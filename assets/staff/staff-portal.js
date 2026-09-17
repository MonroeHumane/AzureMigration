(function () {
  'use strict';

  var cfg = window.monroeContentHub;
  var logoutBtn = document.getElementById('monroe-staff-logout');
  var installBanner = document.getElementById('monroe-staff-install-banner');

  if (!cfg || typeof wp === 'undefined' || !wp.apiFetch) {
    return;
  }

  wp.apiFetch.use(function (options, next) {
    options.headers = Object.assign({}, options.headers || {}, {
      'X-WP-Nonce': cfg.nonce
    });
    return next(options);
  });

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !cfg.swUrl) {
      return;
    }
    navigator.serviceWorker.register(cfg.swUrl, { scope: '/staff/' }).then(function (reg) {
      reg.addEventListener('updatefound', function () {
        var worker = reg.installing;
        if (!worker) {
          return;
        }
        worker.addEventListener('statechange', function () {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner();
          }
        });
      });
      // Browsers only check for a new sw.js on their own schedule (often
      // tied to navigation and throttled to roughly once a day), which
      // left staff on stale cached CSS/JS for a full session after a
      // deploy. Ask explicitly on every load instead of waiting for that.
      reg.update();
    });
  }

  function showUpdateBanner() {
    if (!installBanner || installBanner.dataset.updateShown) {
      return;
    }
    installBanner.dataset.updateShown = '1';
    installBanner.hidden = false;
    installBanner.innerHTML =
      '<p>New version available. <button type="button" class="monroe-staff-install-banner__btn" id="monroe-staff-refresh">Refresh</button></p>';
    var refresh = document.getElementById('monroe-staff-refresh');
    if (refresh) {
      refresh.addEventListener('click', function () {
        window.location.reload();
      });
    }
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      wp.apiFetch({ path: '/monroe/v1/staff/logout', method: 'POST' })
        .then(function () {
          window.location.reload();
        })
        .catch(function () {
          window.location.reload();
        });
    });
  }

  registerServiceWorker();

  var navToggle = document.getElementById('monroe-staff-nav-toggle');
  var navBackdrop = document.getElementById('monroe-staff-nav-backdrop');

  function setNavOpen(open) {
    document.body.classList.toggle('monroe-staff-nav-open', open);
    if (navToggle) {
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
  }

  if (navToggle) {
    navToggle.addEventListener('click', function () {
      setNavOpen(!document.body.classList.contains('monroe-staff-nav-open'));
    });
  }

  if (navBackdrop) {
    navBackdrop.addEventListener('click', function () {
      setNavOpen(false);
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.body.classList.contains('monroe-staff-nav-open')) {
      setNavOpen(false);
    }
  });

  // content-hub.js rebuilds .mch-tabs on every render (tab switch), so this
  // listens on a stable ancestor instead of binding to the disposable tab
  // buttons themselves - closes the drawer once a section is chosen.
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('.mch-tab')) {
      setNavOpen(false);
    }
  });
})();
