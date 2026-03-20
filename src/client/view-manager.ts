/**
 * ViewManager (DOM) - Pure Sync DOM Operations
 *
 * Responsibilities:
 * - Owns specific DOM subtree
 * - Two render modes:
 *   - renderFullState(): Updates everything including editor (for loading/reset)
 *   - renderUIState(): Updates UI except editor (during editing)
 * - Reads: getContentFromDOM()
 * - Event delegation: emits user actions to controller
 * - No business logic
 */

import type { Paste } from './paste';
import 'highlight.js/styles/base16/solarized-dark.css';

export interface ViewCallbacks {
  onSave: () => void;
  onNew: () => void;
  onDuplicate: () => void;
  onTwitter: () => void;
  onContentInput: (content: string) => void;
}

export interface RenderOptions {
  appName: string;
  enableTwitter: boolean;
}

export class ViewManager {
  private editor: HTMLDivElement;
  private gutter: HTMLDivElement;
  private appName: string;
  private callbacks?: ViewCallbacks;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly isMac: boolean =
    /Mac|iPhone|iPad|iPod/.test(navigator.platform) || navigator.userAgent.includes('Mac');
  private readonly ZOOM_KEY = 'editor-zoom';
  private readonly ZOOM_STEP = 0.1;
  private readonly ZOOM_MIN = 0.5;
  private readonly ZOOM_MAX = 3.0;
  private editorZoom: number = 1;

  constructor(options: RenderOptions) {
    this.appName = options.appName;
    this.editor = document.getElementById('editor') as HTMLDivElement;
    this.gutter = document.getElementById('gutter') as HTMLDivElement;

    // Hide twitter button if disabled
    if (!options.enableTwitter) {
      const twitterBtn = document.querySelector('#box2 .twitter') as HTMLElement;
      if (twitterBtn) {
        twitterBtn.style.display = 'none';
      }
    }
  }

  /**
   * Set event callbacks
   */
  setCallbacks(callbacks: ViewCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Initialize event listeners
   */
  init(): void {
    this.setupButtons();
    this.setupKeyboardShortcuts();
    this.setupEditorListeners();
    this.initZoom();
  }

  /**
   * Get current content from editor
   */
  getContentFromDOM(): string {
    return this.editor.innerText;
  }

  /**
   * Render full state including editor (for loading/reset)
   */
  renderFullState(state: Paste, mode: 'editing' | 'presenting', highlightedContent?: string): void {
    if (mode === 'presenting' && highlightedContent) {
      this.editor.contentEditable = 'false';
      this.editor.classList.add('hljs');
      this.editor.innerHTML = highlightedContent;
      this.editor.focus();
      const lineCount = (highlightedContent.match(/\n/g) ?? []).length + 1;
      this.updateGutter(lineCount, true);
    } else {
      this.editor.contentEditable = 'plaintext-only';
      this.editor.classList.remove('hljs');
      this.editor.textContent = state.content;
      this.editor.focus();
      const lineCount = state.content === '' ? 1 : (state.content.match(/\n/g) ?? []).length + 1;
      this.updateGutter(lineCount, false);
    }
    this.renderUIState(state, mode);
  }

  /**
   * Render metadata only (during editing - don't touch textarea)
   */
  renderUIState(state: Paste, mode: 'editing' | 'presenting'): void {
    this.updateButtons(state, mode);
    this.updateTitle(state);
  }

  /**
   * Show error toast message
   */
  showError(message: string): void {
    const toast = document.getElementById('toast')!;
    toast.textContent = message;
    toast.classList.add('visible');
    if (this.toastTimer !== null) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
      this.toastTimer = null;
    }, 4000);
  }

  /**
   * Show saving progress bar
   */
  showProgress(): void {
    const bar = document.getElementById('progress-bar')!;
    bar.classList.remove('done', 'clear');
    // bar.style.width = '0%';
    bar.getBoundingClientRect();
    bar.classList.add('running');
  }

  /**
   * Hide saving progress bar
   */
  hideProgress(): void {
    const bar = document.getElementById('progress-bar')!;
    bar.classList.remove('running');
    bar.classList.add('done');

    setTimeout(() => {
      bar.classList.remove('done');
      bar.classList.add('clear');
    }, 500);
  }

  /**
   * Update document title
   */
  private updateTitle(state: Paste): void {
    if (state.isLoaded) {
      document.title = `${this.appName} - ${state.key}`;
    } else {
      document.title = this.appName;
    }
  }

  /**
   * Update button states based on document state
   */
  private updateButtons(state: Paste, mode: 'editing' | 'presenting'): void {
    const functions = document.querySelectorAll('#box2 .function');
    functions.forEach((element) => {
      const el = element as HTMLElement;
      const isNew = el.classList.contains('new');
      const isSave = el.classList.contains('save');
      const isDuplicate = el.classList.contains('duplicate');
      const isTwitter = el.classList.contains('twitter');

      // New button: always enabled
      if (isNew) {
        el.classList.add('enabled');
      }
      // Save button: enabled when editing and content is not empty
      else if (isSave) {
        if (mode === 'editing' && state.content.trim() !== '') {
          el.classList.add('enabled');
        } else {
          el.classList.remove('enabled');
        }
      }
      // Duplicate and Twitter: enabled when presenting
      else if (isDuplicate || isTwitter) {
        if (mode === 'presenting') {
          el.classList.add('enabled');
        } else {
          el.classList.remove('enabled');
        }
      }
    });
  }

  /**
   * Setup button event listeners
   */
  private setupButtons(): void {
    const mod = 'ctrl';
    const buttons = [
      {
        selector: '.save',
        action: () => this.callbacks?.onSave(),
        label: 'Save',
        shortcut: `${mod} + s`,
      },
      {
        selector: '.new',
        action: () => this.callbacks?.onNew(),
        label: 'New',
        shortcut: `${mod} + n`,
      },
      {
        selector: '.duplicate',
        action: () => this.callbacks?.onDuplicate(),
        label: 'Duplicate & Edit',
        shortcut: `${mod} + d`,
      },
      {
        selector: '.twitter',
        action: () => this.callbacks?.onTwitter(),
        label: 'Twitter',
        shortcut: `${mod} + t`,
      },
    ];

    buttons.forEach(({ selector, action, label, shortcut }) => {
      const element = document.querySelector(`#box2 ${selector}`) as HTMLElement;
      if (!element) return;

      // Click handler
      element.addEventListener('click', (evt) => {
        evt.preventDefault();
        if (element.classList.contains('enabled')) {
          action();
        }
      });

      // Hover handlers for tooltip
      element.addEventListener('mouseenter', () => {
        const labelEl = document.querySelector('#box3 .label') as HTMLElement;
        const shortcutEl = document.querySelector('#box3 .shortcut') as HTMLElement;
        const box3 = document.getElementById('box3')!;
        const pointer = document.getElementById('pointer')!;

        labelEl.textContent = label;
        shortcutEl.textContent = shortcut;
        box3.style.display = 'block';
        element.appendChild(pointer);
        pointer.style.display = 'block';
      });

      element.addEventListener('mouseleave', () => {
        const box3 = document.getElementById('box3')!;
        const pointer = document.getElementById('pointer')!;
        box3.style.display = 'none';
        pointer.style.display = 'none';
      });
    });
  }

  /**
   * Setup keyboard shortcuts
   */
  private setupKeyboardShortcuts(): void {
    document.body.addEventListener('keydown', (evt) => {
      const ctrlHot = evt.ctrlKey;
      const fontHot = evt.altKey && (this.isMac ? evt.metaKey : evt.ctrlKey);

      if (ctrlHot) {
        switch (evt.key.toLowerCase()) {
          case 's':
          case 'l':
            evt.preventDefault();
            this.callbacks?.onSave();
            break;
          case 'n':
            evt.preventDefault();
            this.callbacks?.onNew();
            break;
          case 'd':
            evt.preventDefault();
            this.callbacks?.onDuplicate();
            break;
          case 't':
            evt.preventDefault();
            this.callbacks?.onTwitter();
            break;
        }
      }

      if (fontHot) {
        switch (evt.code) {
          case 'Equal':
            evt.preventDefault();
            this.editorZoom = parseFloat(
              Math.min(this.ZOOM_MAX, this.editorZoom + this.ZOOM_STEP).toFixed(2)
            );
            this.applyZoom();
            break;
          case 'Minus':
            evt.preventDefault();
            this.editorZoom = parseFloat(
              Math.max(this.ZOOM_MIN, this.editorZoom - this.ZOOM_STEP).toFixed(2)
            );
            this.applyZoom();
            break;
          case 'Digit0':
            evt.preventDefault();
            this.editorZoom = 1;
            this.applyZoom();
            break;
        }
      }
    });
  }

  private initZoom(): void {
    const stored = sessionStorage.getItem(this.ZOOM_KEY);
    if (stored !== null) {
      this.editorZoom = parseFloat(stored);
    }
    this.applyZoom();
  }

  private applyZoom(): void {
    const container = document.getElementById('editor-container')!;
    container.style.setProperty('--editor-zoom', String(this.editorZoom));
    sessionStorage.setItem(this.ZOOM_KEY, String(this.editorZoom));
  }

  private updateGutter(lineCount: number, presenting: boolean): void {
    const frag = document.createDocumentFragment();
    for (let i = 1; i <= lineCount; i++) {
      const el = document.createElement(presenting ? 'a' : 'span');
      if (presenting) {
        (el as HTMLAnchorElement).href = `#L${i}`;
        el.id = `L${i}`;
      }
      el.textContent = String(i);
      frag.appendChild(el);
    }
    this.gutter.textContent = '';
    this.gutter.appendChild(frag);
  }

  /**
   * Setup editor event listeners
   */
  private setupEditorListeners(): void {
    // Tab: insert 2 spaces (no selection) or indent all selected lines (with selection)
    this.editor.addEventListener('keydown', (evt) => {
      if (evt.key !== 'Tab') return;
      evt.preventDefault();

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      if (sel.isCollapsed) {
        document.execCommand('insertText', false, '  ');
        return;
      }

      // Indent each selected line by prepending 2 spaces
      const indented = sel
        .toString()
        .split('\n')
        .map((l) => '  ' + l)
        .join('\n');
      document.execCommand('insertText', false, indented);

      // Re-select the inserted text so subsequent Tab presses continue indenting.
      // execCommand collapses the cursor to end of inserted text; extend backwards
      // one character at a time to cover the full inserted length.
      const newSel = window.getSelection()!;
      for (let i = 0; i < indented.length; i++) {
        newSel.modify('extend', 'backward', 'character');
      }
    });

    // Input: notify controller of content changes
    this.editor.addEventListener('input', () => {
      if (this.callbacks?.onContentInput) {
        this.callbacks.onContentInput(this.editor.innerText);
      }
      const raw = this.editor.innerText;
      const trimmed = raw.endsWith('\n') ? raw.slice(0, -1) : raw;
      const lineCount = trimmed === '' ? 1 : (trimmed.match(/\n/g) ?? []).length + 1;
      this.updateGutter(lineCount, false);
    });
  }
}
