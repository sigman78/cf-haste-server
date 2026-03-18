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
import { Router, MatchResult } from './router';
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
  private router: Router;

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

    // Initialize router with declarative routes
    this.router = new Router();
    this.router.on('/', (match: MatchResult) => this.handleRoot(match));
    this.router.on('/:doc/edit', (match: MatchResult) =>
      this.loadDocumentByPath(match.params.doc, 'editing', match.state)
    );
    this.router.on('/:doc', (match: MatchResult) =>
      this.loadDocumentByPath(match.params.doc, 'presenting')
    );
  }

  /**
   * Initialize the application
   */
  init(): void {
    this.view.init();
    this.router.resolve();
  }

  /**
   * Handle root route (/)
   */
  private handleRoot(match: MatchResult): void {
    // Guard: can't create new while loading/saving
    if (this.lifecycleState === 'loading' || this.lifecycleState === 'saving') {
      return;
    }

    this.transitions.run(() => {
      // Update model
      this.document.reset();

      // Check history state for restored content
      if (match.state?.content) {
        this.document.setContent(match.state.content);
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

    this.transitions.run(() => {
      // Update model
      this.document.reset();

      // Update state
      this.lifecycleState = 'editing';

      // Update router
      if (pushState) {
        this.router.navigate('/', { mode: 'push' });
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

      // Perform save (async)
      const result = await this.storage.save(this.document.serialize());

      // Highlight content and detect language in a single pass
      const { highlighted, language } = highlightContent(content);

      // Update document
      this.document.update({ key: result.key, language: language });

      // Update state
      this.lifecycleState = 'presenting';

      // Build path with extension
      let path = result.key;
      if (language) {
        const ext = getExtensionForLanguage(language);
        path += '.' + ext;
      }

      // Update router
      // Use push mode to create a new history entry
      // This ensures back button works correctly: doc2 -> doc1/edit -> doc1
      this.router.navigate('/' + path, { mode: 'push' });

      // Render with transition
      this.transitions.run(() => {
        this.view.renderFullState(this.document.getState(), 'presenting', highlighted);
      });
    } catch (err) {
      console.error('Save failed:', err);

      // Fallback: stay in editing mode
      this.lifecycleState = 'editing';
      this.view.renderUIState(this.document.getState(), 'editing');

      // TODO: Show error to user
      alert('Failed to save document. Please try again.');
    }
  }

  /**
   * Load document by path (key with optional extension)
   */
  private async loadDocumentByPath(
    path: string,
    defaultMode: 'editing' | 'presenting',
    savedState?: any
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

      if (savedState?.content) {
        // Fast path: use saved content without storage call
        const content = savedState.content;
        const language = savedState.language || urlLanguage;

        // Highlight content
        const highlightResult = highlightContent(content, language);

        // Update model
        this.document.hydrate({
          content,
          key: savedState.key,
          language: highlightResult.language || language,
        });

        this.lifecycleState = defaultMode;

        // Render with transition
        this.transitions.run(() => {
          this.view.renderFullState(
            this.document.getState(),
            defaultMode,
            defaultMode === 'presenting' ? highlightResult.highlighted : undefined
          );
        });
      } else {
        // Slow path: load from storage
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
            this.router.navigate(`/${state.key}.${ext}`, { mode: 'replace' });
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
      }
    } catch (err) {
      console.error('Load failed:', err);

      // Fallback: show new document
      this.lifecycleState = 'editing';
      this.document.reset();
      this.router.navigate('/', { mode: 'push' });
      this.view.renderFullState(this.document.getState(), 'editing');

      // TODO: Show error to user (optional)
      // alert('Document not found');
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
      this.newDocument(true);
    }
  }

  /**
   * Handle duplicate button/shortcut
   */
  private handleDuplicate(): void {
    if (this.lifecycleState === 'presenting') {
      const content = this.document.getContent();
      const key = this.document.getKey();
      const language = this.document.getLanguage();

      this.transitions.run(() => {
        // Reset document
        this.document.reset();
        this.document.setContent(content);

        // Update state
        this.lifecycleState = 'editing';

        // Navigate to edit URL with content in history state (PUSH to preserve /doc in history)
        // Note: URL is /key/edit without extension, state has language
        this.router.navigate(`/${key}/edit`, {
          mode: 'push',
          state: { content, key, language },
        });

        // Render with content
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
