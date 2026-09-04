export type OperationalReportItem = {
  tenderId: string;
  sessionDate: string;
  noticeNumber: string | null;
  processNumber: string | null;
  municipality: string;
  state: string | null;
  agency: string | null;
  platformName: string | null;
  spreadsheetReady: boolean;
  situation: string;
  documents: number;
};

export type OperationalTenderRow = {
  id: string;
  sessionDate: string;
  noticeNumber: string | null;
  processNumber: string | null;
  municipality: string;
  state: string | null;
  agency: string | null;
  platformName: string | null;
  participations: number;
  pendingAttachments: number;
  spreadsheetReady: boolean;
  documents: number;
};

export type OperationalSummary = {
  metrics: {
    tenders: number;
    participations: number;
    pendingAttachments: number;
    spreadsheetsReady: number;
    spreadsheetsPending: number;
    documents: number;
  };
  monthly: Array<{ month: string; count: number }>;
  platforms: Array<{ name: string; count: number }>;
  municipalities: Array<{ name: string; count: number }>;
  rows: OperationalTenderRow[];
};

const increment = (map: Map<string, number>, key: string) => {
  map.set(key, (map.get(key) ?? 0) + 1);
};

export function buildOperationalSummary(items: OperationalReportItem[]): OperationalSummary {
  const tenderMap = new Map<string, OperationalTenderRow>();

  for (const item of items) {
    const current = tenderMap.get(item.tenderId) ?? {
      id: item.tenderId,
      sessionDate: item.sessionDate,
      noticeNumber: item.noticeNumber,
      processNumber: item.processNumber,
      municipality: item.municipality,
      state: item.state,
      agency: item.agency,
      platformName: item.platformName,
      participations: 0,
      pendingAttachments: 0,
      spreadsheetReady: item.spreadsheetReady,
      documents: 0
    };

    current.participations += 1;
    current.pendingAttachments += item.situation === 'PENDENTE' ? 1 : 0;
    current.documents += item.documents;
    tenderMap.set(item.tenderId, current);
  }

  const rows = [...tenderMap.values()].sort((a, b) => {
    const dateOrder = b.sessionDate.localeCompare(a.sessionDate);
    return dateOrder || a.municipality.localeCompare(b.municipality, 'pt-BR');
  });

  const monthlyMap = new Map<string, number>();
  const platformMap = new Map<string, number>();
  const municipalityMap = new Map<string, number>();

  for (const row of rows) {
    increment(monthlyMap, row.sessionDate.slice(0, 7));
    increment(platformMap, row.platformName || 'Sem plataforma');
    increment(municipalityMap, row.state ? `${row.municipality}/${row.state}` : row.municipality);
  }

  const byCountThenName = ([nameA, countA]: [string, number], [nameB, countB]: [string, number]) =>
    countB - countA || nameA.localeCompare(nameB, 'pt-BR');

  return {
    metrics: {
      tenders: rows.length,
      participations: items.length,
      pendingAttachments: rows.reduce((total, row) => total + row.pendingAttachments, 0),
      spreadsheetsReady: rows.filter((row) => row.spreadsheetReady).length,
      spreadsheetsPending: rows.filter((row) => !row.spreadsheetReady).length,
      documents: rows.reduce((total, row) => total + row.documents, 0)
    },
    monthly: [...monthlyMap.entries()]
      .sort(([monthA], [monthB]) => monthA.localeCompare(monthB))
      .map(([month, count]) => ({ month, count })),
    platforms: [...platformMap.entries()].sort(byCountThenName).map(([name, count]) => ({ name, count })),
    municipalities: [...municipalityMap.entries()]
      .sort(byCountThenName)
      .map(([name, count]) => ({ name, count })),
    rows
  };
}
