import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from '../config/index.js';
import { setupWebSocket } from './websocket.js';
import { createRequestsRouter } from './routes/requests.js';
import { auditRouter } from './routes/audit.js';
import { createAgentsRouter } from './routes/agents.js';
import { chatRouter } from './routes/chat.js';
import { keysRouter } from './routes/keys.js';
import { db } from '../db/index.js';

export function createApp() {
  const app = express();
  const httpServer = createServer(app);

  const io = setupWebSocket(httpServer);

  app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  });

  const resolveProvidedApiKey = (req: express.Request): string | undefined =>
    (req.headers['x-api-key'] as string | undefined) ??
    ((req.body as Record<string, unknown>)?.apiKey as string | undefined);

  // Protected endpoints require API keys once any active key exists.
  const requireApiKeyAuth: express.RequestHandler = (req, res, next) => {
    const hasActiveKeys = db.hasActiveApiKeys();
    if (!hasActiveKeys) return next();

    const provided = resolveProvidedApiKey(req);
    if (!provided) {
      return res.status(401).json({ error: 'Invalid or missing API key' });
    }

    const resolved = db.resolveApiKey(provided);
    if (!resolved) return res.status(401).json({ error: 'Invalid or missing API key' });
    req.authApiKeyId = resolved.id;
    req.authApiKeyPreview = resolved.preview;
    return next();
  };

  app.use('/api/requests', requireApiKeyAuth, createRequestsRouter(io));
  app.use('/v1/guard', requireApiKeyAuth, createRequestsRouter(io));
  app.use('/api/audit', requireApiKeyAuth, auditRouter);
  app.use('/api/agents', requireApiKeyAuth, createAgentsRouter(io));
  app.use('/api/chat', requireApiKeyAuth, chatRouter);
  app.use('/api/keys', keysRouter);

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: config.nodeEnv === 'development' ? err.message : undefined,
    });
  });

  app.use((_req, res) => {
    res.status(404).json({
      error: 'Not found',
    });
  });

  return { app, httpServer, io };
}

export function startServer() {
  const { httpServer } = createApp();

  httpServer.listen(config.port, config.host, () => {
    console.log(`
====================================================
        AGENT WATCHDOG - Security Layer
====================================================
Server running at:
http://${config.host}:${config.port}

API Endpoints:
POST   /api/requests          - Submit request
POST   /v1/guard              - Public guard endpoint
GET    /api/requests          - List requests
GET    /api/audit             - Get audit logs
GET    /api/agents            - List agents
POST   /api/agents/:id/killswitch - Kill switch

WebSocket: ws://${config.host}:${config.port}
====================================================
    `);
  });

  return httpServer;
}
