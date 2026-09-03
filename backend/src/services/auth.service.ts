import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { publicUser } from '../utils/public-user.js';

type TokenUser = { id: string; role: UserRole; companyId: string | null; sessionVersion: number };
type RefreshPayload = jwt.JwtPayload & { sub: string; type: 'refresh' };

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

const signAccessToken = (user: TokenUser) =>
  jwt.sign(
    { role: user.role, companyId: user.companyId, sessionVersion: user.sessionVersion, type: 'access' },
    env.JWT_SECRET,
    {
    subject: user.id,
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as SignOptions['expiresIn']
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

export const authenticateUser = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { company: true, companyLinks: { include: { company: true } } }
  });
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
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
    include: { company: true, companyLinks: { include: { company: true } } }
  });
  if (!user || !user.active || (user.role === 'EMPRESA' && !user.company?.active)) {
    throw new AppError('Usuário sem acesso ao sistema', 403);
  }

  const nextRefreshToken = signRefreshToken(user.id);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 86_400_000);
  await prisma.$transaction([
    prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } }),
    prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: hashToken(nextRefreshToken), expiresAt }
    })
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
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash, sessionVersion: { increment: 1 } }
    }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt }
    })
  ]);
};
