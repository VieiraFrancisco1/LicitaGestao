import { UserRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { accessibleBidWhere } from '../src/services/bid.service.js';
import { accessibleParticipationWhere } from '../src/services/tender.service.js';

const organizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('licitação geral compartilhada somente dentro da organização', () => {
  it('limita o login EMPRESA à própria empresa e organização', () => {
    const auth = {
      userId: 'user-a',
      role: UserRole.EMPRESA,
      companyId: '11111111-1111-4111-8111-111111111111',
      organizationId
    };
    expect(accessibleBidWhere(auth)).toEqual({
      companyId: auth.companyId,
      tender: { organizationId },
      company: { organizationId }
    });
    expect(accessibleParticipationWhere(auth)).toEqual({
      companyId: auth.companyId,
      tender: { organizationId }
    });
  });

  it('limita o funcionário às empresas atribuídas dentro da organização', () => {
    const auth = { userId: 'staff-a', role: UserRole.FUNCIONARIO, companyId: null, organizationId };
    expect(accessibleBidWhere(auth)).toEqual({
      tender: { organizationId },
      company: { organizationId, staffLinks: { some: { userId: auth.userId } } }
    });
    expect(accessibleParticipationWhere(auth)).toEqual({
      company: { organizationId, staffLinks: { some: { userId: auth.userId } } },
      tender: { organizationId }
    });
  });

  it('permite ao administrador consultar todas as participações da própria organização, não de outros clientes', () => {
    const auth = { userId: 'admin', role: UserRole.ADMIN, companyId: null, organizationId };
    expect(accessibleBidWhere(auth)).toEqual({ tender: { organizationId }, company: { organizationId } });
    expect(accessibleParticipationWhere(auth)).toEqual({ tender: { organizationId } });
  });
});
