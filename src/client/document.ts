/**
 * Document (Model) - Pure Sync Business Logic
 *
 * Responsibilities:
 * - Business logic only, no I/O, no DOM
 * - Data: content, key, language
 * - Operations: getters, setters, serialize, hydrate, reset
 * - Lifecycle state managed by AppController
 */

/**
 * Document metadata (key and language)
 */
export interface DocumentMetaState {
  key?: string;
  language?: string;
}

/**
 * Full document state (metadata + content)
 */
export interface DocumentState extends DocumentMetaState {
  content: string;
}

export class DocumentModel {
  private state: DocumentState;

  constructor() {
    this.state = {
      content: '',
    };
  }

  // Getters
  getContent(): string {
    return this.state.content;
  }

  getKey(): string | undefined {
    return this.state.key;
  }

  getLanguage(): string | undefined {
    return this.state.language;
  }

  getState(): Readonly<DocumentState> {
    return { ...this.state };
  }

  // Setters
  setContent(content: string): void {
    this.state.content = content;
  }

  setLanguage(language: string | undefined): void {
    this.state.language = language;
  }

  // Load from external data (after fetch)
  hydrate(data: DocumentState): void {
    this.state = {
      content: data.content,
      key: data.key,
      language: data.language,
    };
  }

  // After successful save
  markSaved(key: string, language?: string): void {
    this.state.key = key;
    this.state.language = language;
  }

  // Serialize for save
  serialize(): string {
    return this.state.content;
  }

  // Reset to blank
  reset(): void {
    this.state = {
      content: '',
    };
  }

  // Copy content for duplication
  duplicate(): string {
    return this.state.content;
  }
}
