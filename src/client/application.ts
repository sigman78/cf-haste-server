/**
 * Haste - Main Application Entry Point
 *
 * Refactored Architecture:
 * - Document (Model): Pure sync business logic
 * - Storage (Backend): Pure async I/O
 * - ViewManager (DOM): Pure sync DOM operations
 * - TransitionManager: Sync wrapper for view transitions
 * - Router: Sync global manager for routing
 * - AppController: Orchestrator with state machine
 *
 * This file now simply initializes the application with the new architecture.
 */

import { initializeIcons } from './icons';
import { AppController } from './app-controller';
import appConfig from './config';

// Initialize app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize vector icons first
  initializeIcons();

  // Create and initialize the app controller
  const app = new AppController(appConfig);

  app.init();
});
