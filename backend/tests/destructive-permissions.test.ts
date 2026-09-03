import { UserRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { deleteBid } from '../src/services/bid.service.js';

describe('proteção de ações destrutivas', () => {
  it('impede empresa de desassociar a participação inteira', async () => {
    await expect(
      deleteBid('11111111-1111-4111-8111-111111111111', {
        userId: 'empresa',
        role: UserRole.EMPRESA,
        companyId: '22222222-2222-4222-8222-222222222222'
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
