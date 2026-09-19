import { CardPayment, initMercadoPago } from '@mercadopago/sdk-react';
import {
  CheckCircle2,
  Copy,
  CreditCard,
  QrCode,
  ShieldCheck
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { errorMessage, rawApi } from '../services/api';
import type {
  ApiResponse,
  BillingCardResult,
  BillingPixData,
  BillingPlanCode,
  BillingPlansData,
  BillingStatusData
} from '../types';
import licitaGestaoLogo from '../assets/licitagestao-logo.png';
import './access-flow.css';

const TOKEN_KEY = 'licitagestao.billing-token';
const MERCADO_PAGO_PUBLIC_KEY =
  import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY?.trim() ?? '';

if (MERCADO_PAGO_PUBLIC_KEY) {
  initMercadoPago(MERCADO_PAGO_PUBLIC_KEY);
}

const planCopy: Record<BillingPlanCode, string> = {
  MONTHLY: '1 mês de acesso',
  QUARTERLY: '3 meses de acesso',
  SEMIANNUAL: '6 meses de acesso'
};

type PaymentMethodChoice = 'PIX' | 'CARD';

export function PaymentPage() {
  const { user } = useAuth();
  const [token] = useState(() => window.sessionStorage.getItem(TOKEN_KEY) ?? '');
  const [plansData, setPlansData] = useState<BillingPlansData | null>(null);
  const [status, setStatus] = useState<BillingStatusData | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<BillingPlanCode>('MONTHLY');
  const [method, setMethod] = useState<PaymentMethodChoice | null>(null);
  const [pixData, setPixData] = useState<BillingPixData | null>(null);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const loadStatus = useCallback(async () => {
    if (!token) return;

    try {
      const response = await rawApi.get<ApiResponse<BillingStatusData>>(
        '/billing/status',
        { params: { token } }
      );
      setStatus(response.data.data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [token]);

  useEffect(() => {
    void rawApi
      .get<ApiResponse<BillingPlansData>>('/billing/plans')
      .then((response) => setPlansData(response.data.data))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    if (!token || method === 'CARD' || status?.accessGranted) return;

    const checkPayment = async () => {
      if (method === 'PIX' && pixData?.orderId) {
        try {
          const response = await rawApi.post<ApiResponse<BillingStatusData>>(
            '/billing/reconcile',
            {
              token,
              orderId: pixData.orderId
            }
          );
          setStatus(response.data.data);
          setError('');
        } catch (err) {
          setError(errorMessage(err));
        }
        return;
      }

      await loadStatus();
    };

    const first = window.setTimeout(() => void checkPayment(), 0);
    const polling = window.setInterval(() => void checkPayment(), 12_000);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(polling);
    };
  }, [
    token,
    loadStatus,
    method,
    pixData?.orderId,
    status?.accessGranted
  ]); // LICITAGESTAO_PIX_RECONCILE_V16

  const selected = useMemo(
    () =>
      plansData?.plans.find((plan) => plan.code === selectedPlan) ?? null,
    [plansData, selectedPlan]
  );

  const selectPlan = (plan: BillingPlanCode) => {
    setSelectedPlan(plan);
    setPixData(null);
    setCopied(false);
    setError('');
  };

  const selectMethod = (nextMethod: PaymentMethodChoice) => {
    setMethod(nextMethod);
    setPixData(null);
    setCopied(false);
    setError('');
  };

  const createPix = async () => {
    if (!token || !selected) return;

    setWorking(true);
    setError('');
    setPixData(null);
    setCopied(false);

    try {
      const response = await rawApi.post<ApiResponse<BillingPixData>>(
        '/billing/pix',
        {
          token,
          plan: selected.code
        }
      );
      setPixData(response.data.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWorking(false);
    }
  };

  const copyPix = async () => {
    if (!pixData?.qrCode) return;

    try {
      await navigator.clipboard.writeText(pixData.qrCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Não foi possível copiar o Pix. Selecione o código e copie manualmente.');
    }
  };

  const finish = () => {
    window.sessionStorage.removeItem(TOKEN_KEY);
    window.location.assign('/login?pagamento=aprovado');
  };

  if (user) return <Navigate to="/" replace />;

  if (!token) {
    return (
      <div className="payment-page">
        <section className="payment-shell compact-payment-message">
          <img src={licitaGestaoLogo} alt="LicitaGestão" />
          <h2>Sessão de pagamento não encontrada</h2>
          <p>
            Volte ao login. Se a assinatura estiver pendente ou vencida,
            o sistema abrirá esta tela novamente.
          </p>
          <Link className="primary-button" to="/login">
            Voltar ao login
          </Link>
        </section>
      </div>
    );
  }

  if (status?.accessGranted) {
    return (
      <div className="payment-page">
        <section className="payment-shell payment-approved">
          <span className="payment-success-icon">
            <CheckCircle2 size={38} />
          </span>
          <span className="eyebrow">Pagamento confirmado</span>
          <h2>Acesso liberado</h2>
          <p>
            A assinatura de <strong>{status.organization.name}</strong> está ativa
            {status.subscriptionExpiresAt
              ? ` até ${new Intl.DateTimeFormat('pt-BR').format(
                  new Date(status.subscriptionExpiresAt)
                )}`
              : ''}.
          </p>
          <button className="primary-button large" onClick={finish}>
            Entrar no LicitaGestão
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="payment-page">
      <section className="payment-shell">
        <div className="payment-brand">
          <img src={licitaGestaoLogo} alt="LicitaGestão" />
          <div>
            <span className="eyebrow">
              {status?.subscriptionStatus === 'EXPIRED' ? 'Renovação' : 'Assinatura'}
            </span>
            <h2>
              {status?.subscriptionStatus === 'EXPIRED'
                ? 'Reative sua assinatura'
                : 'Escolha seu plano'}
            </h2>
            <p>
              {status?.subscriptionStatus === 'EXPIRED'
                ? `A assinatura de ${status.organization.name} venceu. Escolha um plano e faça o pagamento para liberar o acesso novamente.`
                : status?.organization.name
                  ? `Finalize o pagamento para liberar o acesso de ${status.organization.name}.`
                  : 'Finalize o pagamento para liberar o acesso.'}
            </p>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {!plansData?.configured && (
          <div className="alert alert-warning">
            Os pagamentos ainda não foram configurados pelo administrador
            do LicitaGestão.
          </div>
        )}

        <div className="billing-plans">
          {plansData?.plans.map((plan) => (
            <button
              type="button"
              key={plan.code}
              className={`billing-plan-card ${
                selectedPlan === plan.code ? 'selected' : ''
              }`}
              onClick={() => selectPlan(plan.code)}
            >
              <span>{plan.name}</span>
              <strong>{plan.displayPrice}</strong>
              <small>{planCopy[plan.code]}</small>
              <em>
                {selectedPlan === plan.code
                  ? 'Selecionado'
                  : 'Escolher plano'}
              </em>
            </button>
          ))}
        </div>

        <div className="payment-method-title">
          <span>Forma de pagamento</span>
          <small>Escolha como deseja pagar</small>
        </div>

        <div className="payment-method-selector">
          <button
            type="button"
            className={method === 'PIX' ? 'selected' : ''}
            onClick={() => selectMethod('PIX')}
          >
            <QrCode size={25} />
            <span>
              <strong>Pix</strong>
              <small>QR Code e Pix Copia e Cola</small>
            </span>
          </button>

          <button
            type="button"
            className={method === 'CARD' ? 'selected' : ''}
            onClick={() => selectMethod('CARD')}
          >
            <CreditCard size={25} />
            <span>
              <strong>Cartão</strong>
              <small>Preencha os dados sem sair do LicitaGestão</small>
            </span>
          </button>
        </div>

        {!method && (
          <div className="payment-method-empty">
            Selecione Pix ou Cartão para continuar.
          </div>
        )}

        {method === 'PIX' && (
          <section className="payment-method-panel">
            <div className="payment-method-panel-heading">
              <div>
                <span className="eyebrow">Pix</span>
                <h3>Pagamento instantâneo</h3>
                <p>
                  Será gerado um Pix dinâmico exclusivo para esta cobrança.
                </p>
              </div>
              <strong>{selected?.displayPrice ?? '—'}</strong>
            </div>

            {!pixData ? (
              <button
                type="button"
                className="primary-button large payment-action-button"
                disabled={working || !selected || !plansData?.configured}
                onClick={() => void createPix()}
              >
                <QrCode size={19} />
                {working ? 'Gerando Pix...' : 'Gerar Pix'}
              </button>
            ) : (
              <div className="pix-payment-result">
                <div className="pix-qr-card">
                  {pixData.qrCodeBase64 ? (
                    <img
                      src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                      alt="QR Code Pix"
                    />
                  ) : (
                    <QrCode size={92} />
                  )}
                </div>

                <div className="pix-copy-area">
                  <span>Pix Copia e Cola</span>
                  <textarea readOnly value={pixData.qrCode} rows={4} />
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void copyPix()}
                  >
                    <Copy size={17} />
                    {copied ? 'Copiado' : 'Copiar código Pix'}
                  </button>
                  <small>
                    Após o pagamento, esta tela verifica automaticamente a
                    confirmação e libera o acesso.
                  </small>
                </div>
              </div>
            )}
          </section>
        )}

        {method === 'CARD' && (
          <section className="payment-method-panel">
            <div className="payment-method-panel-heading">
              <div>
                <span className="eyebrow">Cartão</span>
                <h3>Pagamento na própria tela</h3>
              </div>
              <strong>{selected?.displayPrice ?? '—'}</strong>
            </div>

            {!MERCADO_PAGO_PUBLIC_KEY && (
              <div className="alert alert-warning">
                Configure VITE_MERCADO_PAGO_PUBLIC_KEY no frontend para habilitar
                o formulário de cartão.
              </div>
            )}

            {MERCADO_PAGO_PUBLIC_KEY && selected && status && (
              <div className="card-payment-brick">
                <CardPayment
                  key={`${selected.code}-${selected.amount}`}
                  locale="pt-BR"
                  initialization={{
                    amount: selected.amount,
                    payer: {
                      email: status.payerEmail
                    }
                  }}
                  customization={{
                    paymentMethods: {
                      minInstallments: 1,
                      maxInstallments: 3
                    }
                  }}
                  onSubmit={async (formData, additionalData) => {
                    setError('');

                    try {
                      const paymentTypeId =
                        (
                          additionalData as
                            | { paymentTypeId?: string }
                            | undefined
                        )?.paymentTypeId ?? 'credit_card';

                      const response = await rawApi.post<
                        ApiResponse<BillingCardResult>
                      >('/billing/card', {
                        token,
                        plan: selected.code,
                        cardToken: formData.token,
                        paymentMethodId: formData.payment_method_id,
                        paymentTypeId,
                        installments: Number(formData.installments ?? 1),
                        payerEmail: formData.payer?.email,
                        identification: formData.payer?.identification
                      });

                      setStatus(response.data.data.status);

                      if (!response.data.data.status.accessGranted) {
                        const detail =
                          response.data.data.status.latestPayment
                            ?.providerStatusDetail;
                        setError(
                          detail
                            ? `O cartão não foi aprovado (${detail}). Verifique os dados ou tente outro cartão.`
                            : 'O pagamento não foi aprovado. Verifique os dados ou tente outro cartão.'
                        );
                      }
                    } catch (err) {
                      setError(errorMessage(err));
                      throw err;
                    }
                  }}
                  onError={() => {
                    setError(
                      'Não foi possível carregar ou validar o formulário do cartão.'
                    );
                  }}
                />
              </div>
            )}
          </section>
        )}

        <div className="payment-security-note">
          <ShieldCheck size={18} />
          <span>
            O LicitaGestão não armazena número do cartão, validade ou código de
            segurança. O formulário seguro e a tokenização são fornecidos pelo
            Mercado Pago.
          </span>
        </div>

        <Link className="payment-back-link" to="/login">
          Voltar ao login
        </Link>
      </section>
    </div>
  );
}
