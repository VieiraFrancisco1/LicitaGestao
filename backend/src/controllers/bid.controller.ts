import type { Request, Response } from 'express';
import { createBid, deleteBid, getBid, listBids, updateBid } from '../services/bid.service.js';
import { AuditActions, recordAudit } from '../services/audit.service.js';
import { relinkPotentialConvocationsForTender } from '../services/gmail.service.js';

export const index = async (req: Request, res: Response) => {
  const result = await listBids(req.query as unknown as Parameters<typeof listBids>[0], req.auth!);
  res.json({ success: true, data: result });
};

export const show = async (req: Request, res: Response) => {
  const bid = await getBid(req.params.id as string, req.auth!);
  res.json({ success: true, data: bid });
};

export const create = async (req: Request, res: Response) => {
  const bid = await createBid(req.body, req.auth!);
  await recordAudit(req.auth!, {
    action: AuditActions.CREATE,
    entityType: 'BID',
    entityId: bid.id,
    entityLabel: bid.company.tradeName || bid.company.legalName,
    description: 'Participação de empresa cadastrada na licitação',
    metadata: { tenderId: bid.tenderId, companyId: bid.companyId }
  });
  await relinkPotentialConvocationsForTender(bid.tenderId).catch((error) =>
    console.error('Falha ao reavaliar convocações após associar empresa:', error)
  );
  res.status(201).json({ success: true, message: 'Licitação associada à empresa', data: bid });
};

export const createForTender = async (req: Request, res: Response) => {
  const bid = await createBid({ ...req.body, tenderId: req.params.id as string }, req.auth!);
  await recordAudit(req.auth!, {
    action: AuditActions.CREATE,
    entityType: 'BID',
    entityId: bid.id,
    entityLabel: bid.company.tradeName || bid.company.legalName,
    description: 'Participação de empresa cadastrada na licitação',
    metadata: { tenderId: bid.tenderId, companyId: bid.companyId }
  });
  await relinkPotentialConvocationsForTender(bid.tenderId).catch((error) =>
    console.error('Falha ao reavaliar convocações após associar empresa:', error)
  );
  res.status(201).json({ success: true, message: 'Licitação associada à empresa', data: bid });
};

export const update = async (req: Request, res: Response) => {
  const bid = await updateBid(req.params.id as string, req.body, req.auth!);
  await recordAudit(req.auth!, {
    action: AuditActions.UPDATE,
    entityType: 'BID',
    entityId: bid.id,
    entityLabel: bid.company.tradeName || bid.company.legalName,
    description: 'Participação atualizada',
    metadata: { changedFields: Object.keys(req.body), tenderId: bid.tenderId, companyId: bid.companyId }
  });
  res.json({ success: true, message: 'Participação atualizada', data: bid });
};

export const remove = async (req: Request, res: Response) => {
  const bid = await deleteBid(req.params.id as string, req.auth!);
  await recordAudit(req.auth!, {
    action: AuditActions.DELETE,
    entityType: 'BID',
    entityId: bid.id,
    entityLabel: `${bid.company.tradeName || bid.company.legalName} · ${bid.tender.municipality}`,
    description: 'Licitação desassociada da empresa',
    metadata: { tenderId: bid.tenderId, companyId: bid.companyId }
  });
  res.json({ success: true, message: 'Licitação desassociada da empresa' });
};
