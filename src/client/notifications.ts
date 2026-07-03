/**
 * Notifications - toast messages and the save progress bar.
 *
 * Extracted from ViewManager so transient UI feedback is independent
 * of editor/viewer rendering.
 */

export type ToastKind = 'info' | 'error';

const TOAST_DURATION_MS = 4000;

export class Notifications {
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  toast(message: string, kind: ToastKind = 'info'): void {
    const toast = document.getElementById('toast')!;
    toast.textContent = message;
    toast.classList.toggle('error', kind === 'error');
    toast.classList.add('visible');
    if (this.toastTimer !== null) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
      this.toastTimer = null;
    }, TOAST_DURATION_MS);
  }

  progressStart(): void {
    const bar = document.getElementById('progress-bar')!;
    bar.classList.remove('done', 'clear');
    bar.getBoundingClientRect();
    bar.classList.add('running');
  }

  progressDone(): void {
    const bar = document.getElementById('progress-bar')!;
    bar.classList.remove('running');
    bar.classList.add('done');

    setTimeout(() => {
      bar.classList.remove('done');
      bar.classList.add('clear');
    }, 500);
  }
}
