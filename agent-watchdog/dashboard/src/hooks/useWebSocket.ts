import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export interface WSEvent {
  type: string;
  data: unknown;
  timestamp: string;
}

export interface UseWebSocketResult {
  isConnected: boolean;
  events: WSEvent[];
  lastEvent: WSEvent | null;
  subscribeToAgent: (agentId: string) => void;
  unsubscribeFromAgent: (agentId: string) => void;
  clearEvents: () => void;
}

export function useWebSocket(url = 'http://localhost:3001'): UseWebSocketResult {
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<WSEvent[]>([]);
  const [lastEvent, setLastEvent] = useState<WSEvent | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(url, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('WebSocket connected');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
    });

    socket.on('connected', (data) => {
      addEvent('connected', data);
    });

    socket.on('request:new', (data) => {
      addEvent('request:new', data);
    });

    socket.on('request:processed', (data) => {
      addEvent('request:processed', data);
    });

    socket.on('violation:detected', (data) => {
      addEvent('violation:detected', data);
    });

    socket.on('killswitch:triggered', (data) => {
      addEvent('killswitch:triggered', data);
    });

    socket.on('agent:status', (data) => {
      addEvent('agent:status', data);
    });

    return () => {
      socket.disconnect();
    };
  }, [url]);

  const addEvent = useCallback((type: string, data: unknown) => {
    const event: WSEvent = {
      type,
      data,
      timestamp: new Date().toISOString(),
    };
    setLastEvent(event);
    setEvents((prev) => [event, ...prev].slice(0, 100)); // Keep last 100 events
  }, []);

  const subscribeToAgent = useCallback((agentId: string) => {
    socketRef.current?.emit('subscribe:agent', agentId);
  }, []);

  const unsubscribeFromAgent = useCallback((agentId: string) => {
    socketRef.current?.emit('unsubscribe:agent', agentId);
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
    setLastEvent(null);
  }, []);

  return {
    isConnected,
    events,
    lastEvent,
    subscribeToAgent,
    unsubscribeFromAgent,
    clearEvents,
  };
}
