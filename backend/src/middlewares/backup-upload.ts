import multer from 'multer';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

export const uploadBackup = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const validName = file.originalname.toLowerCase().endsWith('.json');
    const validType = ['application/json', 'text/json', 'application/octet-stream'].includes(file.mimetype);
    if (!validName || !validType) {
      callback(new AppError('Selecione um arquivo de backup JSON válido', 422));
      return;
    }
    callback(null, true);
  }
}).single('file');
