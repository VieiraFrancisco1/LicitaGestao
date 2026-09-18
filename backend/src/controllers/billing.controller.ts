import type { Request, Response } from 'express';
import {
  createBillingCard,
  createBillingCheckout,
  createBillingPix,
  getBillingPlans,
  getBillingStatus,
  processMercadoPagoOrderWithRetry,
  reconcileBillingOrder,
  validateMercadoPagoWebhook
} from '../services/billing.service.js';
import { AppError } from '../utils/app-error.js';

export const plans = async (_req: Request, res: Response) => {
  res.json({ success: true, data: getBillingPlans() });
};

export const status = async (req: Request, res: Response) => {
  const data = await getBillingStatus(req.query.token as string);
  res.json({ success: true, data });
};

export const checkout = async (req: Request, res: Response) => {
  const data = await createBillingCheckout(req.body.token, req.body.plan);
  res.status(201).json({ success: true, data });
};

export const pix = async (req: Request, res: Response) => {
  const data = await createBillingPix(req.body.token, req.body.plan);
  res.status(201).json({ success: true, data });
};

export const card = async (req: Request, res: Response) => {
  const data = await createBillingCard(req.body.token, req.body.plan, {
    cardToken: req.body.cardToken,
    paymentMethodId: req.body.paymentMethodId,
    paymentTypeId: req.body.paymentTypeId,
    installments: req.body.installments,
    payerEmail: req.body.payerEmail,
    identification: req.body.identification
  });
  res.status(201).json({ success: true, data });
};

// LICITAGESTAO_BILLING_TRANSPARENTE_V8_CONTROLLER

export const reconcile = async (req: Request, res: Response) => {
  const data = await reconcileBillingOrder(req.body.token, req.body.orderId);
  res.json({ success: true, data });
};

export const webhook = async (req: Request, res: Response) => {
  const body = req.body as {
    type?: string;
    data?: { id?: string };
  };

  const dataId =
    (req.query['data.id'] as string | undefined) ||
    body.data?.id;

  const signature = req.header('x-signature') ?? undefined;
  const requestId = req.header('x-request-id') ?? undefined;

  if (!validateMercadoPagoWebhook({ signature, requestId, dataId })) {
    throw new AppError('Assinatura do webhook inválida', 401);
  }

  // Responde imediatamente; a consulta à Orders API acontece em seguida.
  res.status(200).json({ success: true });

  if (body.type === 'order' && dataId) {
    void processMercadoPagoOrderWithRetry(dataId);
  }
};
