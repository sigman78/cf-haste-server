/**
 * Shared API contract between the worker and the client.
 * Worker-only types (bindings, storage) live in src/worker/types.ts.
 */

export interface SaveResponse {
  key: string;
  url?: string;
}

export interface GetResponse {
  content: string;
  key: string;
  language?: string;
  frozen?: boolean;
}
