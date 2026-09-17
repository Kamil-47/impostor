import { randomUUID } from 'node:crypto';
import type {
  GameStatus,
  Language,
  PlayerRole,
  PublicPlayer,
  Room,
  RoomSettings,
  RoundPublic,
  RoundResult,
} from '@impostor/shared';
import { generateUniqueRoomCode } from '../utils/roomCode.js';

export class RoomError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'RoomError';
  }
}

export interface InternalPlayer {
  id: string;
  uuid: string;
  nickname: string;
  socketId: string | null;
  isReady: boolean;
  role?: PlayerRole;
  word?: string;
  hint?: Record<Language, string>;
  vote?: string | null;
}

export interface InternalRoom {
  code: string;
  hostId: string;
  status: GameStatus;
  settings: RoomSettings;
  players: InternalPlayer[];
  round?: RoundPublic;
  currentWord?: string;
  lastRoundResult?: RoundResult;
  usedWordsIds: string[];
}

export interface CreateRoomResult {
  room: Room;
  playerId: string;
  playerUuid: string;
}

export interface JoinRoomResult {
  room: Room;
  playerId: string;
  playerUuid: string;
  reconnected: boolean;
}

export interface LeaveRoomResult {
  roomCode: string;
  playerId: string;
  playerNickname: string;
  roomDeleted: boolean;
  newHostId: string | null;
  roundAborted: boolean;
  shouldResolve: boolean;
}

export interface KickPlayerResult {
  room: Room;
  kickedSocketId: string | null;
  roundAborted: boolean;
  playerNickname: string;
  shouldResolve: boolean;
}

export interface DisconnectResult {
  roomCode: string;
  playerId: string;
}

export interface RoomManagerOptions {
  playerGraceMs?: number;
  emptyRoomMs?: number;
  onGraceExpired?: (result: LeaveRoomResult) => void;
  onRoomExpired?: (roomCode: string) => void;
}

const NICKNAME_MAX = 20;
const NICKNAME_REGEX = /^[\p{L}\p{N}_\- ]+$/u;

function sanitizeNickname(raw: string): string {
  const nick = raw.trim();
  if (!nick) {
    throw new RoomError('NICKNAME_EMPTY', 'Nickname must not be empty');
  }
  if (nick.length > NICKNAME_MAX) {
    throw new RoomError(
      'NICKNAME_TOO_LONG',
      `Nickname must be at most ${NICKNAME_MAX} characters`,
    );
  }
  if (!NICKNAME_REGEX.test(nick)) {
    throw new RoomError(
      'NICKNAME_INVALID',
      'Nickname contains invalid characters',
    );
  }
  return nick;
}

export class RoomManager {
  private rooms = new Map<string, InternalRoom>();
  private socketIndex = new Map<
    string,
    { roomCode: string; playerId: string }
  >();
  private graceTimers = new Map<string, NodeJS.Timeout>();
  private emptyRoomTimers = new Map<string, NodeJS.Timeout>();

  private readonly playerGraceMs: number;
  private readonly emptyRoomMs: number;
  private readonly onGraceExpired?: (result: LeaveRoomResult) => void;
  private readonly onRoomExpired?: (roomCode: string) => void;

  constructor(options?: RoomManagerOptions) {
    this.playerGraceMs = options?.playerGraceMs ?? 60_000;
    this.emptyRoomMs = options?.emptyRoomMs ?? 300_000;
    this.onGraceExpired = options?.onGraceExpired;
    this.onRoomExpired = options?.onRoomExpired;
  }

  createRoom(
    nickname: string,
    settings: RoomSettings,
    socketId: string,
  ): CreateRoomResult {
    const nick = sanitizeNickname(nickname);

    if (
      !Number.isInteger(settings.roundsCount) ||
      settings.roundsCount < 1 ||
      settings.roundsCount > 3
    ) {
      throw new RoomError(
        'INVALID_ROUNDS_COUNT',
        'Rounds count must be 1, 2 or 3',
      );
    }

    const code = generateUniqueRoomCode((c) => this.rooms.has(c));
    const playerId = randomUUID();
    const playerUuid = randomUUID();

    const host: InternalPlayer = {
      id: playerId,
      uuid: playerUuid,
      nickname: nick,
      socketId,
      isReady: false,
    };

    const room: InternalRoom = {
      code,
      hostId: playerId,
      status: 'lobby',
      settings,
      players: [host],
      usedWordsIds: [],
    };

    this.rooms.set(code, room);
    this.socketIndex.set(socketId, { roomCode: code, playerId });

    return {
      room: this.toPublicRoom(room),
      playerId,
      playerUuid,
    };
  }

  joinRoom(
    code: string,
    nickname: string,
    socketId: string,
    playerUuid?: string,
  ): JoinRoomResult {
    const room = this.rooms.get(code);
    if (!room) {
      throw new RoomError('ROOM_NOT_FOUND', `Room ${code} does not exist`);
    }

    if (playerUuid) {
      const existing = room.players.find((p) => p.uuid === playerUuid);
      if (existing) {
        if (existing.socketId && existing.socketId !== socketId) {
          this.socketIndex.delete(existing.socketId);
        }
        existing.socketId = socketId;
        this.socketIndex.set(socketId, { roomCode: code, playerId: existing.id });
        this.cancelGraceTimer(code, existing.id);
        return {
          room: this.toPublicRoom(room),
          playerId: existing.id,
          playerUuid: existing.uuid,
          reconnected: true,
        };
      }
    }

    if (room.status !== 'lobby') {
      throw new RoomError(
        'ROOM_IN_PROGRESS',
        'Cannot join a room while a round is in progress',
      );
    }

    const nick = sanitizeNickname(nickname);
    if (
      room.players.some(
        (p) => p.nickname.toLowerCase() === nick.toLowerCase(),
      )
    ) {
      throw new RoomError(
        'NICKNAME_TAKEN',
        `Nickname "${nick}" is already used in this room`,
      );
    }

    this.cancelEmptyRoomTimer(code);
    const newId = randomUUID();
    const newUuid = randomUUID();
    const player: InternalPlayer = {
      id: newId,
      uuid: newUuid,
      nickname: nick,
      socketId,
      isReady: false,
    };
    room.players.push(player);
    this.socketIndex.set(socketId, { roomCode: code, playerId: newId });

    return {
      room: this.toPublicRoom(room),
      playerId: newId,
      playerUuid: newUuid,
      reconnected: false,
    };
  }

  updateSettings(
    socketId: string,
    partial: Partial<RoomSettings>,
  ): { roomCode: string } {
    const entry = this.socketIndex.get(socketId);
    if (!entry) {
      throw new RoomError('NOT_IN_ROOM', 'Socket is not in any room');
    }

    const room = this.rooms.get(entry.roomCode);
    if (!room) {
      throw new RoomError(
        'ROOM_NOT_FOUND',
        `Room ${entry.roomCode} does not exist`,
      );
    }

    if (room.hostId !== entry.playerId) {
      throw new RoomError('NOT_HOST', 'Only the host can change settings');
    }

    if (room.status !== 'lobby') {
      throw new RoomError(
        'NOT_IN_LOBBY',
        'Settings can only be changed in lobby',
      );
    }

    if (partial.impostorCount != null) {
      if (
        !Number.isInteger(partial.impostorCount) ||
        partial.impostorCount < 1 ||
        partial.impostorCount > 3
      ) {
        throw new RoomError(
          'INVALID_IMPOSTOR_COUNT',
          'Impostor count must be 1, 2 or 3',
        );
      }
      room.settings.impostorCount = partial.impostorCount;
    }

    if (partial.roundsCount != null) {
      if (
        !Number.isInteger(partial.roundsCount) ||
        partial.roundsCount < 1 ||
        partial.roundsCount > 3
      ) {
        throw new RoomError(
          'INVALID_ROUNDS_COUNT',
          'Rounds count must be 1, 2 or 3',
        );
      }
      room.settings.roundsCount = partial.roundsCount;
    }

    if (partial.categories != null) {
      room.settings.categories = partial.categories;
    }

    if (partial.hintsEnabled != null) {
      room.settings.hintsEnabled = partial.hintsEnabled;
    }

    return { roomCode: entry.roomCode };
  }

  setReady(socketId: string, isReady: boolean): { roomCode: string } {
    const entry = this.socketIndex.get(socketId);
    if (!entry) {
      throw new RoomError('NOT_IN_ROOM', 'Socket is not in any room');
    }

    const room = this.rooms.get(entry.roomCode);
    if (!room) {
      throw new RoomError(
        'ROOM_NOT_FOUND',
        `Room ${entry.roomCode} does not exist`,
      );
    }

    if (room.status !== 'lobby') {
      throw new RoomError(
        'NOT_IN_LOBBY',
        'Can only change ready status in lobby',
      );
    }

    const player = room.players.find((p) => p.id === entry.playerId);
    if (!player) {
      throw new RoomError('PLAYER_NOT_FOUND', 'Player not found in room');
    }

    player.isReady = isReady;
    return { roomCode: entry.roomCode };
  }

  leaveRoom(socketId: string): LeaveRoomResult | null {
    const entry = this.socketIndex.get(socketId);
    if (!entry) return null;

    this.socketIndex.delete(socketId);
    this.cancelGraceTimer(entry.roomCode, entry.playerId);

    return this.removePlayer(entry.roomCode, entry.playerId);
  }

  kickPlayer(hostSocketId: string, targetPlayerId: string): KickPlayerResult {
    const entry = this.socketIndex.get(hostSocketId);
    if (!entry) {
      throw new RoomError('NOT_IN_ROOM', 'Socket is not in any room');
    }

    const room = this.rooms.get(entry.roomCode);
    if (!room) {
      throw new RoomError(
        'ROOM_NOT_FOUND',
        `Room ${entry.roomCode} does not exist`,
      );
    }

    if (room.hostId !== entry.playerId) {
      throw new RoomError('NOT_HOST', 'Only host can kick players');
    }
    if (targetPlayerId === room.hostId) {
      throw new RoomError('CANNOT_KICK_SELF', 'Host cannot kick themselves');
    }

    const target = room.players.find((p) => p.id === targetPlayerId);
    if (!target) {
      throw new RoomError(
        'PLAYER_NOT_FOUND',
        `Player ${targetPlayerId} not in room`,
      );
    }

    const kickedSocketId = target.socketId;
    this.cancelGraceTimer(entry.roomCode, targetPlayerId);

    const result = this.removePlayer(entry.roomCode, targetPlayerId)!;

    return {
      room: this.toPublicRoom(room),
      kickedSocketId,
      roundAborted: result.roundAborted,
      playerNickname: result.playerNickname,
      shouldResolve: result.shouldResolve,
    };
  }

  disconnectPlayer(socketId: string): DisconnectResult | null {
    const entry = this.socketIndex.get(socketId);
    if (!entry) return null;

    this.socketIndex.delete(socketId);
    const room = this.rooms.get(entry.roomCode);
    if (!room) return null;

    const player = room.players.find((p) => p.id === entry.playerId);
    if (!player) return null;

    player.socketId = null;

    const timerKey = `${entry.roomCode}:${entry.playerId}`;
    const timer = setTimeout(() => {
      this.graceTimers.delete(timerKey);
      const result = this.removePlayer(entry.roomCode, entry.playerId);
      if (result) {
        this.onGraceExpired?.(result);
      }
    }, this.playerGraceMs);
    this.graceTimers.set(timerKey, timer);

    return {
      roomCode: entry.roomCode,
      playerId: entry.playerId,
    };
  }

  getPublicRoom(code: string): Room | null {
    const room = this.rooms.get(code);
    return room ? this.toPublicRoom(room) : null;
  }

  getRoomBySocket(
    socketId: string,
  ): { room: Room; playerId: string } | null {
    const entry = this.socketIndex.get(socketId);
    if (!entry) return null;
    const room = this.rooms.get(entry.roomCode);
    if (!room) return null;
    return { room: this.toPublicRoom(room), playerId: entry.playerId };
  }

  getInternalRoom(code: string): InternalRoom | null {
    return this.rooms.get(code) ?? null;
  }

  getSocketEntry(socketId: string): { roomCode: string; playerId: string } | null {
    return this.socketIndex.get(socketId) ?? null;
  }

  private removePlayer(
    roomCode: string,
    playerId: string,
  ): LeaveRoomResult | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const idx = room.players.findIndex((p) => p.id === playerId);
    if (idx === -1) return null;

    const player = room.players[idx];
    const playerNickname = player.nickname;
    const wasHost = room.hostId === playerId;

    if (player.socketId) {
      this.socketIndex.delete(player.socketId);
    }

    room.players.splice(idx, 1);

    let roundAborted = false;
    let shouldResolve = false;
    if (room.status === 'playing') {
      this.abortRound(room);
      roundAborted = true;
    } else if (room.status === 'voting') {
      const allRemainingVoted =
        room.players.length > 0 && room.players.every((p) => p.vote != null);
      if (allRemainingVoted) {
        shouldResolve = true;
      } else {
        this.abortRound(room);
        roundAborted = true;
      }
    }

    let roomDeleted = false;
    let newHostId: string | null = null;

    if (room.players.length === 0) {
      this.startEmptyRoomTimer(roomCode);
    } else if (wasHost) {
      newHostId = room.players[0].id;
      room.hostId = newHostId;
    }

    return {
      roomCode,
      playerId,
      playerNickname,
      roomDeleted,
      newHostId,
      roundAborted,
      shouldResolve,
    };
  }

  private abortRound(room: InternalRoom): void {
    for (const player of room.players) {
      player.isReady = false;
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

  private startEmptyRoomTimer(roomCode: string): void {
    this.cancelEmptyRoomTimer(roomCode);
    const timer = setTimeout(() => {
      this.emptyRoomTimers.delete(roomCode);
      const room = this.rooms.get(roomCode);
      if (room && room.players.length === 0) {
        this.rooms.delete(roomCode);
        this.onRoomExpired?.(roomCode);
      }
    }, this.emptyRoomMs);
    this.emptyRoomTimers.set(roomCode, timer);
  }

  private cancelEmptyRoomTimer(roomCode: string): void {
    const timer = this.emptyRoomTimers.get(roomCode);
    if (timer) {
      clearTimeout(timer);
      this.emptyRoomTimers.delete(roomCode);
    }
  }

  private cancelGraceTimer(roomCode: string, playerId: string): void {
    const key = `${roomCode}:${playerId}`;
    const timer = this.graceTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.graceTimers.delete(key);
    }
  }

  private toPublicRoom(room: InternalRoom): Room {
    const players: PublicPlayer[] = room.players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      isReady: p.isReady,
      isHost: p.id === room.hostId,
      hasVoted: p.vote != null,
      hasSubmittedClue:
        room.round?.clues.some((c) => c.playerId === p.id) ?? false,
    }));

    return {
      code: room.code,
      hostId: room.hostId,
      status: room.status,
      settings: room.settings,
      players,
      round: room.round,
    };
  }
}
