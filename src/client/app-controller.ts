/**
 * AppController - Orchestrator
 *
 * Responsibilities:
 * - Owns document lifecycle state machine: loading | editing | presenting | saving
 * - Coordinates all modules
 * - Public API is synchronous
 * - Manages async operations internally with consistent error handling
 */

import { Paste } from './paste';
import { StorageService } from './storage';
import { ViewManager } from './view-manager';
import { TransitionManager } from './transition-manager';
import { HistoryManager } from './history-manager';
import {
  highlightContent,
  getExtensionForLanguage,
  getLanguageForExtension,
} from './highlight-config';
import appConfig from './config';
import { parsePath, buildPath } from './path-utils';

type DocumentLifecycleState = 'loading' | 'editing' | 'presenting' | 'saving';
type HistoryState = { content?: string; scrollY?: number };

export interface AppConfig {
  appName: string;
  enableTwitter: boolean;
  scrollToTopOnSave?: boolean; // default true
  lineNumbers?: boolean; // default true
  highlightCurrentLine?: boolean; // default true
}

export class AppController {
  // Module dependencies
  private document: Paste;
  private storage: StorageService;
  private view: ViewManager;
  private transitions: TransitionManager;
  private history: HistoryManager;

  // State machine
  private lifecycleState: DocumentLifecycleState = 'editing';
  private scrollToTopOnSave: boolean;
  private isFirstLoad = true;

  constructor(options: AppConfig) {
    this.scrollToTopOnSave = options.scrollToTopOnSave !== false;

    // Initialize modules
    this.document = new Paste();
    this.storage = new StorageService();
    this.view = new ViewManager({
      appName: options.appName,
      enableTwitter: options.enableTwitter,
      lineNumbers: options.lineNumbers ?? true,
      highlightCurrentLine: options.highlightCurrentLine ?? true,
    });
    this.transitions = new TransitionManager();

    // Wire up view callbacks
    this.view.setCallbacks({
      onSave: () => this.handleSave(),
      onNew: () => this.handleNew(),
      onDuplicate: () => this.handleDuplicate(),
      onTwitter: () => this.handleTwitter(),
      onContentInput: (content) => this.handleContentInput(content),
    });

    // Initialize history manager
    this.history = new HistoryManager();
    this.history.onNavigate((path, state) => {
      if (!parsePath(path).key) {
        this.handleRoot(state);
      } else {
        this.loadDocumentByPath(path.slice(1), 'presenting', state as HistoryState);
      }
    });
  }

  /**
   * Initialize the application
   */
  init(): void {
    history.scrollRestoration = 'manual';
    this.view.init();
    window.addEventListener('beforeunload', (e) => {
      if (this.lifecycleState === 'editing' && this.document.content.trim()) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
    this.history.resolve();
  }

  /**
   * Handle root route (/)
   */
  private handleRoot(state?: unknown): void {
    // Guard: can't create new while loading/saving
    if (this.lifecycleState === 'loading' || this.lifecycleState === 'saving') {
      return;
    }

    this.isFirstLoad = false;
    const historyState = state as HistoryState | undefined;
    const targetScrollY = historyState?.scrollY ?? 0;

    this.transitions.run(() => {
      this.document.reset();
      if (historyState?.content) this.document.content = historyState.content;
      this.lifecycleState = 'editing';
      this.view.renderFullState(this.document, 'editing');
      window.scrollTo({ top: targetScrollY, behavior: 'instant' });
    });
  }

  /**
   * Command: Create new document
   */
  private newDocument(pushState: boolean): void {
    // Guard: can't create new while loading/saving
    if (this.lifecycleState === 'loading' || this.lifecycleState === 'saving') {
      return;
    }

    if (pushState) {
      // Persist draft and scroll to current history entry before navigating
      if (this.lifecycleState === 'editing' && this.document.content) {
        this.history.replace(window.location.pathname, {
          content: this.document.content,
          scrollY: window.scrollY,
        });
      } else {
        this.captureScrollInHistory();
      }
      this.history.push('/');
    }

    this.transitions.run(() => {
      this.document.reset();
      this.lifecycleState = 'editing';
      this.view.renderFullState(this.document, 'editing');
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  }

  /**
   * Command: Save current document
   */
  private async saveDocument(): Promise<void> {
    // Guard: must be in editing state
    if (this.lifecycleState !== 'editing') {
      return;
    }

    // Guard: must have content
    const content = this.view.getContentFromDOM();
    if (!content.trim()) {
      return;
    }

    // Update content from DOM
    this.document.content = content;

    try {
      // Update state
      this.lifecycleState = 'saving';
      this.view.showProgress();

      // Perform save (async)
      const result = await this.storage.save(this.document.content);

      // Highlight content and detect language in a single pass
      const { highlighted, language } = highlightContent(content);

      // Update document
      this.document.markSaved(result.key, language);

      // Update state
      this.lifecycleState = 'presenting';
      setTimeout(() => {
        this.view.hideProgress();
      }, 500);

      const ext = language ? getExtensionForLanguage(language) : undefined;

      // Bug C3 fix: persist draft to current history entry before navigating to saved doc
      this.history.replace(window.location.pathname, { content: content, scrollY: window.scrollY });

      // Push new history entry
      this.history.push(buildPath(result.key, ext));

      // Render with transition
      this.transitions.run(() => {
        this.view.renderFullState(this.document, 'presenting', highlighted);
        if (this.scrollToTopOnSave) {
          window.scrollTo({ top: 0, behavior: 'instant' });
        }
      });
    } catch (err) {
      console.error('Save failed:', err);

      // Fallback: stay in editing mode
      this.view.hideProgress();
      this.lifecycleState = 'editing';
      this.view.renderUIState(this.document, 'editing');

      this.view.showError('Failed to save. Please try again.');
    }
  }

  /**
   * Load document by path (key with optional extension)
   */
  private async loadDocumentByPath(
    path: string,
    defaultMode: 'editing' | 'presenting',
    historyState?: HistoryState
  ): Promise<void> {
    // Guard: can't load while loading/saving
    if (this.lifecycleState === 'loading' || this.lifecycleState === 'saving') {
      return;
    }

    // Parse key and extension
    const { key, ext } = parsePath(path);
    const urlLanguage = ext ? getLanguageForExtension(ext) : undefined;

    const hideWhileLoading = this.isFirstLoad;
    this.isFirstLoad = false;
    this.lifecycleState = 'loading';
    if (hideWhileLoading) this.view.renderLoadingState();
    try {
      // Load from storage
      const result = await this.storage.load(key);

      // Highlight content (with language hint if available)
      const highlightResult = highlightContent(result.content, urlLanguage || result.language);

      // Update model with the final language (detected or provided)
      this.document.restore({
        content: result.content,
        key: result.key,
        language: highlightResult.language || urlLanguage || result.language,
      });

      this.lifecycleState = defaultMode;

      // For view mode without extension, ensure URL has extension (use replace to avoid duplicate entries)
      if (defaultMode === 'presenting' && !ext && this.document.key) {
        if (this.document.language) {
          const langExt = getExtensionForLanguage(this.document.language);
          this.history.replace(buildPath(this.document.key, langExt));
        }
      }

      const targetScrollY = historyState?.scrollY ?? 0;

      // Render with transition
      this.transitions.run(() => {
        this.view.renderFullState(
          this.document,
          defaultMode,
          defaultMode === 'presenting' ? highlightResult.highlighted : undefined
        );
        window.scrollTo({ top: targetScrollY, behavior: 'instant' });
      });
    } catch (err) {
      console.error('Load failed:', err);

      // Fallback: show new document
      this.lifecycleState = 'editing';
      this.document.reset();
      this.history.replace('/');
      this.view.showError('Document not found.');
      this.view.renderFullState(this.document, 'editing');
    }
  }

  private captureScrollInHistory(): void {
    const existing = (window.history.state as HistoryState) ?? {};
    this.history.replace(window.location.pathname, { ...existing, scrollY: window.scrollY });
  }

  /**
   * Handle save button/shortcut
   */
  private handleSave(): void {
    if (this.lifecycleState === 'editing') {
      const content = this.view.getContentFromDOM();
      if (content.trim()) {
        this.saveDocument();
      }
    }
  }

  /**
   * Handle new button/shortcut
   */
  private handleNew(): void {
    if (this.lifecycleState === 'editing' || this.lifecycleState === 'presenting') {
      if (
        this.lifecycleState === 'editing' &&
        this.document.content.trim() &&
        !window.confirm('Discard unsaved changes?')
      ) {
        return;
      }
      this.newDocument(true);
    }
  }

  /**
   * Handle duplicate button/shortcut
   */
  private handleDuplicate(): void {
    if (this.lifecycleState === 'presenting') {
      const content = this.document.content;
      this.transitions.run(() => {
        this.document.reset();
        this.document.content = content;
        this.lifecycleState = 'editing';
        // URL stays at current doc — no history push
        this.view.renderFullState(this.document, 'editing');
      });
    }
  }

  /**
   * Handle twitter button/shortcut
   */
  private handleTwitter(): void {
    if (this.lifecycleState === 'presenting') {
      window.open('https://twitter.com/share?url=' + encodeURI(window.location.href));
    }
  }

  /**
   * Handle content input from textarea
   */
  private handleContentInput(content: string): void {
    // During editing phase, textarea owns content
    if (this.lifecycleState === 'editing') {
      this.document.content = content;
      // Update button states
      this.view.renderUIState(this.document, 'editing');
    }
  }
}
