/**
 * DraftStore - best-effort persistence of unsaved editor content.
 *
 * Keeps the last unsaved draft in localStorage (debounced) so an accidental
 * tab close or crash doesn't lose work. Cleared on save or explicit discard.
 * All storage access is wrapped: private browsing or quota errors just
 * disable the feature silently.
 */

const DRAFT_KEY = 'haste-draft';
const DEBOUNCE_MS = 400;

export class DraftStore {
  private timer: ReturnType<typeof setTimeout> | null = null;

  /** Debounced write; empty content removes the draft. */
  schedule(content: string): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.write(content);
    }, DEBOUNCE_MS);
  }

  load(): string | null {
    try {
      return localStorage.getItem(DRAFT_KEY);
    } catch {
      return null;
    }
  }

  clear(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // best-effort
    }
  }

  private write(content: string): void {
    try {
      if (content.trim()) {
        localStorage.setItem(DRAFT_KEY, content);
      } else {
        localStorage.removeItem(DRAFT_KEY);
      }
    } catch {
      // best-effort
    }
  }
}
