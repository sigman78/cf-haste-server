import { randomKey } from '../storage';

describe('randomKey', () => {
  it('generates keys of the requested length plus separators', () => {
    const key = randomKey(10);
    expect(key.replace(/-/g, '')).toHaveLength(10);
  });

  it('enforces a minimum length of 6', () => {
    const key = randomKey(2);
    expect(key.replace(/-/g, '')).toHaveLength(6);
  });

  it('never produces a trailing dash', () => {
    for (const len of [6, 10, 12, 18]) {
      expect(randomKey(len).endsWith('-')).toBe(false);
    }
  });

  it('inserts a dash every 6 characters', () => {
    const key = randomKey(12);
    expect(key).toMatch(/^[a-z]{6}-[a-z]{6}$/);
  });

  it('only uses pronounceable consonant/vowel pattern', () => {
    const key = randomKey(9);
    // pattern: CVC CVC CVC (dash after 6th char)
    expect(key).toMatch(/^[bcdfghjklmnpqrstvwxyz][aeiou][bcdfghjklmnpqrstvwxyz]/);
  });

  it('produces distinct keys', () => {
    const keys = new Set(Array.from({ length: 100 }, () => randomKey(10)));
    expect(keys.size).toBeGreaterThan(90);
  });
});
