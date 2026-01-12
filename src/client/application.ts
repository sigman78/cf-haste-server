import type { GetResponse, SaveResponse } from '../shared/types';
import hljs from 'highlight.js';

// Extension to language mapping
const extensionMap: Record<string, string> = {
  rb: 'ruby',
  py: 'python',
  pl: 'perl',
  php: 'php',
  scala: 'scala',
  go: 'go',
  xml: 'xml',
  html: 'xml',
  htm: 'xml',
  css: 'css',
  js: 'javascript',
  vbs: 'vbscript',
  lua: 'lua',
  pas: 'delphi',
  java: 'java',
  cpp: 'cpp',
  cc: 'cpp',
  m: 'objectivec',
  vala: 'vala',
  cs: 'cs',
  sql: 'sql',
  sm: 'smalltalk',
  lisp: 'lisp',
  ini: 'ini',
  diff: 'diff',
  bash: 'bash',
  sh: 'bash',
  tex: 'tex',
  erl: 'erlang',
  hs: 'haskell',
  md: 'markdown',
  txt: '',
};

interface ButtonConfig {
  element: HTMLElement;
  label: string;
  shortcutDescription?: string;
  shortcut?: (evt: KeyboardEvent) => boolean;
  action: () => void;
}

class HasteDocument {
  locked = false;
  key?: string;
  data?: string;

  async load(
    key: string,
    lang?: string
  ): Promise<{ value: string; key: string; language?: string } | null> {
    try {
      const response = await fetch(`/documents/${key}`);

      if (!response.ok) {
        return null;
      }

      const res: GetResponse = await response.json();

      this.locked = true;
      this.key = key;
      this.data = res.content;

      let high: { value: string; language?: string };

      try {
        if (lang === 'txt') {
          high = { value: res.content };
        } else if (lang) {
          high = hljs.highlight(res.content, { language: lang });
        } else {
          high = hljs.highlightAuto(res.content);
        }
      } catch (err) {
        // Failed highlight, fall back on auto
        high = hljs.highlightAuto(res.content);
      }

      return {
        value: high.value,
        key: key,
        language: high.language || lang,
      };
    } catch (error) {
      console.error('Error loading document:', error);
      return null;
    }
  }

  async save(data: string): Promise<{ value: string; key: string; language?: string } | null> {
    if (this.locked) {
      return null;
    }

    this.data = data;

    try {
      const response = await fetch('/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: data,
      });

      if (!response.ok) {
        return null;
      }

      const res: SaveResponse = await response.json();

      this.locked = true;
      this.key = res.key;

      const high = hljs.highlightAuto(data);

      return {
        value: high.value,
        key: res.key,
        language: high.language,
      };
    } catch (error) {
      console.error('Error saving document:', error);
      return null;
    }
  }
}

class Haste {
  appName: string;
  baseUrl: string;
  textarea: HTMLTextAreaElement;
  box: HTMLElement;
  code: HTMLElement;
  options: { twitter: boolean };
  doc: HasteDocument;
  buttons: ButtonConfig[] = [];

  constructor(appName: string, options: { twitter: boolean }) {
    this.appName = appName;
    this.baseUrl = window.location.href;
    this.textarea = document.querySelector('textarea')!;
    this.box = document.getElementById('box')!;
    this.code = document.querySelector('#box code')!;
    this.options = options;
    this.doc = new HasteDocument();

    this.configureShortcuts();
    this.configureButtons();

    // If twitter is disabled, hide the button
    if (!options.twitter) {
      const twitterBtn = document.querySelector('#box2 .twitter') as HTMLElement;
      if (twitterBtn) {
        twitterBtn.style.display = 'none';
      }
    }
  }

  setTitle(ext?: string): void {
    const title = ext ? `${this.appName} - ${ext}` : this.appName;
    document.title = title;
  }

  lightKey(): void {
    this.configureKey(['new', 'save']);
  }

  fullKey(): void {
    this.configureKey(['new', 'duplicate', 'twitter']);
  }

  configureKey(enable: string[]): void {
    const functions = document.querySelectorAll('#box2 .function');
    functions.forEach((element) => {
      const el = element as HTMLElement;
      const hasEnabledClass = enable.some((cls) => el.classList.contains(cls));

      if (hasEnabledClass) {
        el.classList.add('enabled');
      } else {
        el.classList.remove('enabled');
      }
    });
  }

  newDocument(hideHistory = false): void {
    this.box.style.display = 'none';
    this.doc = new HasteDocument();

    if (!hideHistory) {
      window.history.pushState(null, this.appName, '/');
    }

    this.setTitle();
    this.lightKey();
    this.textarea.value = '';
    this.textarea.style.display = 'block';
    this.textarea.focus();
  }

  lookupExtensionByType(type: string): string {
    for (const [key, value] of Object.entries(extensionMap)) {
      if (value === type) return key;
    }
    return type;
  }

  lookupTypeByExtension(ext?: string): string | undefined {
    if (!ext) return undefined;
    return extensionMap[ext] || ext;
  }

  async loadDocument(key: string): Promise<void> {
    const parts = key.split('.', 2);
    this.doc = new HasteDocument();

    const ret = await this.doc.load(parts[0], this.lookupTypeByExtension(parts[1]));

    if (ret) {
      this.code.innerHTML = ret.value;
      this.setTitle(ret.key);

      let file = '/' + ret.key;
      if (ret.language) {
        file += '.' + this.lookupExtensionByType(ret.language);
      }

      if (window.location.pathname !== file) {
        window.history.pushState(null, `${this.appName}-${ret.key}`, file);
      }

      this.fullKey();
      this.textarea.value = '';
      this.textarea.style.display = 'none';
      this.box.style.display = 'block';
      this.box.focus();
    } else {
      this.newDocument();
    }
  }

  duplicateDocument(): void {
    if (this.doc.locked && this.doc.data) {
      const currentData = this.doc.data;
      this.newDocument();
      this.textarea.value = currentData;
    }
  }

  async lockDocument(): Promise<void> {
    const ret = await this.doc.save(this.textarea.value);

    if (ret) {
      this.code.innerHTML = ret.value;
      this.setTitle(ret.key);

      let file = '/' + ret.key;
      if (ret.language) {
        file += '.' + this.lookupExtensionByType(ret.language);
      }

      window.history.pushState(null, `${this.appName}-${ret.key}`, file);

      this.fullKey();
      this.textarea.value = '';
      this.textarea.style.display = 'none';
      this.box.style.display = 'block';
      this.box.focus();
    }
  }

  configureButtons(): void {
    this.buttons = [
      {
        element: document.querySelector('#box2 .save')!,
        label: 'Save',
        shortcutDescription: 'control + s',
        shortcut: (evt) => evt.ctrlKey && (evt.keyCode === 76 || evt.keyCode === 83),
        action: () => {
          if (this.textarea.value.trim() !== '') {
            this.lockDocument();
          }
        },
      },
      {
        element: document.querySelector('#box2 .new')!,
        label: 'New',
        shortcut: (evt) => evt.ctrlKey && evt.keyCode === 78,
        shortcutDescription: 'control + n',
        action: () => {
          this.newDocument(!this.doc.key);
        },
      },
      {
        element: document.querySelector('#box2 .duplicate')!,
        label: 'Duplicate & Edit',
        shortcut: (evt) => this.doc.locked && evt.ctrlKey && evt.keyCode === 68,
        shortcutDescription: 'control + d',
        action: () => {
          this.duplicateDocument();
        },
      },
      {
        element: document.querySelector('#box2 .twitter')!,
        label: 'Twitter',
        shortcut: (evt) => this.options.twitter && this.doc.locked && evt.ctrlKey && evt.keyCode === 84,
        shortcutDescription: 'control + t',
        action: () => {
          window.open('https://twitter.com/share?url=' + encodeURI(window.location.href));
        },
      },
    ];

    this.buttons.forEach((button) => this.configureButton(button));
  }

  configureButton(config: ButtonConfig): void {
    // Handle click action
    config.element.addEventListener('click', (evt) => {
      evt.preventDefault();
      if (config.element.classList.contains('enabled')) {
        config.action();
      }
    });

    // Show label
    config.element.addEventListener('mouseenter', () => {
      const labelEl = document.querySelector('#box3 .label') as HTMLElement;
      const shortcutEl = document.querySelector('#box3 .shortcut') as HTMLElement;
      const box3 = document.getElementById('box3')!;
      const pointer = document.getElementById('pointer')!;

      labelEl.textContent = config.label;
      shortcutEl.textContent = config.shortcutDescription || '';
      box3.style.display = 'block';
      config.element.appendChild(pointer);
      pointer.style.display = 'block';
    });

    // Hide label
    config.element.addEventListener('mouseleave', () => {
      const box3 = document.getElementById('box3')!;
      const pointer = document.getElementById('pointer')!;
      box3.style.display = 'none';
      pointer.style.display = 'none';
    });
  }

  configureShortcuts(): void {
    document.body.addEventListener('keydown', (evt) => {
      for (const button of this.buttons) {
        if (button.shortcut && button.shortcut(evt)) {
          evt.preventDefault();
          button.action();
          return;
        }
      }
    });

    // Tab behavior - 2 spaces per tab
    this.textarea.addEventListener('keydown', (evt) => {
      if (evt.keyCode === 9) {
        evt.preventDefault();
        const myValue = '  ';
        const startPos = this.textarea.selectionStart;
        const endPos = this.textarea.selectionEnd;
        const scrollTop = this.textarea.scrollTop;

        this.textarea.value =
          this.textarea.value.substring(0, startPos) +
          myValue +
          this.textarea.value.substring(endPos);

        this.textarea.selectionStart = startPos + myValue.length;
        this.textarea.selectionEnd = startPos + myValue.length;
        this.textarea.scrollTop = scrollTop;
      }
    });
  }
}

// Initialize app
let app: Haste | null = null;

const handlePop = (evt: PopStateEvent | { target: Window }): void => {
  const path = (evt.target as Window).location.pathname;
  if (path === '/') {
    app?.newDocument(true);
  } else {
    app?.loadDocument(path.substring(1));
  }
};

// Set up pop state handling
setTimeout(() => {
  window.onpopstate = (evt) => {
    try {
      handlePop(evt);
    } catch (err) {
      // Not loaded yet
    }
  };
}, 1000);

// Construct app and load initial path
document.addEventListener('DOMContentLoaded', () => {
  app = new Haste('hastebin', { twitter: true });
  handlePop({ target: window });
});
