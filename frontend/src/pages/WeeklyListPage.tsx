import { ArrowLeft, ArrowRight, CalendarDays, ExternalLink, FileText, FolderOpen, ListChecks, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../services/api';
import type { ApiResponse } from '../types';
import { formatCurrency, formatDate } from '../utils/bid';
import './weekly-list.css';

type WeeklyOpportunity = {
  municipality: string;
  reference: string;
  object: string;
  estimatedValue: number | null;
  sessionDate: string;
  sessionTime?: string | null;
  platformName?: string | null;
  platformUrl?: string | null;
  sources?: Array<{ source: string; url: string }>;
  documents?: Array<{ title: string; url: string; type: string }>;
  importedTenderId: string | null;
  active: boolean;
};
type WeeklyItem = {
  id: string;
  opportunityId: string;
  createdAt: string;
  opportunity: WeeklyOpportunity;
};

export function WeeklyListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<WeeklyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string[]>([]);

  useEffect(() => {
    let live = true;
    void api.get<ApiResponse<WeeklyItem[]>>('/weekly-list')
      .then(({ data }) => { if (live) setItems(data.data); })
      .catch((err) => { if (live) setError(errorMessage(err)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  const remove = async (item: WeeklyItem) => {
    if (!window.confirm(`Retirar a licitação de ${item.opportunity.municipality} da lista semanal?`)) return;
    setWorking(item.id); setError('');
    try {
      await api.delete(`/weekly-list/${item.id}`);
      setItems((current) => current.filter((x) => x.id !== item.id));
    } catch (err) { setError(errorMessage(err)); }
    finally { setWorking(''); }
  };

  const clear = async () => {
    if (!items.length || !window.confirm(`Limpar os ${items.length} itens da lista semanal? Isso NÃO excluirá licitações do Controle Geral.`)) return;
    setWorking('all'); setError('');
    try { await api.delete('/weekly-list'); setItems([]); }
    catch (err) { setError(errorMessage(err)); }
    finally { setWorking(''); }
  };

  const addToControl = async (item: WeeklyItem) => {
    setWorking(item.id); setError('');
    try {
      const response = await api.get<ApiResponse<Record<string, unknown>>>(`/opportunities/${item.opportunityId}/draft`, { timeout: 125000 });
      navigate('/licitacoes/nova', { state: { opportunityDraft: response.data.data } });
    } catch (err) { setError(errorMessage(err)); setWorking(''); }
  };

  const toggle = (id: string) => setExpanded((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);

  return <div className="page-stack weekly-list-page">
    <div className="page-heading weekly-list-heading">
      <div><p>Seleção do Agente de Monitoramento</p><h2>Lista semanal</h2><span>Oportunidades separadas para avaliação. A lista só é esvaziada quando você decidir.</span></div>
      <div className="weekly-heading-actions">
        <Link className="secondary-button" to="/licitacoes"><ArrowLeft size={16} /> Licitações</Link>
        <button type="button" className="secondary-button" disabled={!items.length || Boolean(working)} onClick={() => void clear()}><Trash2 size={16} /> Limpar lista inteira</button>
      </div>
    </div>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    <div className="weekly-summary"><ListChecks size={19}/><strong>{items.length}</strong><span>licitação(ões) na lista semanal</span></div>
    {loading && <div className="weekly-empty">Carregando lista semanal...</div>}
    {!loading && items.length === 0 && <div className="weekly-empty"><ListChecks size={34}/><h3>Sua lista semanal está vazia</h3><p>Abra o Agente de Monitoramento e clique em Enviar para lista na licitação desejada.</p><Link className="primary-button compact" to="/oportunidades">Abrir agente <ArrowRight size={15}/></Link></div>}
    <div className="weekly-list-items">
      {items.map((item) => {
        const o = item.opportunity;
        const open = expanded.includes(item.id);
        return <article className="weekly-item" key={item.id}>
          <div className="weekly-item-header">
            <div><span className="weekly-item-location">{o.municipality} / CE</span><h3>{o.object}</h3><small>Edital: {o.reference || 'Não informado'} · Adicionada em {new Date(item.createdAt).toLocaleDateString('pt-BR')}</small></div>
            {o.importedTenderId && <span className="weekly-item-imported">No Controle Geral</span>}
          </div>
          <div className="weekly-item-metadata">
            <div><small>Valor estimado</small><strong>{o.estimatedValue === null ? 'Não informado' : formatCurrency(String(o.estimatedValue))}</strong></div>
            <div><small>Sessão</small><strong>{formatDate(o.sessionDate)}{o.sessionTime ? ` · ${o.sessionTime}` : ''}</strong></div>
            <div><small>Plataforma</small><strong>{o.platformName?.trim() || 'Não identificada'}</strong></div>
          </div>
          <div className="weekly-item-actions">
            {o.importedTenderId
              ? <Link className="primary-button compact" to={`/licitacoes/${o.importedTenderId}`}><FolderOpen size={15}/> Abrir em Licitações</Link>
              : <button type="button" className="primary-button compact" disabled={!o.active || Boolean(working)} title={!o.active ? 'Oportunidade encerrada: confira a publicação original antes de cadastrar' : undefined} onClick={() => void addToControl(item)}><FileText size={15}/> {!o.active ? 'Oportunidade encerrada' : working === item.id ? 'Lendo edital...' : 'Adicionar em Licitações'}</button>}
            <button type="button" className="secondary-button compact" onClick={() => toggle(item.id)} aria-expanded={open}><CalendarDays size={15}/> {open ? 'Ocultar links' : 'Arquivos e links'}</button>
            <button type="button" className="secondary-button compact weekly-remove" disabled={Boolean(working)} onClick={() => void remove(item)}><Trash2 size={15}/> Excluir da lista</button>
          </div>
          {open && <div className="weekly-links">
            {(o.documents ?? []).map((doc) => <a key={doc.url} href={doc.url} target="_blank" rel="noopener noreferrer"><FileText size={15}/>{doc.title}<ExternalLink size={14}/></a>)}
            {o.platformUrl && <a href={o.platformUrl} target="_blank" rel="noopener noreferrer">Acessar {o.platformName?.trim() || 'plataforma'} <ExternalLink size={14}/></a>}
            {(o.sources ?? []).map((s) => <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">Fonte {s.source} <ExternalLink size={14}/></a>)}
            {!o.documents?.length && <small>Não há arquivos catalogados. Confira os links oficiais da licitação.</small>}
          </div>}
        </article>;
      })}
    </div>
  </div>;
}
