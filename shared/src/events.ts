import type { Room, RoomSettings, RoundResult, PlayerRole, Language } from './models.js';

export interface CreateRoomPayload {
  nickname: string;
  settings: RoomSettings;
}

export interface CreateRoomResponse {
  code: string;
  playerId: string;
  playerUuid: string;
}

export interface JoinRoomPayload {
  code: string;
  nickname: string;
  playerUuid?: string;
}

export interface JoinRoomResponse {
  playerId: string;
  playerUuid: string;
}

export type PlayerHand =
  | { role: 'player'; word: string }
  | { role: 'impostor'; hint?: Record<Language, string> };

export interface SocketError {
  code: string;
  message: string;
}

export interface ClientToServerEvents {
  'room:create': (payload: CreateRoomPayload, ack: (response: CreateRoomResponse) => void) => void;
  'room:join': (payload: JoinRoomPayload, ack: (response: JoinRoomResponse) => void) => void;
  'room:leave': () => void;
  'player:kick': (targetId: string) => void;
  'player:setReady': (isReady: boolean) => void;
  'round:start': () => void;
  'vote:cast': (targetId: string) => void;
  'round:next': () => void;
  'clue:submit': (text: string, ack: (err: SocketError | null) => void) => void;
  'settings:update': (settings: Partial<RoomSettings>) => void;
}

export interface RoundAbortedPayload {
  reason: 'playerLeft';
  playerNickname: string;
}

export interface ServerToClientEvents {
  'room:state': (room: Room) => void;
  'round:privateHand': (hand: PlayerHand) => void;
  'round:votingOpen': () => void;
  'round:results': (result: RoundResult) => void;
  'round:aborted': (payload: RoundAbortedPayload) => void;
  'error': (error: SocketError) => void;
}
