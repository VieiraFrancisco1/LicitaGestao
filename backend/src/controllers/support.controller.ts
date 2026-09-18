import type { Request, Response } from 'express';
import { getSupportSettings } from '../services/platform-admin.service.js';

export const show = async (_req: Request, res: Response) => {
  res.json({ success: true, data: await getSupportSettings() });
};
