import { describe, expect, it } from 'vitest';
import { calculateDiscountPercentage } from '../src/services/discount.service.js';

describe('cálculo simples da baixa', () => {
  it('calcula 14,99% para o exemplo enviado pelo usuário', () => {
    const result = calculateDiscountPercentage('2632406.39', '2237808.67');
    expect(result.toFixed(2)).toBe('14.99');
  });

  it('calcula 2,00% quando o valor final possui baixa de dois por cento', () => {
    const result = calculateDiscountPercentage('1174841.90', '1151345.06');
    expect(result.toFixed(2)).toBe('2.00');
  });

  it('retorna zero quando o valor final é igual ao global', () => {
    const result = calculateDiscountPercentage('100000.00', '100000.00');
    expect(result.toFixed(2)).toBe('0.00');
  });
});
