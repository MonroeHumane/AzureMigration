/**
 * Click-to-zoom lightbox for the T-shirt design contest gallery. Vanilla JS,
 * no dependencies. The overlay markup is rendered server-side in PHP and
 * already in the DOM at load - this script only toggles its visibility and
 * swaps the image/caption.
 */
(function () {
  'use strict';

  function init() {
    var gallery = document.querySelector('.monroe-artwork-contest-gallery__grid');
    var overlay = document.getElementById('monroeArtworkLightbox');
    if (!gallery || !overlay) {
      return;
    }

    var buttons = Array.prototype.slice.call(
      gallery.querySelectorAll('.monroe-artwork-contest-gallery__frame-btn')
    );
    if (!buttons.length) {
      return;
    }

    var entries = buttons.map(function (btn) {
      return {
        src: btn.getAttribute('data-full-src') || btn.querySelector('img').src,
        label: btn.getAttribute('data-label') || '',
      };
    });

    var imageEl = overlay.querySelector('.monroe-artwork-lightbox__image');
    var captionEl = overlay.querySelector('.monroe-artwork-lightbox__caption');
    var closeEls = Array.prototype.slice.call(overlay.querySelectorAll('[data-lightbox-close]'));
    var prevBtn = overlay.querySelector('[data-lightbox-prev]');
    var nextBtn = overlay.querySelector('[data-lightbox-next]');
    var voteBtn = overlay.querySelector('.monroe-artwork-lightbox__vote-btn');

    var currentIndex = 0;
    var lastFocused = null;

    function show(index) {
      currentIndex = (index + entries.length) % entries.length;
      var entry = entries[currentIndex];
      imageEl.src = entry.src;
      imageEl.alt = entry.label;
      captionEl.textContent = entry.label;
    }

    function open(index) {
      lastFocused = document.activeElement;
      show(index);
      overlay.hidden = false;
      document.body.classList.add('monroe-artwork-lightbox-open');
    }

    function close() {
      overlay.hidden = true;
      document.body.classList.remove('monroe-artwork-lightbox-open');
      if (lastFocused && typeof lastFocused.focus === 'function') {
        lastFocused.focus();
      }
    }

    buttons.forEach(function (btn, index) {
      btn.addEventListener('click', function () {
        open(index);
      });
    });

    closeEls.forEach(function (el) {
      el.addEventListener('click', close);
    });
    prevBtn.addEventListener('click', function () {
      show(currentIndex - 1);
    });
    nextBtn.addEventListener('click', function () {
      show(currentIndex + 1);
    });
    if (voteBtn) {
      // Let the #vote link navigate/scroll normally - just get the overlay
      // out of the way first so the page underneath is actually visible.
      voteBtn.addEventListener('click', close);
    }

    document.addEventListener('keydown', function (event) {
      if (overlay.hidden) {
        return;
      }
      if (event.key === 'Escape') {
        close();
      } else if (event.key === 'ArrowLeft') {
        show(currentIndex - 1);
      } else if (event.key === 'ArrowRight') {
        show(currentIndex + 1);
      }
    });

    // Basic swipe support for mobile.
    var touchStartX = null;
    overlay.addEventListener('touchstart', function (event) {
      touchStartX = event.changedTouches[0].clientX;
    }, { passive: true });
    overlay.addEventListener('touchend', function (event) {
      if (touchStartX === null) {
        return;
      }
      var delta = event.changedTouches[0].clientX - touchStartX;
      if (Math.abs(delta) > 40) {
        show(currentIndex + (delta < 0 ? 1 : -1));
      }
      touchStartX = null;
    }, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
