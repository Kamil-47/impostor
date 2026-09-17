# Impostor — Valorant Word Game

Gra słowna typu "impostor" z kategoriami z Valoranta.

## Wymagania

- Node.js >= 20
- npm >= 10

## Instalacja

```bash
npm install
```

## Developerka

Uruchamia jednocześnie: kompilację shared (watch), serwer (watch) i klienta Vite:

```bash
npm run dev
```

Osobno:

```bash
npm run dev -w shared    # kompilacja typów (watch)
npm run dev -w server    # serwer na :3001
npm run dev -w client    # Vite dev server na :5173
```

## Build produkcyjny

```bash
npm run build
```

## Testy

```bash
npm test
```

## Lint i formatowanie

```bash
npm run lint
npm run format
```
