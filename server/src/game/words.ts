import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Word, Category, Language } from '@impostor/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface WordsFile {
  [key: string]: Word[];
}

export class WordsRepository {
  private words: Map<Category, Word[]> = new Map();

  constructor() {
    const categories: { file: string; key: Category }[] = [
      { file: 'words.agents.json', key: 'agents' },
      { file: 'words.maps.json', key: 'maps' },
      { file: 'words.weapons.json', key: 'weapons' },
      { file: 'words.ultimates.json', key: 'ultimates' },
    ];

    const requiredLangs: Language[] = ['pl', 'en'];

    for (const { file, key } of categories) {
      const filePath = resolve(__dirname, '..', 'data', file);
      const raw = readFileSync(filePath, 'utf-8');
      const data: WordsFile = JSON.parse(raw);
      const words = data[key];

      for (const word of words) {
        for (const lang of requiredLangs) {
          if (!word.hints[lang] || word.hints[lang].length !== 3) {
            throw new Error(
              `Word "${word.id}" is missing hints for language "${lang}"`,
            );
          }
        }
      }

      this.words.set(key, words);
      console.log(`[words] loaded ${words.length} ${key}`);
    }
  }

  pickRandom(categories: Category[] | 'random', excludeIds?: string[]): Word {
    const all =
      categories === 'random'
        ? [...this.words.values()].flat()
        : categories.flatMap((c) => this.words.get(c) ?? []);

    if (all.length === 0) {
      throw new Error(`No words available for categories "${categories}"`);
    }

    let pool = excludeIds?.length
      ? all.filter((w) => !excludeIds.includes(w.id))
      : all;

    if (pool.length === 0) pool = all;

    const index = Math.floor(Math.random() * pool.length);
    return pool[index];
  }

  getAll(category: Category): Word[] {
    return this.words.get(category) ?? [];
  }
}
