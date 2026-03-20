import { useEffect, useRef, useCallback } from 'react';
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

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected to', url);
    };

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        switch (msg.type) {
          case 'snapshot':
            onSnapshot(msg.payload as SnapshotPayload);
            break;
          case 'device_upsert':
            onDeviceUpsert(msg.payload as DeviceUpsertPayload);
            break;
          case 'device_remove':
            onDeviceRemove(msg.payload as DeviceRemovePayload);
            break;
        }
      } catch (e) {
        console.error('[WS] Parse error:', e);
      }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected, reconnecting in 3s...');
      reconnectTimerRef.current = window.setTimeout(connect, 3000);
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
      ws.close();
    };
  }, [url, onSnapshot, onDeviceUpsert, onDeviceRemove]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);
}
