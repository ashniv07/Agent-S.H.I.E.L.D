import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from '../config/index.js';
import { setupWebSocket } from './websocket.js';
import { createRequestsRouter } from './routes/requests.js';
import { auditRouter } from './routes/audit.js';
import { createAgentsRouter } from './routes/agents.js';

export function createApp() {
  const app = express();
  const httpServer = createServer(app);

  // Setup WebSocket
  const io = setupWebSocket(httpServer);

  // Middleware
  app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  }));
  app.use(express.json());

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  });

  // API routes
  app.use('/api/requests', createRequestsRouter(io));
  app.use('/api/audit', auditRouter);
  app.use('/api/agents', createAgentsRouter(io));

  // Error handling middleware
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: config.nodeEnv === 'development' ? err.message : undefined,
    });
  });

  // 404 handler
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
╔═══════════════════════════════════════════════════╗
║         AGENT WATCHDOG - Security Layer           ║
╠═══════════════════════════════════════════════════╣
║  Server running at:                               ║
║  http://${config.host}:${config.port}                            ║
║                                                   ║
║  API Endpoints:                                   ║
║  POST   /api/requests     - Submit request        ║
║  GET    /api/requests     - List requests         ║
║  GET    /api/audit        - Get audit logs        ║
║  GET    /api/agents       - List agents           ║
║  POST   /api/agents/:id/killswitch - Kill switch  ║
║                                                   ║
║  WebSocket: ws://${config.host}:${config.port}                   ║
╚═══════════════════════════════════════════════════╝
    `);
  });

  return httpServer;
}
