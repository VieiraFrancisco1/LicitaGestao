import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, AuditAction, AuditLog, Paginated } from '../types';

const actionLabels: Record<AuditAction, string> = {
  CREATE: 'Criação',
  UPDATE: 'Edição',
  DELETE: 'Exclusão',
  STATUS_CHANGE: 'Mudança de status',
  UPLOAD: 'Envio de arquivo'
};

const entityLabels: Record<string, string> = {
  TENDER: 'Licitação',
  BID: 'Participação',
  COMPANY: 'Empresa',
  PLATFORM: 'Plataforma',
  USER: 'Usuário',
  DOCUMENT: 'Documento',
  DISCOUNT: 'Baixa'
};

export function AuditPage() {
  const [data, setData] = useState<Paginated<AuditLog> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [action, setAction] = useState<'' | AuditAction>('');

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '100' });
      if (search.trim()) params.set('search', search.trim());
      if (action) params.set('action', action);
      const response = await api.get<ApiResponse<Paginated<AuditLog>>>(`/audit?${params.toString()}`);
      setData(response.data.data);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const params = new URLSearchParams({ page: '1', pageSize: '100' });
        if (action) params.set('action', action);
        const response = await api.get<ApiResponse<Paginated<AuditLog>>>(`/audit?${params.toString()}`);
        if (active) {
          setData(response.data.data);
          setError('');
        }
      } catch (err) {
        if (active) setError(errorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [action]);

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <p>Segurança e rastreabilidade</p>
          <h2>Auditoria</h2>
          <span>Histórico das alterações importantes realizadas pelos usuários do sistema.</span>
        </div>
      </div>

      <section className="table-card audit-panel">
        <div className="audit-filters">
          <label className="audit-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && void load()}
              placeholder="Buscar usuário, registro ou descrição"
            />
          </label>
          <select value={action} onChange={(event) => setAction(event.target.value as typeof action)}>
            <option value="">Todas as ações</option>
            {Object.entries(actionLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
          <button className="secondary-button" onClick={() => void load()}>
            Buscar
          </button>
        </div>

        {loading ? (
          <div className="empty-state">Carregando auditoria...</div>
        ) : error ? (
          <div className="error-box">{error}</div>
        ) : (
          <div className="table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Data e hora</th>
                  <th>Usuário</th>
                  <th>Ação</th>
                  <th>Registro</th>
                  <th>Descrição</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.length ? (
                  data.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{new Date(item.createdAt).toLocaleDateString('pt-BR')}</strong>
                        <small>
                          {new Date(item.createdAt).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </small>
                      </td>
                      <td>
                        <strong>{item.actor?.name || 'Usuário removido'}</strong>
                        <small>{item.actor?.email || '—'}</small>
                      </td>
                      <td>
                        <span className={`audit-action ${item.action.toLowerCase()}`}>
                          {actionLabels[item.action]}
                        </span>
                      </td>
                      <td>
                        <strong>{entityLabels[item.entityType] || item.entityType}</strong>
                        <small>{item.entityLabel || item.entityId || '—'}</small>
                      </td>
                      <td>{item.description}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>
                      <div className="empty-state">Nenhum registro de auditoria encontrado.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
