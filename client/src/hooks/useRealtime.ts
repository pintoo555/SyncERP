import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { api, getSocketUrl } from '../api/client';

export interface NewAssetPayload {
  assetId: number;
  assetTag: string;
  addedByUserId: number;
  addedByName: string;
}

export type UseRealtimeOptions = {
  onUpdate: () => void;
  onNewAsset?: (payload: NewAssetPayload) => void;
};

/**
 * Subscribe to realtime dashboard updates. Fetches a short-lived token and connects to /realtime.
 * - dashboard:update -> onUpdate (refetch figures/graphs).
 * - dashboard:new-asset -> onNewAsset (show toast: new asset added by user).
 */
export function useRealtime(options: UseRealtimeOptions | (() => void)) {
  const onUpdate = typeof options === 'function' ? options : options.onUpdate;
  const onNewAsset = typeof options === 'function' ? undefined : options.onNewAsset;

  const socketRef = useRef<Socket | null>(null);
  const onUpdateRef = useRef(onUpdate);
  const onNewAssetRef = useRef(onNewAsset);
  onUpdateRef.current = onUpdate;
  onNewAssetRef.current = onNewAsset;

  useEffect(() => {
    let mounted = true;
    const connect = () => {
      api.get<{ success: boolean; token: string }>('/api/auth/socket-token')
        .then((res) => {
          if (!mounted || !res.token) return;
          const baseUrl = getSocketUrl();
          const url = baseUrl ? `${baseUrl.replace(/\/$/, '')}/realtime` : '/realtime';
          const socket = io(url, {
            path: '/socket.io',
            auth: { token: res.token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 20,
            reconnectionDelay: 2000,
          });
          socketRef.current = socket;
          socket.on('dashboard:update', () => {
            onUpdateRef.current?.();
          });
          socket.on('dashboard:new-asset', (payload: NewAssetPayload) => {
            onNewAssetRef.current?.(payload);
          });
          socket.on('connect_error', () => {
            // Connection failed (e.g. CORS or wrong URL); Socket.IO will retry. Dashboard still works without realtime.
          });
        })
        .catch(() => {});
    };
    connect();

    return () => {
      mounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);
}
