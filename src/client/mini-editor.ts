export interface MiniEditorCallbacks {
  onContentChange: (content: string, lineCount: number) => void;
}

interface UndoState {
  content: string;
  cursorOffset: number;
}

export class MiniEditor {
  private editor: HTMLDivElement;
  private callbacks?: MiniEditorCallbacks;
  private undoStack: UndoState[] = [];
  private redoStack: UndoState[] = [];
  private readonly MAX_UNDO = 25;

  constructor(element: HTMLDivElement) {
    this.editor = element;
  }

  setCallbacks(callbacks: MiniEditorCallbacks): void {
    this.callbacks = callbacks;
  }

  init(): void {
    this.setupKeyboardHandlers();
    this.setupInputHandlers();
  }

  getContent(): string {
    return this.editor.innerText;
  }

  setContent(content: string): void {
    this.editor.textContent = content;
    this.undoStack = [];
    this.redoStack = [];
  }

  setEditable(editable: boolean): void {
    this.editor.contentEditable = editable ? 'plaintext-only' : 'false';
  }

  focus(): void {
    this.editor.focus();
  }

  getCursorOffset(): number {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return 0;

    const range = sel.getRangeAt(0);
    if (!this.editor.contains(range.startContainer)) return 0;

    const preRange = document.createRange();
    preRange.setStart(this.editor, 0);
    preRange.setEnd(range.startContainer, range.startOffset);
    return preRange.toString().length;
  }

  setCursorOffset(offset: number): void {
    const text = this.editor.textContent || '';
    offset = Math.min(offset, text.length);

    const walker = document.createTreeWalker(this.editor, NodeFilter.SHOW_TEXT);
    let current = 0;
    let node: Text | null;

    while ((node = walker.nextNode() as Text)) {
      const len = node.length;
      if (current + len >= offset) {
        const range = document.createRange();
        range.setStart(node, offset - current);
        range.collapse(true);
        const sel = window.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      current += len;
    }

    // Fallback: cursor at end
    const range = document.createRange();
    range.selectNodeContents(this.editor);
    range.collapse(false);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
  }

  undo(): void {
    if (this.undoStack.length === 0) return;

    this.redoStack.push({
      content: this.editor.textContent || '',
      cursorOffset: this.getCursorOffset(),
    });

    const state = this.undoStack.pop()!;
    this.editor.textContent = state.content;
    this.setCursorOffset(state.cursorOffset);
    this.notifyContentChange();
  }

  redo(): void {
    if (this.redoStack.length === 0) return;

    this.undoStack.push({
      content: this.editor.textContent || '',
      cursorOffset: this.getCursorOffset(),
    });

    const state = this.redoStack.pop()!;
    this.editor.textContent = state.content;
    this.setCursorOffset(state.cursorOffset);
    this.notifyContentChange();
  }

  private saveUndoState(): void {
    const state: UndoState = {
      content: this.editor.textContent || '',
      cursorOffset: this.getCursorOffset(),
    };

    this.undoStack.push(state);
    if (this.undoStack.length > this.MAX_UNDO) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  private insertText(text: string, selectAfter = false): void {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    this.saveUndoState();

    const range = sel.getRangeAt(0);
    range.deleteContents();

    const textNode = document.createTextNode(text);
    range.insertNode(textNode);

    if (selectAfter) {
      // Select the inserted text
      range.selectNode(textNode);
    } else {
      // Collapse cursor to end
      range.setStartAfter(textNode);
      range.collapse(true);
    }
    sel.removeAllRanges();
    sel.addRange(range);

    this.notifyContentChange();
  }

  private notifyContentChange(): void {
    const raw = this.editor.innerText;
    const trimmed = raw.endsWith('\n') ? raw.slice(0, -1) : raw;
    const lineCount = trimmed === '' ? 1 : (trimmed.match(/\n/g) ?? []).length + 1;
    this.callbacks?.onContentChange(raw, lineCount);
  }

  private setupKeyboardHandlers(): void {
    this.editor.addEventListener('keydown', (evt) => {
      // Tab: insert 2 spaces or indent selection
      if (evt.key === 'Tab') {
        evt.preventDefault();
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;

        if (sel.isCollapsed) {
          this.insertText('  ');
        } else {
          const indented = sel
            .toString()
            .split('\n')
            .map((l) => '  ' + l)
            .join('\n');
          this.insertText(indented, true); // Keep selection for repeated indent
        }
        return;
      }

      // Enter: insert plain newline
      if (evt.key === 'Enter') {
        evt.preventDefault();
        this.insertText('\n');
        return;
      }

      // Ctrl+Z: Undo, Ctrl+Shift+Z or Ctrl+Y: Redo
      if (evt.ctrlKey || evt.metaKey) {
        if (evt.key === 'z' || evt.key === 'Z') {
          evt.preventDefault();
          if (evt.shiftKey) {
            this.redo();
          } else {
            this.undo();
          }
          return;
        }
        if (evt.key === 'y' || evt.key === 'Y') {
          evt.preventDefault();
          this.redo();
          return;
        }
      }
    });
  }

  private setupInputHandlers(): void {
    // Save undo state before browser's native input
    this.editor.addEventListener('beforeinput', (evt) => {
      if (evt.inputType.startsWith('insert') || evt.inputType.startsWith('delete')) {
        this.saveUndoState();
      }
    });

    // Notify on any input
    this.editor.addEventListener('input', () => {
      this.notifyContentChange();
    });
  }
}
