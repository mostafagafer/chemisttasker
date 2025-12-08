import { useEffect, useRef } from 'react';
import { markRoomAsRead } from '@chemisttasker/shared-core';
type IncomingHandler = (payload: any) => void;

export function useLiveMessages(
  roomId: number | null,
  accessToken: string | null,
  onMessage: IncomingHandler,
  onUnread: (payload: any) => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const onMessageRef = useRef(onMessage);
  const onUnreadRef = useRef(onUnread);

  // Keep the refs updated with the latest handlers on each render
  useEffect(() => {
    onMessageRef.current = onMessage;
    onUnreadRef.current = onUnread;
  }, [onMessage, onUnread]);
  
  useEffect(() => {
    let isCancelled = false;
    const setupWs = async () => {
      if (!roomId || !accessToken) return;
      try {
        const base = process.env.EXPO_PUBLIC_WS_URL || process.env.EXPO_PUBLIC_API_URL || '';
        const httpBase = base.endsWith('/api') ? base.slice(0, -4) : base;
        const wsBase = httpBase.replace(/^http/, 'ws');
        const ws = new WebSocket(`${wsBase}/ws/chat/rooms/${roomId}/?token=${accessToken}`);
        wsRef.current = ws;
        reconnectAttempts.current = 0;
        ws.onopen = () => {
          void markRoomAsRead(roomId);
        };
        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            onMessageRef.current(payload);
            if (payload?.type === 'message.created' || payload?.type === 'chat.message') {
              onUnreadRef.current(payload);
            }
          } catch {
            // ignore parse errors
          }
        };
        ws.onerror = (err: any) => {
          console.error('WS error', err?.message || 'WebSocket connection error.');
        };
        ws.onclose = (event) => {
          console.log(`WS closed. Code: ${event.code}, Reason: ${event.reason}`);
          const attempt = reconnectAttempts.current + 1;
          reconnectAttempts.current = attempt;
          const delay = Math.min(30000, 1000 * 2 ** attempt);
          setTimeout(() => {
            if (!isCancelled) {
              wsRef.current = null; // Ensure ref is cleared before reconnecting
              void setupWs();
            }
          }, delay);
        };
      } catch {
        // ignore
      }
    };
    void setupWs();
    return () => {
      isCancelled = true;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [roomId, accessToken]);

  return wsRef;
}
