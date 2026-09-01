import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { prisma } from '../config/database.js';
import { authenticateUser, revokeRefreshToken, rotateRefreshToken } from '../services/auth.service.js';
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

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };
  const result = await authenticateUser(email, password);
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
    include: { company: true, companyLinks: { include: { company: true } } }
  });
  if (!user || !user.active) throw new AppError('Usuário sem acesso ao sistema', 403);
  res.json({ success: true, data: publicUser(user) });
};
