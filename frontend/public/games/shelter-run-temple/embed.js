(function () {
  var params = new URLSearchParams(window.location.search);
  if (params.get('embed') === '1') {
    document.documentElement.classList.add('humane-embed');
  } else {
    document.documentElement.classList.add('sr-standalone-chrome');
  }

  var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  var forceTouch = params.get('touch') === '1';
  if (forceTouch || coarse || ('ontouchstart' in window && window.innerWidth < 900)) {
    document.documentElement.classList.add('sr-touch');
  }

  function wireExit() {
    var btn = document.getElementById('srExitBtn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'arcade:exit', game: 'shelter_run' }, '*');
        }
      } catch (e) {}
      // Standalone fallback: hub games index
      if (!document.documentElement.classList.contains('humane-embed')) {
        window.location.href = '/games/';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireExit);
  } else {
    wireExit();
  }
})();
