import type { Request, Response } from 'express';
import { globalSearch } from '../services/search.service.js';

export const index = async (req: Request, res: Response) => {
  const data = await globalSearch(req.auth!, String(req.query.q || ''));
  res.json({ success: true, data });
};
