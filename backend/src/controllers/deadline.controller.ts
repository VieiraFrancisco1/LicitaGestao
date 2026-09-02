import type { Request, Response } from 'express';
import { listDeadlineAlerts, listTenderDeadlines, markAllDeadlineReads, markDeadlineRead } from '../services/deadline.service.js';

export const index = async (req: Request, res: Response) => {
  const data = await listDeadlineAlerts(
    req.auth!,
    req.query as unknown as { horizon: number; pastDays: number }
  );
  res.json({ success: true, data });
};

export const tender = async (req: Request, res: Response) => {
  const data = await listTenderDeadlines(req.auth!, req.params.tenderId as string);
  res.json({ success: true, data });
};

export const read = async (req: Request, res: Response) => {
  await markDeadlineRead(req.auth!.userId, req.body.alertKey);
  res.json({ success: true, message: 'Notificação marcada como lida' });
};

export const readAll = async (req: Request, res: Response) => {
  const data = await markAllDeadlineReads(req.auth!);
  res.json({ success: true, message: 'Notificações marcadas como lidas', data });
};
