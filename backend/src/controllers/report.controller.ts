import type { Request, Response } from 'express';
import { getOperationalReport, type ReportQuery } from '../services/report.service.js';

export const show = async (req: Request, res: Response) => {
  const data = await getOperationalReport(req.auth!, req.query as unknown as ReportQuery);
  res.json({ success: true, data });
};
