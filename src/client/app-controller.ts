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
import { ViewManager } from './view-manager';
import { TransitionManager } from './transition-manager';
import appConfig from './config';
import { parsePath } from './path-utils';
import { DocumentSession } from './document-session';
import { NavigationState, type HistoryState } from './navigation-state';

type DocumentLifecycleState = 'loading' | 'editing' | 'presenting' | 'saving';

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
  private session: DocumentSession;
  private view: ViewManager;
  private transitions: TransitionManager;
  private navigation: NavigationState;

  // State machine
  private lifecycleState: DocumentLifecycleState = 'editing';
  private scrollToTopOnSave: boolean;
  private isFirstLoad = true;

  private get isBusy(): boolean {
    return this.lifecycleState === 'loading' || this.lifecycleState === 'saving';
  }

  constructor(options: AppConfig) {
    this.scrollToTopOnSave = options.scrollToTopOnSave !== false;

    // Initialize modules
    this.document = new Paste();
    this.session = new DocumentSession();
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
      onFileDrop: (content) => this.handleFileDrop(content),
    });

    // Initialize history manager
    this.navigation = new NavigationState();
    this.navigation.onNavigate((path, state) => {
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
    this.navigation.resolve();
  }

  /**
   * Handle root route (/)
   */
  private handleRoot(state?: unknown): void {
    if (this.isBusy) return;

    this.isFirstLoad = false;
    const historyState = state as HistoryState | undefined;
    const targetScrollY = historyState?.scrollY ?? 0;

    this.document.reset();
    if (historyState?.content) this.document.content = historyState.content;
    this.lifecycleState = 'editing';
    this.renderWithTransition('editing', undefined, targetScrollY);
  }

  /**
   * Command: Create new document
   */
  private newDocument(pushState: boolean): void {
    if (this.isBusy) return;

    if (pushState) {
      // Persist draft and scroll to current history entry before navigating
      if (this.lifecycleState === 'editing' && this.document.content) {
        this.navigation.replaceDraft(
          window.location.pathname,
          this.document.content,
          window.scrollY
        );
      } else {
        this.captureScrollInHistory();
      }
      this.navigation.pushPath('/');
    }

    this.document.reset();
    this.lifecycleState = 'editing';
    this.renderWithTransition('editing');
  }

  /**
   * Command: Save current document
   */
  private async saveDocument(): Promise<void> {
    if (this.lifecycleState !== 'editing') {
      return;
    }

    const content = this.view.getContentFromDOM();
    if (!content.trim()) {
      return;
    }

    this.document.content = content;

    try {
      this.lifecycleState = 'saving';
      this.view.showProgress();

      const result = await this.session.save(this.document.content);
      this.session.apply(this.document, result);

      this.lifecycleState = 'presenting';
      setTimeout(() => {
        this.view.hideProgress();
      }, 500);

      this.navigation.replaceDraft(window.location.pathname, content, window.scrollY);
      this.navigation.pushPath(result.canonicalPath);
      this.renderWithTransition(
        'presenting',
        result.highlighted,
        this.scrollToTopOnSave ? 0 : null
      );
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
    if (this.isBusy) return;

    const { ext } = parsePath(path);

    const hideWhileLoading = this.isFirstLoad;
    this.isFirstLoad = false;
    this.lifecycleState = 'loading';
    if (hideWhileLoading) this.view.renderLoadingState();
    try {
      const result = await this.session.load(path);
      this.session.apply(this.document, result);

      this.lifecycleState = defaultMode;

      // For view mode without extension, ensure URL has extension (use replace to avoid duplicate entries)
      if (
        defaultMode === 'presenting' &&
        !ext &&
        result.canonicalPath !== window.location.pathname
      ) {
        this.navigation.replacePath(result.canonicalPath);
      }

      const targetScrollY = historyState?.scrollY ?? 0;

      // Render with transition
      this.renderWithTransition(
        defaultMode,
        defaultMode === 'presenting' ? result.highlighted : undefined,
        targetScrollY
      );
    } catch (err) {
      console.error('Load failed:', err);

      // Fallback: show new document
      this.lifecycleState = 'editing';
      this.document.reset();
      this.navigation.replacePath('/');
      this.view.showError('Document not found.');
      this.view.renderFullState(this.document, 'editing');
    }
  }

  private renderWithTransition(
    mode: 'editing' | 'presenting',
    highlighted?: string,
    scrollY: number | null = 0
  ): void {
    this.transitions.run(() => {
      this.view.renderFullState(this.document, mode, highlighted);
      if (scrollY !== null) {
        window.scrollTo({ top: scrollY, behavior: 'instant' });
      }
    });
  }

  private captureScrollInHistory(): void {
    this.navigation.captureScroll(window.location.pathname);
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
    if (this.lifecycleState === 'presenting' && !this.document.frozen) {
      const content = this.document.content;
      this.transitions.run(() => {
        this.document.reset();
        this.document.content = content;
        this.lifecycleState = 'editing';
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

  private handleFileDrop(content: string): void {
    if (this.isBusy) return;

    // Same history behaviour as New: persist draft/scroll, then navigate to /
    if (this.lifecycleState === 'editing' && this.document.content) {
      this.navigation.replaceDraft(window.location.pathname, this.document.content, window.scrollY);
    } else {
      this.captureScrollInHistory();
    }
    this.navigation.pushPath('/');

    this.document.reset();
    this.document.content = content;
    this.lifecycleState = 'editing';
    this.renderWithTransition('editing');
  }

  /**
   * Handle content input from textarea
   */
  private handleContentInput(content: string): void {
    // During editing phase, textarea owns content
    if (this.lifecycleState === 'editing') {
      this.document.content = content;
      this.view.renderUIState(this.document, 'editing');
    }
  }
}
