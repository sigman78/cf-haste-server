/**
 * @jest-environment jsdom
 */
import { Router } from './router';

describe('Router (Modern API Mode)', () => {
  let router: Router;
  let mockNavigate: jest.Mock;
  let mockAddEventListener: jest.Mock;
  let mockIntercept: jest.Mock;
  let mockURLPatternExec: jest.Mock;

  // Store original globals
  // Note: We don't need to store location because we won't overwrite it
  const originalNavigation = (window as any).navigation;
  const originalURLPattern = (window as any).URLPattern;

  beforeEach(() => {
    // 1. Mock Navigation API
    // window.navigation is usually undefined in JSDOM, so defineProperty works fine here.
    mockNavigate = jest.fn();
    mockAddEventListener = jest.fn();
    mockIntercept = jest.fn();

    Object.defineProperty(window, 'navigation', {
      writable: true,
      configurable: true,
      value: {
        navigate: mockNavigate,
        addEventListener: mockAddEventListener,
      },
    });

    // 2. Mock URLPattern
    mockURLPatternExec = jest.fn();
    Object.defineProperty(window, 'URLPattern', {
      writable: true,
      configurable: true,
      value: class MockURLPattern {
        constructor(public config: any) {}
        exec(input: string) {
          return mockURLPatternExec(input, this.config);
        }
      },
    });

    // 3. Reset Location using Native History API
    // Instead of deleting window.location, we just reset the path to root
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    // Restore mocks
    if (originalNavigation) {
      (window as any).navigation = originalNavigation;
    } else {
      delete (window as any).navigation;
    }

    if (originalURLPattern) {
      (window as any).URLPattern = originalURLPattern;
    } else {
      delete (window as any).URLPattern;
    }

    jest.clearAllMocks();
  });

  describe('Initialization & Navigation', () => {
    test('should attach a "navigate" event listener on construction', () => {
      new Router();
      expect(mockAddEventListener).toHaveBeenCalledWith('navigate', expect.any(Function));
    });

    test('navigate() should delegate directly to window.navigation.navigate', () => {
      router = new Router();
      router.navigate('/dashboard');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { history: 'auto' });
    });
  });

  describe('Route Matching (URLPattern)', () => {
    test('resolve() should use URLPattern to match current location', async () => {
      const handler = jest.fn();
      router = new Router();
      router.on('/profile', handler);

      // Setup the mock to return a success match
      mockURLPatternExec.mockReturnValue({
        pathname: { input: '/profile', groups: {} },
      });

      // USE HISTORY API TO SET TEST STATE
      // JSDOM defaults to origin: http://localhost
      window.history.pushState({}, '', '/profile');

      router.resolve();

      // Verify URLPattern was executed with the JSDOM URL
      expect(mockURLPatternExec).toHaveBeenCalledWith(
        'http://localhost/profile',
        expect.objectContaining({ baseURL: 'http://localhost' })
      );
      expect(handler).toHaveBeenCalled();
    });

    test('should extract parameters provided by URLPattern', async () => {
      const handler = jest.fn();
      router = new Router();
      router.on('/user/:id', handler);

      // Mock a successful match
      mockURLPatternExec.mockReturnValue({
        pathname: {
          input: '/user/123',
          groups: { id: '123' },
        },
      });

      // Set URL
      window.history.pushState({}, '', '/user/123');

      router.resolve();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { id: '123' },
          path: '/user/123',
        })
      );
    });
  });

  describe('Event Interception', () => {
    test('should intercept valid navigation events', async () => {
      const handler = jest.fn();
      router = new Router();
      router.on('/about', handler);

      const listener = mockAddEventListener.mock.calls.find((c) => c[0] === 'navigate')[1];

      // Prepare a Mock Event (Use http://localhost)
      const event = {
        canIntercept: true,
        hashChange: false,
        downloadRequest: false,
        destination: { url: 'http://localhost/about' },
        intercept: mockIntercept,
      };

      // Mock the matching logic
      mockURLPatternExec.mockImplementation((url) => {
        return url === 'http://localhost/about'
          ? { pathname: { input: '/about', groups: {} } }
          : null;
      });

      listener(event);

      expect(mockIntercept).toHaveBeenCalled();

      // Run the handler passed to intercept()
      const interceptCallback = mockIntercept.mock.calls[0][0].handler;
      await interceptCallback();

      expect(handler).toHaveBeenCalled();
    });

    test('should ignore non-interceptable events', () => {
      new Router();
      const listener = mockAddEventListener.mock.calls.find((c) => c[0] === 'navigate')[1];

      const event = {
        canIntercept: false,
        destination: { url: 'http://localhost/foo' },
        intercept: mockIntercept,
      };

      listener(event);
      expect(mockIntercept).not.toHaveBeenCalled();
    });
  });
});
