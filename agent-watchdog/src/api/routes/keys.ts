import { Router, type Request, type Response } from 'express';
import { db } from '../../db/index.js';

export const keysRouter = Router();

function integrationConfig(req: Request): { baseUrl: string; guardEndpoint: string } {
  return {
    baseUrl: `${req.protocol}://${req.get('host')}`,
    guardEndpoint: '/v1/guard',
  };
}

keysRouter.get('/auth/config', (req: Request, res: Response) => {
  const config = integrationConfig(req);
  return res.json({
    requiresApiKey: db.hasActiveApiKeys(),
    ...config,
  });
});

keysRouter.post('/auth', (req: Request, res: Response) => {
  const { apiKey } = req.body as { apiKey?: string };
  const requiresApiKey = db.hasActiveApiKeys();
  const config = integrationConfig(req);

  if (!requiresApiKey) {
    return res.json({
      ok: true,
      requiresApiKey: false,
      ...config,
      message: 'No active API keys yet. Create your first key in Integration.',
    });
  }

  const resolved = typeof apiKey === 'string' ? db.resolveApiKey(apiKey) : undefined;
  if (!resolved) {
    return res.status(401).json({
      ok: false,
      requiresApiKey: true,
      ...config,
      error: 'Invalid API key',
    });
  }

  return res.json({
    ok: true,
    requiresApiKey: true,
    keyId: resolved.id,
    keyPreview: resolved.preview,
    ...config,
  });
});

// List all keys (hashes never returned — only preview + metadata)
keysRouter.get('/', (_req: Request, res: Response) => {
  const keys = db.listApiKeys();
  return res.json({ keys });
});

// Create a new key — plaintext returned ONCE here
keysRouter.post('/', (req: Request, res: Response) => {
  const { name } = req.body as { name?: string };
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Key name is required' });
  }
  const result = db.createApiKey(name.trim());
  return res.status(201).json(result);
});

// Revoke (soft-delete — keeps audit history)
keysRouter.patch('/:id/revoke', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  db.revokeApiKey(id);
  return res.json({ ok: true });
});

// Hard delete
keysRouter.delete('/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  db.deleteApiKey(id);
  return res.json({ ok: true });
});

keysRouter.post('/:id/rotate', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const target = db.listApiKeys().find((key) => key.id === id);
  if (!target) {
    return res.status(404).json({ error: 'Key not found' });
  }
  if (!target.isActive) {
    return res.status(400).json({ error: 'Cannot rotate a revoked key' });
  }

  const { name } = req.body as { name?: string };
  const nextName = typeof name === 'string' && name.trim().length > 0
    ? name.trim()
    : `${target.name} (rotated)`;
  const replacement = db.createApiKey(nextName);
  db.revokeApiKey(target.id);

  return res.status(201).json({
    replacedKeyId: target.id,
    ...replacement,
  });
});
