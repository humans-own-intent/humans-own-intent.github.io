import { describe, it, expect } from 'vitest';
import { ADJECTIVES, NOUNS, generateRandomNodeTitle } from '../src/random-title.js';

describe('generateRandomNodeTitle', () => {
  it('has at least 100 adjectives and 100 nouns', () => {
    expect(ADJECTIVES.length).toBeGreaterThanOrEqual(100);
    expect(NOUNS.length).toBeGreaterThanOrEqual(100);

    // Verify all items are unique and non-empty
    const uniqueAdj = new Set(ADJECTIVES);
    const uniqueNouns = new Set(NOUNS);
    expect(uniqueAdj.size).toBe(ADJECTIVES.length);
    expect(uniqueNouns.size).toBe(NOUNS.length);
  });

  it('generates a title formatted as [Adjective] [Noun] from the sets', () => {
    for (let i = 0; i < 20; i++) {
      const title = generateRandomNodeTitle();
      const parts = title.split(' ');
      expect(parts.length).toBe(2);

      const [adj, noun] = parts;
      expect(ADJECTIVES).toContain(adj);
      expect(NOUNS).toContain(noun);
    }
  });
});
