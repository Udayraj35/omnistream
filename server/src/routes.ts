import express from 'express';
import { authController } from './controllers/auth.controller.ts';
import { streamController } from './controllers/stream.controller.ts';
import { toolsController } from './controllers/tools.controller.ts';

export const router = express.Router();

// Auth Routes
router.get('/auth/:platform/url', authController.getLoginUrl);
router.get('/auth/:platform/callback', authController.callback);

// Config / Meta
router.get('/config/auth-status', authController.getAuthConfigStatus);

// Account Routes
router.get('/accounts', authController.getUserAccounts);
router.post('/accounts', authController.createAccount);
router.delete('/accounts/:id', authController.removeAccount);

// Stream Routes
router.post('/stream/start', streamController.startStream);
router.post('/stream/stop', streamController.stopStream);
router.get('/stream/ingest', streamController.getIngestConfig);

// Tools Routes
router.post('/tools/resolve', toolsController.resolveUrl);
router.get('/tools/stream/:id', toolsController.proxyMedia);

// Health Check
router.get('/health', (req, res) => { res.json({ status: 'ok', timestamp: Date.now() }) });