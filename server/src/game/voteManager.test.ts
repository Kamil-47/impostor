import { describe, it, expect, beforeEach } from 'vitest';
import type { InternalRoom, InternalPlayer } from './roomManager.js';
import { VoteManager, VoteError } from './voteManager.js';

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
    vote: null,
    ...overrides,
  };
}

function createVotingRoom(
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
    status: 'voting',
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

describe('VoteManager.castVote', () => {
  let vm: VoteManager;

  beforeEach(() => {
    vm = new VoteManager();
  });

  it('records a vote on the voter', () => {
    const room = createVotingRoom(4);
    vm.castVote(room, 'p0', 'p1');
    expect(room.players[0].vote).toBe('p1');
  });

  it('returns allVoted=false when not all players have voted', () => {
    const room = createVotingRoom(4);
    const result = vm.castVote(room, 'p0', 'p1');
    expect(result.allVoted).toBe(false);
  });

  it('returns allVoted=true when the last player votes', () => {
    const room = createVotingRoom(3);
    vm.castVote(room, 'p0', 'p1');
    vm.castVote(room, 'p1', 'p0');
    const result = vm.castVote(room, 'p2', 'p0');
    expect(result.allVoted).toBe(true);
  });

  it('allows a player to vote for themselves', () => {
    const room = createVotingRoom(3);
    const result = vm.castVote(room, 'p1', 'p1');
    expect(room.players[1].vote).toBe('p1');
    expect(result.allVoted).toBe(false);
  });

  it('throws NOT_VOTING when room is in lobby', () => {
    const room = createVotingRoom(3);
    room.status = 'lobby';
    expect(() => vm.castVote(room, 'p0', 'p1')).toThrow(VoteError);
    expect(() => vm.castVote(room, 'p0', 'p1')).toThrow(
      'Voting is only allowed during voting phase',
    );
  });

  it('throws NOT_VOTING when room is in results', () => {
    const room = createVotingRoom(3);
    room.status = 'results';
    expect(() => vm.castVote(room, 'p0', 'p1')).toThrow(VoteError);
  });

  it('throws VOTER_NOT_FOUND for unknown voter', () => {
    const room = createVotingRoom(3);
    expect(() => vm.castVote(room, 'unknown', 'p1')).toThrow(VoteError);
    expect(() => vm.castVote(room, 'unknown', 'p1')).toThrow(
      'Voter is not in this room',
    );
  });

  it('throws ALREADY_VOTED when voter has already voted', () => {
    const room = createVotingRoom(3);
    vm.castVote(room, 'p0', 'p1');
    expect(() => vm.castVote(room, 'p0', 'p2')).toThrow(VoteError);
    expect(() => vm.castVote(room, 'p0', 'p2')).toThrow(
      'Player has already voted',
    );
  });

  it('throws TARGET_NOT_FOUND for unknown target', () => {
    const room = createVotingRoom(3);
    expect(() => vm.castVote(room, 'p0', 'nonexistent')).toThrow(VoteError);
    expect(() => vm.castVote(room, 'p0', 'nonexistent')).toThrow(
      'Vote target is not in this room',
    );
  });
});

describe('VoteManager.resolveRound', () => {
  let vm: VoteManager;

  beforeEach(() => {
    vm = new VoteManager();
  });

  it('returns all impostor IDs', () => {
    const room = createVotingRoom(4, 1);
    room.players.forEach((p) => (p.vote = 'p1'));
    const result = vm.resolveRound(room);
    expect(result.impostorIds).toEqual(['p0']);
  });

  it('returns multiple impostor IDs when there are multiple impostors', () => {
    const room = createVotingRoom(5, 2);
    room.players.forEach((p) => (p.vote = 'p2'));
    const result = vm.resolveRound(room);
    expect(result.impostorIds).toEqual(['p0', 'p1']);
  });

  it('returns the word that was in play', () => {
    const room = createVotingRoom(3);
    room.players.forEach((p) => (p.vote = 'p0'));
    const result = vm.resolveRound(room);
    expect(result.word).toBe('Jett');
  });

  it('returns all votes as a player→target record', () => {
    const room = createVotingRoom(4);
    room.players[0].vote = 'p1';
    room.players[1].vote = 'p0';
    room.players[2].vote = 'p1';
    room.players[3].vote = 'p0';
    const result = vm.resolveRound(room);
    expect(result.votes).toEqual({
      p0: 'p1',
      p1: 'p0',
      p2: 'p1',
      p3: 'p0',
    });
  });

  it('sets room status to results', () => {
    const room = createVotingRoom(3);
    room.players.forEach((p) => (p.vote = 'p0'));
    vm.resolveRound(room);
    expect(room.status).toBe('results');
  });

  it('players win when majority votes for the impostor', () => {
    const room = createVotingRoom(4, 1);
    // p0 is impostor — everyone else votes for p0
    room.players[0].vote = 'p1';
    room.players[1].vote = 'p0';
    room.players[2].vote = 'p0';
    room.players[3].vote = 'p0';

    const result = vm.resolveRound(room);
    expect(result.impostorWins).toBe(false);
  });

  it('impostor wins when majority votes for a non-impostor', () => {
    const room = createVotingRoom(4, 1);
    // p0 is impostor — majority votes for p2 (not impostor)
    room.players[0].vote = 'p2';
    room.players[1].vote = 'p2';
    room.players[2].vote = 'p0';
    room.players[3].vote = 'p2';

    const result = vm.resolveRound(room);
    expect(result.impostorWins).toBe(true);
  });

  it('impostor wins on a tie (no unique maximum)', () => {
    const room = createVotingRoom(4, 1);
    // p0 is impostor — votes split: p0 gets 2, p1 gets 2
    room.players[0].vote = 'p1';
    room.players[1].vote = 'p0';
    room.players[2].vote = 'p1';
    room.players[3].vote = 'p0';

    const result = vm.resolveRound(room);
    expect(result.impostorWins).toBe(true);
  });

  it('impostor wins on a three-way tie', () => {
    const room = createVotingRoom(6, 1);
    // p0 is impostor — votes split 2-2-2
    room.players[0].vote = 'p1';
    room.players[1].vote = 'p2';
    room.players[2].vote = 'p3';
    room.players[3].vote = 'p1';
    room.players[4].vote = 'p2';
    room.players[5].vote = 'p3';

    const result = vm.resolveRound(room);
    expect(result.impostorWins).toBe(true);
  });

  it('impostor wins even when tied with a non-impostor', () => {
    const room = createVotingRoom(4, 1);
    // p0 is impostor — p0 and p1 each get 2 votes (tie)
    room.players[0].vote = 'p1';
    room.players[1].vote = 'p0';
    room.players[2].vote = 'p0';
    room.players[3].vote = 'p1';

    const result = vm.resolveRound(room);
    // tie → impostor wins regardless
    expect(result.impostorWins).toBe(true);
  });

  it('players win with multiple impostors when one is caught by majority', () => {
    const room = createVotingRoom(5, 2);
    // p0,p1 are impostors — majority votes for p0
    room.players[0].vote = 'p2';
    room.players[1].vote = 'p2';
    room.players[2].vote = 'p0';
    room.players[3].vote = 'p0';
    room.players[4].vote = 'p0';

    const result = vm.resolveRound(room);
    expect(result.impostorWins).toBe(false);
  });

  it('handles empty word gracefully', () => {
    const room = createVotingRoom(3);
    room.currentWord = undefined;
    room.players.forEach((p) => (p.vote = 'p0'));
    const result = vm.resolveRound(room);
    expect(result.word).toBe('');
  });

  it('handles room where no one voted', () => {
    const room = createVotingRoom(3);
    const result = vm.resolveRound(room);
    expect(result.votes).toEqual({});
    expect(result.impostorWins).toBe(true);
  });
});

describe('VoteManager.nextRound', () => {
  let vm: VoteManager;

  beforeEach(() => {
    vm = new VoteManager();
  });

  it('sets all players isReady to true (auto-ready)', () => {
    const room = createVotingRoom(3);
    room.status = 'results';
    room.players[1].isReady = false;
    vm.nextRound(room);
    for (const player of room.players) {
      expect(player.isReady).toBe(true);
    }
  });

  it('clears player roles', () => {
    const room = createVotingRoom(3);
    room.status = 'results';
    vm.nextRound(room);
    for (const player of room.players) {
      expect(player.role).toBeUndefined();
    }
  });

  it('clears player word and hint', () => {
    const room = createVotingRoom(3);
    room.status = 'results';
    vm.nextRound(room);
    for (const player of room.players) {
      expect(player.word).toBeUndefined();
      expect(player.hint).toBeUndefined();
    }
  });

  it('resets all votes to null', () => {
    const room = createVotingRoom(3);
    room.status = 'results';
    room.players.forEach((p) => (p.vote = 'someone'));
    vm.nextRound(room);
    for (const player of room.players) {
      expect(player.vote).toBeNull();
    }
  });

  it('sets room status to lobby', () => {
    const room = createVotingRoom(3);
    room.status = 'results';
    vm.nextRound(room);
    expect(room.status).toBe('lobby');
  });

  it('clears currentWord', () => {
    const room = createVotingRoom(3);
    room.status = 'results';
    vm.nextRound(room);
    expect(room.currentWord).toBeUndefined();
  });

  it('always clears round so next game gets a fresh shuffle', () => {
    const room = createVotingRoom(3);
    room.status = 'results';
    room.round = {
      roundNumber: 1,
      totalRounds: 3,
      turnOrder: ['p0', 'p1', 'p2'],
      clues: [],
    };
    vm.nextRound(room);
    expect(room.round).toBeUndefined();
  });

  it('throws NOT_IN_RESULTS when room is in voting', () => {
    const room = createVotingRoom(3);
    room.status = 'voting';
    expect(() => vm.nextRound(room)).toThrow(VoteError);
    expect(() => vm.nextRound(room)).toThrow(
      'Can only start next round from results phase',
    );
  });

  it('throws NOT_IN_RESULTS when room is in lobby', () => {
    const room = createVotingRoom(3);
    room.status = 'lobby';
    expect(() => vm.nextRound(room)).toThrow(VoteError);
  });
});

describe('VoteManager.resolveByImpostorCaught', () => {
  let vm: VoteManager;

  beforeEach(() => {
    vm = new VoteManager();
  });

  it('sets room status to results', () => {
    const room = createVotingRoom(4);
    room.status = 'playing';
    vm.resolveByImpostorCaught(room);
    expect(room.status).toBe('results');
  });

  it('returns impostorWins=false', () => {
    const room = createVotingRoom(4);
    room.status = 'playing';
    const result = vm.resolveByImpostorCaught(room);
    expect(result.impostorWins).toBe(false);
  });

  it('returns empty votes record', () => {
    const room = createVotingRoom(4);
    room.status = 'playing';
    const result = vm.resolveByImpostorCaught(room);
    expect(result.votes).toEqual({});
  });

  it('returns all impostor IDs', () => {
    const room = createVotingRoom(5, 2);
    room.status = 'playing';
    const result = vm.resolveByImpostorCaught(room);
    expect(result.impostorIds).toEqual(['p0', 'p1']);
  });

  it('returns the word that was in play', () => {
    const room = createVotingRoom(3);
    room.status = 'playing';
    const result = vm.resolveByImpostorCaught(room);
    expect(result.word).toBe('Jett');
  });

  it('stores lastRoundResult on the room', () => {
    const room = createVotingRoom(3);
    room.status = 'playing';
    const result = vm.resolveByImpostorCaught(room);
    expect(room.lastRoundResult).toBe(result);
  });
});
