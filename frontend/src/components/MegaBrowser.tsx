import {
  Cloud,
  Download,
  File as FileIcon,
  Folder,
  FolderPlus,
  HardDrive,
  Eye,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Upload
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { api, errorMessage } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { ApiResponse, MegaBrowseData, MegaItem, MegaStatus } from '../types';
import { formatBytes, formatDate } from '../utils/bid';
import { DOCUMENT_UPLOAD_ACCEPT, validateDocumentUpload } from '../utils/upload';

type Props = {
  companyId?: string | null;
  compact?: boolean;
};

export function MegaBrowser({ companyId, compact = false }: Props) {
  const { user } = useAuth();
  const [status, setStatus] = useState<MegaStatus | null>(null);
  const [data, setData] = useState<MegaBrowseData | null>(null);
  const [path, setPath] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadStatus = useCallback(async () => {
    const response = await api.get<ApiResponse<MegaStatus>>('/mega/status');
    setStatus(response.data.data);
    return response.data.data;
  }, []);

  const load = useCallback(
    async (nextPath = path, refresh = false) => {
      setLoading(true);
      setError('');
      try {
        const currentStatus = refresh || !status ? await loadStatus() : status;
        if (!currentStatus.configured || !currentStatus.connected) {
          setData(null);
          return;
        }
        const response = await api.get<ApiResponse<MegaBrowseData>>('/mega/browse', {
          params: {
            ...(companyId ? { companyId } : {}),
            path: nextPath,
            ...(refresh ? { refresh: 'true' } : {})
          }
        });
        setData(response.data.data);
        setPath(response.data.data.path);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [companyId, loadStatus, path, status]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPath('');
      setSearch('');
      void load('', false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    if (!query) return data?.items ?? [];
    return (data?.items ?? []).filter((item) => item.name.toLocaleLowerCase('pt-BR').includes(query));
  }, [data, search]);

  const breadcrumbs = useMemo(() => {
    const parts = path.split('/').filter(Boolean);
    return [
      { label: data?.scopeLabel || 'MEGA', path: '' },
      ...parts.map((part, index) => ({ label: part, path: parts.slice(0, index + 1).join('/') }))
    ];
  }, [data?.scopeLabel, path]);

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      await load(path, true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const createFolder = () => {
    const name = window.prompt('Nome da nova pasta:')?.trim();
    if (!name) return;
    void runAction(async () => {
      await api.post('/mega/folders', { companyId: companyId || undefined, path, name });
      setMessage('Pasta criada no MEGA.');
    });
  };

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;
    const invalid = files.map((file) => ({ file, error: validateDocumentUpload(file) })).find((item) => item.error);
    if (invalid) {
      setMessage('');
      setError(`${invalid.file.name}: ${invalid.error}`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      for (const file of files) {
        const form = new FormData();
        form.append('file', file);
        form.append('path', path);
        if (companyId) form.append('companyId', companyId);
        await api.post('/mega/upload', form);
      }
      setMessage(files.length === 1 ? 'Arquivo enviado ao MEGA.' : `${files.length} arquivos enviados ao MEGA.`);
      await load(path, true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const rename = (item: MegaItem) => {
    const name = window.prompt('Novo nome:', item.name)?.trim();
    if (!name || name === item.name) return;
    void runAction(async () => {
      await api.patch(`/mega/nodes/${item.id}`, { companyId: companyId || undefined, name });
      setMessage('Item renomeado.');
    });
  };

  const remove = (item: MegaItem) => {
    if (!window.confirm(`Mover “${item.name}” para a lixeira do MEGA?`)) return;
    void runAction(async () => {
      await api.delete(`/mega/nodes/${item.id}`, { params: companyId ? { companyId } : {} });
      setMessage('Item movido para a lixeira do MEGA.');
    });
  };

  const download = async (item: MegaItem) => {
    setBusy(true);
    setError('');
    try {
      const response = await api.get(`/mega/nodes/${item.id}/download`, {
        params: companyId ? { companyId } : {},
        responseType: 'blob'
      });
      const url = URL.createObjectURL(response.data as Blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = item.name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };


  const canPreview = (item: MegaItem) => /\.(pdf|png|jpe?g)$/i.test(item.name);

  const preview = async (item: MegaItem) => {
    setBusy(true);
    setError('');
    try {
      const response = await api.get(`/mega/nodes/${item.id}/preview`, {
        params: companyId ? { companyId } : {},
        responseType: 'blob'
      });
      const url = URL.createObjectURL(response.data as Blob);
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (!opened) {
        URL.revokeObjectURL(url);
        throw new Error('O navegador bloqueou a abertura da pré-visualização. Permita pop-ups para este site.');
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void uploadFiles(Array.from(event.dataTransfer.files));
  };

  if (loading && !status && !data) {
    return (
      <div className="mega-loading">
        <span className="spinner" />
        Conectando ao MEGA...
      </div>
    );
  }

  if (status && (!status.configured || !status.connected)) {
    return (
      <section className="mega-setup-card">
        <div className="mega-setup-icon"><Cloud size={30} /></div>
        <div>
          <span className="eyebrow">Armazenamento online</span>
          <h3>{status.configured ? 'Não foi possível conectar ao MEGA' : 'MEGA ainda não configurado'}</h3>
          <p>
            {status.configured
              ? 'Confira as credenciais configuradas no servidor e tente novamente.'
              : 'Configure MEGA_EMAIL e MEGA_PASSWORD nas variáveis de ambiente do Render. Os arquivos não serão gravados no disco temporário do servidor.'}
          </p>
          <button className="secondary-button" onClick={() => void load('', true)}>
            <RefreshCw size={16} /> Tentar novamente
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={`mega-browser ${compact ? 'compact' : ''}`}>
      <div className="mega-toolbar">
        <div className="mega-location">
          <span className="mega-cloud-badge"><Cloud size={17} /> MEGA</span>
          <div className="mega-breadcrumbs">
            {breadcrumbs.map((crumb, index) => (
              <span key={`${crumb.path}:${index}`}>
                {index > 0 && <b>/</b>}
                <button disabled={busy || crumb.path === path} onClick={() => void load(crumb.path)}>
                  {crumb.label}
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="mega-toolbar-actions">
          <button className="secondary-button" disabled={busy} onClick={() => void load(path, true)}>
            <RefreshCw size={15} /> Atualizar
          </button>
          <button className="secondary-button" disabled={busy} onClick={createFolder}>
            <FolderPlus size={15} /> Nova pasta
          </button>
          <button className="primary-button" disabled={busy} onClick={() => fileInputRef.current?.click()}>
            <Upload size={15} /> Enviar arquivo
          </button>
          <input
            ref={fileInputRef}
            className="mega-hidden-input"
            type="file"
            multiple
            accept={DOCUMENT_UPLOAD_ACCEPT}
            onChange={(event) => void uploadFiles(Array.from(event.target.files ?? []))}
          />
        </div>
      </div>

      <div className="mega-meta-row">
        <label className="search-field mega-search">
          <Search size={16} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nesta pasta" />
        </label>
        {status?.spaceUsed != null && status.spaceTotal != null && (
          <span className="mega-quota">
            <HardDrive size={15} /> {formatBytes(status.spaceUsed)} de {formatBytes(status.spaceTotal)} usados
          </span>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div
        className={`mega-dropzone ${dragging ? 'dragging' : ''}`}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {loading && (
          <div className="mega-overlay-loading"><span className="spinner" /> Atualizando arquivos...</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="mega-empty">
            <Folder size={34} />
            <strong>{search ? 'Nenhum resultado' : 'Esta pasta está vazia'}</strong>
            <span>Arraste arquivos para cá ou use “Enviar arquivo”.</span>
          </div>
        )}
        {filtered.length > 0 && (
          <div className="mega-file-list">
            <div className="mega-file-head">
              <span>Nome</span><span>Tamanho</span><span>Atualizado</span><span>Ações</span>
            </div>
            {filtered.map((item) => (
              <article key={item.id} className={item.type === 'folder' ? 'folder-row' : ''}>
                <button
                  className="mega-item-main"
                  onClick={() => item.type === 'folder' && void load(item.path)}
                  title={item.type === 'folder' ? 'Abrir pasta' : item.name}
                >
                  <span className="mega-item-icon">
                    {item.type === 'folder' ? <Folder size={19} /> : <FileIcon size={19} />}
                  </span>
                  <strong>{item.name}</strong>
                </button>
                <span>{item.type === 'folder' ? '—' : formatBytes(item.size)}</span>
                <span>{item.updatedAt ? formatDate(item.updatedAt) : '—'}</span>
                <div className="mega-row-actions">
                  {item.type === 'file' && canPreview(item) && (
                    <button className="icon-action" title="Visualizar" disabled={busy} onClick={() => void preview(item)}>
                      <Eye size={16} />
                    </button>
                  )}
                  {item.type === 'file' && (
                    <button className="icon-action" title="Baixar" disabled={busy} onClick={() => void download(item)}>
                      <Download size={16} />
                    </button>
                  )}
                  {(item.type === 'file' || user?.role === 'ADMIN') && (
                    <button className="icon-action" title="Renomear" disabled={busy} onClick={() => rename(item)}>
                      <Pencil size={15} />
                    </button>
                  )}
                  {(item.type === 'file' || user?.role === 'ADMIN') && (
                    <button className="icon-action danger" title="Mover para lixeira" disabled={busy} onClick={() => remove(item)}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      <small className="mega-safety-note">Exclusões são enviadas para a lixeira do MEGA, não apagadas permanentemente.</small>
    </section>
  );
}
