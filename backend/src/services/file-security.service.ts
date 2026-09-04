import path from 'node:path';
import { AppError } from '../utils/app-error.js';

const allowedFiles: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.csv': ['text/csv', 'application/vnd.ms-excel', 'text/plain'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.zip': ['application/zip', 'application/x-zip-compressed']
};

const dangerousExtensions = new Set([
  'bat',
  'cmd',
  'com',
  'cpl',
  'dll',
  'exe',
  'hta',
  'html',
  'htm',
  'jar',
  'js',
  'jse',
  'mjs',
  'msi',
  'php',
  'ps1',
  'scr',
  'sh',
  'vbe',
  'vbs'
]);

function isControlOrDirectionalCharacter(character: string) {
  const code = character.codePointAt(0) ?? 0;
  return (
    code <= 0x1f ||
    code === 0x7f ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069)
  );
}

function hasControlOrDirectionalCharacter(value: string) {
  return Array.from(value).some(isControlOrDirectionalCharacter);
}

function extensionOf(name: string) {
  return path.extname(name).toLowerCase();
}

function startsWith(buffer: Buffer, signature: number[]) {
  return signature.every((byte, index) => buffer[index] === byte);
}

function isZip(buffer: Buffer) {
  return (
    startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWith(buffer, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWith(buffer, [0x50, 0x4b, 0x07, 0x08])
  );
}

export function assertSafeUploadName(name: string) {
  const clean = name.trim().normalize('NFC');
  if (
    !clean ||
    clean === '.' ||
    clean === '..' ||
    clean.startsWith('.') ||
    clean.length > 180 ||
    /[\\/]/.test(clean) ||
    hasControlOrDirectionalCharacter(clean)
  ) {
    throw new AppError('Nome de arquivo inválido', 422);
  }

  const parts = clean.toLowerCase().split('.');
  if (parts.slice(0, -1).some((part) => dangerousExtensions.has(part))) {
    throw new AppError('Nome de arquivo potencialmente perigoso', 422);
  }

  const extension = extensionOf(clean);
  if (!allowedFiles[extension]) {
    throw new AppError('Tipo de arquivo não permitido', 422);
  }
  return clean;
}

export function assertAllowedUploadMetadata(file: Pick<Express.Multer.File, 'originalname' | 'mimetype'>) {
  const name = assertSafeUploadName(file.originalname);
  const extension = extensionOf(name);
  const mimeType = file.mimetype.toLowerCase().split(';', 1)[0]?.trim() ?? '';
  if (!allowedFiles[extension]?.includes(mimeType)) {
    throw new AppError('A extensão do arquivo não corresponde ao tipo informado', 422);
  }
}

export function assertSafeUploadFile(file: Express.Multer.File) {
  assertAllowedUploadMetadata(file);
  if (!file.size || !file.buffer.length) throw new AppError('O arquivo está vazio', 422);

  const extension = extensionOf(file.originalname);
  const firstBytes = file.buffer.subarray(0, 1024);
  const trimmedStart = firstBytes.toString('utf8').trimStart().toLowerCase();
  if (
    startsWith(file.buffer, [0x4d, 0x5a]) ||
    startsWith(file.buffer, [0x7f, 0x45, 0x4c, 0x46]) ||
    trimmedStart.startsWith('#!') ||
    trimmedStart.startsWith('<!doctype html') ||
    trimmedStart.startsWith('<html')
  ) {
    throw new AppError('O conteúdo do arquivo não é seguro', 422);
  }

  const ole = startsWith(file.buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  const signatureIsValid =
    extension === '.pdf'
      ? firstBytes.includes(Buffer.from('%PDF-'))
      : extension === '.png'
        ? startsWith(file.buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        : extension === '.jpg' || extension === '.jpeg'
          ? startsWith(file.buffer, [0xff, 0xd8, 0xff])
          : extension === '.zip'
            ? isZip(file.buffer)
            : extension === '.doc' || extension === '.xls'
              ? ole
              : extension === '.docx'
                ? isZip(file.buffer) && file.buffer.includes(Buffer.from('word/'))
                : extension === '.xlsx'
                  ? isZip(file.buffer) && file.buffer.includes(Buffer.from('xl/'))
                  : extension === '.csv'
                    ? !file.buffer.includes(0)
                    : false;

  if (!signatureIsValid) {
    throw new AppError('O conteúdo do arquivo não corresponde à extensão', 422);
  }
}

export function safeResponseFileName(value: string) {
  const normalized = value
    .normalize('NFC')
    .replace(/[\\/]/g, '_');
  const clean = Array.from(normalized)
    .filter((character) => !isControlOrDirectionalCharacter(character))
    .join('')
    .trim()
    .slice(0, 180);
  return clean || 'arquivo';
}
