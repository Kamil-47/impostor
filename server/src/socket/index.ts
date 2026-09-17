import { Server as SocketServer } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import type { WordsRepository } from '../game/words.js';
import { RoomManager } from '../game/roomManager.js';
import { GameEngine } from '../game/gameEngine.js';
import { VoteManager } from '../game/voteManager.js';
import { ClueManager } from '../game/clueManager.js';
import { config } from '../config.js';
import { registerRoomHandlers } from './handlers/roomHandler.js';
import { registerPlayerHandlers } from './handlers/playerHandler.js';
import { registerRoundHandlers } from './handlers/roundHandler.js';
import { broadcastRoomState, checkAutoResolve } from './helpers.js';
import type { AppServer, AppContext } from './types.js';

export type { AppSocket, AppServer, AppContext } from './types.js';

export function setupSocket(
  httpServer: HttpServer,
  clientOrigin: string,
  wordsRepo: WordsRepository,
): AppServer {
  const io: AppServer = new SocketServer(httpServer, {
    cors: {
      origin: clientOrigin,
      methods: ['GET', 'POST'],
    },
  });

  const voteManager = new VoteManager();
  const gameEngine = new GameEngine(wordsRepo);
  const clueManager = new ClueManager();

  const roomManager = new RoomManager({
    playerGraceMs: config.playerGraceMs,
    emptyRoomMs: config.emptyRoomMs,
    onGraceExpired: (result) => {
      if (result.roundAborted) {
        ctx.io.to(result.roomCode).emit('round:aborted', {
          reason: 'playerLeft',
          playerNickname: result.playerNickname,
        });
      }
      broadcastRoomState(ctx, result.roomCode);
      if (result.shouldResolve) {
        checkAutoResolve(ctx, result.roomCode);
      }
    },
    onRoomExpired: (roomCode) => {
      console.log(`[room] expired: ${roomCode}`);
    },
  });

  const ctx: AppContext = { io, roomManager, gameEngine, voteManager, clueManager };

  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    registerRoomHandlers(socket, ctx);
    registerPlayerHandlers(socket, ctx);
    registerRoundHandlers(socket, ctx);

    socket.on('disconnect', (reason) => {
      console.log(`[socket] disconnected: ${socket.id} (${reason})`);
      roomManager.disconnectPlayer(socket.id);
    });
  });

  return io;
}
