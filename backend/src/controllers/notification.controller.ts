import type { Request, Response } from 'express';
import {
  listUserNotifications,
  markAllUserNotificationsRead,
  markUserNotificationRead
} from '../services/notification.service.js';

export const index = async (req: Request, res: Response) => {
  res.json({ success: true, data: await listUserNotifications(req.auth!) });
};

export const read = async (req: Request, res: Response) => {
  await markUserNotificationRead(req.params.id as string, req.auth!);
  res.json({ success: true, message: 'Notificação marcada como lida' });
};

export const readAll = async (req: Request, res: Response) => {
  res.json({ success: true, data: await markAllUserNotificationsRead(req.auth!) });
};
