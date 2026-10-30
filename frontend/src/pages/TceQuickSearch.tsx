import { ArrowRight, ExternalLink, FileText, ListPlus, MapPin, Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../services/api';
import type { ApiResponse } from '../types';
import { formatCurrency, formatDate } from '../utils/bid';
import './tce-quick-search.css';

type FoundTender = {
  id: string;
  municipality: string;
  reference: string;
  object: string;
  estimatedValue: number | null;
  sessionDate: string;
  sessionTime: string | null;
  platformName?: string | null;
  sources: Array<{ source: string; url: string }>;
  importedTenderId: string | null;
};
type SearchResult = { items: FoundTender[]; pagesChecked: number; partial: boolean; notice: string };

export function TceQuickSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState('');
  const [queuedIds, setQueuedIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const search = async (event: FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    if (q.length < 3 || loading) return;
    setLoading(true); setError(''); setMessage(''); setResult(null);
    try {
      const response = await api.get<ApiResponse<SearchResult>>('/opportunities/search-tce',
        { params: { q }, timeout: 85000 });
      setResult(response.data.data);
    } catch (err) { setError(errorMessage(err)); }
    finally { setLoading(false); }
  };
  const addToWeekly = async (id: string) => {
    if (working || queuedIds.includes(id)) return;
    setWorking(id); setError(''); setMessage('');
    try {
      await api.post('/weekly-list', { opportunityId: id });
      setQueuedIds((current) => [...current, id]);
      setMessage('Licitação adicionada à Lista Semanal.');
    } catch (err) { setError(errorMessage(err)); }
    finally { setWorking(''); }
  };
  const addToControl = async (id: string) => {
    if (working) return;
    setWorking(id); setError('');
    try {
      const response = await api.get<ApiResponse<Record<string, unknown>>>(`/opportunities/${id}/draft`,
        { timeout: 85000 });
      navigate('/licitacoes/nova', { state: { opportunityDraft: response.data.data } });
    } catch (err) { setError(errorMessage(err)); setWorking(''); }
  };
  return (
    <section className="tce-quick-search" aria-label="Pesquisar licitação no TCE-CE">
      <div className="tce-quick-heading">
        <div><span>CONSULTA DIRETA · TCE-CE</span><h3>Pesquisar licitação</h3>
          <p>Encontre uma obra pelo nome completo da cidade ou número da concorrência, sem sair do LicitaGestão.</p>
        </div>
        <Search size={22}/>
      </div>
      <form className="tce-quick-form" onSubmit={(event) => void search(event)}>
        <input aria-label="Cidade ou número da licitação" value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ex.: Pedra Branca ou 019/2026-CP" maxLength={120} required />
        <button type="submit" className="primary-button" disabled={loading || query.trim().length < 3}>
          <Search size={17}/>{loading ? 'Consultando TCE...' : 'Pesquisar no TCE'}
        </button>
      </form>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {message && <p className="tce-quick-feedback" role="status">{message}</p>}
      {result && <>
        <div className="tce-quick-summary">
          <strong>{result.items.length} licitação(ões) encontrada(s)</strong>
          <small>{result.pagesChecked} página(s) do TCE consultada(s)</small>
        </div>
        {result.partial && <p className="tce-quick-warning">Pesquisa parcial: {result.notice || 'O TCE apresentou resultados além do limite consultado.'} Para confirmar a lista completa, refine a busca.</p>}
        {!result.items.length && <p className="tce-quick-empty">Não encontramos obras correspondentes nas páginas consultadas. Confira a grafia ou o número informado.</p>}
        <div className="tce-quick-results">
          {result.items.map((item) => {
            const sourceUrl = item.sources.find((s) => s.source === 'TCE')?.url;
            return <article key={item.id} className="tce-quick-card">
              <div className="tce-quick-card-top"><strong><MapPin size={14}/> {item.municipality} / CE</strong><span>{item.platformName || 'Plataforma não identificada'}</span></div>
              <h4>{item.object}</h4>
              <div className="tce-quick-facts">
                <span><small>Concorrência</small><strong>{item.reference || 'Não informada'}</strong></span>
                <span><small>Sessão</small><strong>{formatDate(item.sessionDate)}{item.sessionTime ? ` · ${item.sessionTime}` : ''}</strong></span>
                <span><small>Valor estimado</small><strong>{item.estimatedValue == null ? 'Não informado' : formatCurrency(String(item.estimatedValue))}</strong></span>
              </div>
              <div className="tce-quick-actions">
                {item.importedTenderId
                  ? <Link className="primary-button compact" to={`/licitacoes/${item.importedTenderId}`}>Abrir no Controle Geral <ArrowRight size={14}/></Link>
                  : <button className="primary-button compact" disabled={Boolean(working)} onClick={() => void addToControl(item.id)}><FileText size={15}/>{working === item.id ? 'Lendo detalhes...' : 'Adicionar licitação'}</button>}
                <button type="button" className="secondary-button compact" disabled={Boolean(working) || queuedIds.includes(item.id)} onClick={() => void addToWeekly(item.id)}>
                  <ListPlus size={15}/>{queuedIds.includes(item.id) ? 'Na lista semanal' : 'Enviar à lista semanal'}</button>
                {sourceUrl && <a href={sourceUrl} className="secondary-button compact" target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> Fonte TCE-CE</a>}
              </div>
            </article>;
          })}
        </div>
      </>}
    </section>
  );
}
