import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

export const validate =
  (schema: ZodType): RequestHandler =>
  (req, _res, next) => {
    const parsed = schema.parse({
      body: req.body ?? {},
      params: req.params ?? {},
      query: req.query ?? {}
    }) as {
      body: unknown;
      params: typeof req.params;
      query: unknown;
    };
    req.body = parsed.body;
    req.params = parsed.params;
    Object.defineProperty(req, 'query', {
      value: parsed.query,
      writable: true,
      configurable: true,
      enumerable: true
    });
    next();
  };
