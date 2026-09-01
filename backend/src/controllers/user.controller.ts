import type { Request, Response } from 'express';
import { createUser, getUser, listUsers, updateUser } from '../services/user.service.js';
import { AuditActions, recordAudit } from '../services/audit.service.js';

export const index = async (req: Request, res: Response) => {
  const result = await listUsers(req.query as unknown as Parameters<typeof listUsers>[0]);
  res.json({ success: true, data: result });
};

export const show = async (req: Request, res: Response) => {
  const user = await getUser(req.params.id as string);
  res.json({ success: true, data: user });
};

export const create = async (req: Request, res: Response) => {
  const user = await createUser(req.body);
  await recordAudit(req.auth!, {
    action: AuditActions.CREATE,
    entityType: 'USER',
    entityId: user.id,
    entityLabel: user.name,
    description: 'Usuário cadastrado',
    metadata: { role: user.role }
  });
  res.status(201).json({ success: true, message: 'Usuário cadastrado', data: user });
};

export const update = async (req: Request, res: Response) => {
  const user = await updateUser(req.params.id as string, req.auth!.userId, req.body);
  const changedFields = Object.keys(req.body).filter((field) => field !== 'password');
  if (req.body.password !== undefined) changedFields.push('password');
  await recordAudit(req.auth!, {
    action: AuditActions.UPDATE,
    entityType: 'USER',
    entityId: user.id,
    entityLabel: user.name,
    description: 'Usuário atualizado',
    metadata: { changedFields }
  });
  res.json({ success: true, message: 'Usuário atualizado', data: user });
};
