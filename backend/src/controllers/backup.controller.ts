import type { Request, Response } from 'express';
import { AuditActions, recordAudit } from '../services/audit.service.js';
import {
  createSystemBackup,
  getBackupSummary,
  parseSystemBackup,
  restoreSystemBackup
} from '../services/backup.service.js';
import { AppError } from '../utils/app-error.js';

export const summary = async (_req: Request, res: Response) => {
  const data = await getBackupSummary();
  res.json({ success: true, data });
};

export const download = async (req: Request, res: Response) => {
  const backup = await createSystemBackup();
  const stamp = backup.generatedAt.replace(/[:.]/g, '-');
  await recordAudit(req.auth!, {
    action: AuditActions.CREATE,
    entityType: 'SYSTEM_BACKUP',
    entityId: backup.generatedAt,
    entityLabel: `Backup ${backup.generatedAt}`,
    description: 'Backup de segurança baixado pelo administrador',
    metadata: backup.counts
  });
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="licitagestao-backup-${stamp}.json"`);
  res.send(JSON.stringify(backup, null, 2));
};

export const restore = async (req: Request, res: Response) => {
  if (
    String(req.body.confirmation ?? '')
      .trim()
      .toUpperCase() !== 'RESTAURAR'
  ) {
    throw new AppError('Digite RESTAURAR para confirmar a recuperação', 422);
  }
  if (!req.file?.buffer) throw new AppError('Selecione o arquivo de backup', 422);
  const backup = parseSystemBackup(req.file.buffer);
  const data = await restoreSystemBackup(backup, req.auth!.userId);
  await recordAudit(req.auth!, {
    action: AuditActions.UPDATE,
    entityType: 'SYSTEM_BACKUP',
    entityId: backup.generatedAt,
    entityLabel: `Backup ${backup.generatedAt}`,
    description: 'Dados restaurados a partir de um backup de segurança',
    metadata: data
  });
  res.json({ success: true, message: 'Backup restaurado com sucesso', data });
};
