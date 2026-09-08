import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { prisma } from '../config/database.js';
import {
  authenticateOrganizationMember,
  changeOwnPassword,
  loginOrganization,
  requestOrganizationPasswordReset,
  resetOrganizationPassword as resetOrganizationPasswordService,
  revokeRefreshToken,
  rotateRefreshToken
} from '../services/auth.service.js';
import { AuditActions, recordAudit } from '../services/audit.service.js';
import { AppError } from '../utils/app-error.js';
import { publicUser } from '../utils/public-user.js';

const cookieName = 'licitagestao_refresh';
const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/auth',
  maxAge: env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 86_400_000
};

export const organizationLogin = async (req: Request, res: Response) => {
  const result = await loginOrganization(req.body.email, req.body.password);
  res.json({ success: true, data: result });
};

export const memberLogin = async (req: Request, res: Response) => {
  const result = await authenticateOrganizationMember(
    req.body.organizationToken,
    req.body.userId,
    req.body.password
  );
  res.cookie(cookieName, result.refreshToken, cookieOptions);
  res.json({ success: true, data: { accessToken: result.accessToken, user: result.user } });
};

export const refresh = async (req: Request, res: Response) => {
  const token = req.cookies?.[cookieName] as string | undefined;
  if (!token) throw new AppError('Sessão não encontrada', 401);
  const result = await rotateRefreshToken(token);
  res.cookie(cookieName, result.refreshToken, cookieOptions);
  res.json({ success: true, data: { accessToken: result.accessToken, user: result.user } });
};

export const logout = async (req: Request, res: Response) => {
  await revokeRefreshToken(req.cookies?.[cookieName] as string | undefined);
  res.clearCookie(cookieName, cookieOptions);
  res.json({ success: true, message: 'Sessão encerrada' });
};

export const me = async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    include: { organization: true, company: true, companyLinks: { include: { company: true } } }
  });
  if (!user || !user.active || !user.organization.active) throw new AppError('Usuário sem acesso ao sistema', 403);
  res.json({ success: true, data: publicUser(user) });
};

export const forgotOrganizationPassword = async (req: Request, res: Response) => {
  await requestOrganizationPasswordReset(req.body.email);
  res.json({
    success: true,
    message: 'Se este e-mail estiver cadastrado como acesso principal, enviaremos as instruções de redefinição.'
  });
};

export const resetOrganizationPassword = async (req: Request, res: Response) => {
  await resetOrganizationPasswordService(req.body.token, req.body.newPassword);
  res.json({ success: true, message: 'Senha principal alterada. Volte ao login e entre com a nova senha.' });
};

export const changePassword = async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  await changeOwnPassword(req.auth!.userId, currentPassword, newPassword);
  await recordAudit(req.auth!, {
    action: AuditActions.UPDATE,
    entityType: 'USER_SECURITY',
    entityId: req.auth!.userId,
    description: 'Senha alterada pelo próprio usuário'
  });
  res.clearCookie(cookieName, cookieOptions);
  res.json({ success: true, message: 'Senha alterada. Entre novamente com a nova senha.' });
};
