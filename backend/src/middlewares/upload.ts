import multer from 'multer';
import { env } from '../config/env.js';

export const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 }
}).single('file');
