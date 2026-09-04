import type { Request, Response } from 'express';
import { getSystemHealth } from '../services/system-health.service.js';

export const health = async (_req: Request, res: Response) => {
  const data = await getSystemHealth();
  res.json({ success: true, data });
};

