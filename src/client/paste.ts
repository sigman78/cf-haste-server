/**
 * Paste - Document
 *
 */

export class Paste {
  content: string = '';
  key?: string;
  language?: string;

  get isLoaded(): boolean {
    return this.key !== undefined;
  }

  reset(): void {
    this.content = '';
    this.key = undefined;
    this.language = undefined;
  }

  restore(data: { content: string; key?: string; language?: string }): void {
    this.content = data.content;
    this.key = data.key;
    this.language = data.language;
  }

  markSaved(key: string, language?: string): void {
    this.key = key;
    this.language = language;
  }
}
