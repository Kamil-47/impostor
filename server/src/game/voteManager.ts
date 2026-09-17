import type { RoundResult } from '@impostor/shared';
import type { InternalRoom } from './roomManager.js';

export class VoteError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'VoteError';
  }
}

export interface CastVoteResult {
  allVoted: boolean;
}

export class VoteManager {
  castVote(
    room: InternalRoom,
    voterId: string,
    targetId: string,
  ): CastVoteResult {
    if (room.status !== 'voting') {
      throw new VoteError(
        'NOT_VOTING',
        'Voting is only allowed during voting phase',
      );
    }

    const voter = room.players.find((p) => p.id === voterId);
    if (!voter) {
      throw new VoteError('VOTER_NOT_FOUND', 'Voter is not in this room');
    }

    if (voter.vote != null) {
      throw new VoteError('ALREADY_VOTED', 'Player has already voted');
    }

    const target = room.players.find((p) => p.id === targetId);
    if (!target) {
      throw new VoteError(
        'TARGET_NOT_FOUND',
        'Vote target is not in this room',
      );
    }

    voter.vote = targetId;

    const allVoted = room.players.every((p) => p.vote != null);
    return { allVoted };
  }

  resolveRound(room: InternalRoom): RoundResult {
    const votes: Record<string, string> = {};
    const voteCounts = new Map<string, number>();

    for (const player of room.players) {
      if (player.vote != null) {
        votes[player.id] = player.vote;
        voteCounts.set(
          player.vote,
          (voteCounts.get(player.vote) ?? 0) + 1,
        );
      }
    }

    const impostorIds = room.players
      .filter((p) => p.role === 'impostor')
      .map((p) => p.id);

    const impostorIdSet = new Set(impostorIds);

    let maxVotes = 0;
    for (const count of voteCounts.values()) {
      if (count > maxVotes) maxVotes = count;
    }

    const topVoted = [...voteCounts.entries()]
      .filter(([, count]) => count === maxVotes)
      .map(([id]) => id);

    const impostorWins =
      topVoted.length !== 1 || !impostorIdSet.has(topVoted[0]);

    room.status = 'results';

    const result: RoundResult = {
      impostorIds,
      word: room.currentWord ?? '',
      votes,
      impostorWins,
    };
    room.lastRoundResult = result;

    return result;
  }

  resolveByImpostorGuessedWord(room: InternalRoom): RoundResult {
    const impostorIds = room.players
      .filter((p) => p.role === 'impostor')
      .map((p) => p.id);

    room.status = 'results';

    const result: RoundResult = {
      impostorIds,
      word: room.currentWord ?? '',
      votes: {},
      impostorWins: true,
      impostorGuessedWord: true,
    };
    room.lastRoundResult = result;

    return result;
  }

  resolveByImpostorCaught(room: InternalRoom): RoundResult {
    const impostorIds = room.players
      .filter((p) => p.role === 'impostor')
      .map((p) => p.id);

    room.status = 'results';

    const result: RoundResult = {
      impostorIds,
      word: room.currentWord ?? '',
      votes: {},
      impostorWins: false,
      impostorCaughtByClue: true,
    };
    room.lastRoundResult = result;

    return result;
  }

  nextRound(room: InternalRoom): void {
    if (room.status !== 'results') {
      throw new VoteError(
        'NOT_IN_RESULTS',
        'Can only start next round from results phase',
      );
    }

    for (const player of room.players) {
      player.isReady = true;
      player.role = undefined;
      player.word = undefined;
      player.hint = undefined;
      player.vote = null;
    }

    room.status = 'lobby';
    room.currentWord = undefined;
    room.lastRoundResult = undefined;

    room.round = undefined;
  }
}
