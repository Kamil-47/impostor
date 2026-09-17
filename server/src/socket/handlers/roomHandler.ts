import type { AppSocket, AppContext } from '../types.js';
import { broadcastRoomState, checkAutoResolve, emitError } from '../helpers.js';

export function registerRoomHandlers(
  socket: AppSocket,
  ctx: AppContext,
): void {
  socket.on('room:create', (payload, ack) => {
    try {
      const result = ctx.roomManager.createRoom(
        payload.nickname,
        payload.settings,
        socket.id,
      );
      socket.join(result.room.code);
      ack({
        code: result.room.code,
        playerId: result.playerId,
        playerUuid: result.playerUuid,
      });
      ctx.io.to(result.room.code).emit('room:state', result.room);
    } catch (err) {
      emitError(socket, err);
    }
  });

  socket.on('room:join', (payload, ack) => {
    try {
      const code = payload.code.toUpperCase();

      const oldEntry = ctx.roomManager.getSocketEntry(socket.id);
      if (oldEntry && oldEntry.roomCode !== code) {
        const oldRoomCode = oldEntry.roomCode;
        const leaveResult = ctx.roomManager.leaveRoom(socket.id);
        socket.leave(oldRoomCode);
        if (leaveResult?.roundAborted) {
          ctx.io.to(oldRoomCode).emit('round:aborted', {
            reason: 'playerLeft',
            playerNickname: leaveResult.playerNickname,
          });
        }
        broadcastRoomState(ctx, oldRoomCode);
        if (leaveResult?.shouldResolve) {
          checkAutoResolve(ctx, oldRoomCode);
        }
      }

      const result = ctx.roomManager.joinRoom(
        code,
        payload.nickname,
        socket.id,
        payload.playerUuid,
      );
      socket.join(code);
      ack({ playerId: result.playerId, playerUuid: result.playerUuid });
      ctx.io.to(code).emit('room:state', result.room);

      if (result.reconnected) {
        const internalRoom = ctx.roomManager.getInternalRoom(code);
        if (internalRoom && internalRoom.status !== 'lobby') {
          const player = internalRoom.players.find(
            (p) => p.id === result.playerId,
          );
          if (player?.role === 'impostor' && player.hint) {
            socket.emit('round:privateHand', {
              role: 'impostor',
              hint: player.hint,
            });
          } else if (player?.role === 'impostor') {
            socket.emit('round:privateHand', { role: 'impostor' });
          } else if (player?.role === 'player' && player.word) {
            socket.emit('round:privateHand', {
              role: 'player',
              word: player.word,
            });
          }

          if (
            internalRoom.status === 'results' &&
            internalRoom.lastRoundResult
          ) {
            socket.emit('round:results', internalRoom.lastRoundResult);
          }
        }
      }
    } catch (err) {
      emitError(socket, err);
    }
  });

  socket.on('settings:update', (settings) => {
    try {
      const { roomCode } = ctx.roomManager.updateSettings(
        socket.id,
        settings,
      );
      broadcastRoomState(ctx, roomCode);
    } catch (err) {
      emitError(socket, err);
    }
  });

  socket.on('room:leave', () => {
    const entry = ctx.roomManager.getSocketEntry(socket.id);
    if (!entry) return;

    const roomCode = entry.roomCode;
    const result = ctx.roomManager.leaveRoom(socket.id);
    socket.leave(roomCode);

    if (result?.roundAborted) {
      ctx.io.to(roomCode).emit('round:aborted', {
        reason: 'playerLeft',
        playerNickname: result.playerNickname,
      });
    }
    broadcastRoomState(ctx, roomCode);
    if (result?.shouldResolve) {
      checkAutoResolve(ctx, roomCode);
    }
  });
}
