import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Organization, UserRole } from '@prisma/client';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { publicUser } from '../utils/public-user.js';
import { passwordResetEmailConfigured, sendOrganizationPasswordResetEmail } from './transactional-email.service.js';

type TokenUser = {
  id: string;
  role: UserRole;
  companyId: string | null;
  organizationId: string;
  sessionVersion: number;
};
type RefreshPayload = jwt.JwtPayload & { sub: string; type: 'refresh' };
type OrganizationAccessPayload = jwt.JwtPayload & {
  sub: string;
  organizationId: string;
  sessionVersion: number;
  type: 'organization-access';
};

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

const signAccessToken = (user: TokenUser) =>
  jwt.sign(
    {
      role: user.role,
      companyId: user.companyId,
      organizationId: user.organizationId,
      sessionVersion: user.sessionVersion,
      type: 'access'
    },
    env.JWT_SECRET,
    {
      subject: user.id,
      expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as SignOptions['expiresIn']
    }
  );

const signOrganizationAccessToken = (organization: Pick<Organization, 'id' | 'sessionVersion'>) =>
  jwt.sign(
    {
      organizationId: organization.id,
      sessionVersion: organization.sessionVersion,
      type: 'organization-access'
    },
    env.JWT_SECRET,
    {
      subject: organization.id,
      expiresIn: env.ORGANIZATION_ACCESS_EXPIRES_IN as SignOptions['expiresIn']
    }
  );

const signRefreshToken = (userId: string) =>
  jwt.sign({ type: 'refresh' }, env.JWT_REFRESH_SECRET, {
    subject: userId,
    expiresIn: `${env.REFRESH_TOKEN_EXPIRES_IN_DAYS}d`
  });

const saveRefreshToken = async (userId: string, refreshToken: string) => {
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 86_400_000);
  await prisma.refreshToken.create({ data: { userId, tokenHash: hashToken(refreshToken), expiresAt } });
};

const memberSelect = {
  id: true,
  name: true,
  role: true
} as const;

export async function loginOrganization(email: string, password: string) {
  const organization = await prisma.organization.findUnique({
    where: { loginEmail: email.toLowerCase() }
  });
  if (!organization || !organization.active || !(await bcrypt.compare(password, organization.passwordHash))) {
    throw new AppError('E-mail ou senha da empresa inválidos', 401);
  }

  const members = await prisma.user.findMany({
    where: { organizationId: organization.id, active: true },
    select: memberSelect,
    orderBy: [{ role: 'asc' }, { name: 'asc' }]
  });
  if (members.length === 0) throw new AppError('Nenhum usuário ativo foi encontrado nesta organização', 403);

  return {
    organizationToken: signOrganizationAccessToken(organization),
    organization: { id: organization.id, name: organization.name },
    members
  };
}

export async function authenticateOrganizationMember(
  organizationToken: string,
  userId: string,
  password: string
) {
  let payload: OrganizationAccessPayload;
  try {
    payload = jwt.verify(organizationToken, env.JWT_SECRET) as OrganizationAccessPayload;
  } catch {
    throw new AppError('O acesso da empresa expirou. Entre novamente com a conta principal.', 401);
  }
  if (payload.type !== 'organization-access' || !payload.organizationId || payload.sub !== payload.organizationId) {
    throw new AppError('Acesso da empresa inválido', 401);
  }

  const organization = await prisma.organization.findUnique({ where: { id: payload.organizationId } });
  if (!organization?.active || organization.sessionVersion !== payload.sessionVersion) {
    throw new AppError('O acesso da empresa não está mais válido. Entre novamente.', 401);
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId: organization.id, active: true },
    include: { organization: true, company: true, companyLinks: { include: { company: true } } }
  });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError('Senha do usuário incorreta', 401);
  }
  if (user.role === 'EMPRESA' && (!user.company || !user.company.active)) {
    throw new AppError('Empresa sem acesso ao sistema', 403);
  }

  const refreshToken = signRefreshToken(user.id);
  await saveRefreshToken(user.id, refreshToken);
  return { accessToken: signAccessToken(user), refreshToken, user: publicUser(user) };
}

// Mantido como função interna para compatibilidade de serviços/testes antigos.
// O frontend não possui mais rota de login direto por usuário.
export const authenticateUser = async (email: string, password: string) => {
  const users = await prisma.user.findMany({
    where: { email: email.toLowerCase(), active: true },
    include: { organization: true, company: true, companyLinks: { include: { company: true } } },
    take: 2
  });
  const user = users.length === 1 ? users[0] : undefined;
  if (!user || !user.organization.active || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError('E-mail ou senha inválidos', 401);
  }
  if (user.role === 'EMPRESA' && (!user.company || !user.company.active)) {
    throw new AppError('Empresa sem acesso ao sistema', 403);
  }
  const refreshToken = signRefreshToken(user.id);
  await saveRefreshToken(user.id, refreshToken);
  return { accessToken: signAccessToken(user), refreshToken, user: publicUser(user) };
};

export const rotateRefreshToken = async (token: string) => {
  let payload: RefreshPayload;
  try {
    payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshPayload;
  } catch {
    throw new AppError('Sessão inválida ou expirada', 401);
  }
  if (payload.type !== 'refresh' || !payload.sub) throw new AppError('Sessão inválida', 401);

  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!stored || stored.revokedAt || stored.expiresAt <= new Date() || stored.userId !== payload.sub) {
    throw new AppError('Sessão inválida ou expirada', 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: stored.userId },
    include: { organization: true, company: true, companyLinks: { include: { company: true } } }
  });
  if (
    !user ||
    !user.active ||
    !user.organization.active ||
    (user.role === 'EMPRESA' && !user.company?.active)
  ) {
    throw new AppError('Usuário sem acesso ao sistema', 403);
  }

  const nextRefreshToken = signRefreshToken(user.id);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 86_400_000);
  await prisma.$transaction([
    prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } }),
    prisma.refreshToken.create({ data: { userId: user.id, tokenHash: hashToken(nextRefreshToken), expiresAt } })
  ]);

  return { accessToken: signAccessToken(user), refreshToken: nextRefreshToken, user: publicUser(user) };
};

export const revokeRefreshToken = async (token?: string) => {
  if (!token) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() }
  });
};

export const changeOwnPassword = async (userId: string, currentPassword: string, newPassword: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.active) throw new AppError('Usuário sem acesso ao sistema', 403);
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new AppError('A senha atual está incorreta', 422);
  }
  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    throw new AppError('A nova senha precisa ser diferente da senha atual', 422);
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const revokedAt = new Date();
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash, sessionVersion: { increment: 1 } } }),
    prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt } })
  ]);
};

export async function requestOrganizationPasswordReset(email: string) {
  if (!passwordResetEmailConfigured()) {
    throw new AppError('A recuperação de senha ainda não foi configurada no servidor', 503, 'PASSWORD_RESET_NOT_CONFIGURED');
  }
  const organization = await prisma.organization.findUnique({ where: { loginEmail: email.toLowerCase() } });
  if (!organization?.active) return;

  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60_000);
  await prisma.$transaction([
    prisma.organizationPasswordResetToken.updateMany({
      where: { organizationId: organization.id, usedAt: null },
      data: { usedAt: new Date() }
    }),
    prisma.organizationPasswordResetToken.create({
      data: { organizationId: organization.id, tokenHash, expiresAt }
    })
  ]);

  const resetUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/redefinir-senha?token=${encodeURIComponent(rawToken)}`;
  await sendOrganizationPasswordResetEmail({
    to: organization.loginEmail,
    organizationName: organization.name,
    resetUrl,
    expiresMinutes: env.PASSWORD_RESET_TTL_MINUTES
  });
}

export async function resetOrganizationPassword(rawToken: string, newPassword: string) {
  const tokenHash = hashToken(rawToken);
  const reset = await prisma.organizationPasswordResetToken.findUnique({
    where: { tokenHash },
    include: { organization: true }
  });
  if (!reset || reset.usedAt || reset.expiresAt <= new Date() || !reset.organization.active) {
    throw new AppError('Este link de recuperação é inválido ou já expirou.', 422, 'INVALID_RESET_TOKEN');
  }
  if (await bcrypt.compare(newPassword, reset.organization.passwordHash)) {
    throw new AppError('A nova senha precisa ser diferente da senha atual.', 422);
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const now = new Date();
  const userIds = (
    await prisma.user.findMany({ where: { organizationId: reset.organizationId }, select: { id: true } })
  ).map((user) => user.id);
  await prisma.$transaction([
    prisma.organization.update({
      where: { id: reset.organizationId },
      data: { passwordHash, sessionVersion: { increment: 1 } }
    }),
    prisma.organizationPasswordResetToken.update({ where: { id: reset.id }, data: { usedAt: now } }),
    prisma.organizationPasswordResetToken.updateMany({
      where: { organizationId: reset.organizationId, id: { not: reset.id }, usedAt: null },
      data: { usedAt: now }
    }),
    prisma.user.updateMany({
      where: { organizationId: reset.organizationId },
      data: { sessionVersion: { increment: 1 } }
    }),
    prisma.refreshToken.updateMany({
      where: { userId: { in: userIds }, revokedAt: null },
      data: { revokedAt: now }
    })
  ]);
}
