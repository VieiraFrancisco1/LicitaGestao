import { Building2, Edit3, FolderOpen, Plus, Search } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, Company, Paginated } from '../types';

type CompanyForm = {
  legalName: string;
  tradeName: string;
  cnpj: string;
  email: string;
  phone: string;
  contactName: string;
  observations: string;
  active: boolean;
};

const emptyForm: CompanyForm = {
  legalName: '',
  tradeName: '',
  cnpj: '',
  email: '',
  phone: '',
  contactName: '',
  observations: '',
  active: true
};
const formatCnpj = (value: string) =>
  value
    .replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .slice(0, 18);

export function CompaniesPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Paginated<Company> | null>(null);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState<Company | null | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<ApiResponse<Paginated<Company>>>('/companies', {
        params: { search: search || undefined, active: active || undefined, page, pageSize: 10 }
      });
      setData(response.data.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, active, page]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);
  const notify = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(''), 3500);
  };

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <p>Cadastros</p>
          <h2>Empresas clientes</h2>
          <span>Gerencie os dados e os acessos vinculados a cada empresa.</span>
        </div>
        {user?.role === 'ADMIN' && (
          <button className="primary-button" onClick={() => setEditing(null)}>
            <Plus size={18} />
            Nova empresa
          </button>
        )}
      </div>
      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-error">{error}</div>}
      <section className="table-card">
        <div className="table-toolbar">
          <label className="search-field">
            <Search size={18} />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por empresa ou CNPJ"
            />
          </label>
          <select
            value={active}
            onChange={(e) => {
              setActive(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos os status</option>
            <option value="true">Ativas</option>
            <option value="false">Inativas</option>
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>CNPJ</th>
                <th>Responsável</th>
                <th>Usuários</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="table-message">
                    Carregando empresas...
                  </td>
                </tr>
              )}
              {!loading && !data?.items.length && (
                <tr>
                  <td colSpan={6} className="table-message">
                    <Building2 size={28} />
                    Nenhuma empresa encontrada.
                  </td>
                </tr>
              )}
              {!loading &&
                data?.items.map((company) => (
                  <tr key={company.id}>
                    <td>
                      <strong>{company.legalName}</strong>
                      <small>{company.tradeName || 'Sem nome fantasia'}</small>
                    </td>
                    <td>{formatCnpj(company.cnpj)}</td>
                    <td>{company.contactName || '—'}</td>
                    <td>{company._count?.users ?? 0}</td>
                    <td>
                      <span className={`status-pill ${company.active ? 'active' : 'inactive'}`}>
                        {company.active ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <Link className="action-button" to={`/empresas/${company.id}`}>
                          <FolderOpen size={16} />
                          Abrir
                        </Link>
                        {user?.role === 'ADMIN' && (
                          <button className="action-button" onClick={() => setEditing(company)}>
                            <Edit3 size={16} />
                            Editar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {data && data.pages > 1 && (
          <div className="pagination">
            <span>{data.total} empresas</span>
            <div>
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </button>
              <span>
                {page} de {data.pages}
              </span>
              <button disabled={page === data.pages} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </button>
            </div>
          </div>
        )}
      </section>
      {editing !== undefined && (
        <CompanyModal
          company={editing}
          onClose={() => setEditing(undefined)}
          onSaved={(message) => {
            setEditing(undefined);
            notify(message);
            void load();
          }}
        />
      )}
    </div>
  );
}

function CompanyModal({
  company,
  onClose,
  onSaved
}: {
  company: Company | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState<CompanyForm>(
    company
      ? {
          legalName: company.legalName,
          tradeName: company.tradeName ?? '',
          cnpj: formatCnpj(company.cnpj),
          email: company.email ?? '',
          phone: company.phone ?? '',
          contactName: company.contactName ?? '',
          observations: company.observations ?? '',
          active: company.active
        }
      : emptyForm
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const field = (key: keyof CompanyForm, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (company) await api.put(`/companies/${company.id}`, form);
      else await api.post('/companies', form);
      onSaved(company ? 'Empresa atualizada com sucesso.' : 'Empresa cadastrada com sucesso.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={company ? 'Editar empresa' : 'Nova empresa'} onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        {error && <div className="alert alert-error full">{error}</div>}
        <label className="full">
          Razão social
          <input value={form.legalName} onChange={(e) => field('legalName', e.target.value)} required />
        </label>
        <label>
          Nome fantasia
          <input value={form.tradeName} onChange={(e) => field('tradeName', e.target.value)} />
        </label>
        <label>
          CNPJ
          <input
            value={form.cnpj}
            onChange={(e) => field('cnpj', formatCnpj(e.target.value))}
            required
            placeholder="00.000.000/0000-00"
          />
        </label>
        <label>
          E-mail
          <input type="email" value={form.email} onChange={(e) => field('email', e.target.value)} />
        </label>
        <label>
          Telefone
          <input value={form.phone} onChange={(e) => field('phone', e.target.value)} />
        </label>
        <label className="full">
          Responsável
          <input value={form.contactName} onChange={(e) => field('contactName', e.target.value)} />
        </label>
        <label className="full">
          Observações
          <textarea
            rows={3}
            value={form.observations}
            onChange={(e) => field('observations', e.target.value)}
          />
        </label>
        {company && (
          <label className="check-field full">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => field('active', e.target.checked)}
            />
            Empresa ativa
          </label>
        )}
        <div className="form-actions full">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar empresa'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
