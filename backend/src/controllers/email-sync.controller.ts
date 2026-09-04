import type { Request, Response } from 'express';
import { syncAccessibleEmailIntegrations } from '../services/email-sync.service.js';

export const syncAccessible = async (req: Request, res: Response) => {
  const data = await syncAccessibleEmailIntegrations(req.auth!);
  res.json({ success: true, message: 'E-mails atualizados automaticamente', data });
};
