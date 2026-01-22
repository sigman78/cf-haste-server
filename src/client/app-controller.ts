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
import { Router } from './router';
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
    this.router = new Router(options.appName);

    // Wire up callbacks
    this.view.setCallbacks({
      onSave: () => this.handleSave(),
      onNew: () => this.handleNew(),
      onDuplicate: () => this.handleDuplicate(),
      onTwitter: () => this.handleTwitter(),
      onContentInput: (content) => this.handleContentInput(content),
    });

    this.router.onRoute((path) => this.handleRoute(path));
  }

  /**
   * Initialize the application
   */
  init(): void {
    this.view.init();
    this.router.init();
  }

  /**
   * Handle route changes
   */
  private handleRoute(path: string): void {
    if (!path || path === '') {
      // Home route - new document
      this.newDocument(false);
    } else {
      // Load document
      this.loadDocumentByPath(path);
    }
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
        this.router.navigate('', 'push');
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

      // Update model
      this.document.markSaved(result.key, language);

      // Update state
      this.lifecycleState = 'presenting';

      // Build path with extension
      let path = result.key;
      if (language) {
        const ext = getExtensionForLanguage(language);
        path += '.' + ext;
      }

      // Update router
      this.router.navigate(path, 'push');

      // Render with transition
      this.transitions.run(() => {
        this.view.renderFullState(this.document.getState(), 'presenting', highlighted);
      });
    } catch (err) {
      console.error('Save failed:', err);

      // Fallback: stay in editing mode
      this.lifecycleState = 'editing';
      this.view.renderMetadata(this.document.getState(), 'editing');

      // TODO: Show error to user
      alert('Failed to save document. Please try again.');
    }
  }

  /**
   * Load document by path (key with optional extension)
   */
  private async loadDocumentByPath(path: string): Promise<void> {
    // Guard: can't load while loading/saving
    if (this.lifecycleState === 'loading' || this.lifecycleState === 'saving') {
      return;
    }

    // Parse key and extension
    const parts = path.split('.', 2);
    const key = parts[0];
    const ext = parts[1];
    const language = ext ? getLanguageForExtension(ext) : undefined;

    try {
      // Update state
      this.lifecycleState = 'loading';

      // Perform load (async)
      const result = await this.storage.load(key);

      // Highlight content (with language hint if available)
      const highlightResult = highlightContent(result.content, language || result.language);

      // Update model with the final language (detected or provided)
      this.document.hydrate({
        content: result.content,
        key: result.key,
        language: highlightResult.language || language || result.language,
      });

      // Update state
      this.lifecycleState = 'presenting';

      // Build path with extension
      const state = this.document.getState();
      if (isLoaded(state)) {
        let fullPath = state.key;
        if (state.language) {
          const ext = getExtensionForLanguage(state.language);
          fullPath += '.' + ext;
        }

        // Update router if path doesn't match
        if (path !== fullPath) {
          this.router.navigate(fullPath, 'push');
        }
      }

      // Render with transition
      this.transitions.run(() => {
        this.view.renderFullState(
          this.document.getState(),
          'presenting',
          highlightResult.highlighted
        );
      });
    } catch (err) {
      console.error('Load failed:', err);

      // Fallback: show new document
      this.lifecycleState = 'editing';
      this.document.reset();
      this.router.navigate('', 'push');
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
      const content = this.document.duplicate();

      this.transitions.run(() => {
        // Reset document
        this.document.reset();
        this.document.setContent(content);

        // Update state
        this.lifecycleState = 'editing';

        // Navigate to home (replace current history entry to avoid empty intermediate state)
        this.router.navigate('', 'replace');

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
      this.view.renderMetadata(this.document.getState(), 'editing');
    }
  }
}
