/**
 * Google Form embed - post-submit height trim (Richard Jones pattern, guarded).
 *
 * Google Forms cannot auto-resize cross-origin iframes (no postMessage height API).
 * Parent pages must set a fixed height tall enough for the full form so the PAGE
 * scrolls, not a nested iframe scrollbar. After submit, shrink to thank-you height
 * only when the user interacted with the form (avoids false triggers on double load).
 */
(function () {
  'use strict';

  var MIN = 320;
  var MAX = 4000;

  function clamp(n) {
    var v = Math.round(Number(n));
    if (!Number.isFinite(v)) {
      return 0;
    }
    return Math.max(MIN, Math.min(MAX, v));
  }

  function activeHeight(wrap) {
    if (window.matchMedia('(max-width: 768px)').matches) {
      var mobile = parseInt(wrap.dataset.formHeightMobile || '0', 10);
      if (mobile > 0) {
        return mobile;
      }
    }
    return parseInt(wrap.dataset.formHeight || '0', 10);
  }

  function applyHeight(wrap, px, options) {
    var height = clamp(px);
    if (height <= 0) {
      return;
    }

    wrap.style.setProperty('--monroe-form-embed-h-active', height + 'px');
    wrap.dataset.monroeFormActiveHeight = String(height);

    var iframe = wrap.querySelector('iframe');
    if (iframe) {
      iframe.setAttribute('height', String(height));
      iframe.style.height = height + 'px';
    }

    if (options && options.scrollIntoView) {
      wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function initEmbed(wrap) {
    var thankYou = parseInt(wrap.dataset.thankYouHeight || '520', 10);
    var userInteracted = false;
    var loadCount = 0;
    var iframe = wrap.querySelector('iframe');

    applyHeight(wrap, activeHeight(wrap));

    if (!iframe) {
      return;
    }

    function markInteraction() {
      userInteracted = true;
    }

    wrap.addEventListener('pointerenter', markInteraction, { passive: true });
    iframe.addEventListener('load', function () {
      loadCount += 1;

      if (loadCount === 1) {
        applyHeight(wrap, activeHeight(wrap));
        return;
      }

      if (userInteracted && loadCount >= 2) {
        wrap.classList.add('monroe-google-form-embed--submitted');
        applyHeight(wrap, thankYou, { scrollIntoView: true });
      }
    });
  }

  function onResize() {
    document.querySelectorAll('.monroe-google-form-embed').forEach(function (wrap) {
      if (wrap.classList.contains('monroe-google-form-embed--submitted')) {
        return;
      }
      applyHeight(wrap, activeHeight(wrap));
    });
  }

  function init() {
    var embeds = document.querySelectorAll('.monroe-google-form-embed[data-form-height]');
    if (!embeds.length) {
      return;
    }

    embeds.forEach(initEmbed);

    var timer;
    window.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(onResize, 150);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
