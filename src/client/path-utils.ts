export interface ParsedPath {
  key: string;
  ext?: string;
}

export function parsePath(pathname: string): ParsedPath {
  const raw = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  const dot = raw.indexOf('.');
  if (dot === -1) return { key: raw };
  return { key: raw.slice(0, dot), ext: raw.slice(dot + 1) };
}

export function buildPath(key: string, ext?: string): string {
  if (!key) return '/';
  return ext ? `/${key}.${ext}` : `/${key}`;
}
