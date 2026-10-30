import { describe, expect, it } from 'vitest';
import { parsePlatformRows, permittedPlatformUrl } from '../src/services/platform-discovery.js';

const url = 'https://compras.m2atecnologia.com.br/processos/index/?search=pavimentacao';

describe('V62 - leitura em portais autenticados', () => {
  it('só cria oportunidade quando objeto, CE, valor e data estão explícitos', () => {
    const rows = [{ text: 'MUNICIPIO DE PACOTI-CE | Concorrência 022/2026 | Execução das obras de pavimentação em pedra tosca | R$ 2.500.000,00 | 15/11/2026', href: url }];
    const result = parsePlatformRows(rows, 'M2A');
    expect(result).toHaveLength(1);
    expect(result[0]?.municipality).toBe('PACOTI');
    expect(result[0]?.estimatedValue).toBe(2500000);
    expect(result[0]?.sessionDate).toBe('2026-11-15');
    expect(result[0]?.sources[0]).toEqual({ source: 'PORTAL', url });
    expect(result[0]?.platformName).toBe('M2A Compras');
  });
  it('não inventa valor, cidade, data ou edital ausentes', () => {
    expect(parsePlatformRows([{ text: 'Construção de escola em outra cidade | 15/11/2026', href: url }], 'M2A')).toEqual([]);
    expect(parsePlatformRows([{ text: 'FORTALEZA-CE | Contratação de obra | R$ 2.000.000,00', href: url }], 'M2A')).toEqual([]);
    expect(parsePlatformRows([{ text: 'PACOTI-CE | Compra de móveis | R$ 2.000.000,00 | 15/11/2026', href: url }], 'M2A')).toEqual([]);
  });
  it('rejeita destino HTTP, redes locais e domínios alheios', () => {
    expect(permittedPlatformUrl('M2A', url)).toBe(true);
    expect(permittedPlatformUrl('M2A', 'http://compras.m2atecnologia.com.br/')).toBe(false);
    expect(permittedPlatformUrl('M2A', 'https://m2atecnologia.com.br.evil.com/')).toBe(false);
    expect(permittedPlatformUrl('M2A', 'https://127.0.0.1/')).toBe(false);
    expect(parsePlatformRows([{ text: 'PACOTI-CE | Obra de pavimentação | R$ 2.500.000,00 | 15/11/2026', href: 'https://example.com/' }], 'M2A')).toEqual([]);
  });
});
