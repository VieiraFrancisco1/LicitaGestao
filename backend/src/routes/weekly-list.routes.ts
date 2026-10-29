import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { addWeeklyItem, clearWeeklyItems, listWeeklyItems, removeWeeklyItem } from '../services/weekly-list.service.js';

export const weeklyListRouter = Router();
weeklyListRouter.use(authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FUNCIONARIO));
weeklyListRouter.get('/', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await listWeeklyItems(req.auth!) });
}));
weeklyListRouter.post('/', validate(z.object({ body: z.object({ opportunityId: z.string().uuid() }), params: z.object({}), query: z.object({}) })), asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await addWeeklyItem(req.auth!, req.body.opportunityId) });
}));
weeklyListRouter.delete('/', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await clearWeeklyItems(req.auth!) });
}));
weeklyListRouter.delete('/:id', validate(z.object({ body: z.object({}), params: z.object({ id: z.string().uuid() }), query: z.object({}) })), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await removeWeeklyItem(req.auth!, req.params.id as string) });
}));
