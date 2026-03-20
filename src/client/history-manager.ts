export type NavHandler = (path: string, state: unknown) => void;

export class HistoryManager {
  private handler: NavHandler | null = null;
  private lastPathname: string = '';

  onNavigate(handler: NavHandler): void {
    this.handler = handler;
    this.lastPathname = window.location.pathname;
    window.addEventListener('popstate', (e) => {
      const pathname = window.location.pathname;
      if (pathname === this.lastPathname) return; // hash-only navigation, ignore
      this.lastPathname = pathname;
      handler(pathname, e.state);
    });
  }

  push(path: string, state?: unknown): void {
    window.history.pushState(state ?? null, '', path);
    this.lastPathname = path;
  }

  replace(path: string, state?: unknown): void {
    window.history.replaceState(state ?? null, '', path);
    this.lastPathname = path;
  }

  resolve(): void {
    this.handler?.(window.location.pathname, window.history.state);
  }
}
