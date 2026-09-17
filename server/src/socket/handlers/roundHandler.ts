import type { AppSocket, AppContext } from '../types.js';
import { broadcastRoomState, emitError } from '../helpers.js';
import { ClueError } from '../../game/clueManager.js';

export function registerRoundHandlers(
  socket: AppSocket,
  ctx: AppContext,
): void {
  socket.on('round:start', () => {
    try {
      const entry = ctx.roomManager.getSocketEntry(socket.id);
      if (!entry) {
        socket.emit('error', {
          code: 'NOT_IN_ROOM',
          message: 'You are not in a room',
        });
        return;
      }

      const internalRoom = ctx.roomManager.getInternalRoom(entry.roomCode);
      if (!internalRoom) {
        socket.emit('error', {
          code: 'ROOM_NOT_FOUND',
          message: 'Room not found',
        });
        return;
      }

      if (internalRoom.hostId !== entry.playerId) {
        socket.emit('error', {
          code: 'NOT_HOST',
          message: 'Only the host can start the round',
        });
        return;
      }

      const result = ctx.gameEngine.startRound(internalRoom);

      for (const hand of result.hands) {
        if (hand.socketId) {
          ctx.io.to(hand.socketId).emit('round:privateHand', hand.hand);
        }
      }

      broadcastRoomState(ctx, entry.roomCode);
    } catch (err) {
      emitError(socket, err);
    }
  });

  socket.on('clue:submit', (text, ack) => {
    try {
      const entry = ctx.roomManager.getSocketEntry(socket.id);
      if (!entry) {
        ack({ code: 'NOT_IN_ROOM', message: 'You are not in a room' });
        return;
      }

      const internalRoom = ctx.roomManager.getInternalRoom(entry.roomCode);
      if (!internalRoom) {
        ack({ code: 'ROOM_NOT_FOUND', message: 'Room not found' });
        return;
      }

      const outcome = ctx.clueManager.submitClue(
        internalRoom,
        entry.playerId,
        text,
      );

      broadcastRoomState(ctx, entry.roomCode);
      ack(null);

      if (outcome.kind === 'impostorGuessedWord') {
        const result = ctx.voteManager.resolveByImpostorGuessedWord(internalRoom);
        ctx.io.to(entry.roomCode).emit('round:results', result);
        broadcastRoomState(ctx, entry.roomCode);
      } else if (outcome.kind === 'impostorCaught') {
        const result = ctx.voteManager.resolveByImpostorCaught(internalRoom);
        ctx.io.to(entry.roomCode).emit('round:results', result);
        broadcastRoomState(ctx, entry.roomCode);
      } else if (outcome.kind === 'phaseComplete') {
        internalRoom.status = 'voting';
        ctx.io.to(entry.roomCode).emit('round:votingOpen');
        broadcastRoomState(ctx, entry.roomCode);
      }
    } catch (err) {
      if (err instanceof ClueError) {
        ack({ code: err.code, message: err.message });
      } else {
        emitError(socket, err);
      }
    }
  });

  socket.on('vote:cast', (targetId) => {
    try {
      const entry = ctx.roomManager.getSocketEntry(socket.id);
      if (!entry) {
        socket.emit('error', {
          code: 'NOT_IN_ROOM',
          message: 'You are not in a room',
        });
        return;
      }

      const internalRoom = ctx.roomManager.getInternalRoom(entry.roomCode);
      if (!internalRoom) {
        socket.emit('error', {
          code: 'ROOM_NOT_FOUND',
          message: 'Room not found',
        });
        return;
      }

      const voteResult = ctx.voteManager.castVote(
        internalRoom,
        entry.playerId,
        targetId,
      );

      broadcastRoomState(ctx, entry.roomCode);

      if (voteResult.allVoted) {
        const roundResult = ctx.voteManager.resolveRound(internalRoom);
        ctx.io.to(entry.roomCode).emit('round:results', roundResult);
        broadcastRoomState(ctx, entry.roomCode);
      }
    } catch (err) {
      emitError(socket, err);
    }
  });

  socket.on('round:next', () => {
    try {
      const entry = ctx.roomManager.getSocketEntry(socket.id);
      if (!entry) {
        socket.emit('error', {
          code: 'NOT_IN_ROOM',
          message: 'You are not in a room',
        });
        return;
      }

      const internalRoom = ctx.roomManager.getInternalRoom(entry.roomCode);
      if (!internalRoom) {
        socket.emit('error', {
          code: 'ROOM_NOT_FOUND',
          message: 'Room not found',
        });
        return;
      }

      if (internalRoom.hostId !== entry.playerId) {
        socket.emit('error', {
          code: 'NOT_HOST',
          message: 'Only the host can start the next round',
        });
        return;
      }

      ctx.voteManager.nextRound(internalRoom);
      broadcastRoomState(ctx, entry.roomCode);
    } catch (err) {
      emitError(socket, err);
    }
  });
}
