import { createServer } from 'node:http';
import { config } from './config.js';
import { WordsRepository } from './game/words.js';
import { setupSocket } from './socket/index.js';

const wordsRepo = new WordsRepository();

const httpServer = createServer();

setupSocket(httpServer, config.clientOrigin, wordsRepo);

httpServer.listen(config.port, () => {
  console.log(
    `[server] listening on :${config.port} (client origin: ${config.clientOrigin})`,
  );
});
