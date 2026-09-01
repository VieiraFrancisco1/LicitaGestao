import { Edit3, ExternalLink, Plus, RadioTower } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Modal } from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, Platform } from '../types';

type PlatformForm = { name: string; site: string; observations: string; active: boolean };

export function PlatformsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Platform[]>([]);
  const [editing, setEditing] = useState<Platform | null | undefined>(undefined);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const response = await api.get<ApiResponse<Platform[]>>('/platforms');
      setItems(response.data.data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <p>Administração</p>
          <h2>Plataformas de licitação</h2>
          <span>Cadastre os portais utilizados nas disputas.</span>
        </div>
        {user?.role === 'ADMIN' && (
          <button className="primary-button" onClick={() => setEditing(null)}>
            <Plus size={17} />
            Nova plataforma
          </button>
        )}
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <section className="platform-grid">
        {items.length === 0 && (
          <div className="empty-state">
            <RadioTower size={30} />
            <p>Nenhuma plataforma cadastrada.</p>
          </div>
        )}
        {items.map((platform) => (
          <article key={platform.id}>
            <div className="platform-icon">
              <RadioTower />
            </div>
            <div>
              <strong>{platform.name}</strong>
              <small>{platform._count?.tenders ?? 0} licitações vinculadas</small>
              {platform.site && (
                <a href={platform.site} target="_blank" rel="noreferrer">
                  <ExternalLink size={13} />
                  Abrir site
                </a>
              )}
            </div>
            <span className={`status-pill ${platform.active ? 'active' : 'inactive'}`}>
              {platform.active ? 'Ativa' : 'Inativa'}
            </span>
            {user?.role === 'ADMIN' && (
              <button className="action-button" onClick={() => setEditing(platform)}>
                <Edit3 size={15} />
              </button>
            )}
          </article>
        ))}
      </section>
      {editing !== undefined && (
        <PlatformModal
          platform={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            void load();
          }}
        />
      )}
    </div>
  );
}

function PlatformModal({
  platform,
  onClose,
  onSaved
}: {
  platform: Platform | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<PlatformForm>(
    platform
      ? {
          name: platform.name,
          site: platform.site ?? '',
          observations: platform.observations ?? '',
          active: platform.active
        }
      : { name: '', site: '', observations: '', active: true }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (platform) await api.put(`/platforms/${platform.id}`, form);
      else await api.post('/platforms', form);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={platform ? 'Editar plataforma' : 'Nova plataforma'} onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        {error && <div className="alert alert-error full">{error}</div>}
        <label>
          Nome
          <input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
          />
        </label>
        <label>
          Site
          <input
            type="url"
            value={form.site}
            onChange={(event) => setForm({ ...form, site: event.target.value })}
            placeholder="https://"
          />
        </label>
        <label className="full">
          Observações
          <textarea
            rows={3}
            value={form.observations}
            onChange={(event) => setForm({ ...form, observations: event.target.value })}
          />
        </label>
        {platform && (
          <label className="check-field full">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm({ ...form, active: event.target.checked })}
            />
            Plataforma ativa
          </label>
        )}
        <div className="form-actions full">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar plataforma'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
