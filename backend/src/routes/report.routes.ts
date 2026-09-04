import { Router } from 'express';
import * as controller from '../controllers/report.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { reportSchema } from '../validators/report.validator.js';

export const reportRouter = Router();
reportRouter.use(authenticate);
reportRouter.get('/', validate(reportSchema), asyncHandler(controller.show));
