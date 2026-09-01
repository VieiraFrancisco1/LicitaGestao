import { UserRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { accessibleBidWhere } from '../src/services/bid.service.js';
import { accessibleParticipationWhere } from '../src/services/tender.service.js';

describe('licitação geral compartilhada e participações privadas', () => {
  it('limita a participação do login EMPRESA ao próprio companyId', () => {
    const auth = {
      userId: 'user-a',
      role: UserRole.EMPRESA,
      companyId: '11111111-1111-4111-8111-111111111111'
    };
    expect(accessibleBidWhere(auth)).toEqual({ companyId: auth.companyId });
    expect(accessibleParticipationWhere(auth)).toEqual({ companyId: auth.companyId });
  });

  it('limita o funcionário às empresas atribuídas ao login', () => {
    const auth = { userId: 'staff-a', role: UserRole.FUNCIONARIO, companyId: null };
    const expected = { company: { staffLinks: { some: { userId: auth.userId } } } };
    expect(accessibleBidWhere(auth)).toEqual(expected);
    expect(accessibleParticipationWhere(auth)).toEqual(expected);
  });

  it('permite ao administrador consultar todas as participações', () => {
    const auth = { userId: 'admin', role: UserRole.ADMIN, companyId: null };
    expect(accessibleBidWhere(auth)).toEqual({});
    expect(accessibleParticipationWhere(auth)).toEqual({});
  });
});
