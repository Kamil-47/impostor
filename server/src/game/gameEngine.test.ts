import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Word } from '@impostor/shared';
import type { InternalRoom, InternalPlayer } from './roomManager.js';
import type { WordsRepository } from './words.js';
import { GameEngine, GameError } from './gameEngine.js';

const testWord: Word = {
  id: 'jett',
  word: 'Jett',
  category: 'agents',
  hints: {
    pl: ['Korea', 'Szybka jak wiatr', 'Nożyki'],
    en: ['Korea', 'Fast as wind', 'Knives'],
  },
};

function createMockWordsRepo(word: Word = testWord): WordsRepository {
  return { pickRandom: vi.fn().mockReturnValue(word) } as unknown as WordsRepository;
}

function createPlayer(id: string, overrides?: Partial<InternalPlayer>): InternalPlayer {
  return {
    id,
    uuid: `uuid-${id}`,
    nickname: `Player-${id}`,
    socketId: `socket-${id}`,
    isReady: true,
    ...overrides,
  };
}

function createLobbyRoom(playerCount: number, impostorCount = 1): InternalRoom {
  const players: InternalPlayer[] = [];
  for (let i = 0; i < playerCount; i++) {
    players.push(createPlayer(`p${i}`));
  }
  return {
    code: 'ABC123',
    hostId: players[0].id,
    status: 'lobby',
    settings: { impostorCount, categories: ['agents'], roundsCount: 1, hintsEnabled: true },
    players,
    usedWordsIds: [],
  };
}

describe('GameEngine.startRound', () => {
  let engine: GameEngine;
  let wordsRepo: WordsRepository;

  beforeEach(() => {
    wordsRepo = createMockWordsRepo();
    engine = new GameEngine(wordsRepo);
  });

  it('assigns exactly impostorCount impostors', () => {
    const room = createLobbyRoom(5, 1);
    const { hands } = engine.startRound(room);

    const impostors = hands.filter((h) => h.hand.role === 'impostor');
    const players = hands.filter((h) => h.hand.role === 'player');
    expect(impostors).toHaveLength(1);
    expect(players).toHaveLength(4);
  });

  it('assigns multiple impostors when impostorCount > 1', () => {
    const room = createLobbyRoom(6, 2);
    const { hands } = engine.startRound(room);

    const impostors = hands.filter((h) => h.hand.role === 'impostor');
    expect(impostors).toHaveLength(2);
  });

  it('impostor receives a hint, never the word', () => {
    const room = createLobbyRoom(4, 1);
    const { hands } = engine.startRound(room);

    const impostorHand = hands.find((h) => h.hand.role === 'impostor');
    expect(impostorHand).toBeDefined();
    expect(impostorHand!.hand.role).toBe('impostor');

    const hand = impostorHand!.hand as { role: 'impostor'; hint: Record<string, string> };
    expect(hand.hint).toBeTruthy();
    expect(hand).not.toHaveProperty('word');
    expect(testWord.hints.pl).toContain(hand.hint.pl);
    expect(testWord.hints.en).toContain(hand.hint.en);
  });

  it('regular player receives the word, never a hint', () => {
    const room = createLobbyRoom(4, 1);
    const { hands } = engine.startRound(room);

    const playerHand = hands.find((h) => h.hand.role === 'player');
    expect(playerHand).toBeDefined();

    const hand = playerHand!.hand as { role: 'player'; word: string };
    expect(hand.word).toBe('Jett');
    expect(hand).not.toHaveProperty('hint');
  });

  it('all regular players receive the same word', () => {
    const room = createLobbyRoom(5, 1);
    const { hands } = engine.startRound(room);

    const playerWords = hands
      .filter((h) => h.hand.role === 'player')
      .map((h) => (h.hand as { role: 'player'; word: string }).word);

    expect(new Set(playerWords).size).toBe(1);
    expect(playerWords[0]).toBe('Jett');
  });

  it('sets room status to playing', () => {
    const room = createLobbyRoom(4);
    engine.startRound(room);
    expect(room.status).toBe('playing');
  });

  it('increments the round number', () => {
    const room = createLobbyRoom(4);
    room.settings.roundsCount = 3;
    engine.startRound(room);
    expect(room.round?.roundNumber).toBe(1);
    expect(room.round?.totalRounds).toBe(3);

    room.status = 'lobby';
    room.players.forEach((p) => (p.isReady = true));
    engine.startRound(room);
    expect(room.round?.roundNumber).toBe(2);
  });

  it('stores currentWord on the room for later result reveal', () => {
    const room = createLobbyRoom(4);
    engine.startRound(room);
    expect(room.currentWord).toBe('Jett');
  });

  it('initializes turnOrder with all player ids', () => {
    const room = createLobbyRoom(5);
    engine.startRound(room);

    expect(room.round?.turnOrder).toHaveLength(5);
    const ids = room.players.map((p) => p.id);
    expect([...room.round!.turnOrder].sort()).toEqual([...ids].sort());
  });

  it('initializes clues as empty array', () => {
    const room = createLobbyRoom(4);
    engine.startRound(room);
    expect(room.round?.clues).toEqual([]);
  });

  it('sets totalRounds from settings.roundsCount', () => {
    const room = createLobbyRoom(4);
    room.settings.roundsCount = 2;
    engine.startRound(room);
    expect(room.round?.totalRounds).toBe(2);
  });

  it('keeps the same turnOrder across rounds within a game', () => {
    const room = createLobbyRoom(5);
    room.settings.roundsCount = 3;
    engine.startRound(room);
    const firstTurnOrder = [...room.round!.turnOrder];

    room.status = 'lobby';
    room.players.forEach((p) => (p.isReady = true));
    engine.startRound(room);
    expect(room.round!.turnOrder).toEqual(firstTurnOrder);

    room.status = 'lobby';
    room.players.forEach((p) => (p.isReady = true));
    engine.startRound(room);
    expect(room.round!.turnOrder).toEqual(firstTurnOrder);
  });

  it('shuffles a new turnOrder when starting a new game', () => {
    const room = createLobbyRoom(5);
    engine.startRound(room);
    const firstGameOrder = [...room.round!.turnOrder];

    room.round = undefined;
    room.status = 'lobby';
    room.players.forEach((p) => (p.isReady = true));

    const orders = new Set<string>();
    orders.add(firstGameOrder.join(','));
    for (let i = 0; i < 50; i++) {
      const r = createLobbyRoom(5);
      engine.startRound(r);
      orders.add(r.round!.turnOrder.join(','));
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it('sets player.role on every InternalPlayer', () => {
    const room = createLobbyRoom(5, 1);
    engine.startRound(room);

    const impostors = room.players.filter((p) => p.role === 'impostor');
    const regulars = room.players.filter((p) => p.role === 'player');
    expect(impostors).toHaveLength(1);
    expect(regulars).toHaveLength(4);
  });

  it('stores word on regular players and hint on impostors', () => {
    const room = createLobbyRoom(4, 1);
    engine.startRound(room);

    for (const player of room.players) {
      if (player.role === 'impostor') {
        expect(player.hint).toBeTruthy();
        expect(player.word).toBeUndefined();
        expect(testWord.hints.pl).toContain(player.hint!.pl);
        expect(testWord.hints.en).toContain(player.hint!.en);
      } else {
        expect(player.word).toBe('Jett');
        expect(player.hint).toBeUndefined();
      }
    }
  });

  it('resets vote to null for all players', () => {
    const room = createLobbyRoom(4);
    room.players[0].vote = 'someone';
    engine.startRound(room);

    for (const player of room.players) {
      expect(player.vote).toBeNull();
    }
  });

  it('returns socketId in each hand entry', () => {
    const room = createLobbyRoom(3);
    const { hands } = engine.startRound(room);

    for (const entry of hands) {
      expect(entry.socketId).toBe(`socket-${entry.playerId}`);
    }
  });

  it('calls wordsRepo.pickRandom with the room categories', () => {
    const room = createLobbyRoom(3);
    room.settings.categories = 'random';
    engine.startRound(room);

    expect(wordsRepo.pickRandom).toHaveBeenCalledWith('random', expect.any(Array));
  });
});

describe('GameEngine.startRound validation', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine(createMockWordsRepo());
  });

  it('throws NOT_IN_LOBBY when status is not lobby', () => {
    const room = createLobbyRoom(4);
    room.status = 'voting';

    expect(() => engine.startRound(room)).toThrow(GameError);
    expect(() => engine.startRound(room)).toThrow('Round can only be started from lobby');
  });

  it('throws PLAYERS_NOT_READY when a non-host player is not ready', () => {
    const room = createLobbyRoom(4);
    room.players[2].isReady = false;

    expect(() => engine.startRound(room)).toThrow(GameError);
    expect(() => engine.startRound(room)).toThrow('All players must be ready');
  });

  it('starts even when host is not ready (host readiness is ignored)', () => {
    const room = createLobbyRoom(4);
    room.players[0].isReady = false;

    expect(() => engine.startRound(room)).not.toThrow();
    expect(room.status).toBe('playing');
  });

  it('throws NOT_ENOUGH_PLAYERS with fewer than impostorCount + 2', () => {
    const room = createLobbyRoom(2, 1);

    expect(() => engine.startRound(room)).toThrow(GameError);
    expect(() => engine.startRound(room)).toThrow('Need at least 3 players');
  });

  it('allows exactly impostorCount + 2 players', () => {
    const room = createLobbyRoom(3, 1);
    expect(() => engine.startRound(room)).not.toThrow();
  });

  it('requires 4 players for 2 impostors', () => {
    const room3 = createLobbyRoom(3, 2);
    expect(() => engine.startRound(room3)).toThrow('Need at least 4 players');

    const room4 = createLobbyRoom(4, 2);
    expect(() => engine.startRound(room4)).not.toThrow();
  });
});

describe('GameEngine.startRound impostor distribution', () => {
  it('never gives the word to any impostor across many runs', () => {
    const repo = createMockWordsRepo();
    const engine = new GameEngine(repo);

    for (let i = 0; i < 100; i++) {
      const room = createLobbyRoom(6, 2);
      const { hands } = engine.startRound(room);

      for (const entry of hands) {
        if (entry.hand.role === 'impostor') {
          expect(entry.hand).not.toHaveProperty('word');
        }
      }
    }
  });

  it('assigns impostor hint from the word hints array', () => {
    const repo = createMockWordsRepo();
    const engine = new GameEngine(repo);
    const allHints = new Set<string>();

    for (let i = 0; i < 200; i++) {
      const room = createLobbyRoom(4, 1);
      const { hands } = engine.startRound(room);

      const impostorHand = hands.find((h) => h.hand.role === 'impostor')!;
      const hint = (impostorHand.hand as { role: 'impostor'; hint: Record<string, string> }).hint;
      allHints.add(hint.pl);
    }

    for (const hint of allHints) {
      expect(testWord.hints.pl).toContain(hint);
    }
  });
});
