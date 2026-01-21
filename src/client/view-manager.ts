/**
 * ViewManager (DOM) - Pure Sync DOM Operations
 *
 * Responsibilities:
 * - Owns specific DOM subtree
 * - Two render modes:
 *   - renderFullState(): Updates everything including textarea (for loading/reset)
 *   - renderMetadata(): Updates UI except textarea (during editing)
 * - Reads: getContentFromDOM()
 * - Event delegation: emits user actions to controller
 * - No business logic
 */

import type { DocumentState } from './document';
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
  private textarea: HTMLTextAreaElement;
  private box: HTMLElement;
  private code: HTMLElement;
  private appName: string;
  private callbacks?: ViewCallbacks;

  constructor(options: RenderOptions) {
    this.appName = options.appName;
    this.textarea = document.querySelector('textarea')!;
    this.box = document.getElementById('box')!;
    this.code = document.querySelector('#box code')!;

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
    this.setupTextareaListeners();
  }

  /**
   * Get current content from textarea
   */
  getContentFromDOM(): string {
    return this.textarea.value;
  }

  /**
   * Render full state including textarea (for loading/reset)
   */
  renderFullState(state: DocumentState, mode: 'editing' | 'presenting', highlightedContent?: string): void {
    if (mode === 'presenting' && highlightedContent) {
      // Presenting view - show highlighted code
      this.code.innerHTML = highlightedContent;
      this.textarea.value = '';
      this.textarea.style.display = 'none';
      this.box.style.display = 'block';
      this.box.focus();
      this.updateButtons(state, mode);
      this.updateTitle(state);
    } else {
      // Editing view - show textarea
      this.textarea.value = state.content;
      this.textarea.style.display = 'block';
      this.box.style.display = 'none';
      this.textarea.focus();
      this.updateButtons(state, mode);
      this.updateTitle(state);
    }
  }

  /**
   * Render metadata only (during editing - don't touch textarea)
   */
  renderMetadata(state: DocumentState, mode: 'editing' | 'presenting', highlightedContent?: string): void {
    if (mode === 'presenting' && highlightedContent) {
      // Update code view if presenting
      this.code.innerHTML = highlightedContent;
    }
    this.updateButtons(state, mode);
    this.updateTitle(state);
  }

  /**
   * Update document title
   */
  private updateTitle(state: DocumentState): void {
    if (state.key) {
      document.title = `${this.appName} - ${state.key}`;
    } else {
      document.title = this.appName;
    }
  }

  /**
   * Update button states based on document state
   */
  private updateButtons(state: DocumentState, mode: 'editing' | 'presenting'): void {
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
    const buttons = [
      { selector: '.save', action: () => this.callbacks?.onSave(), label: 'Save', shortcut: 'control + s' },
      { selector: '.new', action: () => this.callbacks?.onNew(), label: 'New', shortcut: 'control + n' },
      {
        selector: '.duplicate',
        action: () => this.callbacks?.onDuplicate(),
        label: 'Duplicate & Edit',
        shortcut: 'control + d',
      },
      { selector: '.twitter', action: () => this.callbacks?.onTwitter(), label: 'Twitter', shortcut: 'control + t' },
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
      // Ctrl+S or Ctrl+L: Save
      if (evt.ctrlKey && (evt.keyCode === 76 || evt.keyCode === 83)) {
        evt.preventDefault();
        this.callbacks?.onSave();
      }
      // Ctrl+N: New
      else if (evt.ctrlKey && evt.keyCode === 78) {
        evt.preventDefault();
        this.callbacks?.onNew();
      }
      // Ctrl+D: Duplicate
      else if (evt.ctrlKey && evt.keyCode === 68) {
        evt.preventDefault();
        this.callbacks?.onDuplicate();
      }
      // Ctrl+T: Twitter
      else if (evt.ctrlKey && evt.keyCode === 84) {
        evt.preventDefault();
        this.callbacks?.onTwitter();
      }
    });
  }

  /**
   * Setup textarea event listeners
   */
  private setupTextareaListeners(): void {
    // Tab key: insert 2 spaces
    this.textarea.addEventListener('keydown', (evt) => {
      if (evt.keyCode === 9) {
        evt.preventDefault();
        const myValue = '  ';
        const startPos = this.textarea.selectionStart;
        const endPos = this.textarea.selectionEnd;
        const scrollTop = this.textarea.scrollTop;

        this.textarea.value =
          this.textarea.value.substring(0, startPos) + myValue + this.textarea.value.substring(endPos);

        this.textarea.selectionStart = startPos + myValue.length;
        this.textarea.selectionEnd = startPos + myValue.length;
        this.textarea.scrollTop = scrollTop;
      }
    });

    // Input event: notify controller of content changes
    this.textarea.addEventListener('input', () => {
      if (this.callbacks?.onContentInput) {
        this.callbacks.onContentInput(this.textarea.value);
      }
    });
  }
}
