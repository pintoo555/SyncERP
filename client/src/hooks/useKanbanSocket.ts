import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { api, getSocketUrl } from '../api/client';

export interface TicketChangedPayload {
  ticketId: number;
  status?: string;
  userName?: string;
}

export interface AssetChangedPayload {
  assetId: number;
  status?: string;
  userName?: string;
  assignedToUserId?: number | null;
  assignedToUserName?: string | null;
}

export interface NewAssetPayload {
  assetId: number;
  assetTag: string;
  addedByUserId: number;
  addedByName: string;
}

export interface KanbanOrderPayload {
  columnKey: string;
  order: number[];
}

export interface UseKanbanSocketOptions {
  onTicketChanged?: (payload: TicketChangedPayload) => void;
  onAssetChanged?: (payload: AssetChangedPayload) => void;
  onNewAsset?: (payload: NewAssetPayload) => void;
  onAssetOrderChanged?: (payload: KanbanOrderPayload) => void;
  onTicketOrderChanged?: (payload: KanbanOrderPayload) => void;
}

export interface UseKanbanSocketReturn {
  emitAssetOrder: (columnKey: string, order: number[]) => void;
  emitTicketOrder: (columnKey: string, order: number[]) => void;
}

export function useKanbanSocket(options: UseKanbanSocketOptions): UseKanbanSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const onTicketRef = useRef(options.onTicketChanged);
  const onAssetRef = useRef(options.onAssetChanged);
  const onNewAssetRef = useRef(options.onNewAsset);
  const onAssetOrderRef = useRef(options.onAssetOrderChanged);
  const onTicketOrderRef = useRef(options.onTicketOrderChanged);
  onTicketRef.current = options.onTicketChanged;
  onAssetRef.current = options.onAssetChanged;
  onNewAssetRef.current = options.onNewAsset;
  onAssetOrderRef.current = options.onAssetOrderChanged;
  onTicketOrderRef.current = options.onTicketOrderChanged;

  useEffect(() => {
    let mounted = true;
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
        });
        socketRef.current = socket;
        socket.on('ticket:changed', (payload: TicketChangedPayload) => {
          onTicketRef.current?.(payload);
        });
        socket.on('asset:changed', (payload: AssetChangedPayload) => {
          onAssetRef.current?.(payload);
        });
        socket.on('dashboard:new-asset', (payload: NewAssetPayload) => {
          onNewAssetRef.current?.(payload);
        });
        socket.on('asset:kanban-order', (payload: KanbanOrderPayload) => {
          onAssetOrderRef.current?.(payload);
        });
        socket.on('ticket:kanban-order', (payload: KanbanOrderPayload) => {
          onTicketOrderRef.current?.(payload);
        });
      })
      .catch(() => {});

    return () => {
      mounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  return {
    emitAssetOrder: (columnKey: string, order: number[]) => {
      socketRef.current?.emit('kanban:reorder-asset', { columnKey, order });
    },
    emitTicketOrder: (columnKey: string, order: number[]) => {
      socketRef.current?.emit('kanban:reorder-ticket', { columnKey, order });
    },
  };
}
