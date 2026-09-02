import type { Request, Response } from 'express';
import { getDashboard } from '../services/dashboard.service.js';

export const show = async (req: Request, res: Response) => {
  const data = await getDashboard(req.auth!, req.query.companyId ? String(req.query.companyId) : undefined);
  res.json({ success: true, data });
};
