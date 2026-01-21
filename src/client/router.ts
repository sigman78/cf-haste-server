/**
 * Router - Sync Global Manager
 *
 * Responsibilities:
 * - Owns window.history and popstate listener
 * - Methods: navigate(path, pushState), onRoute(handler), getCurrentPath()
 * - Single callback handler for route changes
 */

export type RouteHandler = (path: string) => void;

export class Router {
  private handler?: RouteHandler;
  private appName: string;

  constructor(appName: string) {
    this.appName = appName;
    this.initPopStateListener();
  }

  /**
   * Register route change handler
   */
  onRoute(handler: RouteHandler): void {
    this.handler = handler;
  }

  /**
   * Get current path (without leading slash)
   */
  getCurrentPath(): string {
    const path = window.location.pathname;
    return path === '/' ? '' : path.substring(1);
  }

  /**
   * Navigate to a new path
   * @param path - Path to navigate to (without leading slash, or empty for home)
   * @param pushState - Whether to push to history (false for initial load or back/forward)
   */
  navigate(path: string, pushState = true): void {
    const fullPath = path ? `/${path}` : '/';

    if (pushState && window.location.pathname !== fullPath) {
      const title = path ? `${this.appName}-${path.split('.')[0]}` : this.appName;
      window.history.pushState(null, title, fullPath);
    }

    // Don't call handler if we're just updating URL
    if (!pushState && this.handler) {
      this.handler(path);
    }
  }

  /**
   * Initialize popstate listener for browser back/forward
   */
  private initPopStateListener(): void {
    window.addEventListener('popstate', () => {
      const path = this.getCurrentPath();
      if (this.handler) {
        this.handler(path);
      }
    });
  }

  /**
   * Trigger initial route based on current URL
   */
  init(): void {
    const path = this.getCurrentPath();
    if (this.handler) {
      this.handler(path);
    }
  }
}
