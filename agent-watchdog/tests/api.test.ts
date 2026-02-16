import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/api/server.js';
import type { Server } from 'http';

describe('API Routes', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const { httpServer } = createApp();
    await new Promise<void>((resolve) => {
      server = httpServer.listen(0, () => {
        const address = server.address();
        if (address && typeof address !== 'string') {
          baseUrl = `http://localhost:${address.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(() => {
    server?.close();
  });

  it('should return health status', async () => {
    const response = await fetch(`${baseUrl}/health`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.version).toBe('1.0.0');
  });

  it('should return empty requests list initially', async () => {
    const response = await fetch(`${baseUrl}/api/requests`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.requests).toBeDefined();
    expect(Array.isArray(data.requests)).toBe(true);
  });

  it('should return empty audit logs initially', async () => {
    const response = await fetch(`${baseUrl}/api/audit`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.logs).toBeDefined();
    expect(Array.isArray(data.logs)).toBe(true);
  });

  it('should return stats summary', async () => {
    const response = await fetch(`${baseUrl}/api/audit/stats/summary`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalRequests).toBeDefined();
    expect(data.approvedRequests).toBeDefined();
    expect(data.flaggedRequests).toBeDefined();
    expect(data.killedRequests).toBeDefined();
  });

  it('should return agents list', async () => {
    const response = await fetch(`${baseUrl}/api/agents`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.agents).toBeDefined();
    expect(Array.isArray(data.agents)).toBe(true);
  });

  it('should reject invalid request format', async () => {
    const response = await fetch(`${baseUrl}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid: 'data' }),
    });

    expect(response.status).toBe(400);
  });

  it('should return 404 for unknown routes', async () => {
    const response = await fetch(`${baseUrl}/api/unknown`);

    expect(response.status).toBe(404);
  });
});
