import { describe, it, expect, beforeEach } from 'vitest';
import type { InternalRoom, InternalPlayer } from './roomManager.js';
import { ClueManager, ClueError } from './clueManager.js';

function createPlayer(
  id: string,
  overrides?: Partial<InternalPlayer>,
): InternalPlayer {
  return {
    id,
    uuid: `uuid-${id}`,
    nickname: `Player-${id}`,
    socketId: `socket-${id}`,
    isReady: true,
    role: 'player',
    word: 'Jett',
    vote: null,
    ...overrides,
  };
}

function createPlayingRoom(
  playerCount: number,
  impostorCount = 1,
): InternalRoom {
  const players: InternalPlayer[] = [];
  for (let i = 0; i < playerCount; i++) {
    const isImpostor = i < impostorCount;
    players.push(
      createPlayer(`p${i}`, {
        role: isImpostor ? 'impostor' : 'player',
        word: isImpostor ? undefined : 'Jett',
        hint: isImpostor ? { pl: 'Nożyki', en: 'Knives' } : undefined,
      }),
    );
  }

  const turnOrder = players.map((p) => p.id);

  return {
    code: 'ABC123',
    hostId: players[0].id,
    status: 'playing',
    settings: {
      impostorCount,
      categories: ['agents'],
      roundsCount: 1,
      hintsEnabled: true,
    },
    players,
    currentWord: 'Jett',
    usedWordsIds: [],
    round: {
      roundNumber: 1,
      totalRounds: 1,
      turnOrder,
      clues: [],
    },
  };
}

describe('ClueManager.submitClue', () => {
  let cm: ClueManager;

  beforeEach(() => {
    cm = new ClueManager();
  });

  it('accepts a valid clue and returns accepted', () => {
    const room = createPlayingRoom(4);
    const outcome = cm.submitClue(room, 'p0', 'Korea');

    expect(outcome.kind).toBe('accepted');
    expect(room.round!.clues).toHaveLength(1);
    expect(room.round!.clues[0]).toEqual({
      playerId: 'p0',
      nickname: 'Player-p0',
      text: 'Korea',
    });
  });

  it('advances the turn after a successful clue', () => {
    const room = createPlayingRoom(4);
    cm.submitClue(room, 'p0', 'Korea');

    expect(() => cm.submitClue(room, 'p0', 'Szybka')).toThrow(ClueError);
    const outcome = cm.submitClue(room, 'p1', 'Szybka');
    expect(outcome.kind).toBe('accepted');
    expect(room.round!.clues).toHaveLength(2);
  });

  it('trims whitespace from the clue text', () => {
    const room = createPlayingRoom(4);
    cm.submitClue(room, 'p0', '  Korea  ');

    expect(room.round!.clues[0].text).toBe('Korea');
  });

  it('throws NOT_PLAYING when status is not playing', () => {
    const room = createPlayingRoom(4);
    room.status = 'lobby';

    expect(() => cm.submitClue(room, 'p0', 'Korea')).toThrow(ClueError);
    try {
      cm.submitClue(room, 'p0', 'Korea');
    } catch (err) {
      expect((err as ClueError).code).toBe('NOT_PLAYING');
    }
  });

  it('throws NOT_YOUR_TURN when it is another players turn', () => {
    const room = createPlayingRoom(4);

    expect(() => cm.submitClue(room, 'p1', 'Korea')).toThrow(ClueError);
    try {
      cm.submitClue(room, 'p1', 'Korea');
    } catch (err) {
      expect((err as ClueError).code).toBe('NOT_YOUR_TURN');
    }
  });

  it('throws CLUE_EMPTY for empty or whitespace-only clue', () => {
    const room = createPlayingRoom(4);

    expect(() => cm.submitClue(room, 'p0', '')).toThrow(ClueError);
    expect(() => cm.submitClue(room, 'p0', '   ')).toThrow(ClueError);
    try {
      cm.submitClue(room, 'p0', '');
    } catch (err) {
      expect((err as ClueError).code).toBe('CLUE_EMPTY');
    }
  });

  it('throws CLUE_TOO_LONG for clues over 40 characters', () => {
    const room = createPlayingRoom(4);
    const longClue = 'a'.repeat(41);

    expect(() => cm.submitClue(room, 'p0', longClue)).toThrow(ClueError);
    try {
      cm.submitClue(room, 'p0', longClue);
    } catch (err) {
      expect((err as ClueError).code).toBe('CLUE_TOO_LONG');
    }
  });

  it('accepts a clue with exactly 40 characters', () => {
    const room = createPlayingRoom(4);
    const maxClue = 'a'.repeat(40);

    const outcome = cm.submitClue(room, 'p0', maxClue);
    expect(outcome.kind).toBe('accepted');
  });

  it('throws CLUE_INVALID_CHARS for clues with special characters', () => {
    const room = createPlayingRoom(4);

    expect(() => cm.submitClue(room, 'p0', 'http://foo.com')).toThrow(
      ClueError,
    );
    expect(() => cm.submitClue(room, 'p0', 'hello!')).toThrow(ClueError);
    try {
      cm.submitClue(room, 'p0', 'hello!');
    } catch (err) {
      expect((err as ClueError).code).toBe('CLUE_INVALID_CHARS');
    }
  });

  it('allows unicode letters and digits in clues', () => {
    const room = createPlayingRoom(4);
    const outcome = cm.submitClue(room, 'p0', 'Żółć 123');
    expect(outcome.kind).toBe('accepted');
  });

  it('throws CLUE_DUPLICATE for case-insensitive duplicate clue', () => {
    const room = createPlayingRoom(4);
    cm.submitClue(room, 'p0', 'Korea');

    expect(() => cm.submitClue(room, 'p1', 'korea')).toThrow(ClueError);
    try {
      cm.submitClue(room, 'p1', 'korea');
    } catch (err) {
      expect((err as ClueError).code).toBe('CLUE_DUPLICATE');
    }
  });

  it('throws CLUE_DUPLICATE for exact match duplicate', () => {
    const room = createPlayingRoom(4);
    cm.submitClue(room, 'p0', 'Korea');

    expect(() => cm.submitClue(room, 'p1', 'Korea')).toThrow(ClueError);
  });

  it('does not add the clue to the list on duplicate error', () => {
    const room = createPlayingRoom(4);
    cm.submitClue(room, 'p0', 'Korea');

    try {
      cm.submitClue(room, 'p1', 'korea');
    } catch {
      // expected
    }

    expect(room.round!.clues).toHaveLength(1);
  });
});

describe('ClueManager — word as clue', () => {
  let cm: ClueManager;

  beforeEach(() => {
    cm = new ClueManager();
  });

  it('throws CLUE_IS_WORD when player submits the secret word', () => {
    const room = createPlayingRoom(4);
    // p0 is impostor, skip to p1 (a regular player)
    cm.submitClue(room, 'p0', 'Korea');
    expect(() => cm.submitClue(room, 'p1', 'Jett')).toThrow(ClueError);
    try {
      cm.submitClue(room, 'p1', 'Jett');
    } catch (err) {
      expect((err as ClueError).code).toBe('CLUE_IS_WORD');
    }
  });

  it('rejects the word case-insensitively', () => {
    const room = createPlayingRoom(4);
    cm.submitClue(room, 'p0', 'Korea');
    expect(() => cm.submitClue(room, 'p1', 'jett')).toThrow(ClueError);
  });

  it('allows impostor to submit the word (impostorGuessedWord)', () => {
    const room = createPlayingRoom(4);
    const outcome = cm.submitClue(room, 'p0', 'Jett');
    expect(outcome.kind).toBe('impostorGuessedWord');
  });

  it('impostor guessing the word is case-insensitive', () => {
    const room = createPlayingRoom(4);
    const outcome = cm.submitClue(room, 'p0', 'jett');
    expect(outcome.kind).toBe('impostorGuessedWord');
  });
});

describe('ClueManager — impostor caught', () => {
  let cm: ClueManager;

  beforeEach(() => {
    cm = new ClueManager();
  });

  it('returns impostorCaught when impostor submits their hint', () => {
    const room = createPlayingRoom(4);
    // p0 is impostor with hint 'Nożyki'
    const outcome = cm.submitClue(room, 'p0', 'Nożyki');

    expect(outcome.kind).toBe('impostorCaught');
    expect(room.round!.clues).toHaveLength(1);
  });

  it('returns impostorCaught case-insensitively', () => {
    const room = createPlayingRoom(4);
    const outcome = cm.submitClue(room, 'p0', 'nożyki');

    expect(outcome.kind).toBe('impostorCaught');
  });

  it('does not catch impostor when clue differs from hint', () => {
    const room = createPlayingRoom(4);
    const outcome = cm.submitClue(room, 'p0', 'Korea');

    expect(outcome.kind).toBe('accepted');
  });

  it('still pushes the clue when impostor is caught', () => {
    const room = createPlayingRoom(4);
    cm.submitClue(room, 'p0', 'Nożyki');

    expect(room.round!.clues[0].text).toBe('Nożyki');
  });
});

describe('ClueManager — phase complete', () => {
  let cm: ClueManager;

  beforeEach(() => {
    cm = new ClueManager();
  });

  it('returns phaseComplete when all players have submitted (totalRounds=1)', () => {
    const room = createPlayingRoom(3);
    // p0 is impostor — submit a clue that is NOT the hint
    cm.submitClue(room, 'p0', 'Korea');
    cm.submitClue(room, 'p1', 'Szybka');
    const outcome = cm.submitClue(room, 'p2', 'Duelist');

    expect(outcome.kind).toBe('phaseComplete');
    expect(room.round!.clues).toHaveLength(3);
  });

  it('returns phaseComplete after turnOrder.length * totalRounds submissions', () => {
    const room = createPlayingRoom(3);
    room.round!.totalRounds = 2;
    room.settings.roundsCount = 2;

    // Cycle 1
    cm.submitClue(room, 'p0', 'Korea');
    cm.submitClue(room, 'p1', 'Szybka');
    cm.submitClue(room, 'p2', 'Duelist');
    // Cycle 2
    cm.submitClue(room, 'p0', 'Reyna');
    cm.submitClue(room, 'p1', 'Wiatr');
    const outcome = cm.submitClue(room, 'p2', 'Dash');

    expect(outcome.kind).toBe('phaseComplete');
    expect(room.round!.clues).toHaveLength(6);
  });

  it('returns accepted before all clues are in', () => {
    const room = createPlayingRoom(4);
    cm.submitClue(room, 'p0', 'Korea');
    const outcome = cm.submitClue(room, 'p1', 'Szybka');

    expect(outcome.kind).toBe('accepted');
  });

  it('impostor caught takes priority over phase complete', () => {
    const room = createPlayingRoom(3);
    // p0 is the impostor (first in turn order), hint is 'Nożyki'
    // If impostor is last to submit AND submits the hint, impostorCaught wins
    cm.submitClue(room, 'p0', 'Korea');
    cm.submitClue(room, 'p1', 'Szybka');
    // p2 is a regular player, this is the last clue — phaseComplete
    const outcome = cm.submitClue(room, 'p2', 'Duelist');
    expect(outcome.kind).toBe('phaseComplete');
  });

  it('impostor caught on last turn returns impostorCaught not phaseComplete', () => {
    // Create a room where impostor is LAST in turnOrder
    const room = createPlayingRoom(3);
    // Move impostor to last position in turnOrder
    room.round!.turnOrder = ['p1', 'p2', 'p0'];

    cm.submitClue(room, 'p1', 'Szybka');
    cm.submitClue(room, 'p2', 'Duelist');
    // p0 (impostor) submits their hint on the last turn
    const outcome = cm.submitClue(room, 'p0', 'Nożyki');

    expect(outcome.kind).toBe('impostorCaught');
  });
});
