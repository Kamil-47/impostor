export type GameStatus = 'lobby' | 'playing' | 'voting' | 'results';

export type Category = 'agents' | 'maps' | 'weapons' | 'ultimates';

export type PlayerRole = 'player' | 'impostor';

export type Language = 'pl' | 'en';

export interface Word {
  id: string;
  word: string;
  category: Category;
  hints: Record<Language, [string, string, string]>;
}

export interface PublicPlayer {
  id: string;
  nickname: string;
  isReady: boolean;
  isHost: boolean;
  hasVoted: boolean;
  hasSubmittedClue: boolean;
}

export interface RoomSettings {
  impostorCount: number;
  categories: Category[] | 'random';
  roundsCount: number;
  hintsEnabled: boolean;
}

export interface ClueEntry {
  playerId: string;
  nickname: string;
  text: string;
}

export interface RoundPublic {
  roundNumber: number;
  totalRounds: number;
  turnOrder: string[];
  clues: ClueEntry[];
}

export interface RoundResult {
  impostorIds: string[];
  word: string;
  votes: Record<string, string>;
  impostorWins: boolean;
  impostorCaughtByClue?: boolean;
  impostorGuessedWord?: boolean;
}

export interface Room {
  code: string;
  hostId: string;
  status: GameStatus;
  settings: RoomSettings;
  players: PublicPlayer[];
  round?: RoundPublic;
}
