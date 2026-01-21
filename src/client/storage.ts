/**
 * Storage (Backend) - Pure Async I/O
 *
 * Responsibilities:
 * - All network I/O: load, save, create, delete
 * - Returns plain data objects
 * - No state, no DOM access
 * - Throws errors on failure
 */

import type { GetResponse, SaveResponse } from '../shared/types';
import type { DocumentState, DocumentMetaState } from './document';

export class StorageService {
  /**
   * Load document from server
   * @throws Error if fetch fails or document not found
   */
  async load(key: string): Promise<DocumentState & { key: string }> {
    const response = await fetch(`/documents/${key}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Document not found');
      }
      throw new Error(`Failed to load document: ${response.statusText}`);
    }

    const data: GetResponse = await response.json();

    return {
      content: data.content,
      key: data.key,
      language: data.language,
    };
  }

  /**
   * Save document to server
   * @throws Error if save fails
   */
  async save(content: string): Promise<DocumentMetaState & { key: string }> {
    if (!content.trim()) {
      throw new Error('Cannot save empty document');
    }

    const response = await fetch('/documents', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: content,
    });

    if (!response.ok) {
      throw new Error(`Failed to save document: ${response.statusText}`);
    }

    const data: SaveResponse = await response.json();

    return {
      key: data.key,
    };
  }
}
