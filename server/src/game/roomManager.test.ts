import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { RoomSettings, Word } from '@impostor/shared';
import { RoomError, RoomManager } from './roomManager.js';
import type { WordsRepository } from './words.js';
import { GameEngine } from './gameEngine.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const defaultSettings: RoomSettings = {
  impostorCount: 1,
  categories: ['agents'],
  roundsCount: 1,
  hintsEnabled: true,
};

describe('RoomManager.createRoom', () => {
  let mgr: RoomManager;
  beforeEach(() => {
    mgr = new RoomManager();
  });

  it('creates a lobby room with the host as the sole player', () => {
    const { room, playerId, playerUuid } = mgr.createRoom(
      'Alice',
      defaultSettings,
      's1',
    );
    expect(room.code).toHaveLength(6);
    expect(room.hostId).toBe(playerId);
    expect(room.status).toBe('lobby');
    expect(room.settings).toEqual(defaultSettings);
    expect(room.players).toHaveLength(1);
    expect(room.players[0]).toMatchObject({
      id: playerId,
      nickname: 'Alice',
      isHost: true,
      isReady: false,
      hasVoted: false,
      hasSubmittedClue: false,
    });
    expect(playerUuid).toBeTruthy();
    expect(playerUuid).not.toBe(playerId);
  });

  it('trims and validates the nickname', () => {
    expect(() => mgr.createRoom('   ', defaultSettings, 's1')).toThrow(
      RoomError,
    );
    expect(() => mgr.createRoom('x'.repeat(21), defaultSettings, 's1')).toThrow(
      RoomError,
    );
    expect(() => mgr.createRoom('bad!!!', defaultSettings, 's1')).toThrow(
      RoomError,
    );
    const { room } = mgr.createRoom('  Bob  ', defaultSettings, 's2');
    expect(room.players[0].nickname).toBe('Bob');
  });

  it('rejects roundsCount outside 1..3', () => {
    expect(() =>
      mgr.createRoom('Alice', { ...defaultSettings, roundsCount: 0 }, 's1'),
    ).toThrow(RoomError);
    expect(() =>
      mgr.createRoom('Alice', { ...defaultSettings, roundsCount: 4 }, 's1'),
    ).toThrow(RoomError);
    expect(() =>
      mgr.createRoom('Alice', { ...defaultSettings, roundsCount: 1.5 }, 's1'),
    ).toThrow(RoomError);
    expect(() =>
      mgr.createRoom(
        'Alice',
        { ...defaultSettings, roundsCount: -1 },
        's1',
      ),
    ).toThrow(RoomError);
  });

  it('accepts roundsCount 1, 2 and 3', () => {
    for (const rc of [1, 2, 3]) {
      const { room } = mgr.createRoom(
        `P${rc}`,
        { ...defaultSettings, roundsCount: rc },
        `s-${rc}`,
      );
      expect(room.settings.roundsCount).toBe(rc);
    }
  });

  it('generates unique room codes across multiple rooms', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const { room } = mgr.createRoom(`Player${i}`, defaultSettings, `s${i}`);
      codes.add(room.code);
    }
    expect(codes.size).toBe(30);
  });

  it('indexes the host socket to the room', () => {
    const { room, playerId } = mgr.createRoom('Alice', defaultSettings, 's1');
    const found = mgr.getRoomBySocket('s1');
    expect(found?.room.code).toBe(room.code);
    expect(found?.playerId).toBe(playerId);
  });
});

describe('RoomManager.joinRoom', () => {
  let mgr: RoomManager;
  let host: ReturnType<RoomManager['createRoom']>;

  beforeEach(() => {
    mgr = new RoomManager();
    host = mgr.createRoom('Host', defaultSettings, 'sHost');
  });

  it('adds a new player to an existing room', () => {
    const { room, playerId, playerUuid, reconnected } = mgr.joinRoom(
      host.room.code,
      'Bob',
      's2',
    );
    expect(reconnected).toBe(false);
    expect(room.players).toHaveLength(2);
    expect(room.players[1].nickname).toBe('Bob');
    expect(room.players[1].isHost).toBe(false);
    expect(playerId).not.toBe(host.playerId);
    expect(playerUuid).not.toBe(host.playerUuid);
  });

  it('throws when the room does not exist', () => {
    expect(() => mgr.joinRoom('ZZZ999', 'Bob', 's2')).toThrow(RoomError);
  });

  it('rejects duplicate nicknames case-insensitively', () => {
    mgr.joinRoom(host.room.code, 'Bob', 's2');
    expect(() => mgr.joinRoom(host.room.code, 'BOB', 's3')).toThrow(RoomError);
  });

  it('reconnects an existing player when the UUID matches', () => {
    const first = mgr.joinRoom(host.room.code, 'Bob', 's2');
    const second = mgr.joinRoom(
      host.room.code,
      'Bob',
      's2-new',
      first.playerUuid,
    );
    expect(second.reconnected).toBe(true);
    expect(second.playerId).toBe(first.playerId);
    expect(second.room.players).toHaveLength(2);
  });

  it('reconnect keeps the original nickname and repoints the socket', () => {
    const first = mgr.joinRoom(host.room.code, 'Bob', 's2');
    mgr.joinRoom(host.room.code, 'Robert', 's2-new', first.playerUuid);

    const publicRoom = mgr.getPublicRoom(host.room.code);
    const bob = publicRoom?.players.find((p) => p.id === first.playerId);
    expect(bob?.nickname).toBe('Bob');
    expect(mgr.getRoomBySocket('s2-new')?.playerId).toBe(first.playerId);
    expect(mgr.getRoomBySocket('s2')).toBeNull();
  });

  it('treats an unknown UUID as a new player', () => {
    const result = mgr.joinRoom(
      host.room.code,
      'Bob',
      's2',
      '00000000-0000-0000-0000-000000000000',
    );
    expect(result.reconnected).toBe(false);
  });
});

describe('RoomManager.leaveRoom', () => {
  let mgr: RoomManager;
  let host: ReturnType<RoomManager['createRoom']>;

  beforeEach(() => {
    mgr = new RoomManager();
    host = mgr.createRoom('Host', defaultSettings, 'sHost');
  });

  it('removes the player and clears the socket index', () => {
    const bob = mgr.joinRoom(host.room.code, 'Bob', 's2');
    const result = mgr.leaveRoom('s2');
    expect(result?.playerId).toBe(bob.playerId);
    expect(result?.roomCode).toBe(host.room.code);
    expect(result?.roomDeleted).toBe(false);
    expect(result?.newHostId).toBeNull();
    expect(mgr.getRoomBySocket('s2')).toBeNull();
    expect(mgr.getPublicRoom(host.room.code)?.players).toHaveLength(1);
  });

  it('returns null for an unknown socket', () => {
    expect(mgr.leaveRoom('unknown')).toBeNull();
  });

  it('starts empty room timer when the last player leaves', () => {
    const result = mgr.leaveRoom('sHost');
    expect(result?.roomDeleted).toBe(false);
    expect(mgr.getPublicRoom(host.room.code)).not.toBeNull();
    expect(mgr.getPublicRoom(host.room.code)?.players).toHaveLength(0);

    vi.advanceTimersByTime(300_000);
    expect(mgr.getPublicRoom(host.room.code)).toBeNull();
  });

  it('promotes the next player to host when the host leaves', () => {
    const bob = mgr.joinRoom(host.room.code, 'Bob', 's2');
    mgr.joinRoom(host.room.code, 'Charlie', 's3');
    const result = mgr.leaveRoom('sHost');

    expect(result?.newHostId).toBe(bob.playerId);
    const publicRoom = mgr.getPublicRoom(host.room.code);
    expect(publicRoom?.hostId).toBe(bob.playerId);
    expect(publicRoom?.players[0].isHost).toBe(true);
    expect(publicRoom?.players[1].isHost).toBe(false);
  });

  it('does not change host when a non-host leaves', () => {
    mgr.joinRoom(host.room.code, 'Bob', 's2');
    const result = mgr.leaveRoom('s2');
    expect(result?.newHostId).toBeNull();
    expect(mgr.getPublicRoom(host.room.code)?.hostId).toBe(host.playerId);
  });
});

describe('RoomManager.kickPlayer', () => {
  let mgr: RoomManager;
  let host: ReturnType<RoomManager['createRoom']>;

  beforeEach(() => {
    mgr = new RoomManager();
    host = mgr.createRoom('Host', defaultSettings, 'sHost');
  });

  it('lets the host kick another player and clears their socket', () => {
    const bob = mgr.joinRoom(host.room.code, 'Bob', 's2');
    const result = mgr.kickPlayer('sHost', bob.playerId);
    expect(result.kickedSocketId).toBe('s2');
    expect(result.room.players).toHaveLength(1);
    expect(mgr.getRoomBySocket('s2')).toBeNull();
  });

  it('throws when a non-host tries to kick', () => {
    const bob = mgr.joinRoom(host.room.code, 'Bob', 's2');
    mgr.joinRoom(host.room.code, 'Charlie', 's3');
    expect(() => mgr.kickPlayer('s2', bob.playerId)).toThrow(RoomError);
  });

  it('throws when the host tries to kick themselves', () => {
    expect(() => mgr.kickPlayer('sHost', host.playerId)).toThrow(RoomError);
  });

  it('throws when the target player is not in the room', () => {
    expect(() =>
      mgr.kickPlayer('sHost', '00000000-0000-0000-0000-000000000000'),
    ).toThrow(RoomError);
  });

  it('throws when the caller is not in any room', () => {
    expect(() => mgr.kickPlayer('ghost', host.playerId)).toThrow(RoomError);
  });
});

describe('RoomManager.getPublicRoom', () => {
  it('returns null for an unknown room', () => {
    const mgr = new RoomManager();
    expect(mgr.getPublicRoom('ZZZ999')).toBeNull();
  });

  it('exposes only PublicPlayer fields (no role/word/hint)', () => {
    const mgr = new RoomManager();
    const host = mgr.createRoom('Host', defaultSettings, 'sHost');
    mgr.joinRoom(host.room.code, 'Bob', 's2');

    const publicRoom = mgr.getPublicRoom(host.room.code);
    for (const p of publicRoom?.players ?? []) {
      expect(Object.keys(p).sort()).toEqual(
        ['hasSubmittedClue', 'hasVoted', 'id', 'isHost', 'isReady', 'nickname'].sort(),
      );
    }
  });
});

describe('RoomManager.disconnectPlayer', () => {
  let mgr: RoomManager;
  let host: ReturnType<RoomManager['createRoom']>;

  beforeEach(() => {
    mgr = new RoomManager();
    host = mgr.createRoom('Host', defaultSettings, 'sHost');
  });

  it('marks the player as disconnected but keeps them in the room', () => {
    const bob = mgr.joinRoom(host.room.code, 'Bob', 's2');
    const result = mgr.disconnectPlayer('s2');

    expect(result).not.toBeNull();
    expect(result!.roomCode).toBe(host.room.code);
    expect(result!.playerId).toBe(bob.playerId);

    const room = mgr.getPublicRoom(host.room.code);
    expect(room?.players).toHaveLength(2);
    expect(mgr.getRoomBySocket('s2')).toBeNull();
  });

  it('returns null for an unknown socket', () => {
    expect(mgr.disconnectPlayer('unknown')).toBeNull();
  });

  it('removes the player after grace period expires (60s)', () => {
    mgr.joinRoom(host.room.code, 'Bob', 's2');
    mgr.disconnectPlayer('s2');

    expect(mgr.getPublicRoom(host.room.code)?.players).toHaveLength(2);

    vi.advanceTimersByTime(60_000);

    expect(mgr.getPublicRoom(host.room.code)?.players).toHaveLength(1);
  });

  it('does not remove the player before grace period expires', () => {
    mgr.joinRoom(host.room.code, 'Bob', 's2');
    mgr.disconnectPlayer('s2');

    vi.advanceTimersByTime(59_999);

    expect(mgr.getPublicRoom(host.room.code)?.players).toHaveLength(2);
  });

  it('calls onGraceExpired callback when grace timer fires', () => {
    const onGraceExpired = vi.fn();
    const mgr2 = new RoomManager({ onGraceExpired });
    const h = mgr2.createRoom('Host', defaultSettings, 'sHost');
    const bob = mgr2.joinRoom(h.room.code, 'Bob', 's2');

    mgr2.disconnectPlayer('s2');
    vi.advanceTimersByTime(60_000);

    expect(onGraceExpired).toHaveBeenCalledOnce();
    expect(onGraceExpired).toHaveBeenCalledWith(
      expect.objectContaining({
        roomCode: h.room.code,
        playerId: bob.playerId,
      }),
    );
  });

  it('promotes next player to host when host grace timer expires', () => {
    const bob = mgr.joinRoom(host.room.code, 'Bob', 's2');

    mgr.disconnectPlayer('sHost');

    expect(mgr.getPublicRoom(host.room.code)?.hostId).toBe(host.playerId);

    vi.advanceTimersByTime(60_000);

    expect(mgr.getPublicRoom(host.room.code)?.hostId).toBe(bob.playerId);
    expect(mgr.getPublicRoom(host.room.code)?.players).toHaveLength(1);
  });
});

describe('RoomManager grace timer cancellation', () => {
  let mgr: RoomManager;
  let host: ReturnType<RoomManager['createRoom']>;

  beforeEach(() => {
    mgr = new RoomManager();
    host = mgr.createRoom('Host', defaultSettings, 'sHost');
  });

  it('cancels grace timer when player reconnects via UUID', () => {
    const bob = mgr.joinRoom(host.room.code, 'Bob', 's2');
    mgr.disconnectPlayer('s2');

    vi.advanceTimersByTime(30_000);
    mgr.joinRoom(host.room.code, 'Bob', 's2-new', bob.playerUuid);

    vi.advanceTimersByTime(60_000);

    expect(mgr.getPublicRoom(host.room.code)?.players).toHaveLength(2);
  });

  it('cancels grace timer when player is kicked by host', () => {
    const bob = mgr.joinRoom(host.room.code, 'Bob', 's2');
    mgr.disconnectPlayer('s2');

    mgr.kickPlayer('sHost', bob.playerId);
    expect(mgr.getPublicRoom(host.room.code)?.players).toHaveLength(1);

    vi.advanceTimersByTime(60_000);

    expect(mgr.getPublicRoom(host.room.code)?.players).toHaveLength(1);
  });
});

describe('RoomManager empty room timer', () => {
  let mgr: RoomManager;

  beforeEach(() => {
    mgr = new RoomManager();
  });

  it('keeps the room alive for 5 minutes after last player leaves', () => {
    const host = mgr.createRoom('Host', defaultSettings, 'sHost');
    mgr.leaveRoom('sHost');

    expect(mgr.getPublicRoom(host.room.code)).not.toBeNull();
    expect(mgr.getPublicRoom(host.room.code)?.players).toHaveLength(0);

    vi.advanceTimersByTime(299_999);
    expect(mgr.getPublicRoom(host.room.code)).not.toBeNull();

    vi.advanceTimersByTime(1);
    expect(mgr.getPublicRoom(host.room.code)).toBeNull();
  });

  it('starts after all grace periods expire', () => {
    const host = mgr.createRoom('Host', defaultSettings, 'sHost');
    mgr.disconnectPlayer('sHost');

    vi.advanceTimersByTime(60_000);

    expect(mgr.getPublicRoom(host.room.code)).not.toBeNull();
    expect(mgr.getPublicRoom(host.room.code)?.players).toHaveLength(0);

    vi.advanceTimersByTime(300_000);
    expect(mgr.getPublicRoom(host.room.code)).toBeNull();
  });

  it('calls onRoomExpired callback when empty room timer fires', () => {
    const onRoomExpired = vi.fn();
    const mgr2 = new RoomManager({ onRoomExpired });
    const h = mgr2.createRoom('Host', defaultSettings, 'sHost');

    mgr2.leaveRoom('sHost');
    vi.advanceTimersByTime(300_000);

    expect(onRoomExpired).toHaveBeenCalledOnce();
    expect(onRoomExpired).toHaveBeenCalledWith(h.room.code);
  });

  it('cancels empty room timer when a new player joins', () => {
    const host = mgr.createRoom('Host', defaultSettings, 'sHost');
    const code = host.room.code;

    mgr.leaveRoom('sHost');
    expect(mgr.getPublicRoom(code)?.players).toHaveLength(0);

    vi.advanceTimersByTime(120_000);
    mgr.joinRoom(code, 'NewPlayer', 's2');

    vi.advanceTimersByTime(300_000);

    expect(mgr.getPublicRoom(code)).not.toBeNull();
    expect(mgr.getPublicRoom(code)?.players).toHaveLength(1);
  });
});

const testWord: Word = {
  id: 'jett',
  word: 'Jett',
  category: 'agents',
  hints: {
    pl: ['Korea', 'Szybka jak wiatr', 'Nożyki'],
    en: ['Korea', 'Fast as wind', 'Knives'],
  },
};

function createMockWordsRepo(): WordsRepository {
  return { pickRandom: vi.fn().mockReturnValue(testWord) } as unknown as WordsRepository;
}

function setupPlayingRoom(mgr: RoomManager) {
  const host = mgr.createRoom('Host', defaultSettings, 'sHost');
  mgr.joinRoom(host.room.code, 'Bob', 's2');
  mgr.joinRoom(host.room.code, 'Charlie', 's3');

  const engine = new GameEngine(createMockWordsRepo());
  const internalRoom = mgr.getInternalRoom(host.room.code)!;

  for (const p of internalRoom.players) {
    p.isReady = true;
  }
  engine.startRound(internalRoom);

  return { host, internalRoom };
}

describe('Round abort on player removal', () => {
  let mgr: RoomManager;

  beforeEach(() => {
    mgr = new RoomManager();
  });

  it('aborts round when a player leaves during "playing" status', () => {
    const { host, internalRoom } = setupPlayingRoom(mgr);
    expect(internalRoom.status).toBe('playing');
    expect(internalRoom.round).toBeDefined();

    const result = mgr.leaveRoom('s3');

    expect(result?.roundAborted).toBe(true);
    expect(result?.playerNickname).toBe('Charlie');
    expect(internalRoom.status).toBe('lobby');
    expect(internalRoom.round).toBeUndefined();
    expect(internalRoom.currentWord).toBeUndefined();
    for (const p of internalRoom.players) {
      expect(p.role).toBeUndefined();
      expect(p.word).toBeUndefined();
      expect(p.hint).toBeUndefined();
      expect(p.vote).toBeNull();
      expect(p.isReady).toBe(false);
    }
  });

  it('aborts round when a player leaves during "voting" status', () => {
    const { host, internalRoom } = setupPlayingRoom(mgr);
    internalRoom.status = 'voting';

    const result = mgr.leaveRoom('s2');

    expect(result?.roundAborted).toBe(true);
    expect(internalRoom.status).toBe('lobby');
    expect(internalRoom.round).toBeUndefined();
  });

  it('does NOT abort when a player leaves during "lobby" status', () => {
    const host = mgr.createRoom('Host', defaultSettings, 'sHost');
    mgr.joinRoom(host.room.code, 'Bob', 's2');

    const result = mgr.leaveRoom('s2');

    expect(result?.roundAborted).toBe(false);
  });

  it('does NOT abort when a player leaves during "results" status', () => {
    const { host, internalRoom } = setupPlayingRoom(mgr);
    internalRoom.status = 'results';
    internalRoom.lastRoundResult = {
      impostorIds: ['p1'],
      word: 'Jett',
      votes: {},
      impostorWins: false,
    };

    const result = mgr.leaveRoom('s3');

    expect(result?.roundAborted).toBe(false);
    expect(internalRoom.status).toBe('results');
    expect(internalRoom.lastRoundResult).toBeDefined();
  });

  it('aborts round AND transfers host when host leaves during round', () => {
    const { host, internalRoom } = setupPlayingRoom(mgr);

    const result = mgr.leaveRoom('sHost');

    expect(result?.roundAborted).toBe(true);
    expect(result?.newHostId).toBeTruthy();
    expect(internalRoom.status).toBe('lobby');
    expect(internalRoom.hostId).toBe(result?.newHostId);
  });

  it('aborts round when host kicks a player during round', () => {
    const { host, internalRoom } = setupPlayingRoom(mgr);
    const charlie = internalRoom.players.find((p) => p.nickname === 'Charlie')!;

    const result = mgr.kickPlayer('sHost', charlie.id);

    expect(result.roundAborted).toBe(true);
    expect(result.playerNickname).toBe('Charlie');
    expect(internalRoom.status).toBe('lobby');
    expect(internalRoom.round).toBeUndefined();
  });

  it('aborts round when disconnected player grace timer expires during round', () => {
    const onGraceExpired = vi.fn();
    const mgr2 = new RoomManager({ onGraceExpired });
    const host = mgr2.createRoom('Host', defaultSettings, 'sHost');
    mgr2.joinRoom(host.room.code, 'Bob', 's2');
    mgr2.joinRoom(host.room.code, 'Charlie', 's3');

    const engine = new GameEngine(createMockWordsRepo());
    const internalRoom = mgr2.getInternalRoom(host.room.code)!;
    for (const p of internalRoom.players) p.isReady = true;
    engine.startRound(internalRoom);

    mgr2.disconnectPlayer('s3');
    vi.advanceTimersByTime(60_000);

    expect(onGraceExpired).toHaveBeenCalledOnce();
    const cbResult = onGraceExpired.mock.calls[0][0];
    expect(cbResult.roundAborted).toBe(true);
    expect(cbResult.playerNickname).toBe('Charlie');
    expect(internalRoom.status).toBe('lobby');
    expect(internalRoom.round).toBeUndefined();
  });
});
