/**
 * Singleton Petango profile modal for adopt search (and future carousel reuse).
 */
(function () {
  'use strict';

  var ROOT_ID = 'monroe-pet-profile-modal-root';
  var dialog = null;
  var iframe = null;
  var titleEl = null;
  var errorEl = null;
  var closeBtn = null;
  var prevBodyOverflow = '';

  function ensureModal() {
    if (dialog) {
      return dialog;
    }

    var root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.body;
    }

    dialog = document.createElement('dialog');
    dialog.className = 'monroe-pet-profile-modal';
    dialog.setAttribute('aria-labelledby', 'monroe-pet-profile-modal-title');
    dialog.innerHTML =
      '<div class="monroe-pet-profile-modal__panel" role="document">' +
      '  <header class="monroe-pet-profile-modal__header">' +
      '    <h2 id="monroe-pet-profile-modal-title" class="monroe-pet-profile-modal__title">Pet profile</h2>' +
      '    <button type="button" class="monroe-pet-profile-modal__close" aria-label="Close profile">' +
      '      <span aria-hidden="true">&times;</span>' +
      '    </button>' +
      '  </header>' +
      '  <div class="monroe-pet-profile-modal__body">' +
      '    <p class="monroe-pet-profile-modal__error" hidden>No profile available for this pet.</p>' +
      '    <iframe class="monroe-pet-profile-modal__iframe" title="Pet profile" src="about:blank"></iframe>' +
      '  </div>' +
      '</div>';

    root.appendChild(dialog);

    titleEl = dialog.querySelector('.monroe-pet-profile-modal__title');
    iframe = dialog.querySelector('.monroe-pet-profile-modal__iframe');
    errorEl = dialog.querySelector('.monroe-pet-profile-modal__error');
    closeBtn = dialog.querySelector('.monroe-pet-profile-modal__close');

    closeBtn.addEventListener('click', close);
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) {
        close();
      }
    });
    dialog.addEventListener('close', cleanup);
    dialog.addEventListener('cancel', function (e) {
      e.preventDefault();
      close();
    });

    return dialog;
  }

  function setErrorVisible(show) {
    if (!errorEl || !iframe) {
      return;
    }
    if (show) {
      errorEl.removeAttribute('hidden');
      iframe.setAttribute('hidden', '');
    } else {
      errorEl.setAttribute('hidden', '');
      iframe.removeAttribute('hidden');
    }
  }

  function cleanup() {
    if (iframe) {
      iframe.src = 'about:blank';
    }
    document.body.style.overflow = prevBodyOverflow;
    setErrorVisible(false);
  }

  function close() {
    ensureModal();
    if (typeof dialog.close === 'function' && dialog.open) {
      dialog.close();
    } else {
      cleanup();
      dialog.removeAttribute('open');
      dialog.classList.remove('is-open');
    }
  }

  function open(url, name) {
    ensureModal();
    var profileUrl = (url || '').trim();
    var petName = (name || '').trim() || 'Pet profile';

    if (titleEl) {
      titleEl.textContent = petName;
    }

    if (!profileUrl) {
      setErrorVisible(true);
    } else {
      setErrorVisible(false);
      iframe.src = profileUrl;
    }

    prevBodyOverflow = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';

    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      dialog.setAttribute('open', '');
      dialog.classList.add('is-open');
    }

    if (closeBtn) {
      closeBtn.focus();
    }
  }

  window.MonroePetProfile = {
    open: open,
    close: close,
  };
})();
