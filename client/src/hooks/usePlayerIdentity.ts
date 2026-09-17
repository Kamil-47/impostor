const KEY = 'impostor:playerUuid';

export function usePlayerIdentity() {
  return {
    getUuid: (): string | null => localStorage.getItem(KEY),
    saveUuid: (uuid: string): void => { localStorage.setItem(KEY, uuid); },
    clearUuid: (): void => { localStorage.removeItem(KEY); },
  };
}
