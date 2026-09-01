import { describe, expect, it } from 'vitest';
import { isValidCnpj, onlyDigits } from '../src/utils/cnpj.js';

describe('validação de CNPJ', () => {
  it('aceita CNPJ válido com máscara', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
  });

  it('recusa dígitos repetidos e verificador incorreto', () => {
    expect(isValidCnpj('11.111.111/1111-11')).toBe(false);
    expect(isValidCnpj('11.222.333/0001-82')).toBe(false);
  });

  it('normaliza o valor', () => {
    expect(onlyDigits('11.222.333/0001-81')).toBe('11222333000181');
  });
});
