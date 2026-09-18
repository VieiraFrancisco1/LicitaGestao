import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as controller from '../controllers/billing.controller.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  billingCheckoutSchema,
  billingReconcileSchema,
  billingStatusSchema
} from '../validators/billing.validator.js';

export const billingRouter = Router();

const billingLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Muitas tentativas de pagamento. Aguarde alguns minutos.'
  }
});

billingRouter.get('/plans', asyncHandler(controller.plans));
billingRouter.get('/status', billingLimiter, validate(billingStatusSchema), asyncHandler(controller.status));
billingRouter.post('/checkout', billingLimiter, validate(billingCheckoutSchema), asyncHandler(controller.checkout));
billingRouter.post('/reconcile', billingLimiter, validate(billingReconcileSchema), asyncHandler(controller.reconcile));
billingRouter.post('/webhook', asyncHandler(controller.webhook));
