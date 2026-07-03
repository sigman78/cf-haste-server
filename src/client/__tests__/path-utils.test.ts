import { parsePath, buildPath } from '../path-utils';

describe('parsePath', () => {
  it('parses a bare key', () => {
    expect(parsePath('/abc123')).toEqual({ key: 'abc123' });
  });

  it('parses a key with extension', () => {
    expect(parsePath('/abc123.js')).toEqual({ key: 'abc123', ext: 'js' });
  });

  it('parses root as empty key', () => {
    expect(parsePath('/')).toEqual({ key: '' });
  });

  it('handles paths without leading slash', () => {
    expect(parsePath('abc123.py')).toEqual({ key: 'abc123', ext: 'py' });
  });

  it('splits on the first dot only', () => {
    expect(parsePath('/abc.tar.gz')).toEqual({ key: 'abc', ext: 'tar.gz' });
  });
});

describe('buildPath', () => {
  it('builds a bare key path', () => {
    expect(buildPath('abc123')).toBe('/abc123');
  });

  it('builds a path with extension', () => {
    expect(buildPath('abc123', 'js')).toBe('/abc123.js');
  });

  it('returns root for empty key', () => {
    expect(buildPath('')).toBe('/');
  });
});
