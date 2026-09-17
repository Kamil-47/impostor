import type { InternalRoom } from './roomManager.js';

export class ClueError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ClueError';
  }
}

export interface SubmitClueOutcome {
  kind: 'accepted' | 'impostorCaught' | 'impostorGuessedWord' | 'phaseComplete';
}

const CLUE_MAX_LENGTH = 40;
const CLUE_REGEX = /^[\p{L}\p{N}_\- ]+$/u;

export class ClueManager {
  submitClue(
    room: InternalRoom,
    playerId: string,
    rawText: string,
  ): SubmitClueOutcome {
    if (room.status !== 'playing') {
      throw new ClueError(
        'NOT_PLAYING',
        'Clues can only be submitted during playing phase',
      );
    }

    const round = room.round;
    if (!round) {
      throw new ClueError('NOT_PLAYING', 'No active round');
    }

    const currentTurnPlayerId =
      round.turnOrder[round.clues.length % round.turnOrder.length];
    if (currentTurnPlayerId !== playerId) {
      throw new ClueError(
        'NOT_YOUR_TURN',
        'It is not your turn to submit a clue',
      );
    }

    const text = rawText.trim();
    if (!text) {
      throw new ClueError('CLUE_EMPTY', 'Clue must not be empty');
    }
    if (text.length > CLUE_MAX_LENGTH) {
      throw new ClueError(
        'CLUE_TOO_LONG',
        `Clue must be at most ${CLUE_MAX_LENGTH} characters`,
      );
    }
    if (!CLUE_REGEX.test(text)) {
      throw new ClueError(
        'CLUE_INVALID_CHARS',
        'Clue contains invalid characters',
      );
    }

    const player = room.players.find((p) => p.id === playerId);
    if (!player) {
      throw new ClueError('PLAYER_NOT_FOUND', 'Player not found in room');
    }

    const lowerText = text.toLowerCase();
    const isWord = room.currentWord != null && lowerText === room.currentWord.toLowerCase();

    if (isWord && player.role !== 'impostor') {
      throw new ClueError(
        'CLUE_IS_WORD',
        'You cannot use the secret word as a clue',
      );
    }

    if (round.clues.some((c) => c.text.toLowerCase() === lowerText)) {
      throw new ClueError(
        'CLUE_DUPLICATE',
        'This clue has already been submitted',
      );
    }

    round.clues.push({
      playerId,
      nickname: player.nickname,
      text,
    });

    if (player.role === 'impostor' && isWord) {
      return { kind: 'impostorGuessedWord' };
    }

    if (
      player.role === 'impostor' &&
      player.hint &&
      Object.values(player.hint).some((h) => lowerText === h.toLowerCase())
    ) {
      return { kind: 'impostorCaught' };
    }

    if (round.clues.length === round.turnOrder.length * round.totalRounds) {
      return { kind: 'phaseComplete' };
    }

    return { kind: 'accepted' };
  }
}
