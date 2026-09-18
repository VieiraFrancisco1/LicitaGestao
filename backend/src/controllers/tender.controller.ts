import type { Request, Response } from 'express';
import {
  createTender,
  deleteTender,
  getTender,
  listTenderFilterOptions,
  listTenders,
  setSpreadsheetReady,
  setSpreadsheetResponsibility,
  setTenderListStatus,
  updateSpreadsheetNotes,
  updateTender
} from '../services/tender.service.js';
import { AuditActions, recordAudit } from '../services/audit.service.js';
import { relinkPotentialConvocationsForTender } from '../services/gmail.service.js';

export const index = async (req: Request, res: Response) => {
  const result = await listTenders(req.query as unknown as Parameters<typeof listTenders>[0], req.auth!);
  res.json({ success: true, data: result });
};

// LICITAGESTAO_WORKFLOW_CITY_LAYOUT_V3_CONTROLLER
export const filterOptions = async (req: Request, res: Response) => {
  const result = await listTenderFilterOptions(
    req.query as unknown as Parameters<typeof listTenderFilterOptions>[0],
    req.auth!
  );
  res.json({ success: true, data: result });
};

export const show = async (req: Request, res: Response) => {
  const tender = await getTender(req.params.id as string, req.auth!);
  res.json({ success: true, data: tender });
};

export const create = async (req: Request, res: Response) => {
  const tender = await createTender(req.body, req.auth!);

  // Responde assim que a licitação foi gravada no banco.
  // Auditoria e associação de e-mails continuam em segundo plano sem travar o botão Salvar.
  res.status(201).json({ success: true, message: 'Licitação adicionada ao controle geral', data: tender }); // LICITAGESTAO_INSTANT_TENDER_SAVE_V1

  void recordAudit(req.auth!, {
    action: AuditActions.CREATE,
    entityType: 'TENDER',
    entityId: tender.id,
    entityLabel: tender.noticeNumber || tender.processNumber || tender.municipality,
    description: 'Licitação cadastrada',
    metadata: { changedFields: Object.keys(req.body) }
  });

  void relinkPotentialConvocationsForTender(tender.id).catch((error) =>
    console.error('Falha ao reavaliar e-mails após cadastro da licitação:', error)
  );
};

export const update = async (req: Request, res: Response) => {
  const tender = await updateTender(req.params.id as string, req.body, req.auth!);

  // O usuário não precisa esperar a varredura dos e-mails para concluir a edição.
  res.json({ success: true, message: 'Licitação geral atualizada', data: tender });

  void recordAudit(req.auth!, {
    action: AuditActions.UPDATE,
    entityType: 'TENDER',
    entityId: tender.id,
    entityLabel: tender.noticeNumber || tender.processNumber || tender.municipality,
    description: 'Licitação atualizada',
    metadata: { changedFields: Object.keys(req.body) }
  });

  void relinkPotentialConvocationsForTender(tender.id).catch((error) =>
    console.error('Falha ao reavaliar e-mails após atualização da licitação:', error)
  );
};

export const spreadsheetReady = async (req: Request, res: Response) => {
  const tender = await setSpreadsheetReady(req.params.id as string, req.body.ready, req.auth!);
  await recordAudit(req.auth!, {
    action: AuditActions.STATUS_CHANGE,
    entityType: 'TENDER',
    entityId: tender.id,
    entityLabel: tender.noticeNumber || tender.processNumber || tender.municipality,
    description: req.body.ready ? 'Planilha marcada como pronta' : 'Planilha marcada como não pronta',
    metadata: { spreadsheetReady: req.body.ready }
  });
  res.json({
    success: true,
    message: req.body.ready ? 'Planilha marcada como pronta' : 'Planilha marcada como não pronta',
    data: tender
  });
};

export const listStatus = async (req: Request, res: Response) => {
  const tender = await setTenderListStatus(req.params.id as string, req.body.status, req.auth!);
  await recordAudit(req.auth!, {
    action: AuditActions.STATUS_CHANGE,
    entityType: 'TENDER',
    entityId: tender.id,
    entityLabel: tender.noticeNumber || tender.processNumber || tender.municipality,
    description: 'Situação da lista da licitação alterada',
    metadata: { listStatus: req.body.status }
  });
  res.json({ success: true, message: 'Licitação movida para a lista selecionada', data: tender });
};


export const remove = async (req: Request, res: Response) => {
  const tender = await deleteTender(req.params.id as string, req.auth!);
  await recordAudit(req.auth!, {
    action: AuditActions.DELETE,
    entityType: 'TENDER',
    entityId: tender.id,
    entityLabel: tender.noticeNumber || tender.processNumber || tender.municipality,
    description: 'Licitação excluída do controle geral',
    metadata: { municipality: tender.municipality, sessionDate: tender.sessionDate.toISOString() }
  });
  res.json({ success: true, message: 'Licitação excluída' });
};

export const spreadsheetResponsibility = async (req: Request, res: Response) => {
  const tender = await setSpreadsheetResponsibility(req.params.id as string, req.body.responsible, req.auth!);
  await recordAudit(req.auth!, {
    action: AuditActions.STATUS_CHANGE,
    entityType: 'TENDER',
    entityId: tender.id,
    entityLabel: tender.noticeNumber || tender.processNumber || tender.municipality,
    description: req.body.responsible ? 'Usuário assumiu a responsabilidade pela planilha' : 'Responsabilidade pela planilha liberada',
    metadata: { spreadsheetResponsibleUserId: tender.spreadsheetResponsibleUserId }
  });
  res.json({
    success: true,
    message: req.body.responsible ? 'Você agora é o responsável pela planilha' : 'Responsabilidade liberada',
    data: tender
  });
};

export const spreadsheetNotes = async (req: Request, res: Response) => {
  const tender = await updateSpreadsheetNotes(req.params.id as string, req.body.notes, req.auth!);
  await recordAudit(req.auth!, {
    action: AuditActions.UPDATE,
    entityType: 'TENDER',
    entityId: tender.id,
    entityLabel: tender.noticeNumber || tender.processNumber || tender.municipality,
    description: 'Observações da planilha atualizadas',
    metadata: { hasSpreadsheetNotes: Boolean(tender.spreadsheetNotes) }
  });
  res.json({ success: true, message: 'Observações da planilha atualizadas', data: tender });
};
