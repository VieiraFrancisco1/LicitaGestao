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
  noticeNumber: string | null;
  processNumber: string | null;
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
  spreadsheetReady: boolean;
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
