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
import { parsePath, type ParsedPath } from './path-utils';
import { DocumentSession } from './document-session';
import { NavigationState, type HistoryState } from './navigation-state';

type ViewMode = 'editing' | 'presenting';
type ActivityState = 'idle' | 'loading' | 'saving';

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
  private viewMode: ViewMode = 'editing';
  private activity: ActivityState = 'idle';
  private scrollToTopOnSave: boolean;
  private isFirstLoad = true;

  private get isBusy(): boolean {
    return this.activity !== 'idle';
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
      const route = parsePath(path);
      if (!route.key) {
        this.handleRoot(state);
      } else {
        this.loadDocumentByPath(route, 'presenting', state as HistoryState);
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
      if (this.viewMode === 'editing' && this.document.content.trim()) {
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
    this.transitionToView('editing', { scrollY: targetScrollY });
  }

  /**
   * Command: Create new document
   */
  private newDocument(pushState: boolean): void {
    if (this.isBusy) return;

    if (pushState) {
      // Persist draft and scroll to current history entry before navigating
      if (this.viewMode === 'editing' && this.document.content) {
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
    this.transitionToView('editing');
  }

  /**
   * Command: Save current document
   */
  private async saveDocument(): Promise<void> {
    if (this.viewMode !== 'editing' || this.activity !== 'idle') {
      return;
    }

    const content = this.view.getContentFromDOM();
    if (!content.trim()) {
      return;
    }

    this.document.content = content;

    try {
      this.activity = 'saving';
      this.view.showProgress();

      const result = await this.session.save(this.document.content);
      this.session.apply(this.document, result);

      this.activity = 'idle';
      setTimeout(() => {
        this.view.hideProgress();
      }, 500);

      this.navigation.replaceDraft(window.location.pathname, content, window.scrollY);
      this.navigation.pushPath(result.canonicalPath);
      this.transitionToView('presenting', {
        highlighted: result.highlighted,
        scrollY: this.scrollToTopOnSave ? 0 : null,
      });
    } catch (err) {
      console.error('Save failed:', err);

      // Fallback: stay in editing mode
      this.view.hideProgress();
      this.activity = 'idle';
      this.viewMode = 'editing';
      this.view.renderUIState(this.document, 'editing');

      this.view.showError('Failed to save. Please try again.');
    }
  }

  /**
   * Load document by path (key with optional extension)
   */
  private async loadDocumentByPath(
    path: ParsedPath,
    defaultMode: 'editing' | 'presenting',
    historyState?: HistoryState
  ): Promise<void> {
    // Guard: can't load while loading/saving
    if (this.isBusy) return;

    const hideWhileLoading = this.isFirstLoad;
    this.isFirstLoad = false;
    this.activity = 'loading';
    if (hideWhileLoading) this.view.renderLoadingState();
    try {
      const result = await this.session.load(path);
      this.session.apply(this.document, result);

      this.activity = 'idle';

      // For view mode without extension, ensure URL has extension (use replace to avoid duplicate entries)
      if (
        defaultMode === 'presenting' &&
        !path.ext &&
        result.canonicalPath !== window.location.pathname
      ) {
        this.navigation.replacePath(result.canonicalPath);
      }

      const targetScrollY = historyState?.scrollY ?? 0;

      // Render with transition
      this.transitionToView(defaultMode, {
        highlighted: defaultMode === 'presenting' ? result.highlighted : undefined,
        scrollY: targetScrollY,
      });
    } catch (err) {
      console.error('Load failed:', err);

      // Fallback: show new document
      this.activity = 'idle';
      this.document.reset();
      this.navigation.replacePath('/');
      this.view.showError('Document not found.');
      this.transitionToView('editing');
    }
  }

  private transitionToView(
    mode: ViewMode,
    options: { highlighted?: string; scrollY?: number | null } = {}
  ): void {
    this.viewMode = mode;
    this.transitions.run(() => {
      this.view.renderFullState(this.document, mode, options.highlighted);
      if (options.scrollY !== null && options.scrollY !== undefined) {
        window.scrollTo({ top: options.scrollY, behavior: 'instant' });
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
    if (this.viewMode === 'editing' && this.activity === 'idle') {
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
    if (this.viewMode === 'editing' || this.viewMode === 'presenting') {
      if (
        this.viewMode === 'editing' &&
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
    if (this.viewMode === 'presenting' && this.activity === 'idle' && !this.document.frozen) {
      const content = this.document.content;
      this.document.reset();
      this.document.content = content;
      this.transitionToView('editing');
    }
  }

  /**
   * Handle twitter button/shortcut
   */
  private handleTwitter(): void {
    if (this.viewMode === 'presenting' && this.activity === 'idle') {
      window.open('https://twitter.com/share?url=' + encodeURI(window.location.href));
    }
  }

  private handleFileDrop(content: string): void {
    if (this.isBusy) return;

    // Same history behaviour as New: persist draft/scroll, then navigate to /
    if (this.viewMode === 'editing' && this.document.content) {
      this.navigation.replaceDraft(window.location.pathname, this.document.content, window.scrollY);
    } else {
      this.captureScrollInHistory();
    }
    this.navigation.pushPath('/');

    this.document.reset();
    this.document.content = content;
    this.transitionToView('editing');
  }

  /**
   * Handle content input from textarea
   */
  private handleContentInput(content: string): void {
    // During editing phase, textarea owns content
    if (this.viewMode === 'editing') {
      this.document.content = content;
      this.view.renderUIState(this.document, 'editing');
    }
  }
}
