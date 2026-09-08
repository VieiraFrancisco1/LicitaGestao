import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

export function passwordResetEmailConfigured() {
  return Boolean(env.RESEND_API_KEY && env.PASSWORD_RESET_FROM);
}

export async function sendOrganizationPasswordResetEmail(input: {
  to: string;
  organizationName: string;
  resetUrl: string;
  expiresMinutes: number;
}) {
  if (!passwordResetEmailConfigured()) {
    throw new AppError(
      'O envio de recuperação de senha ainda não foi configurado pelo administrador do sistema.',
      503,
      'PASSWORD_RESET_EMAIL_NOT_CONFIGURED'
    );
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.PASSWORD_RESET_FROM,
      to: [input.to],
      subject: 'Redefinição de senha — LicitaGestão',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1f2937;line-height:1.6">
          <h2 style="margin-bottom:8px">Redefinição de senha</h2>
          <p>Foi solicitada a alteração da senha principal da organização <strong>${escapeHtml(input.organizationName)}</strong>.</p>
          <p>Use o botão abaixo para criar uma nova senha. O link expira em ${input.expiresMinutes} minutos e só pode ser utilizado uma vez.</p>
          <p style="margin:28px 0">
            <a href="${escapeAttribute(input.resetUrl)}" style="background:#1d4ed8;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block;font-weight:700">Redefinir senha</a>
          </p>
          <p style="font-size:13px;color:#64748b">Se você não solicitou esta alteração, ignore esta mensagem. Nenhuma senha será modificada sem o uso do link.</p>
        </div>
      `
    }),
    signal: AbortSignal.timeout(15_000)
  }).catch(() => null);

  if (!response?.ok) {
    throw new AppError('Não foi possível enviar o e-mail de recuperação. Tente novamente em alguns minutos.', 502);
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char] ?? char);
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}
