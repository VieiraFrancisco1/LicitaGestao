import type { Request, Response } from 'express';
import { listAuditLogs } from '../services/audit.service.js';

export const index = async (req: Request, res: Response) => {
  const data = await listAuditLogs(req.query as unknown as Parameters<typeof listAuditLogs>[0]);
  res.json({ success: true, data });
};
