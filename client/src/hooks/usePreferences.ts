import type { RoomSettings } from '@impostor/shared';

function read<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function usePreferences() {
  return {
    nickname: read<string>('impostor:nickname', ''),
    lastCode: read<string>('impostor:lastCode', ''),
    impostorCount: read<number>('impostor:impostorCount', 1),
    categories: read<RoomSettings['categories']>('impostor:categories', 'random'),
    theme: read<'dark' | 'light'>('impostor:theme', 'dark'),
    roundsCount: read<number>('impostor:roundsCount', 1),
    hintsEnabled: read<boolean>('impostor:hintsEnabled', true),
    setNickname: (v: string) => write('impostor:nickname', v),
    setLastCode: (v: string) => write('impostor:lastCode', v),
    setImpostorCount: (v: number) => write('impostor:impostorCount', v),
    setCategories: (v: RoomSettings['categories']) => write('impostor:categories', v),
    setTheme: (v: 'dark' | 'light') => write('impostor:theme', v),
    setRoundsCount: (v: number) => write('impostor:roundsCount', v),
    setHintsEnabled: (v: boolean) => write('impostor:hintsEnabled', v),
  };
}
