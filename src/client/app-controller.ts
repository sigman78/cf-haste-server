/**
 * AppController - Orchestrator
 *
 * Responsibilities:
 * - Owns document lifecycle state machine: loading | editing | presenting | saving
 * - Coordinates all modules
 * - Public API is synchronous
 * - Manages async operations internally with consistent error handling
 */

import { DocumentModel, isLoaded } from './document';
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

type DocumentLifecycleState = 'loading' | 'editing' | 'presenting' | 'saving';

export interface AppConfig {
  appName: string;
  enableTwitter: boolean;
}

export class AppController {
  // Module dependencies
  private document: DocumentModel;
  private storage: StorageService;
  private view: ViewManager;
  private transitions: TransitionManager;
  private history: HistoryManager;

  // State machine
  private lifecycleState: DocumentLifecycleState = 'editing';

  // Config
  private appName: string;

  constructor(options: AppConfig) {
    this.appName = options.appName;

    // Initialize modules
    this.document = new DocumentModel();
    this.storage = new StorageService();
    this.view = new ViewManager({
      appName: options.appName,
      enableTwitter: options.enableTwitter,
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
      if (path === '/' || path === '') {
        this.handleRoot(state);
      } else {
        this.loadDocumentByPath(path.slice(1), 'presenting');
      }
    });
  }

  /**
   * Initialize the application
   */
  init(): void {
    this.view.init();
    window.addEventListener('beforeunload', (e) => {
      if (this.lifecycleState === 'editing' && this.document.getContent().trim()) {
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

    this.transitions.run(() => {
      // Update model
      this.document.reset();

      // Check history state for restored content
      if ((state as any)?.content) {
        this.document.setContent((state as any).content);
      }

      // Update state
      this.lifecycleState = 'editing';

      // Render
      this.view.renderFullState(this.document.getState(), 'editing');
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

    // Bug C3 fix: persist draft to current history entry before navigating away
    if (pushState && this.lifecycleState === 'editing') {
      const draft = this.document.getContent();
      if (draft) {
        this.history.replace(window.location.pathname, { content: draft });
      }
    }

    this.transitions.run(() => {
      // Update model
      this.document.reset();

      // Update state
      this.lifecycleState = 'editing';

      // Update history
      if (pushState) {
        this.history.push('/');
      }

      // Render
      this.view.renderFullState(this.document.getState(), 'editing');
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
    this.document.setContent(content);

    try {
      // Update state
      this.lifecycleState = 'saving';
      this.view.showProgress();

      // Perform save (async)
      const result = await this.storage.save(this.document.serialize());

      // Highlight content and detect language in a single pass
      const { highlighted, language } = highlightContent(content);

      // Update document
      this.document.update({ key: result.key, language: language });

      // Update state
      this.lifecycleState = 'presenting';
      setTimeout(() => {
        this.view.hideProgress();
      }, 500);

      // Build path with extension
      let path = result.key;
      if (language) {
        const ext = getExtensionForLanguage(language);
        path += '.' + ext;
      }

      // Bug C3 fix: persist draft to current history entry before navigating to saved doc
      this.history.replace(window.location.pathname, { content: content });

      // Push new history entry
      this.history.push('/' + path);

      // Render with transition
      this.transitions.run(() => {
        this.view.renderFullState(this.document.getState(), 'presenting', highlighted);
      });
    } catch (err) {
      console.error('Save failed:', err);

      // Fallback: stay in editing mode
      this.view.hideProgress();
      this.lifecycleState = 'editing';
      this.view.renderUIState(this.document.getState(), 'editing');

      this.view.showError('Failed to save. Please try again.');
    }
  }

  /**
   * Load document by path (key with optional extension)
   */
  private async loadDocumentByPath(
    path: string,
    defaultMode: 'editing' | 'presenting'
  ): Promise<void> {
    // Guard: can't load while loading/saving
    if (this.lifecycleState === 'loading' || this.lifecycleState === 'saving') {
      return;
    }

    // Parse key and extension
    const parts = path.split('.', 2);
    const key = parts[0];
    const ext = parts[1];
    const urlLanguage = ext ? getLanguageForExtension(ext) : undefined;

    try {
      this.lifecycleState = 'loading';

      // Load from storage
      const result = await this.storage.load(key);

      // Highlight content (with language hint if available)
      const highlightResult = highlightContent(result.content, urlLanguage || result.language);

      // Update model with the final language (detected or provided)
      this.document.hydrate({
        content: result.content,
        key: result.key,
        language: highlightResult.language || urlLanguage || result.language,
      });

      this.lifecycleState = defaultMode;

      // For view mode without extension, ensure URL has extension (use replace to avoid duplicate entries)
      if (defaultMode === 'presenting' && !path.includes('.')) {
        const state = this.document.getState();
        if (state.language) {
          const ext = getExtensionForLanguage(state.language);
          this.history.replace(`/${state.key}.${ext}`);
        }
      }

      // Render with transition
      this.transitions.run(() => {
        this.view.renderFullState(
          this.document.getState(),
          defaultMode,
          defaultMode === 'presenting' ? highlightResult.highlighted : undefined
        );
      });
    } catch (err) {
      console.error('Load failed:', err);

      // Fallback: show new document
      this.lifecycleState = 'editing';
      this.document.reset();
      this.history.replace('/');
      this.view.showError('Document not found.');
      this.view.renderFullState(this.document.getState(), 'editing');
    }
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
        this.document.getContent().trim() &&
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
      const content = this.document.getContent();
      this.transitions.run(() => {
        this.document.reset();
        this.document.setContent(content);
        this.lifecycleState = 'editing';
        // URL stays at current doc — no history push
        this.view.renderFullState(this.document.getState(), 'editing');
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
      this.document.setContent(content);
      // Update button states
      this.view.renderUIState(this.document.getState(), 'editing');
    }
  }
}
