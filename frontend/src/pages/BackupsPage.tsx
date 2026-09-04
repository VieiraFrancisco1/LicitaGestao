import {
  ArchiveRestore,
  Building2,
  DatabaseBackup,
  Download,
  FileText,
  Gavel,
  Mail,
  ShieldCheck,
  Upload,
  Users
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, BackupRestoreResult, BackupSummary } from '../types';

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Fortaleza'
  }).format(new Date(value));
}

export function BackupsPage() {
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<ApiResponse<BackupSummary>>('/backups/summary');
      setSummary(response.data.data);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const download = async () => {
    setDownloading(true);
    setError('');
    setMessage('');
    try {
      const response = await api.get<Blob>('/backups/download', { responseType: 'blob' });
      const disposition = String(response.headers['content-disposition'] ?? '');
      const filename =
        disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? `licitagestao-backup-${Date.now()}.json`;
      const url = URL.createObjectURL(response.data);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      setMessage('Backup baixado. Guarde o arquivo em um local seguro.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  const restore = async () => {
    if (!file || confirmation.trim().toUpperCase() !== 'RESTAURAR') return;
    setRestoring(true);
    setError('');
    setMessage('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('confirmation', confirmation);
      const response = await api.post<ApiResponse<BackupRestoreResult>>('/backups/restore', form);
      setMessage(
        `Recuperação concluída: ${response.data.data.tenders} licitação(ões), ${response.data.data.bids} participação(ões) e ${response.data.data.documents} documento(s) conferidos.`
      );
      setFile(null);
      setConfirmation('');
      if (fileInput.current) fileInput.current.value = '';
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRestoring(false);
    }
  };

  const cards = [
    { label: 'Empresas', value: summary?.companies ?? 0, icon: Building2 },
    { label: 'Usuários', value: summary?.users ?? 0, icon: Users },
    { label: 'Licitações', value: summary?.tenders ?? 0, icon: Gavel },
    { label: 'Participações', value: summary?.bids ?? 0, icon: ShieldCheck },
    { label: 'Documentos', value: summary?.documents ?? 0, icon: FileText },
    { label: 'Avisos importados', value: summary?.emailMessages ?? 0, icon: Mail }
  ];

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Segurança dos dados</span>
          <h2>Backup e recuperação</h2>
          <p>
            Baixe uma cópia dos dados importantes e use-a para recuperar registros em caso de necessidade.
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <section className="backup-summary-grid">
        {cards.map((card) => (
          <article key={card.label} className="backup-summary-card">
            <card.icon size={20} />
            <span>
              <small>{card.label}</small>
              <strong>{loading ? '—' : card.value}</strong>
            </span>
          </article>
        ))}
      </section>

      <section className="backup-action-grid">
        <article className="backup-panel download-panel">
          <div className="backup-panel-icon">
            <DatabaseBackup size={25} />
          </div>
          <div>
            <span className="eyebrow">Criar cópia</span>
            <h3>Baixar backup agora</h3>
            <p>Gera um arquivo JSON com os dados operacionais atuais do LicitaGestão.</p>
          </div>
          <div className="backup-last-run">
            <small>Último backup registrado</small>
            <strong>
              {summary?.lastBackup
                ? `${formatDateTime(summary.lastBackup.createdAt)} · ${summary.lastBackup.actor?.name || 'Administrador'}`
                : 'Nenhum backup registrado'}
            </strong>
          </div>
          <button className="primary-button" disabled={downloading} onClick={() => void download()}>
            <Download size={17} /> {downloading ? 'Preparando...' : 'Baixar backup'}
          </button>
        </article>

        <article className="backup-panel restore-panel">
          <div className="backup-panel-icon">
            <ArchiveRestore size={25} />
          </div>
          <div>
            <span className="eyebrow">Recuperar dados</span>
            <h3>Restaurar um backup</h3>
            <p>
              A restauração atualiza ou recria os registros do arquivo sem apagar os dados adicionais
              existentes.
            </p>
          </div>
          <label className="backup-file-field">
            <span>Arquivo de backup</span>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <small>{file ? file.name : 'Selecione o arquivo JSON baixado pelo LicitaGestão.'}</small>
          </label>
          <label className="backup-confirm-field">
            <span>Digite RESTAURAR para confirmar</span>
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="RESTAURAR"
            />
          </label>
          <button
            className="secondary-button danger-outline"
            disabled={!file || confirmation.trim().toUpperCase() !== 'RESTAURAR' || restoring}
            onClick={() => void restore()}
          >
            <Upload size={17} /> {restoring ? 'Restaurando...' : 'Restaurar backup'}
          </button>
        </article>
      </section>

      <section className="backup-security-note">
        <ShieldCheck size={20} />
        <div>
          <strong>O arquivo não contém senhas nem tokens de acesso</strong>
          <p>
            Contas de e-mail continuam conectadas no servidor e os arquivos físicos permanecem protegidos no
            MEGA.
          </p>
        </div>
      </section>
    </div>
  );
}
