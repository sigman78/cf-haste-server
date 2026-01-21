/**
 * Router - Sync Global Manager
 *
 * Responsibilities:
 * - Owns window.history and popstate listener
 * - Methods: navigate(path, pushState), onRoute(handler), getCurrentPath()
 * - Single callback handler for route changes
 */

export type RouteHandler = (path: string) => void;

/**
 * Navigation mode determines how the router handles browser history:
 * - 'push': Add new entry to browser history (default for user actions)
 * - 'replace': Replace current history entry without adding new one (use for state transitions that shouldn't create back-button steps)
 */
export type NavigationMode = 'push' | 'replace';

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
   * @param mode - Navigation mode ('push' or 'replace')
   */
  navigate(path: string, mode: NavigationMode = 'push'): void {
    const fullPath = path ? `/${path}` : '/';
    const title = path ? `${this.appName}-${path.split('.')[0]}` : this.appName;

    if (window.location.pathname === fullPath) {
      return;
    }

    switch (mode) {
      case 'push':
        window.history.pushState(null, title, fullPath);
        break;

      case 'replace':
        window.history.replaceState(null, title, fullPath);
        break;
    }
  }

  /**
   * Initialize popstate listener for browser back/forward
   */
  private initPopStateListener(): void {
    window.addEventListener('popstate', () => {
      const path = this.getCurrentPath();
      this.handler?.(path);
    });
  }

  /**
   * Trigger initial route based on current URL
   */
  init(): void {
    const path = this.getCurrentPath();
    this.handler?.(path);
  }
}
