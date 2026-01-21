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
 * State for NEW documents (no key yet)
 */
export interface NewDocumentState {
  content: string;
  language?: string;
}

/**
 * State for LOADED/SAVED documents (always has key)
 */
export interface LoadedDocumentState {
  content: string;
  key: string;
  language?: string;
}

/**
 * Union type for Document model internal state
 */
export type DocumentState = NewDocumentState | LoadedDocumentState;

/**
 * Type guard to check if document is loaded
 */
export function isLoaded(doc: DocumentState): doc is LoadedDocumentState {
  return 'key' in doc && doc.key !== undefined;
}

/**
 * Legacy metadata type for backwards compatibility
 */
export interface DocumentMetaState {
  key?: string;
  language?: string;
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
    if (isLoaded(this.state)) {
      return this.state.key;
    }
    return undefined;
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

  // Setters
  setContent(content: string): void {
    this.state = {
      ...this.state,
      content,
    };
  }

  setLanguage(language: string | undefined): void {
    this.state = {
      ...this.state,
      language,
    };
  }

  // Load from external data (after fetch)
  hydrate(data: LoadedDocumentState): void {
    this.state = {
      content: data.content,
      key: data.key,
      language: data.language,
    };
  }

  // After successful save
  markSaved(key: string, language?: string): void {
    this.state = {
      content: this.state.content,
      key,
      language: language || this.state.language,
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

  // Copy content for duplication
  duplicate(): string {
    return this.state.content;
  }
}
