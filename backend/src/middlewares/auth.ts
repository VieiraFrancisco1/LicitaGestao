import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

type AccessPayload = jwt.JwtPayload & {
  sub: string;
  role: UserRole;
  companyId: string | null;
  organizationId: string;
  sessionVersion: number;
  type: 'access';
};

export const authenticate: RequestHandler = (req, _res, next) => {
  const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
  if (scheme !== 'Bearer' || !token) return next(new AppError('Não autenticado', 401));

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AccessPayload;
    if (payload.type !== 'access' || !payload.sub || !payload.role || !payload.organizationId) {
      return next(new AppError('Token inválido', 401));
    }
    void prisma.user
      .findUnique({
        where: { id: payload.sub },
        include: {
          organization: { select: { id: true, active: true } },
          company: { select: { active: true, organizationId: true } }
        }
      })
      .then((user) => {
        if (!user?.active || !user.organization.active) {
          return next(new AppError('Usuário sem acesso ao sistema', 403));
        }
        if (payload.organizationId !== user.organizationId || user.organization.id !== user.organizationId) {
          return next(new AppError('Sessão inválida', 401));
        }
        if (user.role === 'EMPRESA' && (!user.company?.active || user.company.organizationId !== user.organizationId)) {
          return next(new AppError('Usuário sem acesso ao sistema', 403));
        }
        if (payload.sessionVersion !== user.sessionVersion) {
          return next(new AppError('Sessão inválida ou encerrada', 401));
        }
        req.auth = {
          userId: user.id,
          role: user.role,
          companyId: user.companyId,
          organizationId: user.organizationId
        };
        next();
      })
      .catch(next);
  } catch {
    next(new AppError('Token inválido ou expirado', 401));
  }
};

export const authorize = (...roles: UserRole[]): RequestHandler => {
  return (req, _res, next) => {
    if (!req.auth) return next(new AppError('Não autenticado', 401));
    if (!roles.includes(req.auth.role)) return next(new AppError('Você não tem permissão para esta ação', 403));
    next();
  };
};
