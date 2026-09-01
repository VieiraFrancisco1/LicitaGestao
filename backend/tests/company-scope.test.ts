import { UserRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { scopedBidCompanyId } from '../src/services/access.service.js';
import { AppError } from '../src/utils/app-error.js';

describe('isolamento das licitações por empresa', () => {
  it('força o companyId do login EMPRESA', () => {
    const companyId = '11111111-1111-4111-8111-111111111111';
    expect(scopedBidCompanyId({ userId: 'user', role: UserRole.EMPRESA, companyId })).toBe(companyId);
  });

  it('recusa troca manual de companyId pelo login EMPRESA', () => {
    const action = () =>
      scopedBidCompanyId(
        {
          userId: 'user',
          role: UserRole.EMPRESA,
          companyId: '11111111-1111-4111-8111-111111111111'
        },
        '22222222-2222-4222-8222-222222222222'
      );
    expect(action).toThrow(AppError);
    try {
      action();
    } catch (error) {
      expect((error as AppError).statusCode).toBe(404);
    }
  });

  it('mantém o filtro escolhido pelo administrador ou funcionário', () => {
    const companyId = '11111111-1111-4111-8111-111111111111';
    expect(scopedBidCompanyId({ userId: 'admin', role: UserRole.ADMIN, companyId: null }, companyId)).toBe(
      companyId
    );
    expect(
      scopedBidCompanyId({ userId: 'staff', role: UserRole.FUNCIONARIO, companyId: null }, companyId)
    ).toBe(companyId);
  });
});
