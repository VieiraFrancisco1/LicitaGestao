export type UserRole = 'ADMIN' | 'FUNCIONARIO' | 'EMPRESA';

export type CompanySummary = { id: string; legalName: string; tradeName: string | null };
export type AssignedCompany = CompanySummary & { active: boolean };

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  companyId: string | null;
  company: CompanySummary | null;
  assignedCompanies: AssignedCompany[];
  createdAt: string;
  updatedAt: string;
};

export type Company = {
  id: string;
  legalName: string;
  tradeName: string | null;
  cnpj: string;
  email: string | null;
  phone: string | null;
  contactName: string | null;
  observations: string | null;
  megaFolderPath: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { users: number; staffLinks?: number; bids?: number };
};

export type BidProgress =
  | 'NAO_INICIADA'
  | 'EM_ANALISE'
  | 'EM_ANDAMENTO'
  | 'FEITA'
  | 'AGUARDANDO_SESSAO'
  | 'EM_DISPUTA'
  | 'HABILITACAO'
  | 'RECURSO'
  | 'FINALIZADA';

export type BidSituation =
  | 'PENDENTE'
  | 'ANEXADA'
  | 'CLASSIFICADA'
  | 'DESCLASSIFICADA'
  | 'HABILITADA'
  | 'INABILITADA'
  | 'VENCEDORA'
  | 'PERDIDA'
  | 'FINALIZADA';

export type GuaranteeType = 'NAO_EXIGIDA' | 'APOLICE' | 'PROPOSTA_INICIAL' | 'FIANCA' | 'CAUCAO' | 'OUTRO';

export type Platform = {
  id: string;
  name: string;
  site: string | null;
  observations: string | null;
  megaFolderPath: string | null;
  active: boolean;
  _count?: { tenders: number };
};

export type TenderParticipation = {
  id: string;
  companyId: string;
  company: Company;
  proposalValue: string | null;
  progress: BidProgress;
  situation: BidSituation;
  observations: string | null;
  _count?: { documents: number };
};

export type Tender = {
  id: string;
  modality: string | null;
  noticeNumber: string | null;
  processNumber: string | null;
  executionTerm: string | null;
  municipality: string;
  state: string | null;
  agency: string | null;
  sessionDate: string;
  sessionTime: string | null;
  object: string;
  proposalValidityDays: number | null;
  proposalExpirationDate: string | null;
  estimatedValue: string | null;
  guaranteeType: GuaranteeType;
  guaranteePercentage: string | null;
  guaranteeValue: string | null;
  platformId: string | null;
  platform: Platform | null;
  platformLink: string | null;
  seobraLink: string | null;
  spreadsheetReady: boolean;
  spreadsheetResponsibleUserId: string | null;
  spreadsheetResponsibleUser: { id: string; name: string; email: string } | null;
  spreadsheetNotes: string | null;
  spreadsheetNotesUpdatedAt: string | null;
  listStatus: 'PENDENTE' | 'ANEXADA';
  attachedCompanies: number;
  allCompaniesAttached: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string };
  updatedBy?: { id: string; name: string };
  bids: TenderParticipation[];
  _count?: { bids: number };
};

export type DiscountCalculation = {
  id: string;
  companyId: string;
  tenderId: string;
  discountedValue: string | null;
  discountPercentage: string | null;
  tender: Tender;
  createdAt: string;
  updatedAt: string;
};

export type Bid = TenderParticipation & {
  tenderId: string;
  tender: Tender;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string };
  updatedBy?: { id: string; name: string };
};

export type DocumentCategory =
  | 'EDITAL'
  | 'ANEXO'
  | 'PLANILHA_ORCAMENTARIA'
  | 'CRONOGRAMA'
  | 'COMPOSICAO'
  | 'PROPOSTA'
  | 'PROPOSTA_REAJUSTADA'
  | 'SEGURO_GARANTIA'
  | 'CARTA_FIANCA'
  | 'HABILITACAO'
  | 'RECURSO'
  | 'CONTRARRAZOES'
  | 'OUTRO';

export type BidDocument = {
  id: string;
  bidId: string;
  originalName: string;
  mimeType: string;
  size: number;
  category: DocumentCategory;
  createdAt: string;
  storageProvider?: string;
  remoteNodeId?: string | null;
  remotePath?: string | null;
  uploadedBy: { id: string; name: string };
  bid?: { id: string; tender: Pick<Tender, 'id' | 'noticeNumber' | 'municipality' | 'object'> };
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

export type ApiResponse<T> = { success: true; data: T; message?: string };

export type DeadlineAlert = {
  key: string;
  type: 'SESSION' | 'PROPOSAL_EXPIRATION';
  title: string;
  date: string;
  days: number;
  severity: 'OVERDUE' | 'TODAY' | 'URGENT' | 'UPCOMING' | 'FUTURE';
  read: boolean;
  tenderId: string;
  noticeNumber: string | null;
  processNumber: string | null;
  municipality: string;
  state: string | null;
  object: string;
  sessionTime: string | null;
  platform: { id: string; name: string } | null;
};

export type DeadlineData = {
  items: DeadlineAlert[];
  unread: number;
  summary: { overdue: number; today: number; next7Days: number; next30Days: number };
};

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'UPLOAD';
export type AuditLog = {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  description: string;
  metadata: unknown;
  createdAt: string;
  actor: { id: string; name: string; email: string } | null;
};


export type MegaStatus = {
  configured: boolean;
  connected: boolean;
  rootFolder: string;
  accountName: string | null;
  spaceUsed: number | null;
  spaceTotal: number | null;
};

export type MegaItem = {
  id: string;
  name: string;
  type: 'folder' | 'file';
  size: number;
  updatedAt: string | null;
  path: string;
};

export type MegaBrowseData = {
  path: string;
  basePath: string | null;
  scopeLabel: string;
  items: MegaItem[];
};

export type GmailIntegrationStatus = {
  configured: boolean;
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
  pollingIntervalSeconds: number;
};

export type EmailProcessingStatus = 'PENDENTE' | 'PROCESSADO' | 'ERRO';

export type EmailMessage = {
  id: string;
  companyId: string;
  gmailMessageId: string;
  threadId: string;
  sender: string;
  subject: string | null;
  receivedAt: string;
  snippet: string | null;
  textContent: string | null;
  processingStatus: EmailProcessingStatus;
  isPotentialConvocation: boolean;
  convocationReason: string | null;
  tenderId: string | null;
  bidId: string | null;
  convocationMatchMethod: 'PROCESS_NUMBER' | 'NOTICE_NUMBER' | 'CONTEXT' | 'MANUAL' | null;
  convocationMatchConfidence: number | null;
  convocationMatchedAt: string | null;
  tender: Pick<Tender, 'id' | 'modality' | 'noticeNumber' | 'processNumber' | 'municipality'> | null;
  bid: { id: string } | null;
  createdAt: string;
};

export type GmailConvocationAlert = {
  key: string;
  messageId: string;
  companyId: string;
  companyName: string;
  sender: string;
  subject: string | null;
  receivedAt: string;
  snippet: string | null;
  tenderId: string | null;
  bidId: string | null;
  tender: Pick<Tender, 'modality' | 'noticeNumber' | 'processNumber' | 'municipality'> | null;
  read: boolean;
};

export type GmailConvocationAlertData = {
  items: GmailConvocationAlert[];
  unread: number;
};

export type DashboardData = {
  scope: { companyId: string | null; companyName: string | null };
  companies: CompanySummary[];
  metrics: {
    activeBids: number;
    upcomingSessions: number;
    pendingConvocations: number;
    criticalDeadlines: number;
  };
  attention: Array<{
    key: string;
    type: 'CONVOCATION' | 'SESSION' | 'PROPOSAL_EXPIRATION';
    title: string;
    subtitle: string;
    bidId: string | null;
    companyId: string;
    date: string;
    days?: number;
    severity: 'INFO' | 'OVERDUE' | 'URGENT' | 'WARNING';
  }>;
  upcomingBids: Array<{
    id: string;
    companyId: string;
    companyName: string;
    municipality: string;
    noticeNumber: string | null;
    sessionDate: string;
    platformName: string | null;
    situation: BidSituation;
    progress: BidProgress;
  }>;
  recentConvocations: GmailConvocationAlert[];
  statusBreakdown: Array<{ situation: BidSituation; count: number }>;
  companyCards: Array<{
    id: string;
    name: string;
    activeBids: number;
    upcomingSessions: number;
    pendingConvocations: number;
  }>;
};
