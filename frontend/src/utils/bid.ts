import type { BidProgress, BidSituation, DocumentCategory, GuaranteeType } from '../types';

export const progressOptions: Array<{ value: BidProgress; label: string }> = [
  { value: 'NAO_INICIADA', label: 'Não iniciada' },
  { value: 'EM_ANALISE', label: 'Em análise' },
  { value: 'EM_ANDAMENTO', label: 'Em andamento' },
  { value: 'FEITA', label: 'Feita' },
  { value: 'AGUARDANDO_SESSAO', label: 'Aguardando sessão' },
  { value: 'EM_DISPUTA', label: 'Em disputa' },
  { value: 'HABILITACAO', label: 'Habilitação' },
  { value: 'RECURSO', label: 'Recurso' },
  { value: 'FINALIZADA', label: 'Finalizada' }
];

export const situationOptions: Array<{ value: BidSituation; label: string }> = [
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'ANEXADA', label: 'Anexada' },
  { value: 'CLASSIFICADA', label: 'Classificada' },
  { value: 'DESCLASSIFICADA', label: 'Desclassificada' },
  { value: 'HABILITADA', label: 'Habilitada' },
  { value: 'INABILITADA', label: 'Inabilitada' },
  { value: 'VENCEDORA', label: 'Vencedora' },
  { value: 'PERDIDA', label: 'Perdida' },
  { value: 'FINALIZADA', label: 'Finalizada' }
];

export const guaranteeOptions: Array<{ value: GuaranteeType; label: string }> = [
  { value: 'NAO_EXIGIDA', label: 'Não exigida' },
  { value: 'APOLICE', label: 'Apólice' },
  { value: 'PROPOSTA_INICIAL', label: 'Proposta inicial' },
  { value: 'FIANCA', label: 'Fiança' },
  { value: 'CAUCAO', label: 'Caução' },
  { value: 'OUTRO', label: 'Outro' }
];

export const documentCategoryOptions: Array<{ value: DocumentCategory; label: string }> = [
  { value: 'EDITAL', label: 'Edital' },
  { value: 'ANEXO', label: 'Anexo' },
  { value: 'PLANILHA_ORCAMENTARIA', label: 'Planilha orçamentária' },
  { value: 'CRONOGRAMA', label: 'Cronograma' },
  { value: 'COMPOSICAO', label: 'Composição' },
  { value: 'PROPOSTA', label: 'Proposta' },
  { value: 'PROPOSTA_REAJUSTADA', label: 'Proposta reajustada' },
  { value: 'SEGURO_GARANTIA', label: 'Seguro garantia' },
  { value: 'CARTA_FIANCA', label: 'Carta fiança' },
  { value: 'HABILITACAO', label: 'Habilitação' },
  { value: 'RECURSO', label: 'Recurso' },
  { value: 'CONTRARRAZOES', label: 'Contrarrazões' },
  { value: 'OUTRO', label: 'Outro' }
];

export const optionLabel = <T extends string>(options: Array<{ value: T; label: string }>, value: T) =>
  options.find((option) => option.value === value)?.label ?? value;

export const formatDate = (value: string | null) =>
  value ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(value)) : '—';

export const formatCurrency = (value: string | null) =>
  value === null
    ? '—'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));

export const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};
