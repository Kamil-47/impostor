import type { AppSocket, AppContext } from '../types.js';
import { broadcastRoomState, checkAutoResolve, emitError } from '../helpers.js';

export function registerPlayerHandlers(
  socket: AppSocket,
  ctx: AppContext,
): void {
  socket.on('player:kick', (targetId) => {
    try {
      const entry = ctx.roomManager.getSocketEntry(socket.id);
      if (!entry) {
        socket.emit('error', {
          code: 'NOT_IN_ROOM',
          message: 'You are not in a room',
        });
        return;
      }

      const result = ctx.roomManager.kickPlayer(socket.id, targetId);

      if (result.kickedSocketId) {
        ctx.io.to(result.kickedSocketId).emit('error', {
          code: 'KICKED',
          message: 'You have been kicked from the room',
        });
        ctx.io.in(result.kickedSocketId).socketsLeave(entry.roomCode);
      }

      if (result.roundAborted) {
        ctx.io.to(entry.roomCode).emit('round:aborted', {
          reason: 'playerLeft',
          playerNickname: result.playerNickname,
        });
      }

      ctx.io.to(entry.roomCode).emit('room:state', result.room);

      if (result.shouldResolve) {
        checkAutoResolve(ctx, entry.roomCode);
      }
    } catch (err) {
      emitError(socket, err);
    }
  });

  socket.on('player:setReady', (isReady) => {
    try {
      const { roomCode } = ctx.roomManager.setReady(socket.id, isReady);
      broadcastRoomState(ctx, roomCode);
    } catch (err) {
      emitError(socket, err);
    }
  });
}
