import multer from 'multer';
import { env } from '../config/env.js';
import { assertAllowedUploadMetadata } from '../services/file-security.service.js';

export const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    try {
      assertAllowedUploadMetadata(file);
      callback(null, true);
    } catch (error) {
      callback(error instanceof Error ? error : new Error('Arquivo inválido'));
    }
  }
}).single('file');
