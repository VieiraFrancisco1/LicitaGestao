import type { NextFunction, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { authorize } from '../src/middlewares/auth.js';
import { AppError } from '../src/utils/app-error.js';

const response = {} as Response;

describe('autorização por perfil', () => {
  it('permite perfil autorizado', () => {
    const req = { auth: { userId: '1', role: UserRole.ADMIN, companyId: null } } as Request;
    const nextMock = vi.fn();
    const next = nextMock as NextFunction;
    authorize(UserRole.ADMIN)(req, response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('recusa perfil sem permissão', () => {
    const req = { auth: { userId: '1', role: UserRole.EMPRESA, companyId: '2' } } as Request;
    const nextMock = vi.fn();
    const next = nextMock as NextFunction;
    authorize(UserRole.ADMIN)(req, response, next);
    expect(nextMock.mock.calls[0]?.[0]).toBeInstanceOf(AppError);
    expect((nextMock.mock.calls[0]?.[0] as AppError).statusCode).toBe(403);
  });
});
