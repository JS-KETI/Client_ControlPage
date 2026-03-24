import { useEffect, useRef } from 'react';
import type { WsMessage, SnapshotPayload, DeviceUpsertPayload, DeviceRemovePayload } from '../types';

interface UseWebSocketOptions {
  url: string;
  onSnapshot: (payload: SnapshotPayload) => void;
  onDeviceUpsert: (payload: DeviceUpsertPayload) => void;
  onDeviceRemove: (payload: DeviceRemovePayload) => void;
}

export function useWebSocket({ url, onSnapshot, onDeviceUpsert, onDeviceRemove }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const intentionalCloseRef = useRef(false);
  const handlersRef = useRef({ onSnapshot, onDeviceUpsert, onDeviceRemove });

  useEffect(() => {
    handlersRef.current = { onSnapshot, onDeviceUpsert, onDeviceRemove };
  }, [onSnapshot, onDeviceUpsert, onDeviceRemove]);

  useEffect(() => {
    intentionalCloseRef.current = false;

    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected to', url);
      };

      ws.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);
          const h = handlersRef.current;
          switch (msg.type) {
            case 'snapshot':
              h.onSnapshot(msg.payload as SnapshotPayload);
              break;
            case 'device_upsert':
              h.onDeviceUpsert(msg.payload as DeviceUpsertPayload);
              break;
            case 'device_remove':
              h.onDeviceRemove(msg.payload as DeviceRemovePayload);
              break;
          }
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };

      ws.onclose = () => {
        if (!intentionalCloseRef.current) {
          console.log('[WS] Disconnected, reconnecting in 3s...');
          reconnectTimerRef.current = window.setTimeout(connect, 3000);
        }
      };

      ws.onerror = (err) => {
        console.error('[WS] Error:', err);
      };
    };

    connect();

    return () => {
      intentionalCloseRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [url]);
}
