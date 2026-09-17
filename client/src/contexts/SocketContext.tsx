import { createContext, useContext, useRef, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@impostor/shared';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SocketContext = createContext<AppSocket | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<AppSocket | null>(null);

  if (!socketRef.current) {
    socketRef.current = io({ autoConnect: true });
  }

  return (
    <SocketContext.Provider value={socketRef.current}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): AppSocket {
  const socket = useContext(SocketContext);
  if (!socket) throw new Error('useSocket must be used inside SocketProvider');
  return socket;
}
