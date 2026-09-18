import { setTimeout as wait } from 'node:timers/promises';
import jwt from 'jsonwebtoken';
import { WebhookSignatureValidator } from 'mercadopago';
import {
  BillingPaymentStatus,
  SubscriptionPlan,
  SubscriptionStatus,
  type Organization
} from '@prisma/client';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

type BillingTokenPayload = jwt.JwtPayload & {
  sub: string;
  organizationId: string;
  type: 'billing';
};

type MercadoPagoPaymentTransaction = {
  id?: string;
  amount?: string;
  paid_amount?: string;
  status?: string;
  status_detail?: string;
  payment_method?: {
    id?: string;
    type?: string;
    installments?: number;
  };
};

type MercadoPagoOrder = {
  id?: string;
  type?: string;
  processing_mode?: string;
  status?: string;
  status_detail?: string;
  external_reference?: string | null;
  total_amount?: string;
  total_paid_amount?: string;
  checkout_url?: string;
  transactions?: {
    payments?: MercadoPagoPaymentTransaction[];
  };
};

export const BILLING_PLANS = {
  MONTHLY: {
    code: SubscriptionPlan.MONTHLY,
    name: 'Mensal',
    months: 1,
    amount: 79.9,
    amountText: '79.90',
    displayPrice: 'R$ 79,90'
  },
  QUARTERLY: {
    code: SubscriptionPlan.QUARTERLY,
    name: 'Trimestral',
    months: 3,
    amount: 220,
    amountText: '220.00',
    displayPrice: 'R$ 220,00'
  },
  SEMIANNUAL: {
    code: SubscriptionPlan.SEMIANNUAL,
    name: '6 meses',
    months: 6,
    amount: 500,
    amountText: '500.00',
    displayPrice: 'R$ 500,00'
  }
} as const;

const planByCode = (plan: SubscriptionPlan) => BILLING_PLANS[plan];

export const billingConfigured = () =>
  Boolean(
    env.MERCADO_PAGO_ACCESS_TOKEN &&
      env.MERCADO_PAGO_WEBHOOK_SECRET &&
      env.MERCADO_PAGO_WEBHOOK_URL
  );

const requireMercadoPagoToken = () => {
  if (!env.MERCADO_PAGO_ACCESS_TOKEN) {
    throw new AppError(
      'O Mercado Pago ainda não foi configurado pelo administrador.',
      503,
      'BILLING_NOT_CONFIGURED'
    );
  }
};

const requireCheckoutConfigured = () => {
  if (!billingConfigured()) {
    throw new AppError(
      'O pagamento ainda não está totalmente configurado pelo administrador do LicitaGestão.',
      503,
      'BILLING_NOT_CONFIGURED'
    );
  }
};

export const issueBillingToken = (organizationId: string) =>
  jwt.sign(
    { organizationId, type: 'billing' },
    env.JWT_SECRET,
    { subject: organizationId, expiresIn: '48h' }
  );

const verifyBillingToken = (token: string) => {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as BillingTokenPayload;
    if (
      payload.type !== 'billing' ||
      !payload.organizationId ||
      payload.sub !== payload.organizationId
    ) {
      throw new Error('invalid');
    }
    return payload;
  } catch {
    throw new AppError(
      'Sua sessão de pagamento expirou. Volte ao login para continuar.',
      401,
      'BILLING_TOKEN_EXPIRED'
    );
  }
};

export const organizationHasPaidAccess = (
  organization: Pick<
    Organization,
    'billingExempt' | 'subscriptionStatus' | 'subscriptionExpiresAt'
  >
) => {
  if (organization.billingExempt) return true;
  if (organization.subscriptionStatus !== SubscriptionStatus.ACTIVE) return false;
  if (!organization.subscriptionExpiresAt) return false;
  return organization.subscriptionExpiresAt.getTime() > Date.now();
};

async function refreshExpiredSubscription(organization: {
  id: string;
  billingExempt: boolean;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt: Date | null;
}) {
  if (
    !organization.billingExempt &&
    organization.subscriptionStatus === SubscriptionStatus.ACTIVE &&
    organization.subscriptionExpiresAt &&
    organization.subscriptionExpiresAt.getTime() <= Date.now()
  ) {
    await prisma.organization.update({
      where: { id: organization.id },
      data: { subscriptionStatus: SubscriptionStatus.EXPIRED }
    });
    return SubscriptionStatus.EXPIRED;
  }
  return organization.subscriptionStatus;
}

export const getBillingPlans = () => ({
  configured: billingConfigured(),
  plans: Object.values(BILLING_PLANS).map((plan) => ({
    code: plan.code,
    name: plan.name,
    months: plan.months,
    amount: plan.amount,
    displayPrice: plan.displayPrice
  }))
});

export async function getBillingStatus(token: string) {
  const payload = verifyBillingToken(token);
  const organization = await prisma.organization.findUnique({
    where: { id: payload.organizationId },
    include: {
      billingPayments: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });
  if (!organization) throw new AppError('Organização não encontrada', 404);

  const subscriptionStatus = await refreshExpiredSubscription(organization);
  const accessGranted =
    organization.billingExempt ||
    (subscriptionStatus === SubscriptionStatus.ACTIVE &&
      Boolean(
        organization.subscriptionExpiresAt &&
          organization.subscriptionExpiresAt.getTime() > Date.now()
      ));

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      loginEmail: organization.loginEmail
    },
    billingExempt: organization.billingExempt,
    subscriptionStatus,
    subscriptionPlan: organization.subscriptionPlan,
    subscriptionExpiresAt: organization.subscriptionExpiresAt,
    accessGranted,
    latestPayment: organization.billingPayments[0] ?? null
  };
}

async function mercadoPagoFetch<T>(resource: string, init?: RequestInit): Promise<T> {
  requireMercadoPagoToken();

  const response = await fetch(`https://api.mercadopago.com${resource}`, {
    ...init,
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN!}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    },
    signal: AbortSignal.timeout(20_000)
  });

  const raw = await response.text();
  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = { raw };
  }

  if (!response.ok) {
    console.error('Mercado Pago respondeu com erro:', response.status, body);
    throw new AppError(
      'Não foi possível comunicar com o Mercado Pago agora. Tente novamente em instantes.',
      502,
      'PAYMENT_PROVIDER_ERROR'
    );
  }

  return body as T;
}

export async function createBillingCheckout(token: string, plan: SubscriptionPlan) {
  const payload = verifyBillingToken(token);
  requireCheckoutConfigured();

  const organization = await prisma.organization.findUnique({
    where: { id: payload.organizationId }
  });

  if (!organization || !organization.active) {
    throw new AppError('Organização sem acesso ao pagamento', 403);
  }
  if (organization.billingExempt) {
    throw new AppError('Esta organização não precisa realizar pagamento', 422);
  }

  const selectedPlan = planByCode(plan);
  if (!selectedPlan) throw new AppError('Plano inválido', 422);

  const payment = await prisma.billingPayment.create({
    data: {
      organizationId: organization.id,
      plan,
      amount: selectedPlan.amount,
      status: BillingPaymentStatus.PENDING,
      provider: 'MERCADO_PAGO'
    }
  });

  const frontendUrl = env.FRONTEND_URL.replace(/\/$/, '');
  const notificationUrl = env.MERCADO_PAGO_WEBHOOK_URL!;

  try {
    const order = await mercadoPagoFetch<MercadoPagoOrder>('/v1/orders', {
      method: 'POST',
      headers: {
        'X-Idempotency-Key': payment.id
      },
      body: JSON.stringify({
        type: 'online',
        processing_mode: 'manual',
        capture_mode: 'automatic_async',
        total_amount: selectedPlan.amountText,
        external_reference: payment.id,
        description: `LicitaGestão - Plano ${selectedPlan.name}`,
        payer: {
          email: organization.loginEmail
        },
        items: [
          {
            external_code: selectedPlan.code,
            title: `LicitaGestão - Plano ${selectedPlan.name}`,
            description: `Acesso ao LicitaGestão por ${selectedPlan.months} mês(es)`,
            quantity: 1,
            unit_price: selectedPlan.amountText,
            unit_measure: 'unit',
            total_amount: selectedPlan.amountText
          }
        ],
        config: {
          notification_url: notificationUrl,
          online: {
            success_url: `${frontendUrl}/pagamento?resultado=sucesso`,
            pending_url: `${frontendUrl}/pagamento?resultado=pendente`,
            failure_url: `${frontendUrl}/pagamento?resultado=falha`,
            auto_return: 'approved'
          },
          payment_method: {
            not_allowed_types: ['ticket', 'debit_card', 'prepaid_card', 'account_money'],
            max_installments: 1
          }
        }
      })
    });

    if (!order.id || !order.checkout_url) {
      throw new AppError(
        'O Mercado Pago não retornou a URL do checkout.',
        502,
        'INVALID_PROVIDER_RESPONSE'
      );
    }

    await prisma.billingPayment.update({
      where: { id: payment.id },
      data: {
        providerOrderId: order.id,
        providerStatus: order.status ?? null,
        providerStatusDetail: order.status_detail ?? null
      }
    });

    return {
      paymentId: payment.id,
      orderId: order.id,
      checkoutUrl: order.checkout_url,
      plan: {
        code: selectedPlan.code,
        name: selectedPlan.name,
        months: selectedPlan.months,
        amount: selectedPlan.amount,
        displayPrice: selectedPlan.displayPrice
      }
    };
  } catch (error) {
    await prisma.billingPayment
      .update({
        where: { id: payment.id },
        data: { status: BillingPaymentStatus.FAILED }
      })
      .catch(() => undefined);
    throw error;
  }
}

function addPlanMonths(date: Date, plan: SubscriptionPlan) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + planByCode(plan).months);
  return next;
}

function mapOrderStatus(order: MercadoPagoOrder) {
  if (order.status === 'processed' && order.status_detail === 'accredited') {
    return BillingPaymentStatus.APPROVED;
  }
  if (
    order.status === 'refunded' ||
    (order.status === 'processed' &&
      (order.status_detail === 'refunded' || order.status_detail === 'partially_refunded'))
  ) {
    return BillingPaymentStatus.REFUNDED;
  }
  if (order.status === 'canceled') return BillingPaymentStatus.CANCELLED;
  if (order.status === 'failed') return BillingPaymentStatus.REJECTED;
  return BillingPaymentStatus.PENDING;
}

function paymentTransactionFromOrder(order: MercadoPagoOrder) {
  const transactions = order.transactions?.payments ?? [];
  return (
    transactions.find(
      (payment) =>
        payment.status === 'processed' && payment.status_detail === 'accredited'
    ) ??
    transactions[0] ??
    null
  );
}

export async function syncMercadoPagoOrder(
  providerOrderId: string,
  expectedOrganizationId?: string
) {
  requireMercadoPagoToken();

  const order = await mercadoPagoFetch<MercadoPagoOrder>(
    `/v1/orders/${encodeURIComponent(providerOrderId)}`
  );

  if (!order.id) {
    throw new AppError('Order sem identificador no Mercado Pago', 502);
  }

  const externalReference = order.external_reference ?? null;
  let localPayment = await prisma.billingPayment.findFirst({
    where: { providerOrderId: order.id },
    include: { organization: true }
  });

  if (!localPayment && externalReference) {
    localPayment = await prisma.billingPayment.findUnique({
      where: { id: externalReference },
      include: { organization: true }
    });
  }

  if (!localPayment) {
    throw new AppError('Cobrança correspondente não encontrada', 404);
  }

  if (
    expectedOrganizationId &&
    localPayment.organizationId !== expectedOrganizationId
  ) {
    throw new AppError('Esta cobrança não pertence à sua organização', 403);
  }

  if (externalReference && externalReference !== localPayment.id) {
    throw new AppError('Referência do pagamento não confere', 422);
  }

  const expectedAmount = Number(localPayment.amount);
  const receivedAmount = Number(order.total_amount ?? Number.NaN);
  if (
    !Number.isFinite(receivedAmount) ||
    Math.abs(receivedAmount - expectedAmount) > 0.009
  ) {
    throw new AppError('O valor retornado pelo Mercado Pago não confere', 422);
  }

  const nextStatus = mapOrderStatus(order);
  const transaction = paymentTransactionFromOrder(order);
  const paymentMethod = transaction?.payment_method
    ? [transaction.payment_method.type, transaction.payment_method.id]
        .filter(Boolean)
        .join(':')
    : null;

  if (
    nextStatus === BillingPaymentStatus.APPROVED &&
    localPayment.status !== BillingPaymentStatus.APPROVED
  ) {
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const currentOrganization = await tx.organization.findUniqueOrThrow({
        where: { id: localPayment!.organizationId }
      });

      const baseDate =
        currentOrganization.subscriptionExpiresAt &&
        currentOrganization.subscriptionExpiresAt.getTime() > now.getTime()
          ? currentOrganization.subscriptionExpiresAt
          : now;

      const expiresAt = addPlanMonths(baseDate, localPayment!.plan);

      await tx.billingPayment.update({
        where: { id: localPayment!.id },
        data: {
          status: BillingPaymentStatus.APPROVED,
          providerOrderId: order.id,
          providerPaymentId: transaction?.id ?? null,
          paymentMethod,
          providerStatus: order.status ?? null,
          providerStatusDetail: order.status_detail ?? null,
          paidAt: now
        }
      });

      await tx.organization.update({
        where: { id: currentOrganization.id },
        data: {
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          subscriptionPlan: localPayment!.plan,
          subscriptionExpiresAt: expiresAt
        }
      });
    });
  } else {
    await prisma.billingPayment.update({
      where: { id: localPayment.id },
      data: {
        status: nextStatus,
        providerOrderId: order.id,
        providerPaymentId: transaction?.id ?? localPayment.providerPaymentId,
        paymentMethod: paymentMethod ?? localPayment.paymentMethod,
        providerStatus: order.status ?? null,
        providerStatusDetail: order.status_detail ?? null
      }
    });
  }

  return getBillingStatus(issueBillingToken(localPayment.organizationId));
}

export async function reconcileBillingOrder(
  token: string,
  providerOrderId: string
) {
  const payload = verifyBillingToken(token);
  return syncMercadoPagoOrder(providerOrderId, payload.organizationId);
}

export function validateMercadoPagoWebhook(input: {
  signature?: string;
  requestId?: string;
  dataId?: string;
}) {
  if (
    !env.MERCADO_PAGO_WEBHOOK_SECRET ||
    !input.signature ||
    !input.requestId ||
    !input.dataId
  ) {
    return false;
  }

  try {
    WebhookSignatureValidator.validate({
      xSignature: input.signature,
      xRequestId: input.requestId,
      dataId: input.dataId,
      secret: env.MERCADO_PAGO_WEBHOOK_SECRET
    });
    return true;
  } catch {
    return false;
  }
}

export async function processMercadoPagoOrderWithRetry(providerOrderId: string) {
  const delays = [0, 2_000, 8_000];

  for (const delay of delays) {
    if (delay) await wait(delay);

    try {
      await syncMercadoPagoOrder(providerOrderId);
      return;
    } catch (error) {
      if (delay === delays[delays.length - 1]) {
        console.error(
          'Falha ao sincronizar order do Mercado Pago após tentativas:',
          providerOrderId,
          error
        );
      }
    }
  }
}
