export function reportClientError(error: unknown, extra?: Record<string, any>): Promise<Response | void> {
  if (typeof window === 'undefined') return Promise.resolve();
  const msg = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack || '' : '';
  try {
    return fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page: window.location.pathname,
        error: msg,
        stack,
        extra: extra || {}
      }),
    }).catch(() => {});
  } catch {
    return Promise.resolve();
  }
}

export function initErrorReporter(): void {
  if (typeof window === 'undefined') return;
  if ((window as any).__errorReporterInitialized) return;
  (window as any).__errorReporterInitialized = true;
  (window as any).reportClientError = reportClientError;

  window.addEventListener('error', (event) => {
    try {
      fetch('/api/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: window.location.pathname,
          error: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack || ''
        }),
      }).catch(() => {});
    } catch {}
  });

  window.addEventListener('unhandledrejection', (event) => {
    try {
      fetch('/api/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: window.location.pathname,
          error: 'Unhandled Promise Rejection',
          message: event.reason?.message || String(event.reason),
          stack: event.reason?.stack || ''
        }),
      }).catch(() => {});
    } catch {}
  });
}
