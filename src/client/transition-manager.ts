/**
 * TransitionManager - Sync Wrapper for View Transitions
 *
 * Responsibilities:
 * - Wraps document.startViewTransition
 * - Sync API, handles async callbacks internally
 * - Provides fallback for unsupported browsers
 * - Two methods: run() (fire-and-forget) and runAsync() (awaitable)
 */

export class TransitionManager {
  private isSupported: boolean;

  constructor() {
    this.isSupported = typeof document.startViewTransition === 'function';
  }

  /**
   * Run a view transition (fire-and-forget)
   * Callback is executed synchronously, but transition is async
   */
  run(callback: () => void): void {
    if (this.isSupported && document.startViewTransition) {
      document.startViewTransition(() => {
        callback();
      });
    } else {
      // Fallback: just execute the callback
      callback();
    }
  }

  /**
   * Run a view transition and wait for it to complete
   * Useful when you need to know when the transition finishes
   */
  async runAsync(callback: () => void): Promise<void> {
    if (this.isSupported && document.startViewTransition) {
      const transition = document.startViewTransition(() => {
        callback();
      });
      try {
        await transition.finished;
      } catch (err) {
        // Transition was skipped or aborted, ignore
        console.debug('View transition skipped:', err);
      }
    } else {
      // Fallback: just execute the callback
      callback();
    }
  }

  /**
   * Check if view transitions are supported
   */
  isViewTransitionsSupported(): boolean {
    return this.isSupported;
  }
}
