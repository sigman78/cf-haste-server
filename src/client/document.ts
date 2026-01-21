/**
 * Document (Model) - Pure Sync Business Logic
 *
 * Responsibilities:
 * - Business logic only, no I/O, no DOM
 * - Data: content, title, path, isDirty flag
 * - Operations: getters, setters, serialize, hydrate, reset, markClean
 * - Always reflects "saved state + local edits"
 */

export interface DocumentData {
  content: string;
  key?: string;
  language?: string;
}

export interface DocumentState {
  content: string;
  key?: string;
  language?: string;
  isDirty: boolean;
  isLocked: boolean;
}

export class DocumentModel {
  private state: DocumentState;
  private savedState: DocumentData;

  constructor() {
    this.state = {
      content: '',
      isDirty: false,
      isLocked: false,
    };
    this.savedState = {
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

  isDirty(): boolean {
    return this.state.isDirty;
  }

  isLocked(): boolean {
    return this.state.isLocked;
  }

  getState(): Readonly<DocumentState> {
    return { ...this.state };
  }

  // Setters
  setContent(content: string): void {
    this.state.content = content;
    this.state.isDirty = content !== this.savedState.content;
  }

  setLanguage(language: string | undefined): void {
    this.state.language = language;
  }

  // Load from external data (after fetch)
  hydrate(data: DocumentData): void {
    this.state = {
      content: data.content,
      key: data.key,
      language: data.language,
      isDirty: false,
      isLocked: true,
    };
    this.savedState = { ...data };
  }

  // After successful save
  markClean(key: string, language?: string): void {
    this.state.key = key;
    this.state.language = language;
    this.state.isDirty = false;
    this.state.isLocked = true;
    this.savedState = {
      content: this.state.content,
      key,
      language,
    };
  }

  // Serialize for save
  serialize(): string {
    return this.state.content;
  }

  // Reset to blank
  reset(): void {
    this.state = {
      content: '',
      isDirty: false,
      isLocked: false,
    };
    this.savedState = {
      content: '',
    };
  }

  // Copy content for duplication
  duplicate(): string {
    return this.state.content;
  }
}
