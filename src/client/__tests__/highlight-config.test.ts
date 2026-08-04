import {
  getLanguageForExtension,
  highlightContent,
  MAX_AUTO_HIGHLIGHT_LENGTH,
  MAX_EXPLICIT_HIGHLIGHT_LENGTH,
} from '../highlight-config';

describe('highlight policy', () => {
  it('treats unknown extensions as unknown rather than throwing', () => {
    expect(getLanguageForExtension('xyz-not-registered')).toBeUndefined();
    expect(getLanguageForExtension('__proto__')).toBeUndefined();
  });

  it('escapes HTML when content is too large for automatic detection', () => {
    const content = '<script>alert(1)</script>' + 'x'.repeat(MAX_AUTO_HIGHLIGHT_LENGTH);
    const result = highlightContent(content);

    expect(result.highlighted).toContain('&lt;script&gt;');
    expect(result.highlighted).not.toContain('<script>');
    expect(result.language).toBeUndefined();
  });

  it('bounds explicit highlighting independently', () => {
    const content = '<img onerror=alert(1)>' + 'x'.repeat(MAX_EXPLICIT_HIGHLIGHT_LENGTH);
    const result = highlightContent(content, 'xml');

    expect(result.highlighted).toContain('&lt;img');
    expect(result.highlighted).not.toContain('<img');
    expect(result.language).toBe('xml');
  });
});
