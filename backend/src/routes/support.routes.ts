import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as controller from '../controllers/support.controller.js';
import { asyncHandler } from '../utils/async-handler.js';

export const supportRouter = Router();
supportRouter.use(authenticate);
supportRouter.get('/', asyncHandler(controller.show));
