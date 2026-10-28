import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { discoverySettings, type Platform } from '../services/discovery-core.js';
import { listPlatformLoginStatus, savePlatformLogin, removePlatformLogin, permittedLoginPlatforms } from '../services/discovery-credentials.js';
import { checkOpportunityPhase, getDiscoveryStatus, listOpportunities, opportunityDraft, saveDiscoverySettings, startDiscoveryScan } from '../services/discovery.service.js';
export const discoveryRouter = Router();
discoveryRouter.use(authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FUNCIONARIO));
discoveryRouter.get('/status', asyncHandler(async (req, res) => { res.json({ success: true, data: await getDiscoveryStatus(req.auth!) }); }));
const settingsSchema = z.object({ body: discoverySettings, params: z.object({}), query: z.object({}) });
discoveryRouter.put('/settings', validate(settingsSchema), asyncHandler(async (req, res) => { res.json({ success: true, data: await saveDiscoverySettings(req.body, req.auth!) }); }));
discoveryRouter.post('/scan', validate(settingsSchema), asyncHandler(async (req, res) => { res.status(202).json({ success: true, data: await startDiscoveryScan(req.auth!, req.body) }); }));
discoveryRouter.get('/', validate(z.object({ body: z.object({}), params: z.object({}), query: z.object({ page: z.coerce.number().int().min(1).max(150).default(1), platform: z.enum(['BLL', 'M2A', 'LICITAMAIS', 'COMPRASGOV', 'PORTALCOMPRAS', 'LICITANET', 'BBMNET', 'OUTRAS', 'NAO_INFORMADA']).optional() }) })), asyncHandler(async (req, res) => { res.json({ success: true, data: await listOpportunities(req.auth!, Number(req.query.page), undefined, req.query.platform as Platform | undefined) }); }));
// Nunca devolva credenciais ao navegador. Apenas o status de armazenamento.
discoveryRouter.get('/platform-logins', asyncHandler(async (req, res) => { res.json({ success: true, data: await listPlatformLoginStatus(req.auth!) }); }));
const loginSchema = z.object({ body: z.object({ platform: z.enum(permittedLoginPlatforms), username: z.string().trim().min(1).max(180), password: z.string().min(1).max(512) }), params: z.object({}), query: z.object({}) });
discoveryRouter.post('/platform-logins', validate(loginSchema), asyncHandler(async (req, res) => { res.json({ success: true, data: await savePlatformLogin(req.auth!, req.body) }); }));
discoveryRouter.delete('/platform-logins/:platform', validate(z.object({ body: z.object({}), params: z.object({ platform: z.enum(permittedLoginPlatforms) }), query: z.object({}) })), asyncHandler(async (req, res) => { res.json({ success: true, data: await removePlatformLogin(req.auth!, req.params.platform as 'BLL' | 'M2A' | 'LICITAMAIS') }); }));
discoveryRouter.get('/:id/draft', validate(z.object({ body: z.object({}), params: z.object({ id: z.string().uuid() }), query: z.object({}) })), asyncHandler(async (req, res) => { res.json({ success: true, data: await opportunityDraft(req.params.id as string, req.auth!) }); }));

discoveryRouter.post('/:id/check-phase', validate(z.object({ body: z.object({}), params: z.object({ id: z.string().uuid() }), query: z.object({}) })), asyncHandler(async (req, res) => { res.json({ success: true, data: await checkOpportunityPhase(req.params.id as string, req.auth!) }); }));
