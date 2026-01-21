// Optimized highlight.js configuration
// Only imports commonly used languages instead of all 200+ languages
// This reduces bundle size significantly compared to importing all languages

import hljs from 'highlight.js/lib/core';

// Import only commonly used languages
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import php from 'highlight.js/lib/languages/php';
import ruby from 'highlight.js/lib/languages/ruby';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import swift from 'highlight.js/lib/languages/swift';
import kotlin from 'highlight.js/lib/languages/kotlin';
import scala from 'highlight.js/lib/languages/scala';
import sql from 'highlight.js/lib/languages/sql';
import shell from 'highlight.js/lib/languages/shell';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import scss from 'highlight.js/lib/languages/scss';
import markdown from 'highlight.js/lib/languages/markdown';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import nginx from 'highlight.js/lib/languages/nginx';
import perl from 'highlight.js/lib/languages/perl';
import lua from 'highlight.js/lib/languages/lua';
import delphi from 'highlight.js/lib/languages/delphi';
import objectivec from 'highlight.js/lib/languages/objectivec';
import vbscript from 'highlight.js/lib/languages/vbscript';
import vala from 'highlight.js/lib/languages/vala';
import smalltalk from 'highlight.js/lib/languages/smalltalk';
import lisp from 'highlight.js/lib/languages/lisp';
import ini from 'highlight.js/lib/languages/ini';
import diff from 'highlight.js/lib/languages/diff';
import latex from 'highlight.js/lib/languages/latex';
import erlang from 'highlight.js/lib/languages/erlang';
import haskell from 'highlight.js/lib/languages/haskell';

// Register languages
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('java', java);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('c', cpp); // C uses same as C++
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('cs', csharp);
hljs.registerLanguage('php', php);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('swift', swift);
hljs.registerLanguage('kotlin', kotlin);
hljs.registerLanguage('scala', scala);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('shell', shell);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('json', json);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('scss', scss);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('nginx', nginx);
hljs.registerLanguage('perl', perl);
hljs.registerLanguage('pl', perl);
hljs.registerLanguage('lua', lua);
hljs.registerLanguage('delphi', delphi);
hljs.registerLanguage('pas', delphi);
hljs.registerLanguage('objectivec', objectivec);
hljs.registerLanguage('objc', objectivec);
hljs.registerLanguage('m', objectivec);
hljs.registerLanguage('vbscript', vbscript);
hljs.registerLanguage('vbs', vbscript);
hljs.registerLanguage('vala', vala);
hljs.registerLanguage('smalltalk', smalltalk);
hljs.registerLanguage('sm', smalltalk);
hljs.registerLanguage('lisp', lisp);
hljs.registerLanguage('ini', ini);
hljs.registerLanguage('diff', diff);
hljs.registerLanguage('latex', latex);
hljs.registerLanguage('tex', latex);
hljs.registerLanguage('erlang', erlang);
hljs.registerLanguage('erl', erlang);
hljs.registerLanguage('haskell', haskell);
hljs.registerLanguage('hs', haskell);

// Additional aliases for common file extensions
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('py', python);
hljs.registerLanguage('rb', ruby);
hljs.registerLanguage('rs', rust);
hljs.registerLanguage('kt', kotlin);
hljs.registerLanguage('htm', xml);
hljs.registerLanguage('cc', cpp);
hljs.registerLanguage('h', cpp);

// Extension to language mapping
export const extensionMap: Record<string, string> = {
  // Scripting languages
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  rb: 'ruby',
  pl: 'perl',
  php: 'php',
  lua: 'lua',
  vbs: 'vbscript',
  bash: 'bash',
  sh: 'bash',
  // Compiled languages
  java: 'java',
  cpp: 'cpp',
  cc: 'cpp',
  c: 'c',
  h: 'cpp',
  cs: 'cs',
  go: 'go',
  rs: 'rust',
  rust: 'rust',
  swift: 'swift',
  kt: 'kotlin',
  kotlin: 'kotlin',
  scala: 'scala',
  pas: 'delphi',
  m: 'objectivec',
  vala: 'vala',
  // Functional languages
  erl: 'erlang',
  hs: 'haskell',
  lisp: 'lisp',
  sm: 'smalltalk',
  // Markup and data formats
  html: 'xml',
  htm: 'xml',
  xml: 'xml',
  css: 'css',
  scss: 'scss',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  md: 'markdown',
  tex: 'latex',
  // Database
  sql: 'sql',
  // Configuration and other
  ini: 'ini',
  diff: 'diff',
  dockerfile: 'dockerfile',
  nginx: 'nginx',
  txt: '',
};

/**
 * Language Utilities
 */

/**
 * Get language for file extension
 */
export function getLanguageForExtension(ext: string): string | undefined {
  return extensionMap[ext] || ext;
}

/**
 * Get extension for language
 */
export function getExtensionForLanguage(language: string): string {
  for (const [ext, lang] of Object.entries(extensionMap)) {
    if (lang === language) return ext;
  }
  return language;
}

/**
 * Auto-detect language from content
 */
export function detectLanguage(content: string): string | undefined {
  try {
    const result = hljs.highlightAuto(content);
    return result.language;
  } catch {
    return undefined;
  }
}

/**
 * Highlight content with optional language
 */
export function highlightContent(content: string, language?: string): string {
  try {
    if (language === 'txt' || language === '') {
      return escapeHtml(content);
    } else if (language) {
      const result = hljs.highlight(content, { language });
      return result.value;
    } else {
      const result = hljs.highlightAuto(content);
      return result.value;
    }
  } catch (err) {
    // Fallback on auto
    try {
      const result = hljs.highlightAuto(content);
      return result.value;
    } catch {
      return escapeHtml(content);
    }
  }
}

/**
 * Escape HTML for safe display
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default hljs;
