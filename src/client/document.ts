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
 * State for documents
 */
export interface DocumentState {
  content: string;
  key?: string;
  language?: string;
}

/**
 * Type guard to check if document is loaded
 */
export function isLoaded(doc: DocumentState) {
  return 'key' in doc && doc.key !== undefined;
}

// Partial<Pick<DocumentState, 'key' | 'content' | 'language'>>
type DocumentUpdate = {
  key?: string;
  content?: string;
  language?: string;
};

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
    return this.state?.key;
  }

  getLanguage(): string | undefined {
    return this.state.language;
  }

  getState(): Readonly<DocumentState> {
    return { ...this.state };
  }

  isLoaded(): boolean {
    return isLoaded(this.state);
  }

  update(update: DocumentUpdate): void {
    this.state = {
      ...this.state,
      ...update,
    };
  }

  // Setters
  setContent(content: string): void {
    this.state = {
      ...this.state,
      content,
    };
  }

  // Load from external data (after fetch)
  hydrate(data: DocumentState): void {
    this.state = {
      content: data.content,
      key: data.key,
      language: data.language,
    };
  }

  // Serialize for save
  serialize(): string {
    return this.state.content;
  }

  // Reset to blank (new document)
  reset(): void {
    this.state = {
      content: '',
    };
  }
}
