import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as controller from '../controllers/notification.controller.js';
import { asyncHandler } from '../utils/async-handler.js';

export const notificationRouter = Router();
notificationRouter.use(authenticate);
notificationRouter.get('/', asyncHandler(controller.index));
notificationRouter.post('/read-all', asyncHandler(controller.readAll));
notificationRouter.post('/:id/read', asyncHandler(controller.read));
