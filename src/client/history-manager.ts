export type NavHandler = (path: string, state: unknown) => void;

export class HistoryManager {
  private handler: NavHandler | null = null;

  onNavigate(handler: NavHandler): void {
    this.handler = handler;
    let lastPathname = window.location.pathname;
    window.addEventListener('popstate', (e) => {
      const pathname = window.location.pathname;
      if (pathname === lastPathname) return; // hash-only navigation, ignore
      lastPathname = pathname;
      handler(pathname, e.state);
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
