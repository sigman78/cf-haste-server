export type HistoryState = {
  content?: string;
  scrollY?: number;
};

export class NavigationState {
  private handler: ((path: string, state: HistoryState | undefined) => void) | null = null;
  private lastPathname: string = window.location.pathname;

  constructor() {
    window.addEventListener('popstate', (e) => {
      const pathname = window.location.pathname;
      if (pathname === this.lastPathname) return;
      this.lastPathname = pathname;
      this.handler?.(pathname, this.read(e.state));
    });
  }

  onNavigate(handler: (path: string, state: HistoryState | undefined) => void): void {
    this.handler = handler;
    this.lastPathname = window.location.pathname;
  }

  resolve(): void {
    this.handler?.(window.location.pathname, this.read(window.history.state));
  }

  pushPath(path: string, state?: HistoryState): void {
    window.history.pushState(state ?? null, '', path);
    this.lastPathname = path;
  }

  replacePath(path: string, state?: HistoryState): void {
    window.history.replaceState(state ?? null, '', path);
    this.lastPathname = path;
  }

  replaceDraft(path: string, content: string, scrollY: number): void {
    this.replacePath(path, { content, scrollY });
  }

  captureScroll(path: string): void {
    const existing = this.currentState();
    this.replacePath(path, { ...existing, scrollY: window.scrollY });
  }

  currentState(): HistoryState {
    return this.read(window.history.state) ?? {};
  }

  private read(state: unknown): HistoryState | undefined {
    if (!state || typeof state !== 'object') return undefined;

    const candidate = state as { content?: unknown; scrollY?: unknown };
    return {
      content: typeof candidate.content === 'string' ? candidate.content : undefined,
      scrollY: typeof candidate.scrollY === 'number' ? candidate.scrollY : undefined,
    };
  }
}
