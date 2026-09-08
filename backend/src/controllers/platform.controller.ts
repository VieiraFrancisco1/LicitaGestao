import type { Request, Response } from 'express';
import { createPlatform, listPlatforms, updatePlatform } from '../services/platform.service.js';
import { AuditActions, recordAudit } from '../services/audit.service.js';

export const index = async (req: Request, res: Response) => {
  const platforms = await listPlatforms(req.query as unknown as Parameters<typeof listPlatforms>[0], req.auth!);
  res.json({ success: true, data: platforms });
};
export const create = async (req: Request, res: Response) => {
  const platform = await createPlatform(req.body, req.auth!);
  await recordAudit(req.auth!, {
    action: AuditActions.CREATE,
    entityType: 'PLATFORM',
    entityId: platform.id,
    entityLabel: platform.name,
    description: 'Plataforma cadastrada'
  });
  res.status(201).json({ success: true, message: 'Plataforma cadastrada', data: platform });
};
export const update = async (req: Request, res: Response) => {
  const platform = await updatePlatform(req.params.id as string, req.body, req.auth!);
  await recordAudit(req.auth!, {
    action: AuditActions.UPDATE,
    entityType: 'PLATFORM',
    entityId: platform.id,
    entityLabel: platform.name,
    description: 'Plataforma atualizada',
    metadata: { changedFields: Object.keys(req.body) }
  });
  res.json({ success: true, message: 'Plataforma atualizada', data: platform });
};
