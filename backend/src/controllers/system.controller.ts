import type { Request, Response } from 'express';
import { getSystemHealth } from '../services/system-health.service.js';

export const health = async (req: Request, res: Response) => {
  const data = await getSystemHealth(req.auth!);
  res.json({ success: true, data });
};
