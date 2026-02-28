import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Server as HTTPServer } from 'http';

export function setupWebSocket(httpServer: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to agent S.H.I.E.L.D',
      socketId: socket.id,
      timestamp: new Date().toISOString(),
    });

    // Handle subscription to specific agent events
    socket.on('subscribe:agent', (agentId: string) => {
      socket.join(`agent:${agentId}`);
      console.log(`Socket ${socket.id} subscribed to agent ${agentId}`);
    });

    // Handle unsubscription
    socket.on('unsubscribe:agent', (agentId: string) => {
      socket.leave(`agent:${agentId}`);
      console.log(`Socket ${socket.id} unsubscribed from agent ${agentId}`);
    });

    // Handle ping for connection health check
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });

    socket.on('disconnect', (reason) => {
      console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
    });

    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  });

  return io;
}

// Event types for documentation
export const wsEvents = {
  // Server -> Client events
  'request:new': 'Emitted when a new request is received',
  'request:processed': 'Emitted when a request has been fully processed',
  'violation:detected': 'Emitted when a violation is detected',
  'killswitch:triggered': 'Emitted when a kill switch is activated',
  'agent:status': 'Emitted when an agent status changes',
  connected: 'Emitted when a client connects',
  pong: 'Response to ping',

  // Client -> Server events
  'subscribe:agent': 'Subscribe to events for a specific agent',
  'unsubscribe:agent': 'Unsubscribe from events for a specific agent',
  ping: 'Health check ping',
};
