import { Cloud, ShieldCheck } from 'lucide-react';
import { MegaBrowser } from '../components/MegaBrowser';
import { useAuth } from '../contexts/AuthContext';

export function DocumentsPage() {
  const { user, activeCompanyId } = useAuth();
  const companyId = user?.role === 'EMPRESA' ? user.companyId : activeCompanyId;

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

      <section className="documents-context-card">
        <div className="documents-context-copy">
          <span className="documents-context-icon"><Cloud size={21} /></span>
          <div>
            <strong>Origem dos arquivos</strong>
            <small>
              O Render não armazena os documentos. Uploads e downloads são feitos diretamente no MEGA e o
              seletor de empresa no topo define o escopo exibido nesta página.
            </small>
          </div>
        </div>
      </section>

      <MegaBrowser companyId={companyId} />
    </div>
  );
}
