(function () {
  if (!/(?:^|[?&])embed=1(?:&|$)/.test(window.location.search)) {
    return;
  }
  document.documentElement.classList.add('humane-embed');
  window.__SHELTER_EMBED__ = true;
})();
