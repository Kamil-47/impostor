export const config = {
  port: process.env.PORT ? Number(process.env.PORT) : 3001,
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  playerGraceMs: 60_000,
  emptyRoomMs: 300_000,
} as const;
