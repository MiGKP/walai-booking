const STORAGE_KEY = 'walai_post_login_redirect';

export function isSafeInternalPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/auth');
}

export function setPostLoginRedirect(path: string): void {
  if (typeof window === 'undefined') return;
  if (!isSafeInternalPath(path)) return;
  sessionStorage.setItem(STORAGE_KEY, path);
}

export function consumePostLoginRedirect(): string | null {
  if (typeof window === 'undefined') return null;
  const path = sessionStorage.getItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  if (!path || !isSafeInternalPath(path)) return null;
  return path;
}
