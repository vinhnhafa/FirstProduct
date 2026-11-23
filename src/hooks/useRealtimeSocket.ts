import { useEffect, useRef, useState, useCallback } from 'react';

export type WsListener = (type: string, payload: Record<string, unknown>) => void;

export function useRealtimeSocket(userId: string, userName: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Set<WsListener>>(new Set());
  const pendingQueueRef = useRef<string[]>([]);
  const [connected, setConnected] = useState(false);

  const userIdRef = useRef(userId);
  const userNameRef = useRef(userName);
  userIdRef.current = userId;
  userNameRef.current = userName;

  useEffect(() => {
    let active = true;
    let reconnectTimer: number | null = null;

    function connect() {
      if (!active) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!active) return;
        setConnected(true);
        ws.send(
          JSON.stringify({
            type: 'auth:identify',
            payload: { userId: userIdRef.current, userName: userNameRef.current },
          })
        );
        while (pendingQueueRef.current.length > 0) {
          const msg = pendingQueueRef.current.shift();
          if (msg) ws.send(msg);
        }
        for (const listener of listenersRef.current) {
          listener('ws:reconnected', {});
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as {
            type: string;
            payload?: Record<string, unknown>;
          };
          const payload = data.payload || {};
          for (const listener of listenersRef.current) {
            listener(data.type, payload);
          }
        } catch {
          // Ignore malformed message
        }
      };

      ws.onclose = () => {
        if (!active) return;
        setConnected(false);
        wsRef.current = null;
        reconnectTimer = window.setTimeout(connect, 1800);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      active = false;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (connected && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'auth:identify',
          payload: { userId, userName: userNameRef.current },
        })
      );
    }
  }, [userId, connected]);

  useEffect(() => {
    if (connected && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'auth:rename',
          payload: { userName },
        })
      );
    }
  }, [userName, connected]);

  const sendEvent = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    const raw = JSON.stringify({ type, payload });
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(raw);
    } else {
      pendingQueueRef.current.push(raw);
    }
  }, []);

  const subscribe = useCallback((listener: WsListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  return { connected, sendEvent, subscribe };
}
