export const DOCUMENT_UPLOAD_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.zip';
export const DOCUMENT_UPLOAD_LIMIT_MB = 25;

const allowedExtensions = new Set(DOCUMENT_UPLOAD_ACCEPT.split(','));

export function validateDocumentUpload(file: File) {
  if (!file.size) return 'O arquivo selecionado está vazio.';
  if (file.size > DOCUMENT_UPLOAD_LIMIT_MB * 1024 * 1024) {
    return `O arquivo excede o limite de ${DOCUMENT_UPLOAD_LIMIT_MB} MB.`;
  }
  const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
  if (!allowedExtensions.has(extension)) {
    return 'Formato não permitido. Use PDF, Word, Excel, CSV, JPG, PNG ou ZIP.';
  }
  return null;
}

