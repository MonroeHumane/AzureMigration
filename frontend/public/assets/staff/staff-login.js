(function () {
  'use strict';

  var cfg = window.monroeStaffPortal;
  var root = document.getElementById('monroe-staff-login');
  if (!root || !cfg || typeof wp === 'undefined' || !wp.apiFetch) {
    return;
  }

  wp.apiFetch.use(function (options, next) {
    options.headers = Object.assign({}, options.headers || {}, {
      'X-WP-Nonce': cfg.nonce
    });
    return next(options);
  });

  var BRAND_MARK_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7.5-4.6-10-9.3C.5 8 2.3 4.5 5.8 4c2-.3 3.8.6 5 2.2C12 4.6 13.8 3.7 15.8 4c3.5.5 5.3 4 3.8 7.7C17 16.4 12 21 12 21z"/></svg>';

  var EYE_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.66 19.66 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a19.66 19.66 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>';

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !cfg.swUrl) {
      return;
    }
    navigator.serviceWorker.register(cfg.swUrl, { scope: '/staff/' }).catch(function () {
      /* optional */
    });
  }

  function renderLoading() {
    root.innerHTML =
      '<div class="monroe-staff-login__card monroe-staff-login__card--loading" aria-busy="true">' +
      '<div class="monroe-staff-login__mark" aria-hidden="true">' +
      BRAND_MARK_SVG +
      '</div>' +
      '<p class="monroe-staff-login__loading">Loading…</p>' +
      '</div>';
  }

  function bindRevealToggle() {
    var toggle = document.getElementById('monroe-staff-pin-reveal');
    var input = document.getElementById('monroe-staff-pin');
    if (!toggle || !input || toggle.dataset.bound === '1') {
      return;
    }
    toggle.dataset.bound = '1';
    toggle.addEventListener('click', function () {
      var showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      toggle.innerHTML = showing ? EYE_SVG : EYE_OFF_SVG;
      toggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
      input.focus();
    });
  }

  function bindLoginForm(form) {
    if (!form || form.dataset.bound === '1') {
      return;
    }
    form.dataset.bound = '1';
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = document.getElementById('monroe-staff-pin');
      var pin = input ? input.value : '';
      var submitBtn = form.querySelector('.monroe-staff-login__submit');
      if (submitBtn) {
        submitBtn.disabled = true;
      }
      wp.apiFetch({
        path: '/monroe/v1/staff/login',
        method: 'POST',
        data: { pin: pin }
      })
        .then(function () {
          window.location.reload();
        })
        .catch(function (err) {
          var i18n = cfg.i18n || {};
          var msg = i18n.loginError || 'Invalid password.';
          if (err && err.code === 'staff_locked') {
            msg = i18n.loginLocked || msg;
          } else if (err && err.code === 'staff_not_configured') {
            msg = i18n.loginNotConfigured || msg;
          }
          showLoginError(msg);
          if (submitBtn) {
            submitBtn.disabled = false;
          }
          if (input) {
            input.focus();
            input.select();
          }
        });
    });
  }

  function showLoginError(message) {
    var msgEl = document.getElementById('monroe-staff-login-message');
    if (!msgEl) {
      return;
    }
    msgEl.textContent = message;
    msgEl.hidden = false;
    msgEl.classList.add('is-error');
    var input = document.getElementById('monroe-staff-pin');
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', 'monroe-staff-login-message');
    }
  }

  function renderForm(message, isError) {
    var i18n = cfg.i18n || {};
    var form = document.getElementById('monroe-staff-login-form');
    if (!form) {
      root.innerHTML =
        '<div class="monroe-staff-login__card">' +
        '<div class="monroe-staff-login__mark" aria-hidden="true">' +
        BRAND_MARK_SVG +
        '</div>' +
        '<p class="monroe-staff-login__eyebrow">' +
        esc('Humane Society of Monroe County') +
        '</p>' +
        '<h1 class="monroe-staff-login__title">' +
        esc(i18n.loginTitle || 'Staff access') +
        '</h1>' +
        '<p class="monroe-staff-login__hint">' +
        esc(i18n.loginHint || '') +
        '</p>' +
        '<p class="monroe-staff-login__message' +
        (isError ? ' is-error' : '') +
        '" id="monroe-staff-login-message"' +
        (message ? '' : ' hidden') +
        ' role="alert">' +
        esc(message || '') +
        '</p>' +
        '<form class="monroe-staff-login__form" id="monroe-staff-login-form">' +
        '<label class="monroe-staff-login__label" for="monroe-staff-pin">' +
        esc(i18n.loginPinLabel || 'Password') +
        '</label>' +
        '<div class="monroe-staff-login__input-row">' +
        '<input class="monroe-staff-login__input" id="monroe-staff-pin" name="pin" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" autofocus required />' +
        '<button type="button" class="monroe-staff-login__reveal" id="monroe-staff-pin-reveal" aria-label="Show password">' +
        EYE_SVG +
        '</button>' +
        '</div>' +
        '<button type="submit" class="monroe-staff-login__submit">' +
        esc(i18n.loginSubmit || 'Continue') +
        '</button>' +
        '</form></div>';
      bindLoginForm(document.getElementById('monroe-staff-login-form'));
      bindRevealToggle();
      var newInput = document.getElementById('monroe-staff-pin');
      if (newInput) {
        newInput.focus();
      }
      return;
    }

    var card = root.querySelector('.monroe-staff-login__card');
    if (card) {
      card.classList.remove('monroe-staff-login__card--loading');
      card.removeAttribute('aria-busy');
    }
    var msgEl = document.getElementById('monroe-staff-login-message');
    if (msgEl) {
      if (message) {
        msgEl.textContent = message;
        msgEl.hidden = false;
        msgEl.classList.toggle('is-error', !!isError);
      } else {
        msgEl.hidden = true;
        msgEl.textContent = '';
        msgEl.classList.remove('is-error');
      }
    }
    bindLoginForm(document.getElementById('monroe-staff-login-form'));
  }

  registerServiceWorker();
  renderLoading();

  wp.apiFetch({ path: '/monroe/v1/staff/session' })
    .then(function (session) {
      if (session && session.authenticated) {
        window.location.reload();
        return;
      }
      if (session && session.configured === false) {
        renderForm(cfg.i18n.loginNotConfigured, true);
        return;
      }
      renderForm('', false);
    })
    .catch(function () {
      renderForm('', false);
    });
})();
