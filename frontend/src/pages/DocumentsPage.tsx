import { Building2, Cloud, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MegaBrowser } from '../components/MegaBrowser';
import { useAuth } from '../contexts/AuthContext';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, CompanySummary } from '../types';

export function DocumentsPage() {
  const { user, activeCompanyId } = useAuth();
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(
    user?.role === 'EMPRESA' ? user.companyId : activeCompanyId
  );
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (user?.role === 'EMPRESA') {
        setCompanyId(user.companyId);
        return;
      }
      void api
        .get<ApiResponse<CompanySummary[]>>('/companies/options')
        .then((response) => {
          setCompanies(response.data.data);
          if (user?.role === 'FUNCIONARIO') {
            setCompanyId((current) => current ?? activeCompanyId ?? response.data.data[0]?.id ?? null);
          }
        })
        .catch((err) => setError(errorMessage(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeCompanyId, user?.companyId, user?.role]);

  return (
    <div className="page-stack">
      <div className="page-heading documents-heading">
        <div>
          <span className="eyebrow">Armazenamento em nuvem</span>
          <h2>Documentos</h2>
          <p>Gerencie os arquivos do MEGA diretamente pelo LicitaGestão.</p>
        </div>
        <div className="documents-security">
          <ShieldCheck size={18} />
          <span>Arquivos protegidos pelo login do sistema</span>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <section className="documents-context-card">
        <div className="documents-context-copy">
          <span className="documents-context-icon"><Cloud size={21} /></span>
          <div>
            <strong>Origem dos arquivos</strong>
            <small>O Render não armazena os documentos. Uploads e downloads são feitos diretamente no MEGA.</small>
          </div>
        </div>
        {user?.role !== 'EMPRESA' && (
          <label className="documents-company-select">
            <Building2 size={16} />
            <span>Visualizar</span>
            <select value={companyId ?? ''} onChange={(event) => setCompanyId(event.target.value || null)}>
              {user?.role === 'ADMIN' && <option value="">Todos os arquivos da raiz configurada</option>}
              {companies.map((company) => (
                <option key={company.id} value={company.id}>{company.tradeName || company.legalName}</option>
              ))}
            </select>
          </label>
        )}
      </section>

      <MegaBrowser companyId={companyId} />
    </div>
  );
}
