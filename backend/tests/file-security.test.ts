import { describe, expect, it } from 'vitest';
import {
  assertAllowedUploadMetadata,
  assertSafeUploadFile,
  assertSafeUploadName,
  safeResponseFileName
} from '../src/services/file-security.service.js';

function uploadedFile(originalname: string, mimetype: string, buffer: Buffer) {
  return {
    fieldname: 'file',
    originalname,
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    buffer
  } as Express.Multer.File;
}

describe('segurança de arquivos', () => {
  it('aceita um PDF cuja extensão, MIME e assinatura correspondem', () => {
    const file = uploadedFile('edital.pdf', 'application/pdf', Buffer.from('%PDF-1.7\nconteudo'));
    expect(() => assertSafeUploadFile(file)).not.toThrow();
  });

  it('recusa extensões não permitidas e nomes com extensão perigosa escondida', () => {
    expect(() => assertSafeUploadName('programa.exe')).toThrow('Tipo de arquivo não permitido');
    expect(() => assertSafeUploadName('edital.exe.pdf')).toThrow('Nome de arquivo potencialmente perigoso');
  });

  it('recusa quando o MIME não corresponde à extensão', () => {
    expect(() =>
      assertAllowedUploadMetadata({ originalname: 'edital.pdf', mimetype: 'image/png' })
    ).toThrow('A extensão do arquivo não corresponde ao tipo informado');
  });

  it('recusa executável disfarçado de PDF', () => {
    const file = uploadedFile('edital.pdf', 'application/pdf', Buffer.from([0x4d, 0x5a, 0x90, 0x00]));
    expect(() => assertSafeUploadFile(file)).toThrow('O conteúdo do arquivo não é seguro');
  });

  it('recusa imagem cuja assinatura não corresponde ao nome', () => {
    const file = uploadedFile('foto.png', 'image/png', Buffer.from('isto não é uma imagem'));
    expect(() => assertSafeUploadFile(file)).toThrow('O conteúdo do arquivo não corresponde à extensão');
  });

  it('limpa nomes antigos antes de enviá-los no cabeçalho de download', () => {
    expect(safeResponseFileName('../edital\u202E.pdf\n')).toBe('.._edital.pdf');
  });
});

