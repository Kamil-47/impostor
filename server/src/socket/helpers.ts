import type { AppSocket, AppContext } from './types.js';

export function broadcastRoomState(
  ctx: AppContext,
  roomCode: string,
): void {
  const publicRoom = ctx.roomManager.getPublicRoom(roomCode);
  if (publicRoom) {
    ctx.io.to(roomCode).emit('room:state', publicRoom);
  }
}

export function checkAutoResolve(
  ctx: AppContext,
  roomCode: string,
): void {
  const internalRoom = ctx.roomManager.getInternalRoom(roomCode);
  if (!internalRoom || internalRoom.status !== 'voting') return;
  if (internalRoom.players.length === 0) return;
  if (!internalRoom.players.every((p) => p.vote != null)) return;

  const roundResult = ctx.voteManager.resolveRound(internalRoom);
  ctx.io.to(roomCode).emit('round:results', roundResult);
  broadcastRoomState(ctx, roomCode);
}

export function emitError(socket: AppSocket, err: unknown): void {
  if (isAppError(err)) {
    socket.emit('error', { code: err.code, message: err.message });
  } else {
    console.error('[socket] unexpected error:', err);
    socket.emit('error', {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
  }
}

function isAppError(err: unknown): err is Error & { code: string } {
  return err instanceof Error && typeof (err as any).code === 'string';
}
