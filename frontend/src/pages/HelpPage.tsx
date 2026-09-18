import { ExternalLink, HelpCircle, MessageCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, SupportSettings } from '../types';

export function HelpPage() {
  const [settings, setSettings] = useState<SupportSettings | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void api
      .get<ApiResponse<SupportSettings>>('/support')
      .then((response) => setSettings(response.data.data))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const digits = settings?.supportWhatsapp?.replace(/\D/g, '') ?? '';
  const whatsappUrl = digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent('Olá, preciso de ajuda com o LicitaGestão.')}`
    : '';

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <p>Suporte</p>
          <h2>Ajuda</h2>
          <span>Entre em contato com o responsável pelo LicitaGestão sempre que precisar.</span>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <section className="help-card">
        <span className="help-card-icon"><HelpCircle size={28} /></span>
        <div>
          <span className="eyebrow">Atendimento</span>
          <h3>{settings?.supportName || 'Suporte LicitaGestão'}</h3>
          <p>Problemas de acesso, integrações, dúvidas sobre o sistema ou solicitação de autorização do Gmail.</p>
        </div>
        {whatsappUrl ? (
          <a className="primary-button help-whatsapp-button" href={whatsappUrl} target="_blank" rel="noreferrer">
            <MessageCircle size={18} />
            Falar pelo WhatsApp
            <ExternalLink size={14} />
          </a>
        ) : (
          <div className="alert alert-warning">O número de suporte ainda não foi configurado pelo administrador principal.</div>
        )}
      </section>
    </div>
  );
}
