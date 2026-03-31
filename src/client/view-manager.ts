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
import './solarized-dark-hljs.css';

export interface ViewCallbacks {
  onSave: () => void;
  onNew: () => void;
  onDuplicate: () => void;
  onTwitter: () => void;
  onContentInput: (content: string) => void;
  onFileDrop: (content: string) => void;
}

export interface RenderOptions {
  appName: string;
  enableTwitter: boolean;
  lineNumbers: boolean;
  highlightCurrentLine: boolean;
}

export class ViewManager {
  private editor: HTMLTextAreaElement;
  private viewer: HTMLPreElement;
  private viewerCode: HTMLElement;
  private gutter: HTMLDivElement;
  private appName: string;
  private lineNumbers: boolean;
  private callbacks?: ViewCallbacks;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly isMac: boolean =
    /Mac|iPhone|iPad|iPod/.test(navigator.platform) || navigator.userAgent.includes('Mac');
  private readonly ZOOM_KEY = 'editor-zoom';
  private readonly ZOOM_STEP = 0.1;
  private readonly ZOOM_MIN = 0.5;
  private readonly ZOOM_MAX = 3.0;
  private editorZoom: number = 1;
  private lineHighlight: HTMLDivElement | null = null;
  private highlightCurrentLine: boolean;
  private currentLine: number = 0;
  private dragCounter: number = 0;

  constructor(options: RenderOptions) {
    this.appName = options.appName;
    this.editor = document.getElementById('editor') as HTMLTextAreaElement;
    this.viewer = document.getElementById('viewer') as HTMLPreElement;
    this.viewerCode = this.viewer.querySelector('code') as HTMLElement;
    this.gutter = document.getElementById('gutter') as HTMLDivElement;

    // Hide twitter button if disabled
    if (!options.enableTwitter) {
      const twitterBtn = document.querySelector('#box2 .twitter') as HTMLElement;
      if (twitterBtn) {
        twitterBtn.style.display = 'none';
      }
    }

    this.lineNumbers = options.lineNumbers;
    if (!this.lineNumbers) {
      this.gutter.style.display = 'none';
    }

    this.highlightCurrentLine = options.highlightCurrentLine;
    if (this.highlightCurrentLine) {
      this.lineHighlight = document.getElementById('line-highlight') as HTMLDivElement;
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
    this.setupEditorHandlers();
    this.setupLineHighlightListeners();
    this.initZoom();
    this.setupDragDropHandlers();
  }

  /**
   * Setup textarea event handlers (Tab key and input notifications)
   */
  private setupEditorHandlers(): void {
    // Tab key handling for indentation
    this.editor.addEventListener('keydown', (evt) => {
      if (evt.key === 'Tab') {
        evt.preventDefault();
        const start = this.editor.selectionStart;
        const end = this.editor.selectionEnd;
        const value = this.editor.value;

        if (start === end) {
          // No selection: insert 2 spaces
          const scrollTop = this.editor.scrollTop;
          this.editor.value = value.substring(0, start) + '  ' + value.substring(end);
          this.editor.selectionStart = this.editor.selectionEnd = start + 2;
          this.editor.scrollTop = scrollTop;
        } else {
          // Selection: indent all selected lines
          const selected = value.substring(start, end);
          const indented = selected
            .split('\n')
            .map((l) => '  ' + l)
            .join('\n');
          this.editor.value = value.substring(0, start) + indented + value.substring(end);
          this.editor.selectionStart = start;
          this.editor.selectionEnd = start + indented.length;
        }
        this.notifyContentChange();
      }
    });

    // Notify on any input
    this.editor.addEventListener('input', () => {
      this.notifyContentChange();
    });
  }

  private notifyContentChange(): void {
    const content = this.editor.value;
    const lineCount = content === '' ? 1 : (content.match(/\n/g) ?? []).length + 1;
    this.callbacks?.onContentInput?.(content);
    this.updateGutter(lineCount, false);
    this.updateLineHighlight();
  }

  /**
   * Get current content from editor
   */
  getContentFromDOM(): string {
    return this.editor.value;
  }

  /**
   * Render full state including editor (for loading/reset)
   */
  renderFullState(state: Paste, mode: 'editing' | 'presenting', highlightedContent?: string): void {
    this.editor.classList.remove('is-loading');
    this.viewer.classList.remove('is-loading');

    if (mode === 'presenting' && highlightedContent) {
      // Present mode: show viewer, hide editor
      this.editor.value = '';
      this.editor.style.display = 'none';
      this.viewer.style.display = 'block';
      this.viewerCode.innerHTML = highlightedContent;
      const lineCount = (highlightedContent.match(/\n/g) ?? []).length + 1;
      this.updateGutter(lineCount, true);
      // this.resetLineHighlight();
      this.highlightAnchorLine();
    } else {
      // Edit mode: show editor, hide viewer
      this.editor.style.display = 'block';
      this.viewer.style.display = 'none';
      this.editor.value = state.content;
      this.editor.focus();
      const lineCount = state.content === '' ? 1 : (state.content.match(/\n/g) ?? []).length + 1;
      this.updateGutter(lineCount, false);
      this.updateLineHighlight();
    }
    this.renderUIState(state, mode);
  }

  renderLoadingState(): void {
    this.editor.style.display = 'none';
    this.viewer.style.display = 'block';
    this.viewer.classList.add('is-loading');
    this.viewerCode.textContent = '';
    this.gutter.textContent = '';
    this.resetLineHighlight();
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
    const presenting = mode === 'presenting';
    const editing = mode === 'editing';

    const updateBtn = (el: Element | null, isEnabled: boolean) =>
      el?.classList.toggle('enabled', isEnabled);

    updateBtn(document.querySelector('#box2 .new'), true);
    updateBtn(document.querySelector('#box2 .save'), editing && state.content.trim() !== '');
    updateBtn(document.querySelector('#box2 .duplicate'), presenting && !state.frozen);
    updateBtn(document.querySelector('#box2 .twitter'), presenting);
  }

  /**
   * Setup button event listeners
   */
  private setupButtons(): void {
    const box3 = document.getElementById('box3')!;
    const pointer = document.getElementById('pointer')!;
    const labelEl = document.querySelector('#box3 .label') as HTMLElement;
    const shortcutEl = document.querySelector('#box3 .shortcut') as HTMLElement;

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
        labelEl.textContent = label;
        shortcutEl.textContent = shortcut;
        box3.style.display = 'block';
        element.appendChild(pointer);
        pointer.style.display = 'block';
      });

      element.addEventListener('mouseleave', () => {
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
            this.adjustZoom(+this.ZOOM_STEP);
            break;
          case 'Minus':
            evt.preventDefault();
            this.adjustZoom(-this.ZOOM_STEP);
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
    this.updateLineHighlight();
  }

  private adjustZoom(delta: number): void {
    this.editorZoom = parseFloat(
      Math.min(this.ZOOM_MAX, Math.max(this.ZOOM_MIN, this.editorZoom + delta)).toFixed(2)
    );
    this.applyZoom();
  }

  private updateGutter(lineCount: number, presenting: boolean): void {
    if (!this.lineNumbers) return;

    if (!presenting) {
      // Edit mode: clear gutter content but keep element visible for layout
      this.gutter.textContent = '';
      return;
    }

    // Present mode: populate with clickable line numbers
    const frag = document.createDocumentFragment();
    for (let i = 1; i <= lineCount; i++) {
      const el = document.createElement('a');
      el.href = `#L${i}`;
      el.id = `L${i}`;
      el.textContent = String(i);
      frag.appendChild(el);
    }
    this.gutter.textContent = '';
    this.gutter.appendChild(frag);
  }

  private getCurrentLineNumber(): number {
    const pos = this.editor.selectionStart;
    const textBefore = this.editor.value.substring(0, pos);
    return (textBefore.match(/\n/g) ?? []).length + 1;
  }

  private updateLineHighlight(): void {
    if (!this.highlightCurrentLine || !this.lineHighlight) return;

    const isEditing = this.editor.style.display !== 'none';
    const hasFocus = document.activeElement === this.editor;
    const hasSelection = this.editor.selectionStart !== this.editor.selectionEnd;

    if (!isEditing || !hasFocus || hasSelection) {
      this.lineHighlight.classList.remove('visible');
      this.currentLine = 0;
      return;
    }

    const lineNumber = this.getCurrentLineNumber();
    if (lineNumber === this.currentLine) return;

    this.currentLine = lineNumber;

    // Use CSS custom property for line position (CSS calculates: --line-index * 1lh)
    this.lineHighlight.style.setProperty('--line-index', String(lineNumber - 1));
    this.lineHighlight.classList.add('visible');
  }

  private resetLineHighlight(): void {
    if (!this.highlightCurrentLine || !this.lineHighlight) return;
    this.lineHighlight.classList.remove('visible');
    this.currentLine = 0;
  }

  private highlightAnchorLine(): void {
    if (!this.highlightCurrentLine || !this.lineHighlight) return;
    const match = window.location.hash.match(/^#L(\d+)$/);
    if (!match) {
      this.resetLineHighlight();
      return;
    }
    const lineNumber = parseInt(match[1], 10);
    this.lineHighlight.style.setProperty('--line-index', String(lineNumber - 1));
    this.lineHighlight.classList.add('visible');
    this.currentLine = lineNumber;
  }

  private setupDragDropHandlers(): void {
    const overlay = document.getElementById('drop-overlay')!;

    document.addEventListener('dragenter', (evt) => {
      evt.preventDefault();
      this.dragCounter++;
      if (this.dragCounter === 1) overlay.classList.add('visible');
    });

    document.addEventListener('dragover', (evt) => {
      evt.preventDefault();
      evt.dataTransfer!.dropEffect = 'copy';
    });

    document.addEventListener('dragleave', () => {
      this.dragCounter--;
      if (this.dragCounter === 0) overlay.classList.remove('visible');
    });

    document.addEventListener('drop', (evt) => {
      evt.preventDefault();
      this.dragCounter = 0;
      overlay.classList.remove('visible');

      const file = evt.dataTransfer?.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        if (content !== '') this.callbacks?.onFileDrop(content);
      };
      reader.readAsText(file);
    });
  }

  /**
   * Setup line highlight event listeners
   */
  private setupLineHighlightListeners(): void {
    if (!this.highlightCurrentLine) return;

    document.addEventListener('selectionchange', () => {
      this.updateLineHighlight();
    });

    this.editor.addEventListener('focus', () => {
      this.updateLineHighlight();
    });

    this.editor.addEventListener('blur', () => {
      this.resetLineHighlight();
    });

    window.addEventListener('hashchange', () => {
      const isPresenting = this.viewer.style.display !== 'none';
      if (isPresenting) {
        this.highlightAnchorLine();
      }
    });
  }
}
