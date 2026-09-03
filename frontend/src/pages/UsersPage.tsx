import { Edit3, Plus, Search, UserRound } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Modal } from '../components/Modal';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, CompanySummary, Paginated, User, UserRole } from '../types';

type UserForm = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  companyId: string;
  companyIds: string[];
  active: boolean;
};
const roles: { value: UserRole; label: string }[] = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'FUNCIONARIO', label: 'Funcionário' },
  { value: 'EMPRESA', label: 'Empresa' }
];
const roleLabel = (role: UserRole) => roles.find((item) => item.value === role)?.label ?? role;

export function UsersPage() {
  const [data, setData] = useState<Paginated<User> | null>(null);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState<User | null | undefined>(undefined);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<ApiResponse<Paginated<User>>>('/users', {
        params: { search: search || undefined, role: role || undefined, pageSize: 50 }
      });
      setData(response.data.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, role]);
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
          <p>Administração</p>
          <h2>Usuários e permissões</h2>
          <span>Defina quem entra no sistema e o nível de acesso de cada pessoa.</span>
        </div>
        <button className="primary-button" onClick={() => setEditing(null)}>
          <Plus size={18} />
          Novo usuário
        </button>
      </div>
      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-error">{error}</div>}
      <section className="table-card">
        <div className="table-toolbar">
          <label className="search-field">
            <Search size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou e-mail"
            />
          </label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Todos os perfis</option>
            {roles.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Perfil</th>
                <th>Empresa vinculada</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="table-message">
                    Carregando usuários...
                  </td>
                </tr>
              )}
              {!loading && !data?.items.length && (
                <tr>
                  <td colSpan={5} className="table-message">
                    <UserRound size={28} />
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
              {!loading &&
                data?.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      <small>{item.email}</small>
                    </td>
                    <td>
                      <span className="role-pill">{roleLabel(item.role)}</span>
                    </td>
                    <td>
                      {item.role === 'FUNCIONARIO'
                        ? item.assignedCompanies
                            .map((company) => company.tradeName || company.legalName)
                            .join(', ') || '—'
                        : item.company?.tradeName || item.company?.legalName || '—'}
                    </td>
                    <td>
                      <span className={`status-pill ${item.active ? 'active' : 'inactive'}`}>
                        {item.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>
                      <button className="action-button" onClick={() => setEditing(item)}>
                        <Edit3 size={16} />
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
      {editing !== undefined && (
        <UserModal
          user={editing}
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

function UserModal({
  user,
  onClose,
  onSaved
}: {
  user: User | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState<UserForm>(
    user
      ? {
          name: user.name,
          email: user.email,
          password: '',
          role: user.role,
          companyId: user.companyId ?? '',
          companyIds: user.assignedCompanies.map((company) => company.id),
          active: user.active
        }
      : {
          name: '',
          email: '',
          password: '',
          role: 'FUNCIONARIO',
          companyId: '',
          companyIds: [],
          active: true
        }
  );
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (form.role === 'EMPRESA' || form.role === 'FUNCIONARIO')
      void api
        .get<ApiResponse<CompanySummary[]>>('/companies/options')
        .then((response) => setCompanies(response.data.data))
        .catch(() => setError('Não foi possível carregar as empresas.'));
  }, [form.role]);
  const field = (key: keyof UserForm, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      companyId: form.role === 'EMPRESA' ? form.companyId : null,
      companyIds: form.role === 'FUNCIONARIO' ? form.companyIds : [],
      ...(!form.password ? { password: undefined } : {})
    };
    try {
      if (user) await api.put(`/users/${user.id}`, payload);
      else await api.post('/users', payload);
      onSaved(user ? 'Usuário atualizado com sucesso.' : 'Usuário cadastrado com sucesso.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={user ? 'Editar usuário' : 'Novo usuário'} onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        {error && <div className="alert alert-error full">{error}</div>}
        <label>
          Nome
          <input value={form.name} onChange={(e) => field('name', e.target.value)} required />
        </label>
        <label>
          E-mail
          <input type="email" value={form.email} onChange={(e) => field('email', e.target.value)} required />
        </label>
        <label>
          Perfil
          <select
            value={form.role}
            onChange={(e) => {
              const nextRole = e.target.value as UserRole;
              setForm((current) => ({
                ...current,
                role: nextRole,
                companyId: nextRole === 'EMPRESA' ? current.companyId : '',
                companyIds: nextRole === 'FUNCIONARIO' ? current.companyIds : []
              }));
            }}
          >
            {roles.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {form.role === 'EMPRESA' && (
          <label>
            Empresa
            <select value={form.companyId} onChange={(e) => field('companyId', e.target.value)} required>
              <option value="">Selecione</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.tradeName || company.legalName}
                </option>
              ))}
            </select>
          </label>
        )}
        {form.role === 'FUNCIONARIO' && (
          <fieldset className="company-checklist full">
            <legend>Empresas atendidas</legend>
            <p>Marque as empresas que este funcionário poderá administrar.</p>
            <div>
              {companies.map((company) => (
                <label key={company.id}>
                  <input
                    type="checkbox"
                    checked={form.companyIds.includes(company.id)}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        companyIds: event.target.checked
                          ? [...current.companyIds, company.id]
                          : current.companyIds.filter((id) => id !== company.id)
                      }))
                    }
                  />
                  <span>{company.tradeName || company.legalName}</span>
                </label>
              ))}
              {companies.length === 0 && <span>Nenhuma empresa ativa cadastrada.</span>}
            </div>
          </fieldset>
        )}
        <label className={form.role !== 'EMPRESA' ? '' : 'full'}>
          {user ? 'Nova senha (opcional)' : 'Senha'}
          <input
            type="password"
            value={form.password}
            onChange={(e) => field('password', e.target.value)}
            required={!user}
            minLength={form.password ? 12 : undefined}
            autoComplete="new-password"
          />
          <small className="field-help">Mínimo de 12 caracteres.</small>
        </label>
        {user && (
          <label className="check-field full">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => field('active', e.target.checked)}
            />
            Usuário ativo
          </label>
        )}
        <div className="form-actions full">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar usuário'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
