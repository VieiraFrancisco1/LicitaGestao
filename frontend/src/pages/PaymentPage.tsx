import {
  CheckCircle2,
  CreditCard,
  LockKeyhole,
  QrCode,
  ShieldCheck
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { errorMessage, rawApi } from '../services/api';
import type {
  ApiResponse,
  BillingCheckoutData,
  BillingPlanCode,
  BillingPlansData,
  BillingStatusData
} from '../types';
import licitaGestaoLogo from '../assets/licitagestao-logo.png';
import './access-flow.css';

const TOKEN_KEY = 'licitagestao.billing-token';

const planCopy: Record<BillingPlanCode, string> = {
  MONTHLY: '1 mês de acesso',
  QUARTERLY: '3 meses de acesso',
  SEMIANNUAL: '6 meses de acesso'
};

export function PaymentPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [token] = useState(() => window.sessionStorage.getItem(TOKEN_KEY) ?? '');
  const [plansData, setPlansData] = useState<BillingPlansData | null>(null);
  const [status, setStatus] = useState<BillingStatusData | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<BillingPlanCode>('MONTHLY');
  const [working, setWorking] = useState(false);
  const [reconciledOrderId, setReconciledOrderId] = useState('');
  const [error, setError] = useState('');

  const result = searchParams.get('resultado');
  const returnedOrderId = searchParams.get('order_id') ?? '';

  const loadStatus = useCallback(async () => {
    if (!token) return;
    try {
      const response = await rawApi.get<ApiResponse<BillingStatusData>>('/billing/status', {
        params: { token }
      });
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
    if (!token) return;
    const first = window.setTimeout(() => void loadStatus(), 0);
    const polling = window.setInterval(() => void loadStatus(), 5_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(polling);
    };
  }, [token, loadStatus]);

  useEffect(() => {
    if (!token || !returnedOrderId) return;
    let cancelled = false;
    void rawApi
      .post<ApiResponse<BillingStatusData>>('/billing/reconcile', {
        token,
        orderId: returnedOrderId
      })
      .then((response) => {
        if (!cancelled) setStatus(response.data.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setReconciledOrderId(returnedOrderId);
      });
    return () => {
      cancelled = true;
    };
  }, [token, returnedOrderId]);

  const checking = Boolean(
    token && returnedOrderId && reconciledOrderId !== returnedOrderId
  );

  const selected = useMemo(
    () => plansData?.plans.find((plan) => plan.code === selectedPlan) ?? null,
    [plansData, selectedPlan]
  );

  const checkout = async () => {
    if (!token || !selected) return;
    setWorking(true);
    setError('');
    try {
      const response = await rawApi.post<ApiResponse<BillingCheckoutData>>('/billing/checkout', {
        token,
        plan: selected.code
      });
      window.location.assign(response.data.data.checkoutUrl);
    } catch (err) {
      setError(errorMessage(err));
      setWorking(false);
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
            Volte ao login. Se a assinatura estiver pendente ou vencida, o sistema abrirá esta tela novamente.
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
              ? ` até ${new Intl.DateTimeFormat('pt-BR').format(new Date(status.subscriptionExpiresAt))}`
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
            <span className="eyebrow">Assinatura</span>
            <h2>Escolha seu plano</h2>
            <p>
              {status?.organization.name
                ? `Finalize o pagamento para liberar o acesso de ${status.organization.name}.`
                : 'Finalize o pagamento para liberar o acesso.'}
            </p>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {!plansData?.configured && (
          <div className="alert alert-warning">
            Os pagamentos ainda não foram configurados pelo administrador do LicitaGestão.
          </div>
        )}

        {checking && (
          <div className="alert alert-info">Conferindo a confirmação diretamente no Mercado Pago...</div>
        )}

        {result === 'pendente' && (
          <div className="alert alert-warning">
            O pagamento está pendente. O acesso será liberado automaticamente assim que o Mercado Pago confirmar.
          </div>
        )}

        {result === 'falha' && (
          <div className="alert alert-error">
            O pagamento não foi concluído. Você pode escolher o plano e tentar novamente.
          </div>
        )}

        <div className="billing-plans">
          {plansData?.plans.map((plan) => (
            <button
              type="button"
              key={plan.code}
              className={`billing-plan-card ${selectedPlan === plan.code ? 'selected' : ''}`}
              onClick={() => setSelectedPlan(plan.code)}
            >
              <span>{plan.name}</span>
              <strong>{plan.displayPrice}</strong>
              <small>{planCopy[plan.code]}</small>
              <em>{selectedPlan === plan.code ? 'Selecionado' : 'Escolher plano'}</em>
            </button>
          ))}
        </div>

        <div className="payment-methods-preview">
          <div>
            <QrCode size={23} />
            <span>
              <strong>Pix</strong>
              <small>Liberação automática após a confirmação</small>
            </span>
          </div>
          <div>
            <CreditCard size={23} />
            <span>
              <strong>Cartão de crédito</strong>
              <small>Pagamento no ambiente seguro do Mercado Pago</small>
            </span>
          </div>
        </div>

        <div className="payment-checkout-box">
          <div>
            <small>Plano selecionado</small>
            <strong>{selected?.name ?? '—'}</strong>
            <span>{selected?.displayPrice ?? '—'}</span>
          </div>
          <button
            className="primary-button large"
            disabled={working || !selected || !plansData?.configured}
            onClick={() => void checkout()}
          >
            <LockKeyhole size={18} />
            {working ? 'Abrindo checkout...' : 'Pagar com Pix ou cartão'}
          </button>
        </div>

        <div className="payment-security-note">
          <ShieldCheck size={18} />
          <span>
            O LicitaGestão não recebe nem armazena os dados do cartão. A transação é concluída no Checkout Pro do Mercado Pago.
          </span>
        </div>

        <Link className="payment-back-link" to="/login">
          Voltar ao login
        </Link>
      </section>
    </div>
  );
}
