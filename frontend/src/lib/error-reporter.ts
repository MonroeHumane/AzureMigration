export async function reportClientError(error: unknown, extra?: Record<string, any>): Promise<Response | void> {
  if (typeof window === 'undefined') return;
  const msg = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack || '' : '';

  const isServerEnv = window.location.hostname.includes('azure') || Boolean((window as any).__MCHS_API_URL__);
  if (!isServerEnv) {
    console.warn('[ClientError]', msg, extra || '');
    return Promise.resolve();
  }

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
    reportClientError(event.error || event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportClientError(event.reason || 'Unhandled Promise Rejection');
  });
}
