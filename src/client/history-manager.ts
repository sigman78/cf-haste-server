export type NavHandler = (path: string, state: unknown) => void;

export class HistoryManager {
  private handler: NavHandler | null = null;

  onNavigate(handler: NavHandler): void {
    this.handler = handler;
    window.addEventListener('popstate', (e) => {
      handler(window.location.pathname, e.state);
    });
  }

  push(path: string, state?: unknown): void {
    window.history.pushState(state ?? null, '', path);
  }

  replace(path: string, state?: unknown): void {
    window.history.replaceState(state ?? null, '', path);
  }

  resolve(): void {
    this.handler?.(window.location.pathname, window.history.state);
  }
}
