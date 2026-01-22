/**
 * TransitionManager - Sync Wrapper for View Transitions
 */

export class TransitionManager {
  private static readonly IS_SUPPORTED = 'startViewTransition' in document;

  /**
   * Run a view transition (fire-and-forget)
   * Callback is executed synchronously, but transition is async
   */
  run(callback: () => void | Promise<void>): void {
    if (TransitionManager.IS_SUPPORTED) {
      document.startViewTransition(callback);
    } else {
      callback();
    }
  }

  /**
   * Run a view transition and wait for it to complete
   * Useful when you need to know when the transition finishes
   */
  async runAsync(callback: () => void | Promise<void>): Promise<void> {
    if (TransitionManager.IS_SUPPORTED) {
      const transition = document.startViewTransition(callback);

      return transition.finished.catch(err => {
        console.error('View transition failed:', err);
      });
    } else {
      callback();
    }
  }
}
