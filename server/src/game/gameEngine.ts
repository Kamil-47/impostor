import type { PlayerHand, Language } from '@impostor/shared';
import type { InternalRoom } from './roomManager.js';
import type { WordsRepository } from './words.js';
import { shuffle } from '../utils/shuffle.js';

export class GameError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'GameError';
  }
}

export interface PrivateHandEntry {
  playerId: string;
  socketId: string | null;
  hand: PlayerHand;
}

export interface StartRoundResult {
  hands: PrivateHandEntry[];
}

export class GameEngine {
  constructor(private wordsRepo: WordsRepository) {}

  startRound(room: InternalRoom): StartRoundResult {
    if (room.status !== 'lobby') {
      throw new GameError('NOT_IN_LOBBY', 'Round can only be started from lobby');
    }

    const nonHostReady = room.players
      .filter((p) => p.id !== room.hostId)
      .every((p) => p.isReady);
    if (!nonHostReady) {
      throw new GameError('PLAYERS_NOT_READY', 'All players must be ready');
    }

    const minPlayers = room.settings.impostorCount + 2;
    if (room.players.length < minPlayers) {
      throw new GameError(
        'NOT_ENOUGH_PLAYERS',
        `Need at least ${minPlayers} players (${room.settings.impostorCount} impostor(s) + 2)`,
      );
    }

    const word = this.wordsRepo.pickRandom(room.settings.categories, room.usedWordsIds);
    room.usedWordsIds.push(word.id);
    const impostorIndices = this.pickImpostorIndices(
      room.players.length,
      room.settings.impostorCount,
    );

    const hands: PrivateHandEntry[] = [];

    for (let i = 0; i < room.players.length; i++) {
      const player = room.players[i];
      const isImpostor = impostorIndices.has(i);

      if (isImpostor) {
        player.role = 'impostor';
        const hintIndex = Math.floor(Math.random() * word.hints.pl.length);
        const localizedHint = room.settings.hintsEnabled
          ? Object.fromEntries(
              Object.entries(word.hints).map(([lang, arr]) => [lang, arr[hintIndex]]),
            ) as Record<Language, string>
          : undefined;
        player.hint = localizedHint;
        player.word = undefined;
        hands.push({
          playerId: player.id,
          socketId: player.socketId,
          hand: localizedHint
            ? { role: 'impostor', hint: localizedHint }
            : { role: 'impostor' },
        });
      } else {
        player.role = 'player';
        player.word = word.word;
        player.hint = undefined;
        hands.push({
          playerId: player.id,
          socketId: player.socketId,
          hand: { role: 'player', word: word.word },
        });
      }

      player.vote = null;
    }

    room.currentWord = word.word;
    room.status = 'playing';
    const prevRound = room.round;
    room.round = {
      roundNumber: (prevRound?.roundNumber ?? 0) + 1,
      totalRounds: room.settings.roundsCount,
      turnOrder: prevRound?.turnOrder ?? shuffle(room.players.map((p) => p.id)),
      clues: [],
    };

    return { hands };
  }

  private pickImpostorIndices(
    playerCount: number,
    impostorCount: number,
  ): Set<number> {
    const indices = new Set<number>();
    while (indices.size < impostorCount) {
      indices.add(Math.floor(Math.random() * playerCount));
    }
    return indices;
  }
}
