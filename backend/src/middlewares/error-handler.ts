import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../utils/app-error.js';
import multer from 'multer';
import { env } from '../config/env.js';

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new AppError('Rota não encontrada', 404));
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? `O arquivo excede o limite de ${env.MAX_UPLOAD_MB} MB`
        : 'Não foi possível receber o arquivo';
    res.status(422).json({ success: false, message });
    return;
  }
  if (error instanceof ZodError) {
    res.status(422).json({
      success: false,
      message: 'Dados inválidos',
      errors: error.flatten().fieldErrors
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    res.status(409).json({ success: false, message: 'Já existe um registro com esses dados' });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    return;
  }

  console.error(error);
  res.status(500).json({ success: false, message: 'Erro interno do servidor' });
};
