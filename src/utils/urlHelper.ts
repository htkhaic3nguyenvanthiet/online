/**
 * URL and Routing utilities for student exam links
 */

export function getStudentExamShareUrl(examOrSessionId: string): string {
  if (typeof window === 'undefined') {
    return `https://htkhaic3nguyenvanthiet.github.io/online/?exam=${examOrSessionId}`;
  }

  // Use current origin and pathname (works for localhost, dev server, and GitHub Pages)
  const base = `${window.location.origin}${window.location.pathname}`.replace(/\/+$/, '');
  return `${base}?exam=${encodeURIComponent(examOrSessionId)}`;
}

export function getExamIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  // 1. Search Query Parameters: ?exam=xxx or ?quiz=xxx or ?sessionId=xxx or ?id=xxx
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('exam') || params.get('quiz') || params.get('sessionId') || params.get('id');
  if (fromQuery && fromQuery.trim()) return decodeURIComponent(fromQuery.trim());

  // 2. Hash Routing: #exam/xxx, #/exam/xxx, #take/xxx, #/take/xxx, #quiz/xxx
  const hash = window.location.hash;
  if (hash) {
    const hashMatch = hash.match(/#\/?(?:exam|take|quiz|test)\/([^/?&]+)/i);
    if (hashMatch && hashMatch[1]) {
      return decodeURIComponent(hashMatch[1].trim());
    }

    if (hash.includes('exam=')) {
      const parts = hash.split('exam=');
      if (parts[1]) {
        const val = parts[1].split('&')[0];
        if (val) return decodeURIComponent(val.trim());
      }
    }
  }

  return null;
}
