/**
 * Handles the #vote section that holds the inline Zeffy voting form: (1)
 * every "Vote now" shortcut (hero, floating button, lightbox, and the
 * section's own toggle button) needs to open it and scroll to it, and (2)
 * the Zeffy embed script itself is only injected the first time it opens.
 *
 * This is a plain button + hidden <div>, not a <details> disclosure - a
 * closed <details> only auto-expands via native browser behavior when a
 * fragment link points at content *inside* it, not at the <details>' own
 * id, so every shortcut except the summary itself would still need this
 * same JS. A plain toggle sidesteps that native behavior entirely.
 *
 * Zeffy's iframe starts small and resizes to fit the form once it measures
 * the content (a postMessage round-trip that can take a few seconds) - that's
 * normal, not something this script needs to work around.
 */
(function () {
  'use strict';

  var body = document.getElementById('vote');
  if (!body) {
    return;
  }

  var toggleBtn = document.querySelector('.monroe-artwork-contest-vote-embed__toggle');
  var embedLoaded = false;

  function loadEmbed() {
    if (embedLoaded) {
      return;
    }
    embedLoaded = true;

    var formUrl = body.getAttribute('data-zeffy-form-url');
    if (!formUrl) {
      return;
    }
    body.innerHTML = '';

    var embedDiv = document.createElement('div');
    embedDiv.setAttribute('data-zeffy-embed', '');
    embedDiv.setAttribute('data-form-url', formUrl);
    body.appendChild(embedDiv);

    var fallback = document.createElement('div');
    fallback.setAttribute('data-zeffy-embed-fallback', '');
    fallback.style.display = 'none';
    fallback.innerHTML =
      '<div style="position:relative;overflow:hidden;height:450px;width:100%;padding-top:450px;">' +
      '<iframe title="Donation form powered by Zeffy" style="position:absolute;border:0;top:0;left:0;bottom:0;right:0;width:100%;height:100%" ' +
      'data-zeffy-embed-src="https://www.zeffy.com' + formUrl + '" allowpaymentrequest allowtransparency="true"></iframe></div>';
    body.appendChild(fallback);

    var script = document.createElement('script');
    script.src = 'https://www.zeffy.com/embed/v2/zeffy-embed.js';
    script.onerror = function () {
      fallback.style.display = 'block';
      fallback.querySelectorAll('iframe[data-zeffy-embed-src]').forEach(function (frame) {
        frame.src = frame.getAttribute('data-zeffy-embed-src');
      });
    };
    body.appendChild(script);
  }

  function openVoteEmbed() {
    if (body.hidden) {
      body.hidden = false;
      if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', 'true');
      }
    }
    loadEmbed();
    body.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeVoteEmbed() {
    body.hidden = true;
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', 'false');
    }
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', function () {
      if (body.hidden) {
        openVoteEmbed();
      } else {
        closeVoteEmbed();
      }
    });
  }

  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[href="#vote"]');
    if (link) {
      openVoteEmbed();
    }
  });

  if (location.hash === '#vote') {
    openVoteEmbed();
  }
})();
