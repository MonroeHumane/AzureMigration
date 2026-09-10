/**
 * Run once per Astro page load, including the first paint with ClientRouter.
 * Do not also call init() on DOMContentLoaded — that doubles listeners.
 * If init returns a cleanup function, it runs before the next page-load.
 */
export function onAstroPageLoad(init: () => void | (() => void)): void {
  let cleanup: (() => void) | void;
  const run = () => {
    if (typeof cleanup === 'function') cleanup();
    cleanup = init();
  };
  document.addEventListener('astro:page-load', run);
}
