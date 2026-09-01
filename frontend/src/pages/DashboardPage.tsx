import { BellRing, Building2, CheckCircle2, History, Gavel } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function DashboardPage() {
  const { user } = useAuth();
  return (
    <div className="page-stack">
      <section className="welcome-card">
        <div>
          <span className="eyebrow">Área de trabalho</span>
          <h2>Bom trabalho, {user?.name.split(' ')[0]}.</h2>
          <p>Empresas, licitações e documentos agora estão reunidos no mesmo controle.</p>
        </div>
        <span className="phase-badge">
          <CheckCircle2 size={17} />
          Fase 3
        </span>
      </section>
      <section className="status-grid">
        <article>
          <span className="status-icon blue">
            <Gavel />
          </span>
          <div>
            <small>Controle geral</small>
            <strong>Licitações centralizadas</strong>
            <p>Busca, filtros, valores, andamento e situação em uma lista única.</p>
          </div>
        </article>
        <article>
          <span className="status-icon green">
            <Building2 />
          </span>
          <div>
            <small>Empresas</small>
            <strong>Dados separados</strong>
            <p>Cada empresa possui sua própria área e seus próprios registros.</p>
          </div>
        </article>
        <article>
          <span className="status-icon amber">
            <BellRing />
          </span>
          <div>
            <small>Prazos</small>
            <strong>Alertas automáticos</strong>
            <p>Sessões e validade de propostas aparecem no sino e na agenda de prazos.</p>
          </div>
        </article>
      </section>
      <section className="info-panel">
        <div>
          <span className="eyebrow">Fase 3 ativa</span>
          <h3>Prazos, notificações e auditoria</h3>
          <p>
            As datas cadastradas agora geram alertas internos e as alterações importantes ficam registradas
            para rastreabilidade.
          </p>
        </div>
        <span className="coming-tag">
          <History size={15} /> Auditoria ativa
        </span>
      </section>
    </div>
  );
}
