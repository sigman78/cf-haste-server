/**
 * Paste - Document
 *
 */

export class Paste {
  content: string = '';
  key?: string;
  language?: string;
  frozen: boolean = false;

  get isLoaded(): boolean {
    return this.key !== undefined;
  }

  reset(): void {
    this.content = '';
    this.key = undefined;
    this.language = undefined;
    this.frozen = false;
  }

  apply(data: { content: string; key?: string; language?: string; frozen?: boolean }): void {
    this.content = data.content;
    this.key = data.key;
    this.language = data.language;
    this.frozen = data.frozen ?? false;
  }
}
