-- Migration: Create documents table
-- Description: Table for storing paste documents with expiration support

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER,
  views INTEGER NOT NULL DEFAULT 0
);

-- Index for cleaning up expired documents
CREATE INDEX IF NOT EXISTS idx_documents_expires_at ON documents(expires_at);

-- Index for finding documents by creation date
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
