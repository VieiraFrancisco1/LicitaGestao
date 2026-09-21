import {
  BellRing,
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  Edit3,
  Gavel,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  Star,
  Trash2,
  TriangleAlert,
  X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import { api, errorMessage } from '../services/api';
import type {
  AgendaItem,
  ApiResponse,
  CompanyChatData,
  DashboardData,
  Paginated,
  Tender,
  TenderPriorityItem
} from '../types';
import { optionLabel, progressOptions, situationLabel } from '../utils/bid';

function relative(days?: number) {
  if (days === undefined) return '';
  if (days < 0) return `Vencido há ${Math.abs(days)} dia${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Amanhã';
  return `Em ${days} dias`;
}

const chatRoleLabel = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Administrador',
  FUNCIONARIO: 'Usuário',
  EMPRESA: 'Empresa'
} as const;

const priorityLabel: Record<TenderPriorityItem['status'], string> = {
  PENDENTE: 'Pendente',
  ANEXADA: 'Anexada',
  INICIADA: 'Iniciada',
  SUSPENSA: 'Suspensa',
  CONVOCADA: 'Convocada',
  RECURSO: 'Recurso'
};

function toLocalInput(value?: string) {
  const date = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function DashboardPage() {
  const { user, activeCompanyId, setActiveCompanyId } = useAuth();
  const initialCompanyId =
    user?.role === 'EMPRESA'
      ? user.companyId
      : activeCompanyId || (user?.role === 'FUNCIONARIO' ? user.assignedCompanies.find((item) => item.active)?.id : null);
  const [companyId, setCompanyId] = useState<string | null>(initialCompanyId ?? null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [priorities, setPriorities] = useState<TenderPriorityItem[]>([]);
  const [chat, setChat] = useState<CompanyChatData | null>(null);
  const [companyTenders, setCompanyTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [error, setError] = useState('');
  const [priorityModalOpen, setPriorityModalOpen] = useState(false);
  const [agendaModalOpen, setAgendaModalOpen] = useState(false);
  const [editingAgenda, setEditingAgenda] = useState<AgendaItem | null>(null);
  const [chatText, setChatText] = useState('');
  const [chatMentions, setChatMentions] = useState<string[]>([]);
  const [deletingChatId, setDeletingChatId] = useState('');
  const chatMessagesRef = useRef<HTMLDivElement | null>(null);
  const [sendingChat, setSendingChat] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<ApiResponse<DashboardData>>('/dashboard', {
        params: companyId ? { companyId } : undefined,
        timeout: 20_000
      });
      setData(response.data.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const loadWorkspace = useCallback(async () => {
    if (!companyId) {
      setAgenda([]);
      setPriorities([]);
      setCompanyTenders([]);
      return;
    }
    setWorkspaceLoading(true);
    try {
      const [agendaResponse, priorityResponse, tendersResponse] = await Promise.all([
        api.get<ApiResponse<AgendaItem[]>>(`/workspace/${companyId}/agenda`),
        api.get<ApiResponse<TenderPriorityItem[]>>(`/workspace/${companyId}/priorities`),
        api.get<ApiResponse<Paginated<Tender>>>('/tenders', {
          params: { companyId, page: 1, pageSize: 100, sort: 'sessionDate', direction: 'asc' }
        })
      ]);
      setAgenda(agendaResponse.data.data);
      setPriorities(priorityResponse.data.data);
      setCompanyTenders(tendersResponse.data.data.items);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWorkspaceLoading(false);
    }
  }, [companyId]);

  const loadChat = useCallback(async () => {
    if (user?.role === 'EMPRESA') {
      setChat(null);
      return;
    }
    try {
      const response = await api.get<ApiResponse<CompanyChatData>>('/workspace/chat');
      setChat(response.data.data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [user?.role]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadWorkspace(), 0);
    return () => window.clearTimeout(timer);
  }, [loadWorkspace]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadChat(), 0);
    return () => window.clearTimeout(timer);
  }, [loadChat]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadChat();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [loadChat]);

  useEffect(() => {
    const container = chatMessagesRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [chat?.messages.length]);

  const selectedName = useMemo(
    () =>
      data?.companies.find((company) => company.id === companyId)?.tradeName ||
      data?.companies.find((company) => company.id === companyId)?.legalName ||
      (user?.role === 'EMPRESA' ? user.company?.tradeName || user.company?.legalName : undefined),
    [data, companyId, user]
  );

  const selectCompany = (next: string) => {
    const value = next || null;
    setCompanyId(value);
    setActiveCompanyId(value);
  };

  const addPriority = async (tenderId: string) => {
    if (!companyId) return;
    try {
      await api.post(`/workspace/${companyId}/priorities`, { tenderId });
      await loadWorkspace();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const removePriority = async (tenderId: string) => {
    if (!companyId) return;
    try {
      await api.delete(`/workspace/${companyId}/priorities/${tenderId}`);
      await loadWorkspace();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const sendChat = async (event: FormEvent) => {
    event.preventDefault();
    const content = chatText.trim();
    if (!content || sendingChat) return;

    const mentionUserIds = chatMentions.filter((memberId) => {
      const member = chat?.members.find((item) => item.id === memberId);
      return member ? content.includes(`@${member.name}`) : false;
    });

    setSendingChat(true);
    try {
      const response = await api.post<ApiResponse<CompanyChatData['messages'][number]>>('/workspace/chat', {
        content,
        mentionUserIds
      });
      setChat((current) =>
        current ? { ...current, messages: [...current.messages, response.data.data] } : current
      );
      setChatText('');
      setChatMentions([]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSendingChat(false);
    }
  };

  const deleteChatMessage = async (messageId: string) => {
    if (deletingChatId) return;
    if (!window.confirm('Excluir esta mensagem do chat?')) return;
    setDeletingChatId(messageId);
    setError('');
    try {
      await api.delete(`/workspace/chat/${messageId}`);
      setChat((current) =>
        current
          ? { ...current, messages: current.messages.filter((message) => message.id !== messageId) }
          : current
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDeletingChatId('');
    }
  };

  const mentionQuery = useMemo(() => {
    const match = chatText.match(/(?:^|\s)@([^@\s]*)$/);
    return match?.[1]?.toLocaleLowerCase('pt-BR') ?? null;
  }, [chatText]);

  const mentionOptions =
    mentionQuery === null
      ? []
      : (chat?.members ?? [])
          .filter((member) => member.id !== user?.id)
          .filter((member) => member.name.toLocaleLowerCase('pt-BR').includes(mentionQuery));

  const insertMention = (memberId: string, name: string) => {
    setChatText((current) => current.replace(/(?:^|\s)@([^@\s]*)$/, (match) => {
      const prefix = match.startsWith(' ') ? ' ' : '';
      return `${prefix}@${name} `;
    }));
    setChatMentions((current) => (current.includes(memberId) ? current : [...current, memberId]));
  };

  if (loading && !data) {
    return (
      <div className="app-loader">
        <span className="spinner" />
        Carregando dashboard...
      </div>
    );
  }

  return (
    <div className="page-stack dashboard-page">
      <section className="dashboard-hero">
        <div>
          <span className="eyebrow">Área de trabalho</span>
          <h2>Bom trabalho, {user?.name.split(' ')[0]}.</h2>
          <p>
            {selectedName
              ? `Acompanhamento da empresa ${selectedName}.`
              : 'Acompanhe o que precisa da sua atenção hoje.'}
          </p>
        </div>
        <div className="dashboard-scope-control dashboard-company-selector">
          {user?.role !== 'EMPRESA' && (
            <label>
              <span>Empresa</span>
              <select value={companyId ?? ''} onChange={(event) => selectCompany(event.target.value)}>
                {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && <option value="">Visão geral</option>}
                {(data?.companies ?? user?.assignedCompanies ?? []).map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.tradeName || company.legalName}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button className="secondary-button compact" onClick={() => void Promise.all([load(), loadWorkspace(), loadChat()])} disabled={loading || workspaceLoading}>
            <RefreshCw size={15} /> Atualizar
          </button>
        </div>
      </section>

      {error && <div className="alert alert-error">{error}</div>}

      <section className="dashboard-metrics">
        <Metric icon={<Gavel />} label="Em andamento" value={data?.metrics.activeBids ?? 0} detail="participações ativas" />
        <Metric icon={<CalendarClock />} label="Próximas sessões" value={data?.metrics.upcomingSessions ?? 0} detail="nos próximos 7 dias" />
        <Metric icon={<BellRing />} label="Avisos por e-mail" value={data?.metrics.pendingConvocations ?? 0} detail="pendentes de leitura" />
        <Metric icon={<TriangleAlert />} label="Sessões críticas" value={data?.metrics.criticalDeadlines ?? 0} detail="sessões vencidas ou em até 3 dias" />
      </section>

      <section className="dashboard-top-layout">
        <article className="dashboard-panel dashboard-attention dashboard-priority-panel">
          <div className="dashboard-panel-heading">
            <div>
              <span className="eyebrow">Prioridade</span>
              <h3>Precisa da sua atenção</h3>
            </div>
            {companyId && (
              <button className="secondary-button compact" onClick={() => setPriorityModalOpen(true)}>
                <Star size={15} /> Marcar prioridades
              </button>
            )}
          </div>

          {companyId ? (
            <div className="priority-list">
              {!priorities.length && <div className="dashboard-empty">Nenhuma licitação marcada como prioridade.</div>}
              {priorities.map((item) => (
                <article key={item.id} className={`priority-card priority-${item.status.toLowerCase()}`}>
                  <Link to={item.tender.bids[0]?.id ? `/participacoes/${item.tender.bids[0].id}` : `/licitacoes/${item.tenderId}`}>
                    <span className="priority-date">
                      <strong>{item.tender.sessionDate.slice(8, 10)}</strong>
                      <small>
                        {new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' })
                          .format(new Date(`${item.tender.sessionDate.slice(0, 10)}T00:00:00Z`))
                          .replace('.', '')}
                      </small>
                    </span>
                    <span className="priority-copy">
                      <strong>
                        {item.tender.municipality}
                        {item.tender.noticeNumber ? ` · ${item.tender.noticeNumber}` : ''}
                      </strong>
                      <small>
                        {item.tender.emailMessages[0]?.subject
                          ? `Aviso: ${item.tender.emailMessages[0].subject}`
                          : item.tender.object}
                      </small>
                    </span>
                    <span className={`priority-status status-${item.status.toLowerCase()}`}>
                      {priorityLabel[item.status]}
                    </span>
                  </Link>
                  <button title="Retirar prioridade" onClick={() => void removePriority(item.tenderId)}>
                    <X size={15} />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="attention-list">
              {!data?.attention.length && <div className="dashboard-empty">Nenhum item crítico no momento.</div>}
              {data?.attention.map((item) => (
                <Link
                  key={item.key}
                  className={`attention-row ${item.severity.toLowerCase()}`}
                  to={
                    item.bidId
                      ? `/participacoes/${item.bidId}${item.type === 'CONVOCATION' ? '?tab=convocations' : ''}`
                      : `/empresas/${item.companyId}?tab=convocations`
                  }
                >
                  <span className="attention-indicator" />
                  <span className="attention-copy">
                    <strong>{item.title}</strong>
                    <small>{item.subtitle}</small>
                  </span>
                  <span className="attention-time">{item.type === 'CONVOCATION' ? 'Nova mensagem' : relative(item.days)}</span>
                  <ChevronRight size={17} />
                </Link>
              ))}
            </div>
          )}
        </article>

        <div className="dashboard-right-rail">
          <article className="dashboard-panel dashboard-agenda-panel">
            <div className="dashboard-panel-heading">
              <div>
                <span className="eyebrow">Agenda</span>
                <h3>{companyId ? 'Agenda da empresa' : 'Próximas licitações'}</h3>
              </div>
              {companyId ? (
                <button
                  className="secondary-button compact"
                  onClick={() => {
                    setEditingAgenda(null);
                    setAgendaModalOpen(true);
                  }}
                >
                  <Plus size={15} /> Adicionar
                </button>
              ) : (
                <Link to="/licitacoes">Ver todas</Link>
              )}
            </div>

            {companyId ? (
              <div className="dashboard-compact-list editable-agenda-list">
                {!agenda.length && <div className="dashboard-empty">Agenda livre. Adicione uma licitação, tarefa ou lembrete.</div>}
                {agenda.slice(0, 10).map((item) => (
                  <article key={item.id} className="agenda-editable-row">
                    <span className="dashboard-date-box">
                      <strong>{new Date(item.eventDate).getDate().toString().padStart(2, '0')}</strong>
                      <small>{new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(item.eventDate)).replace('.', '')}</small>
                    </span>
                    <div>
                      <strong>{item.title}</strong>
                      <small>
                        {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.eventDate))}
                        {item.tender ? ` · ${item.tender.municipality}${item.tender.noticeNumber ? ` · ${item.tender.noticeNumber}` : ''}` : ''}
                      </small>
                      {item.notes && <p>{item.notes}</p>}
                    </div>
                    <div className="agenda-row-actions">
                      <button
                        title="Editar"
                        onClick={() => {
                          setEditingAgenda(item);
                          setAgendaModalOpen(true);
                        }}
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        title="Excluir"
                        onClick={() => {
                          if (!window.confirm('Excluir este item da agenda?')) return;
                          void api
                            .delete(`/workspace/${companyId}/agenda/${item.id}`)
                            .then(() => loadWorkspace())
                            .catch((err) => setError(errorMessage(err)));
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="dashboard-compact-list">
                {!data?.upcomingBids.length && <div className="dashboard-empty">Nenhuma sessão futura cadastrada.</div>}
                {data?.upcomingBids.map((bid) => (
                  <Link key={bid.id} to={`/participacoes/${bid.id}`}>
                    <span className="dashboard-date-box">
                      <strong>{bid.sessionDate.slice(8, 10)}</strong>
                      <small>
                        {new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' })
                          .format(new Date(`${bid.sessionDate}T00:00:00Z`))
                          .replace('.', '')}
                      </small>
                    </span>
                    <span>
                      <strong>{bid.municipality}{bid.noticeNumber ? ` · ${bid.noticeNumber}` : ''}</strong>
                      <small>{bid.companyName} · {bid.platformName || 'Sem plataforma'}</small>
                    </span>
                    <em>{optionLabel(progressOptions, bid.progress)}</em>
                  </Link>
                ))}
              </div>
            )}
          </article>

          {chat && (
            <section className="dashboard-panel team-chat-card" id="team-chat">
              <div className="dashboard-panel-heading">
                <div>
                  <span className="eyebrow">Equipe</span>
                  <h3>Chat da equipe</h3>
                  <p>Conversa única da organização. Trocar de empresa não altera o histórico. Use @nome para mencionar alguém.</p>
                </div>
                <MessageCircle size={20} />
              </div>
              <div className="team-chat-messages" ref={chatMessagesRef}>
                {!chat.enabled && (
                  <div className="dashboard-empty">
                    O chat será liberado assim que houver pelo menos dois usuários ativos na equipe da organização.
                  </div>
                )}
                {chat.enabled && !chat.messages.length && <div className="dashboard-empty">Nenhuma mensagem ainda.</div>}
                {chat.enabled && chat.messages.map((message) => (
                  <article key={message.id} className={message.authorId === user?.id ? 'mine' : ''}>
                    <div className="chat-message-heading">
                      <strong>{message.author.name}</strong>
                      <span className="chat-message-meta">
                        <small>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(message.createdAt))}</small>
                        {message.authorId === user?.id && (
                          <button
                            type="button"
                            className="chat-delete-message"
                            title="Excluir minha mensagem"
                            aria-label="Excluir minha mensagem"
                            disabled={deletingChatId === message.id}
                            onClick={() => void deleteChatMessage(message.id)}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </span>
                    </div>
                    <p>{message.content}</p>
                  </article>
                ))}
              </div>
              {chat.enabled && (
                <form className="team-chat-form" onSubmit={(event) => void sendChat(event)}>
                  <div className="chat-input-wrap">
                    <textarea
                      rows={2}
                      value={chatText}
                      onChange={(event) => setChatText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          if (chatText.trim() && !sendingChat) event.currentTarget.form?.requestSubmit();
                        }
                      }}
                      placeholder="Escreva uma mensagem. Digite @ para marcar alguém."
                      maxLength={3000}
                    />
                    {mentionOptions.length > 0 && (
                      <div className="chat-mention-menu">
                        {mentionOptions.map((member) => (
                          <button type="button" key={member.id} onClick={() => insertMention(member.id, member.name)}>
                            <span>{member.name.charAt(0).toUpperCase()}</span>
                            <div><strong>{member.name}</strong><small>{chatRoleLabel[member.role]}</small></div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button className="primary-button compact" disabled={!chatText.trim() || sendingChat}>
                    <Send size={15} /> {sendingChat ? 'Enviando...' : 'Enviar'}
                  </button>
                </form>
              )}
            </section>
          )}
        </div>
      </section>

      <section className="dashboard-grid-secondary">
        <article className="dashboard-panel">
          <div className="dashboard-panel-heading">
            <div><span className="eyebrow">E-mail</span><h3>Avisos recentes</h3></div>
            <Link to="/convocacoes">Ver todos</Link>
          </div>
          <div className="dashboard-compact-list convocations">
            {!data?.recentConvocations.length && <div className="dashboard-empty">Nenhum aviso recente.</div>}
            {data?.recentConvocations.map((item) => (
              <Link
                key={item.messageId}
                to={
                  item.bidId
                    ? `/participacoes/${item.bidId}?tab=convocations`
                    : `/empresas/${item.companyId}?tab=convocations`
                }
              >
                <span className={`dashboard-mail-dot ${item.read ? 'read' : ''}`} />
                <span>
                  <strong>{item.tender?.municipality || item.subject || 'Aviso importante'}</strong>
                  <small>
                    {item.companyName} · {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.receivedAt))}
                  </small>
                </span>
                <em>{item.read ? 'Lida' : 'Pendente'}</em>
              </Link>
            ))}
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="dashboard-panel-heading"><div><span className="eyebrow">Situação</span><h3>Participações</h3></div></div>
          <div className="status-breakdown">
            {!data?.statusBreakdown.length && <div className="dashboard-empty">Sem participações cadastradas.</div>}
            {data?.statusBreakdown.map((item) => (
              <div key={item.situation}><span>{situationLabel(item.situation)}</span><strong>{item.count}</strong></div>
            ))}
          </div>
        </article>
      </section>

      {!companyId && Boolean(data?.companyCards.length) && (
        <section className="dashboard-companies-section">
          <div className="dashboard-section-heading">
            <div>
              <span className="eyebrow">Empresas</span>
              <h3>Visão individual por empresa</h3>
              <p>Selecione uma empresa para abrir o acompanhamento específico.</p>
            </div>
          </div>
          <div className="dashboard-company-cards">
            {data?.companyCards.map((company) => (
              <button key={company.id} onClick={() => selectCompany(company.id)}>
                <span className="company-card-icon"><Building2 size={19} /></span>
                <span className="company-card-copy">
                  <strong>{company.name}</strong>
                  <small>{company.activeBids} em andamento · {company.upcomingSessions} próximas sessões</small>
                </span>
                {company.pendingConvocations > 0 && <em>{company.pendingConvocations} aviso{company.pendingConvocations === 1 ? '' : 's'}</em>}
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
        </section>
      )}

      {priorityModalOpen && companyId && (
        <Modal title="Marcar prioridades" eyebrow={selectedName || 'Empresa'} onClose={() => setPriorityModalOpen(false)}>
          <div className="priority-picker">
            <p>Escolha as licitações que devem ficar destacadas no Dashboard desta empresa.</p>
            {companyTenders.map((tender) => {
              const selected = priorities.some((item) => item.tenderId === tender.id);
              return (
                <button
                  type="button"
                  key={tender.id}
                  className={selected ? 'selected' : ''}
                  onClick={() => void (selected ? removePriority(tender.id) : addPriority(tender.id))}
                >
                  <span>
                    <strong>{tender.municipality}{tender.noticeNumber ? ` · ${tender.noticeNumber}` : ''}</strong>
                    <small>{tender.object}</small>
                  </span>
                  {selected ? <Check size={18} /> : <Star size={18} />}
                </button>
              );
            })}
          </div>
        </Modal>
      )}

      {agendaModalOpen && companyId && (
        <AgendaEditor
          companyId={companyId}
          item={editingAgenda}
          tenders={companyTenders}
          onClose={() => {
            setAgendaModalOpen(false);
            setEditingAgenda(null);
          }}
          onSaved={async () => {
            setAgendaModalOpen(false);
            setEditingAgenda(null);
            await loadWorkspace();
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

function AgendaEditor({
  companyId,
  item,
  tenders,
  onClose,
  onSaved,
  onError
}: {
  companyId: string;
  item: AgendaItem | null;
  tenders: Tender[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [eventDate, setEventDate] = useState(toLocalInput(item?.eventDate));
  const [tenderId, setTenderId] = useState(item?.tenderId ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title,
        notes: notes || null,
        eventDate: new Date(eventDate).toISOString(),
        tenderId: tenderId || null
      };
      if (item) await api.put(`/workspace/${companyId}/agenda/${item.id}`, payload);
      else await api.post(`/workspace/${companyId}/agenda`, payload);
      await onSaved();
    } catch (err) {
      onError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Modal title={item ? 'Editar item da agenda' : 'Adicionar à agenda'} eyebrow="Agenda livre" onClose={onClose}>
      <form className="entity-form agenda-editor-form" onSubmit={(event) => void submit(event)}>
        <label>
          Título
          <input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={180} placeholder="Ex.: Revisar documentação" />
        </label>
        <label>
          Data e horário
          <input type="datetime-local" value={eventDate} onChange={(event) => setEventDate(event.target.value)} required />
        </label>
        <label>
          Licitação vinculada <small>(opcional)</small>
          <select value={tenderId} onChange={(event) => setTenderId(event.target.value)}>
            <option value="">Sem licitação — anotação livre</option>
            {tenders.map((tender) => (
              <option key={tender.id} value={tender.id}>
                {tender.municipality}{tender.noticeNumber ? ` · ${tender.noticeNumber}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          Observação livre
          <textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Escreva o que quiser para lembrar a equipe." />
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cancelar</button>
          <button className="primary-button" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </form>
    </Modal>
  );
}

function Metric({ icon, label, value, detail }: { icon: ReactNode; label: string; value: number; detail: string }) {
  return (
    <article className="dashboard-metric-card">
      <span>{icon}</span>
      <div><small>{label}</small><strong>{value}</strong><em>{detail}</em></div>
    </article>
  );
}
