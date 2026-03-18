/**
 * Modern Client-Side Router
 *
 * Features:
 * - Native support for Navigation API (Chrome/Edge 102+)
 * - Native support for URLPattern (Chrome/Edge 95+)
 * - Automatic fallback to History API and Regex for legacy browsers
 * - Zero dependencies
 */

// --- Type Definitions (Polyfill shims for TS) ---

declare global {
  // interface Window {
  //   navigation?: Navigation;
  // }
  // interface NavigationEvent extends Event {
  //   canIntercept: boolean;
  //   hashChange: boolean;
  //   downloadRequest: boolean;
  //   destination: { url: string };
  //   intercept(options: { handler: () => Promise<void> | void }): void;
  // }
  // interface Navigation {
  //   navigate(url: string, options?: unknown): void;
  //   addEventListener(
  //     type: 'navigate',
  //     listener: (ev: NavigationEvent) => any,
  //     options?: boolean | AddEventListenerOptions
  //   ): void;
  // }
  // // Minimal URLPattern definition
  // class URLPattern {
  //   constructor(input: { pathname: string; baseURL?: string });
  //   exec(input: string): URLPatternResult | null;
  // }
  // interface URLPatternResult {
  //   inputs: unknown[];
  //   pathname: {
  //     input: string;
  //     groups: Record<string, string>;
  //   };
  // }
}

// --- Router Types ---

export type RouteHandler = (match: MatchResult) => void | Promise<void>;

export interface MatchResult {
  url: string; // The full URL matched
  path: string; // The path part (e.g. /users/1)
  params: Record<string, string>; // Extracted params (e.g. { id: "1" })
  query: URLSearchParams;
  state?: any; // Navigation state from history API
}

interface Route {
  pathRaw: string;
  handler: RouteHandler;
  pattern: URLPattern | RegExp; // Can be native URLPattern or Regex fallback
}

export type NavigationMode = 'auto' | 'push' | 'replace';

// --- Main Class ---

export class Router {
  private routes: Route[] = [];
  private root: string;
  private notFoundHandler: RouteHandler | null = null;

  // Feature flags
  private readonly useNavigationApi: boolean;
  private readonly useUrlPattern: boolean;

  constructor(root: string = '/') {
    this.root = root;
    this.useNavigationApi = typeof window !== 'undefined' && 'navigation' in window;
    this.useUrlPattern = typeof window !== 'undefined' && 'URLPattern' in window;
    console.log(`Router ${this.useNavigationApi}, ${this.useUrlPattern}`);

    this.init();
  }

  /**
   * Register a route with a specific path.
   * @param path Pattern string (e.g. "/products/:id")
   * @param handler Callback function
   */
  public on(path: string, handler: RouteHandler): this;

  /**
   * Register a default/root catch-all handler.
   * @param handler Callback function
   */
  public on(handler: RouteHandler): this;

  public on(arg1: string | RouteHandler, arg2?: RouteHandler): this {
    let path: string;
    let handler: RouteHandler;

    if (typeof arg1 === 'function') {
      path = '*';
      handler = arg1;
    } else {
      path = arg1;
      handler = arg2!;
    }

    const pattern = this.createPattern(path);
    this.routes.push({ pathRaw: path, handler, pattern });

    return this;
  }

  /**
   * Set a handler for 404s.
   * Note: You can also use .on('*', handler) as a fallback.
   */
  public notFound(handler: RouteHandler): this {
    this.notFoundHandler = handler;
    return this;
  }

  /**
   * Resolves the current route on page load.
   */
  public resolve(): void {
    const currentUrl = window.location.href;
    console.log(`Router resolve: ${currentUrl}`);
    this.handleRoute(currentUrl);
  }

  /**
   * Programmatic navigation.
   */
  public navigate(path: string, options: { mode?: NavigationMode; state?: any } = {}): void {
    console.log(`Router navigate: ${path}`);
    const { mode = 'auto', state } = options;
    if (this.useNavigationApi && window.navigation) {
      window.navigation.navigate(path, { history: mode, state });
    } else {
      switch (mode) {
        case 'auto':
        case 'push':
          window.history.pushState(state || {}, '', path);
          break;
        case 'replace':
          window.history.replaceState(state || {}, '', path);
          break;
      }
      // Manually trigger route check for legacy mode
      this.handleRoute(window.location.href);
    }
  }

  // --- Internal Initialization ---

  private init(): void {
    if (this.useNavigationApi && window.navigation) {
      // STRATEGY A: Modern Navigation API
      window.navigation.addEventListener('navigate', (event) => {
        if (!event.canIntercept || event.hashChange || event.downloadRequest) return;

        event.intercept({
          handler: async () => {
            await this.handleRoute(event.destination.url);
          },
        });
      });
    } else {
      // STRATEGY B: Legacy History API + Click Delegation
      window.addEventListener('popstate', () => {
        this.handleRoute(window.location.href);
      });

      document.body.addEventListener('click', this.handleLinkClick.bind(this));
    }
  }

  private handleLinkClick(e: MouseEvent): void {
    const link = (e.target as HTMLElement).closest('a');

    if (
      !link ||
      link.getAttribute('target') === '_blank' ||
      link.origin !== window.location.origin ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }

    e.preventDefault();
    this.navigate(link.href);
  }

  // --- Matching Logic ---

  private async handleRoute(urlStr: string): Promise<void> {
    const url = new URL(urlStr);

    // Get navigation state (works for both popstate and Navigation API)
    let state: any;
    if (this.useNavigationApi && window.navigation) {
      const entry = window.navigation.currentEntry;
      state = entry?.getState();
    } else {
      state = window.history.state;
    }

    let matched = false;

    console.log(`Router handleRoute: ${urlStr}, path: ${url.pathname}`);

    // Important: Sort routes by specificity - more segments first
    // This ensures that /doc/edit matches before /:doc
    const sortedRoutes = [...this.routes].sort((a, b) => {
      const segmentsA = a.pathRaw.split('/').length;
      const segmentsB = b.pathRaw.split('/').length;
      return segmentsB - segmentsA; // More segments first
    });

    for (const route of sortedRoutes) {
      console.log(`Checking route: ${route.pathRaw}`);
      const matchResult = this.execMatch(route, url);

      if (matchResult) {
        console.log(`Matched route: ${route.pathRaw}`);
        matched = true;
        // Pass state to handlers
        await route.handler({ ...matchResult, state });
        break; // Stop after first match (Navigo behavior)
      }
    }

    // Handle 404
    if (!matched && this.notFoundHandler) {
      this.notFoundHandler({
        url: urlStr,
        path: url.pathname,
        params: {},
        query: url.searchParams,
        state,
      });
    }
  }

  private createPattern(path: string): URLPattern | RegExp {
    if (this.useUrlPattern) {
      // Native URLPattern
      // Important: baseURL allows relative path matching like "/about"
      return new URLPattern({ pathname: path, baseURL: window.location.origin });
    } else {
      // Fallback Regex generation
      if (path === '*') return /.*/;

      // Escape slashes and convert :param to named capture groups
      // Example: /users/:id -> ^/users/(?<id>[^/]+)$
      const normalized = path.replace(/\/$/, ''); // Remove trailing slash for consistency
      const regexString =
        '^' + normalized.replace(/\//g, '\\/').replace(/:([^/]+)/g, '(?<$1>[^/]+)') + '\\/?$'; // Allow optional trailing slash
      return new RegExp(regexString);
    }
  }

  private execMatch(route: Route, url: URL): MatchResult | null {
    if (this.useUrlPattern && route.pattern instanceof URLPattern) {
      // Native Match
      const result = route.pattern.exec(url.href);
      if (!result) return null;

      return {
        url: url.href,
        path: result.pathname.input,
        params: result.pathname.groups || {},
        query: url.searchParams,
      };
    } else if (route.pattern instanceof RegExp) {
      // Regex Match Fallback
      const result = route.pattern.exec(url.pathname);
      if (!result) return null;

      return {
        url: url.href,
        path: url.pathname,
        params: result.groups || {},
        query: url.searchParams,
      };
    }
    return null;
  }
}
