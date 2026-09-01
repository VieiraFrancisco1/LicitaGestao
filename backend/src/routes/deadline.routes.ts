import { Router } from 'express';
import * as controller from '../controllers/deadline.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { listDeadlineSchema, readDeadlineSchema } from '../validators/deadline.validator.js';

export const deadlineRouter = Router();
deadlineRouter.use(authenticate);
deadlineRouter.get('/alerts', validate(listDeadlineSchema), asyncHandler(controller.index));
deadlineRouter.post('/read', validate(readDeadlineSchema), asyncHandler(controller.read));
deadlineRouter.post('/read-all', asyncHandler(controller.readAll));
