import { describe, it, expect } from 'vitest';
import { generateRoomCode, generateUniqueRoomCode } from './roomCode.js';

describe('generateRoomCode', () => {
  it('generates 6-character codes with 3 letters and 3 digits', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(6);
      const letters = code.match(/[A-Z]/g) ?? [];
      const digits = code.match(/[0-9]/g) ?? [];
      expect(letters).toHaveLength(3);
      expect(digits).toHaveLength(3);
    }
  });

  it('produces mostly unique codes across many calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(generateRoomCode());
    expect(seen.size).toBeGreaterThan(180);
  });
});

describe('generateUniqueRoomCode', () => {
  it('returns a code when it is not taken', () => {
    const code = generateUniqueRoomCode(() => false);
    expect(code).toHaveLength(6);
  });

  it('retries when the code is taken then succeeds', () => {
    let attempts = 0;
    const code = generateUniqueRoomCode(() => {
      attempts++;
      return attempts < 3;
    });
    expect(code).toHaveLength(6);
    expect(attempts).toBe(3);
  });

  it('throws after 10 collisions', () => {
    let attempts = 0;
    expect(() =>
      generateUniqueRoomCode(() => {
        attempts++;
        return true;
      }),
    ).toThrow(/Failed to generate unique room code/);
    expect(attempts).toBe(10);
  });
});
