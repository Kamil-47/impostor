import type { Server as SocketServer, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@impostor/shared';
import type { RoomManager } from '../game/roomManager.js';
import type { GameEngine } from '../game/gameEngine.js';
import type { VoteManager } from '../game/voteManager.js';
import type { ClueManager } from '../game/clueManager.js';

export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
export type AppServer = SocketServer<ClientToServerEvents, ServerToClientEvents>;

export interface AppContext {
  io: AppServer;
  roomManager: RoomManager;
  gameEngine: GameEngine;
  voteManager: VoteManager;
  clueManager: ClueManager;
}
