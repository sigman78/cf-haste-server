import { Paste } from './paste';
import { StorageService } from './storage';
import {
  highlightContent,
  getExtensionForLanguage,
  getLanguageForExtension,
} from './highlight-config';
import { buildPath, parsePath } from './path-utils';

export interface DocumentRenderResult {
  document: {
    content: string;
    key: string;
    language?: string;
    frozen?: boolean;
  };
  highlighted?: string;
  canonicalPath: string;
}

export class DocumentSession {
  constructor(private readonly storage: StorageService = new StorageService()) {}

  async save(content: string): Promise<DocumentRenderResult> {
    const result = await this.storage.save(content);
    const highlightResult = highlightContent(content);
    const language = highlightResult.language;
    const ext = language ? getExtensionForLanguage(language) : undefined;

    return {
      document: {
        content,
        key: result.key,
        language,
      },
      highlighted: highlightResult.highlighted,
      canonicalPath: buildPath(result.key, ext),
    };
  }

  async load(path: string): Promise<DocumentRenderResult> {
    const { key, ext } = parsePath(path);
    const urlLanguage = ext ? getLanguageForExtension(ext) : undefined;
    const result = await this.storage.load(key);
    const highlightResult = highlightContent(result.content, urlLanguage || result.language);
    const language = highlightResult.language || urlLanguage || result.language;

    return {
      document: {
        content: result.content,
        key: result.key,
        language,
        frozen: result.frozen,
      },
      highlighted: highlightResult.highlighted,
      canonicalPath: language
        ? buildPath(result.key, getExtensionForLanguage(language))
        : buildPath(key),
    };
  }

  apply(target: Paste, result: DocumentRenderResult): void {
    target.restore(result.document);
  }
}
