const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const MAX_ATTEMPTS = 10;

export function generateRoomCode(): string {
  const chars: string[] = [];
  for (let i = 0; i < 3; i++) {
    chars.push(LETTERS[Math.floor(Math.random() * LETTERS.length)]);
  }
  for (let i = 0; i < 3; i++) {
    chars.push(DIGITS[Math.floor(Math.random() * DIGITS.length)]);
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export function generateUniqueRoomCode(
  isTaken: (code: string) => boolean,
): string {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateRoomCode();
    if (!isTaken(code)) return code;
  }
  throw new Error(
    `Failed to generate unique room code after ${MAX_ATTEMPTS} attempts`,
  );
}
