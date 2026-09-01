import type { Request, Response } from 'express';
import {
  createDiscount,
  deleteDiscount,
  listDiscounts,
  updateDiscount
} from '../services/discount.service.js';
import { AuditActions, recordAudit } from '../services/audit.service.js';

export const index = async (req: Request, res: Response) => {
  const items = await listDiscounts(req.params.id as string, req.auth!);
  res.json({ success: true, data: items });
};

export const create = async (req: Request, res: Response) => {
  const item = await createDiscount(req.params.id as string, req.body.tenderId, req.auth!);
  await recordAudit(req.auth!, {
    action: AuditActions.CREATE,
    entityType: 'DISCOUNT',
    entityId: item.id,
    entityLabel: item.tender.noticeNumber || item.tender.municipality,
    description: 'Licitação adicionada às baixas',
    metadata: { companyId: item.companyId, tenderId: item.tenderId }
  });
  res.status(201).json({ success: true, message: 'Licitação adicionada às baixas', data: item });
};

export const update = async (req: Request, res: Response) => {
  const item = await updateDiscount(
    req.params.id as string,
    req.params.discountId as string,
    req.body.discountedValue,
    req.auth!
  );
  await recordAudit(req.auth!, {
    action: AuditActions.UPDATE,
    entityType: 'DISCOUNT',
    entityId: item.id,
    entityLabel: item.tender.noticeNumber || item.tender.municipality,
    description: 'Baixa calculada e salva',
    metadata: {
      companyId: item.companyId,
      tenderId: item.tenderId,
      discountedValue: req.body.discountedValue
    }
  });
  res.json({ success: true, message: 'Baixa calculada e salva', data: item });
};

export const remove = async (req: Request, res: Response) => {
  await deleteDiscount(req.params.id as string, req.params.discountId as string, req.auth!);
  await recordAudit(req.auth!, {
    action: AuditActions.DELETE,
    entityType: 'DISCOUNT',
    entityId: req.params.discountId as string,
    description: 'Licitação removida das baixas',
    metadata: { companyId: req.params.id as string }
  });
  res.json({ success: true, message: 'Licitação removida das baixas' });
};
