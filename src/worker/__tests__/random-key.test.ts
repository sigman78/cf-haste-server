/** @jest-environment node */

import { generateKey, pronounceableKey, urlSafeKey } from '../storage';

describe('randomKey', () => {
  it('generates keys of the requested length plus separators', () => {
    const key = pronounceableKey(10);
    expect(key.replace(/-/g, '')).toHaveLength(10);
  });

  it('enforces a minimum length of 6', () => {
    const key = pronounceableKey(2);
    expect(key.replace(/-/g, '')).toHaveLength(6);
  });

  it('never produces a trailing dash', () => {
    for (const len of [6, 10, 12, 18]) {
      expect(pronounceableKey(len).endsWith('-')).toBe(false);
    }
  });

  it('inserts a dash every 6 characters', () => {
    const key = pronounceableKey(12);
    expect(key).toMatch(/^[a-z]{6}-[a-z]{6}$/);
  });

  it('only uses pronounceable consonant/vowel pattern', () => {
    const key = pronounceableKey(9);
    // pattern: CVC CVC CVC (dash after 6th char)
    expect(key).toMatch(/^[bcdfghjklmnpqrstvwxyz][aeiou][bcdfghjklmnpqrstvwxyz]/);
  });

  it('produces distinct keys', () => {
    const keys = new Set(Array.from({ length: 100 }, () => pronounceableKey(10)));
    expect(keys.size).toBeGreaterThan(90);
  });

  it('generates URL-safe random keys at six bits per character', () => {
    expect(urlSafeKey(16)).toMatch(/^[A-Za-z0-9_-]{16}$/);
  });

  it('supports UUID keys independently of configured length', () => {
    expect(generateKey('uuid', 6)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });
});
