/**
 * Humane Games Hub: PIN-Secured Client Coordinator & Arcade Launcher
 */
(function () {
  'use strict';

  var SESSION_KEY = 'monroeDexSession';
  var LEGACY_USER_KEY = 'monroeDexUser';
  var LEGACY_DISPLAY_KEY = 'monroeDexDisplay';

  function slugifyUsername(raw) {
    var display = String(raw || '').trim().replace(/\s+/g, ' ');
    if (display.length < 3 || display.length > 20) {
      return null;
    }
    var slug = display.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (slug.length < 3) {
      slug = display.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    }
    if (slug.length < 3 || slug.length > 20) {
      return null;
    }
    return { slug: slug, display: display };
  }

  function getStoredSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.slug && parsed.display) {
          return parsed;
        }
      }
      var legacySlug = localStorage.getItem(LEGACY_USER_KEY);
      var legacyDisplay = localStorage.getItem(LEGACY_DISPLAY_KEY) || legacySlug;
      if (legacySlug) {
        return { slug: legacySlug, display: legacyDisplay, unopened_packs: 0 };
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  function saveSession(session) {
    if (!session) {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(LEGACY_USER_KEY);
      localStorage.removeItem(LEGACY_DISPLAY_KEY);
      return;
    }
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      localStorage.setItem(LEGACY_USER_KEY, session.slug);
      localStorage.setItem(LEGACY_DISPLAY_KEY, session.display);
    } catch (err) {}
  }

  function initHumaneGamesLauncher(root) {
    if (!root || root.dataset.monroeHumaneGamesInit === '1') {
      return;
    }
    root.dataset.monroeHumaneGamesInit = '1';

    var config = window.monroeHumaneGames || {};
    var games = Array.isArray(config.games) ? config.games : [];
    var restBase = (config.restUrl || (window.location.origin + '/wp-json/monroe/v1/')).replace(/\/?$/, '/');
    var assetsBase = (config.assetsBase || '').replace(/\/?$/, '/');

    // DOM Elements - Views
    var authView = root.querySelector('[data-monroe-dex-auth-view]');
    var hubView = root.querySelector('[data-monroe-dex-hub-view]');

    // DOM Elements - Auth Form & PIN Pad
    var authCard = root.querySelector('[data-monroe-auth-card]');
    var usernameInput = root.querySelector('[data-monroe-dex-username]');
    var pinHiddenInput = root.querySelector('[data-monroe-pin-hidden]');
    var pinDots = root.querySelectorAll('[data-pin-index]');
    var pinPad = root.querySelector('[data-monroe-pin-pad]');
    var authSubmitBtn = root.querySelector('[data-monroe-auth-submit]');
    var authMessage = root.querySelector('[data-monroe-auth-message]');

    // DOM Elements - Hub View
    var playerNameEl = root.querySelector('[data-monroe-player-name]');
    var packCountEl = root.querySelector('[data-monroe-pack-count]');
    var openPacksPill = root.querySelector('[data-monroe-open-packs-pill]');
    var viewAlbumBtn = root.querySelector('[data-monroe-dex-view-album]');
    var copyLinkBtn = root.querySelector('[data-monroe-dex-copy-link]');
    var signoutBtn = root.querySelector('[data-monroe-dex-signout]');
    var toastEl = root.querySelector('[data-monroe-dex-toast]');

    // DOM Elements - Game Modal Player
    var player = document.querySelector('[data-monroe-humane-games-player]');
    var frame = player ? player.querySelector('[data-monroe-humane-games-frame]') : null;
    var playerTitle = player ? player.querySelector('[data-monroe-humane-games-player-title]') : null;
    var fullscreenBtn = player ? player.querySelector('[data-monroe-humane-games-fullscreen]') : null;
    var closeBtn = player ? player.querySelector('[data-monroe-humane-games-player-close]') : null;
    var loadingEl = player ? player.querySelector('[data-monroe-humane-games-loading]') : null;
    var errorEl = player ? player.querySelector('[data-monroe-humane-games-error]') : null;
    var restoreGameFocus = null;

    var gameMap = {};
    games.forEach(function (g) {
      gameMap[g.id] = g;
    });

    // Auth State
    var currentPin = '';
    var isSubmitting = false;
    var activeSession = getStoredSession();
    var mobileSaveDetails = root.querySelector('[data-mobile-save-details]');

    function syncMobileSaveDetails() {
      if (!mobileSaveDetails) return;
      mobileSaveDetails.open = true;
    }

    syncMobileSaveDetails();
    window.addEventListener('resize', syncMobileSaveDetails);

    function showToast(message) {
      if (!toastEl) return;
      toastEl.textContent = message;
      toastEl.hidden = false;
      window.clearTimeout(showToast._timer);
      showToast._timer = window.setTimeout(function () {
        toastEl.hidden = true;
      }, 3000);
    }

    function showAuthMessage(msg, isError) {
      if (!authMessage) return;
      if (!msg) {
        authMessage.hidden = true;
        authMessage.textContent = '';
        return;
      }
      authMessage.textContent = msg;
      authMessage.classList.toggle('auth-message--error', !!isError);
      authMessage.classList.toggle('auth-message--success', !isError);
      authMessage.hidden = false;
    }

    function shakeCard() {
      if (!authCard) return;
      authCard.classList.remove('is-shake');
      void authCard.offsetWidth; // Force reflow
      authCard.classList.add('is-shake');
      window.setTimeout(function () {
        authCard.classList.remove('is-shake');
      }, 600);
    }

    function updatePinDots() {
      pinDots.forEach(function (dot, index) {
        dot.classList.toggle('is-filled', index < currentPin.length);
      });
      if (pinHiddenInput) {
        pinHiddenInput.value = currentPin;
      }
    }

    function clearPin() {
      currentPin = '';
      updatePinDots();
    }

    function resetAuthForm() {
      clearPin();
      showAuthMessage('', false);
    }

    // On-screen Numpad Handlers
    if (pinPad) {
      pinPad.querySelectorAll('[data-key]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          var key = btn.getAttribute('data-key');
          if (key === 'clear') {
            clearPin();
          } else if (key === 'back') {
            if (currentPin.length > 0) {
              currentPin = currentPin.slice(0, -1);
              updatePinDots();
            }
          } else if (/^[0-9]$/.test(key)) {
            if (currentPin.length < 4) {
              currentPin += key;
              updatePinDots();
              if (currentPin.length === 4 && usernameInput && usernameInput.value.trim().length >= 3) {
                handleAuthSubmit();
              }
            }
          }
        });
      });
    }

    // Physical Keyboard PIN input listener
    if (pinHiddenInput) {
      pinHiddenInput.addEventListener('input', function () {
        var digits = pinHiddenInput.value.replace(/[^0-9]/g, '').slice(0, 4);
        currentPin = digits;
        updatePinDots();
        if (currentPin.length === 4 && usernameInput && usernameInput.value.trim().length >= 3) {
          handleAuthSubmit();
        }
      });
    }

    // Auth Submission Logic
    async function handleAuthSubmit() {
      if (isSubmitting) return;

      var rawUser = usernameInput ? usernameInput.value : '';
      var parsedUser = slugifyUsername(rawUser);

      if (!parsedUser) {
        showAuthMessage('Please enter a valid nickname (3-20 letters/numbers).', true);
        shakeCard();
        if (usernameInput) usernameInput.focus();
        return;
      }

      if (currentPin.length !== 4) {
        showAuthMessage('Please enter all 4 numbers for your PIN.', true);
        shakeCard();
        return;
      }

      isSubmitting = true;
      if (authSubmitBtn) {
        authSubmitBtn.disabled = true;
        authSubmitBtn.classList.add('is-loading');
      }
      showAuthMessage('Connecting to Arcade...', false);

      try {
        var res = await fetch(restBase + 'adoptedex/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            user: parsedUser.slug,
            pin: currentPin
          })
        });

        var data = await res.json();

        if (!res.ok || !data.ok) {
          var errText = (data && data.message) ? data.message : 'Something went wrong. Please check your nickname and PIN.';
          showAuthMessage(errText, true);
          shakeCard();
          clearPin();
          return;
        }

        // Success!
        activeSession = {
          slug: data.slug,
          display: data.display || parsedUser.display,
          unopened_packs: parseInt(data.unopened_packs || 0, 10),
          total_packs_opened: parseInt(data.total_packs_opened || 0, 10)
        };
        saveSession(activeSession);
        clearPin();
        showAuthMessage('', false);

        renderView();
        showToast(data.is_new ? '🎉 Welcome! 1 Free Booster Pack added to your album!' : '✨ Welcome back, ' + activeSession.display + '!');

      } catch (err) {
        showAuthMessage('Could not reach the game server. Please try again.', true);
        shakeCard();
      } finally {
        isSubmitting = false;
        if (authSubmitBtn) {
          authSubmitBtn.disabled = false;
          authSubmitBtn.classList.remove('is-loading');
        }
      }
    }

    if (authSubmitBtn) {
      authSubmitBtn.addEventListener('click', handleAuthSubmit);
    }

    if (usernameInput) {
      usernameInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (currentPin.length === 4) {
            handleAuthSubmit();
          } else if (pinHiddenInput) {
            pinHiddenInput.focus();
          }
        }
      });
    }

    // Refresh profile stats in background (e.g. after a game closes)
    async function refreshProfileStats() {
      if (!activeSession || !activeSession.slug) return;
      try {
        var res = await fetch(restBase + 'adoptedex/' + encodeURIComponent(activeSession.slug), {
          credentials: 'same-origin'
        });
        if (res.ok) {
          var data = await res.json();
          if (data && data.stats) {
            activeSession.unopened_packs = parseInt(data.stats.unopened_packs || 0, 10);
            activeSession.total_packs_opened = parseInt(data.stats.total_packs_opened || 0, 10);
            saveSession(activeSession);
            updateHubUi();
          }
        }
      } catch (e) {}
    }

    function hasBoosterPacks() {
      return !!(activeSession && Number(activeSession.unopened_packs || 0) > 0);
    }

    function updateGameAvailability() {
      var boosterAvailable = hasBoosterPacks();
      root.querySelectorAll('[data-monroe-humane-game]').forEach(function (btn) {
        var unavailable = btn.getAttribute('data-monroe-humane-game') === 'booster' && !boosterAvailable;
        btn.disabled = unavailable;
        btn.setAttribute('aria-disabled', unavailable ? 'true' : 'false');
        if (unavailable) {
          btn.setAttribute('title', 'No booster packs available');
        } else {
          btn.removeAttribute('title');
        }
      });
      if (openPacksPill) {
        openPacksPill.disabled = !boosterAvailable;
        openPacksPill.setAttribute('aria-disabled', boosterAvailable ? 'false' : 'true');
      }
    }

    function updateHubUi() {
      if (!activeSession) return;
      if (playerNameEl) {
        playerNameEl.textContent = activeSession.display;
      }
      if (packCountEl) {
        packCountEl.textContent = String(activeSession.unopened_packs || 0);
      }
      if (openPacksPill) {
        var count = activeSession.unopened_packs || 0;
        openPacksPill.classList.toggle('has-packs', count > 0);
      }
      updateGameAvailability();
    }

    function renderView() {
      if (activeSession && activeSession.slug) {
        if (authView) authView.hidden = true;
        if (hubView) {
          hubView.hidden = false;
          hubView.removeAttribute('data-guest');
        }
        updateHubUi();
      } else {
        if (authView) authView.hidden = false;
        if (hubView) {
          hubView.hidden = false;
          hubView.setAttribute('data-guest', 'true');
        }
        resetAuthForm();
        updateGameAvailability();
      }
    }

    // Open Packs Pill Click -> Launch Booster directly
    if (openPacksPill) {
      openPacksPill.addEventListener('click', function () {
        launchGame('booster');
      });
    }

    // View Album Action
    if (viewAlbumBtn) {
      viewAlbumBtn.addEventListener('click', function () {
        if (!activeSession || !activeSession.slug) {
          renderView();
          return;
        }
        var albumUrl = assetsBase + 'dex/album.html?embed=1'
          + '&dex_user=' + encodeURIComponent(activeSession.slug)
          + '&dex_display=' + encodeURIComponent(activeSession.display)
          + '&dex_api=' + encodeURIComponent(restBase);
        openGameFrame(albumUrl, activeSession.display + "'s Pet Album");
      });
    }

    // Share Link Action
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', function () {
        if (!activeSession || !activeSession.slug) return;
        var shareUrl = (config.gamesUrl || (window.location.origin + '/games/')) + '?album=' + encodeURIComponent(activeSession.slug);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(shareUrl).then(function () {
            showToast('🔗 Album share link copied to clipboard!');
          }).catch(function () {
            showToast(shareUrl);
          });
        } else {
          showToast(shareUrl);
        }
      });
    }

    // Sign Out Action
    if (signoutBtn) {
      signoutBtn.addEventListener('click', function () {
        saveSession(null);
        activeSession = null;
        if (usernameInput) usernameInput.value = '';
        clearPin();
        renderView();
        showToast('👋 Signed out of Humane Arcade.');
      });
    }

    // Launch Game Action
    function launchGame(gameId) {
      var game = gameMap[gameId];
      if (!game) return;

      if (gameId === 'booster' && !hasBoosterPacks()) {
        if (!activeSession) {
          showAuthMessage('Sign in to open booster packs.', true);
          if (usernameInput) usernameInput.focus();
        } else {
          showToast('No booster packs available yet. Play a game to earn one!');
        }
        updateGameAvailability();
        return;
      }

      var url = game.url;
      var slug = activeSession ? activeSession.slug : 'guest';
      var display = activeSession ? activeSession.display : 'Guest';

      if (game.needsDex) {
        url += (url.indexOf('?') >= 0 ? '&' : '?') + 'dex_user=' + encodeURIComponent(slug);
        url += '&dex_display=' + encodeURIComponent(display);
        url += '&dex_api=' + encodeURIComponent(restBase);
        url += '&pets_api=' + encodeURIComponent(restBase + 'pet-match-pets');
      } else {
        url += (url.indexOf('?') >= 0 ? '&' : '?') + 'user=' + encodeURIComponent(slug);
      }

      openGameFrame(url, game.title);
    }

    function openGameFrame(url, title) {
      if (!player || !frame) return;

      restoreGameFocus = document.activeElement;
      frame.src = url;
      frame.title = title || 'Humane Arcade game';
      if (playerTitle) playerTitle.textContent = title;
      if (loadingEl) loadingEl.hidden = false;
      if (errorEl) errorEl.hidden = true;
      player.classList.add('is-open');
      player.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      if (closeBtn) closeBtn.focus();
    }

    function closeGameFrame() {
      if (!player || !frame) return;

      player.classList.remove('is-open');
      player.setAttribute('aria-hidden', 'true');
      frame.src = 'about:blank';
      document.body.style.overflow = '';

      if (document.fullscreenElement) {
        document.exitFullscreen().catch(function () {});
      }

      if (restoreGameFocus && typeof restoreGameFocus.focus === 'function') {
        restoreGameFocus.focus();
        restoreGameFocus = null;
      }

      // Refresh pack inventory and discoveries on game modal close
      refreshProfileStats();
    }

    if (frame) {
      frame.addEventListener('load', function () {
        if (loadingEl) loadingEl.hidden = true;
      });
      frame.addEventListener('error', function () {
        if (loadingEl) loadingEl.hidden = true;
        if (errorEl) errorEl.hidden = false;
      });
    }

    // Attach click handlers to all game launch buttons
    root.querySelectorAll('[data-monroe-humane-game]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var gameId = btn.getAttribute('data-monroe-humane-game');
        if (gameId) {
          launchGame(gameId);
        }
      });
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', closeGameFrame);
    }

    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', function () {
        if (!document.fullscreenElement) {
          if (player.requestFullscreen) {
            player.requestFullscreen().catch(function () {});
          }
        } else {
          if (document.exitFullscreen) {
            document.exitFullscreen().catch(function () {});
          }
        }
      });
    }

    // Escape key closes player
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && player && player.classList.contains('is-open')) {
        closeGameFrame();
      }
    });

    // Auto-launch if ?game= or ?album= query param is present
    try {
      var params = new URLSearchParams(window.location.search);
      var gameParam = params.get('game');
      var albumParam = params.get('album');

      if (albumParam) {
        var albumUrl = assetsBase + 'dex/album.html?embed=1'
          + '&dex_user=' + encodeURIComponent(albumParam)
          + '&dex_api=' + encodeURIComponent(restBase);
        openGameFrame(albumUrl, albumParam + "'s Pet Album");
      } else if (gameParam && gameMap[gameParam]) {
        launchGame(gameParam);
      }
    } catch (e) {}

    // Initial view render
    renderView();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var root = document.querySelector('[data-monroe-humane-games-root]');
    if (root) {
      initHumaneGamesLauncher(root);
    }
  });

  window.monroeInitHumaneGames = initHumaneGamesLauncher;
})();

