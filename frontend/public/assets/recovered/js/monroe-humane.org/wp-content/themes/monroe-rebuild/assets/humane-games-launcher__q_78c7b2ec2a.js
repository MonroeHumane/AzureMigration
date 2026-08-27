(function () {
	'use strict';

	var STORAGE_KEY = 'monroeDexUser';
	var STORAGE_DISPLAY = 'monroeDexDisplay';
	var COOKIE_KEY = 'monroeDexUser';
	var LAST_GAME_KEY = 'monroeHumaneLastGame';

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

	function readCookie(name) {
		var match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
		return match ? decodeURIComponent(match[1]) : '';
	}

	function writeCookie(name, value, days) {
		var maxAge = days * 24 * 60 * 60;
		document.cookie = name + '=' + encodeURIComponent(value) + '; path=/; max-age=' + maxAge + '; SameSite=Lax';
	}

	function getStoredDex() {
		try {
			var slug = localStorage.getItem(STORAGE_KEY) || readCookie(COOKIE_KEY);
			var display = localStorage.getItem(STORAGE_DISPLAY) || slug;
			if (!slug) {
				return null;
			}
			return { slug: slug, display: display || slug };
		} catch (err) {
			return null;
		}
	}

	function saveDexUser(parsed, remember) {
		if (!parsed) {
			return;
		}
		try {
			if (remember) {
				localStorage.setItem(STORAGE_KEY, parsed.slug);
				localStorage.setItem(STORAGE_DISPLAY, parsed.display);
				writeCookie(COOKIE_KEY, parsed.slug, 365);
			} else {
				localStorage.removeItem(STORAGE_KEY);
				localStorage.removeItem(STORAGE_DISPLAY);
				writeCookie(COOKIE_KEY, '', -1);
			}
		} catch (err) {
			// ignore
		}
	}

	function initHumaneGamesLauncher(root) {
		if (!root || root.dataset.monroeHumaneGamesInit === '1') {
			return;
		}
		root.dataset.monroeHumaneGamesInit = '1';

		var config = window.monroeHumaneGames || {};
		var games = Array.isArray(config.games) ? config.games : [];
		var i18n = config.i18n || {};
		var player = document.querySelector('[data-monroe-humane-games-player]');
		var about = document.querySelector('[data-monroe-humane-games-about]');
		var frame = player ? player.querySelector('[data-monroe-humane-games-frame]') : null;
		var playerTitle = player ? player.querySelector('[data-monroe-humane-games-player-title]') : null;
		var restoreFocus = null;
		var currentGameId = '';
		var activeFilter = 'all';

		var usernameInput = root.querySelector('[data-monroe-dex-username]');
		var validationEl = root.querySelector('[data-monroe-dex-validation]');
		var rememberCheckbox = root.querySelector('[data-monroe-dex-remember]');
		var viewAlbumBtn = root.querySelector('[data-monroe-dex-view-album]');
		var copyLinkBtn = root.querySelector('[data-monroe-dex-copy-link]');
		var recommendedBtn = root.querySelector('[data-monroe-humane-games-recommended]');
		var resumeBtn = root.querySelector('[data-monroe-humane-games-resume]');
		var aiPlayerBtn = root.querySelector('[data-monroe-humane-games-ai-player]');
		var aiPlayerOverlay = document.querySelector('[data-monroe-humane-games-ai-player]');
		var aiPlayerList = aiPlayerOverlay ? aiPlayerOverlay.querySelector('[data-monroe-humane-games-ai-player-list]') : null;
		var aiPlayerHint = aiPlayerOverlay ? aiPlayerOverlay.querySelector('[data-monroe-humane-games-ai-player-hint]') : null;
		var aiPlayerRestoreFocus = null;
		var privacyEl = root.querySelector('[data-monroe-dex-privacy]');
		var toastEl = root.querySelector('[data-monroe-dex-toast]');
		var gameMap = {};
		games.forEach(function (g) {
			gameMap[g.id] = g;
		});

		function track(eventName, props) {
			var payload = Object.assign({ event: eventName, source: 'games-launcher' }, props || {});
			if (window.dataLayer && Array.isArray(window.dataLayer)) {
				window.dataLayer.push(payload);
			}
			window.dispatchEvent(new CustomEvent('monroe-humane-games-analytics', { detail: payload }));
		}

		if (privacyEl && i18n.privacyNote) {
			privacyEl.textContent = i18n.privacyNote;
		}

		var currentDex = getStoredDex();
		if (currentDex && usernameInput) {
			usernameInput.value = currentDex.display;
		}

		function showToast(message) {
			if (!toastEl) {
				return;
			}
			toastEl.textContent = message;
			toastEl.hidden = false;
			window.clearTimeout(showToast._timer);
			showToast._timer = window.setTimeout(function () {
				toastEl.hidden = true;
			}, 2400);
		}

		function getUsernameFromInput() {
			if (!usernameInput) {
				return null;
			}
			return slugifyUsername(usernameInput.value);
		}

		function matchesFilter(game) {
			if (!game) return false;
			if (activeFilter === 'no-dex') return !game.needsDex;
			if (activeFilter === 'saves') return String(game.badge || '').toLowerCase().indexOf('save') >= 0;
			return true;
		}

		function applyFilter() {
			root.querySelectorAll('.monroe-humane-games__grid-item').forEach(function (item) {
				var btn = item.querySelector('[data-monroe-humane-game]');
				if (!btn) return;
				var id = btn.getAttribute('data-monroe-humane-game');
				var game = gameMap[id];
				item.hidden = !matchesFilter(game);
			});
		}

		function getRecommendedGame(parsed) {
			return gameMap.match || games[0];
		}

		function updateTopActions(parsed) {
			var recommended = getRecommendedGame(parsed);
			if (recommendedBtn && recommended) {
				recommendedBtn.textContent = 'Play recommended: ' + (recommended.shortTitle || recommended.title);
				recommendedBtn.setAttribute('data-target-game', recommended.id);
			}
			if (resumeBtn) {
				var lastGame = localStorage.getItem(LAST_GAME_KEY);
				var exists = !!(lastGame && gameMap[lastGame]);
				resumeBtn.hidden = !exists;
				if (exists) {
					resumeBtn.textContent = 'Resume: ' + (gameMap[lastGame].shortTitle || gameMap[lastGame].title);
					resumeBtn.setAttribute('data-target-game', lastGame);
				}
			}
		}

		function setValidationMessage(parsed, blockedReason) {
			if (!validationEl) return;
			if (blockedReason) {
				validationEl.textContent = blockedReason;
				validationEl.classList.add('is-error');
				return;
			}
			if (parsed) {
				validationEl.textContent = i18n.nicknameValid || 'Nickname looks good. Dex-enabled games are unlocked.';
				validationEl.classList.remove('is-error');
				return;
			}
			validationEl.textContent = i18n.nicknameHelp || 'Use 3–20 letters or numbers.';
			validationEl.classList.remove('is-error');
		}

		function updateDexControls() {
			var parsed = getUsernameFromInput();
			var enabled = !!parsed;
			setValidationMessage(parsed);
			if (viewAlbumBtn) {
				viewAlbumBtn.disabled = !enabled;
			}
			if (copyLinkBtn) {
				copyLinkBtn.disabled = !enabled;
			}
			root.querySelectorAll('[data-monroe-humane-game]').forEach(function (btn) {
				var gameId = btn.getAttribute('data-monroe-humane-game');
				var game = gameMap[gameId];
				var needsDex = !!(game && game.needsDex) || btn.hasAttribute('data-needs-dex');
				if (needsDex) {
					btn.disabled = !enabled;
					btn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
					btn.classList.toggle('is-needs-nickname', !enabled);
					var lockEl = btn.querySelector('[data-monroe-dex-lock]');
					if (lockEl) {
						lockEl.hidden = enabled;
						if (i18n.nicknameRequiredShort) {
							lockEl.textContent = i18n.nicknameRequiredShort;
						}
					}
				}
			});
			if (parsed && rememberCheckbox && rememberCheckbox.checked) {
				saveDexUser(parsed, true);
			}
			currentDex = parsed;
			updateTopActions(parsed);
			track('nickname_state', { isValid: !!parsed });
		}

		if (usernameInput) {
			usernameInput.addEventListener('input', updateDexControls);
			usernameInput.addEventListener('change', updateDexControls);
		}
		if (rememberCheckbox) {
			rememberCheckbox.addEventListener('change', updateDexControls);
		}
		updateDexControls();

		function shareAlbumUrl(slug) {
			var base = config.gamesUrl || (window.location.origin + '/games/');
			var url = new URL(base, window.location.origin);
			url.searchParams.set('album', slug);
			return url.toString();
		}

		function appendDexParams(url, parsed) {
			if (!url || !parsed) {
				return url;
			}
			var sep = url.indexOf('?') >= 0 ? '&' : '?';
			var out = url + sep + 'dex_user=' + encodeURIComponent(parsed.slug) + '&dex_display=' + encodeURIComponent(parsed.display);
			if (config.restUrl) {
				out += '&dex_api=' + encodeURIComponent(config.restUrl);
			}
			return out;
		}

		function trapFocus(panel, event) {
			var focusable = panel.querySelectorAll(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);
			if (!focusable.length) {
				return;
			}
			var first = focusable[0];
			var last = focusable[focusable.length - 1];
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		}

		function bindOverlay(overlay, openSelector, closeSelector, bodyClass) {
			if (!overlay) {
				return { open: function () {}, close: function () {} };
			}

			var panel = overlay.querySelector('[role="dialog"]') || overlay;
			var openers = document.querySelectorAll(openSelector);
			var closers = overlay.querySelectorAll(closeSelector);
			var localRestore = null;

			function onKeydown(event) {
				if (event.key === 'Escape') {
					event.preventDefault();
					close();
					return;
				}
				if (event.key === 'Tab') {
					trapFocus(panel, event);
				}
			}

			function close() {
				if (!overlay.classList.contains('is-active')) {
					return;
				}
				overlay.classList.remove('is-active');
				overlay.setAttribute('aria-hidden', 'true');
				document.body.classList.remove(bodyClass);
				overlay.removeEventListener('keydown', onKeydown);
				if (localRestore) {
					localRestore.focus();
					localRestore = null;
				}
			}

			function open(event) {
				if (event) {
					event.preventDefault();
				}
				localRestore = document.activeElement;
				overlay.classList.add('is-active');
				overlay.setAttribute('aria-hidden', 'false');
				document.body.classList.add(bodyClass);
				var focusTarget = overlay.querySelector('button') || panel;
				if (focusTarget) {
					focusTarget.focus();
				}
				overlay.addEventListener('keydown', onKeydown);
			}

			openers.forEach(function (btn) {
				btn.addEventListener('click', open);
			});
			closers.forEach(function (btn) {
				btn.addEventListener('click', close);
			});
			overlay.addEventListener('click', function (event) {
				if (event.target === overlay) {
					close();
				}
			});

			return { open: open, close: close };
		}

		var aboutOverlay = bindOverlay(
			about,
			'[data-monroe-humane-games-about-open]',
			'[data-monroe-humane-games-about-close]',
			'monroe-humane-games-about-open'
		);

		function closePlayer(reason) {
			if (!player) {
				return;
			}
			player.classList.remove('is-active', 'is-opening', 'is-loading', 'monroe-humane-games-player--clicker', 'monroe-humane-games-player--adventure');
			player.setAttribute('aria-hidden', 'true');
			document.body.classList.remove('monroe-humane-games-player-open');
			if (frame) {
				frame.removeEventListener('load', onFrameLoaded);
				frame.removeAttribute('src');
				frame.removeAttribute('title');
			}
			player.removeEventListener('keydown', onPlayerKeydown);
			if (restoreFocus) {
				restoreFocus.focus();
				restoreFocus = null;
			}
			track('overlay_close', { gameId: currentGameId || null, reason: reason || 'ui' });
		}

		function onPlayerKeydown(event) {
			if (event.key === 'Escape') {
				event.preventDefault();
				closePlayer('escape');
				return;
			}
			if (event.key === 'Tab') {
				trapFocus(player, event);
			}
		}

		function onFrameLoaded() {
			if (player) {
				player.classList.remove('is-loading');
				track('iframe_loaded', { gameId: currentGameId || null });
			}
		}

		function openFrameUrl(title, url) {
			if (!player || !frame || !url) {
				return;
			}

			if (about && about.classList.contains('is-active')) {
				aboutOverlay.close();
			}

			restoreFocus = document.activeElement;
			if (playerTitle) {
				playerTitle.textContent = title || '';
			}
			frame.setAttribute('title', title || 'Humane Game');
			var launchUrl = url;
			frame.setAttribute('src', launchUrl);
			frame.addEventListener('load', onFrameLoaded, { once: true });

			player.classList.remove('monroe-humane-games-player--clicker', 'monroe-humane-games-player--adventure');
			if (launchUrl.indexOf('shelter-tycoon-main') >= 0) {
				player.classList.add('monroe-humane-games-player--clicker');
			} else if (launchUrl.indexOf('petsnakerouguelike') >= 0) {
				player.classList.add('monroe-humane-games-player--adventure');
			}

			player.classList.add('is-opening');
			player.classList.add('is-loading');
			player.setAttribute('aria-hidden', 'false');
			document.body.classList.add('monroe-humane-games-player-open');
			player.addEventListener('keydown', onPlayerKeydown);

			window.requestAnimationFrame(function () {
				player.classList.add('is-active');
				player.classList.remove('is-opening');
			});

			var closeBtn = player.querySelector('[data-monroe-humane-games-player-close]');
			if (closeBtn) {
				closeBtn.focus();
			}
			track('game_launch', { gameId: currentGameId || null });
		}

		function openAiPlayer(gameId) {
			var parsed = getUsernameFromInput();
			var game = gameMap[gameId];
			if (!game || !game.url) {
				return;
			}
			if (game.needsDex && !parsed) {
				showToast(i18n.usernameRequired || 'Choose a nickname first.');
				setValidationMessage(parsed, i18n.usernameRequired || 'Choose a nickname first.');
				track('blocked_launch', { gameId: gameId, reason: 'nickname_required', mode: 'ai_player' });
				if (usernameInput) {
					usernameInput.focus();
				}
				return;
			}
			var url = game.url;
			if (parsed) {
				url = appendDexParams(url, parsed);
			}
			try {
				var aiUrl = new URL(url, window.location.origin);
				aiUrl.searchParams.set('bot', '1');
				url = aiUrl.toString();
			} catch (e) { /* keep url */ }
			currentGameId = gameId;
			localStorage.setItem(LAST_GAME_KEY, gameId);
			updateTopActions(parsed);
			openFrameUrl((game.title || '') + ' (AI player)', url);
			track('game_launch', { gameId: gameId, mode: 'ai_player' });
		}

		function getAiPlayerGames() {
			return games.filter(function (g) {
				return g.aiPlayerSupported && g.url;
			});
		}

		function closeAiPlayerPicker() {
			if (!aiPlayerOverlay) {
				return;
			}
			aiPlayerOverlay.classList.remove('is-active');
			aiPlayerOverlay.setAttribute('aria-hidden', 'true');
			document.body.classList.remove('monroe-humane-games-ai-player-open');
			if (aiPlayerRestoreFocus && typeof aiPlayerRestoreFocus.focus === 'function') {
				aiPlayerRestoreFocus.focus();
			}
			aiPlayerRestoreFocus = null;
		}

		function openAiPlayerPicker() {
			var compatible = getAiPlayerGames();
			if (!compatible.length) {
				showToast(i18n.aiPlayerNone || 'No AI player games are available right now.');
				return;
			}
			if (compatible.length === 1) {
				openAiPlayer(compatible[0].id);
				return;
			}
			if (!aiPlayerOverlay || !aiPlayerList) {
				openAiPlayer(compatible[0].id);
				return;
			}
			aiPlayerList.innerHTML = '';
			compatible.forEach(function (game) {
				var title = game.shortTitle || game.title || game.id;
				var item = document.createElement('li');
				var btn = document.createElement('button');
				btn.type = 'button';
				btn.className = 'monroe-humane-games-ai-player__option';
				btn.setAttribute('data-monroe-humane-games-ai-player-game', game.id);
				btn.innerHTML =
					'<span class="monroe-humane-games-ai-player__option-icon" aria-hidden="true">' + (game.icon || '🎮') + '</span>' +
					'<span class="monroe-humane-games-ai-player__option-body">' +
						'<span class="monroe-humane-games-ai-player__option-title">' + title + '</span>' +
						'<span class="monroe-humane-games-ai-player__option-desc">' + (game.description || '') + '</span>' +
					'</span>' +
					'<span class="monroe-humane-games-ai-player__option-action" aria-hidden="true">' + (i18n.aiPlayerLaunch || 'Start AI preview') + ' ›</span>';
				btn.addEventListener('click', function () {
					closeAiPlayerPicker();
					openAiPlayer(game.id);
				});
				item.appendChild(btn);
				aiPlayerList.appendChild(item);
			});
			if (aiPlayerHint && i18n.aiPlayerHint) {
				aiPlayerHint.textContent = i18n.aiPlayerHint;
			}
			aiPlayerRestoreFocus = document.activeElement;
			aiPlayerOverlay.classList.add('is-active');
			aiPlayerOverlay.setAttribute('aria-hidden', 'false');
			document.body.classList.add('monroe-humane-games-ai-player-open');
			var firstOption = aiPlayerList.querySelector('button');
			if (firstOption) {
				firstOption.focus();
			}
			track('ai_player_picker_open', { gameCount: compatible.length });
		}

		function openPlayer(gameId) {
			var parsed = getUsernameFromInput();
			var game = gameMap[gameId];
			if (!game || !game.url) {
				return;
			}
			if (game.needsDex && !parsed) {
				showToast(i18n.usernameRequired || 'Choose a nickname first.');
				setValidationMessage(parsed, i18n.usernameRequired || 'Choose a nickname first.');
				track('blocked_launch', { gameId: gameId, reason: 'nickname_required' });
				if (usernameInput) {
					usernameInput.focus();
				}
				return;
			}
			var url = game.url;
			if (parsed) {
				url = appendDexParams(url, parsed);
			} else if (game.needsDex) {
				showToast(i18n.usernameRequired || 'Choose a nickname first.');
				setValidationMessage(parsed, i18n.usernameRequired || 'Choose a nickname first.');
				track('blocked_launch', { gameId: gameId, reason: 'nickname_required' });
				if (usernameInput) {
					usernameInput.focus();
				}
				return;
			}
			currentGameId = gameId;
			localStorage.setItem(LAST_GAME_KEY, gameId);
			updateTopActions(parsed);
			openFrameUrl(game.title || '', url);
		}

		window.addEventListener('message', function (event) {
			if (event.origin !== window.location.origin || !event.data) {
				return;
			}
			if (event.data.type === 'monroe-shelter-need-dex') {
				showToast(i18n.usernameRequired || 'Choose your Adoptédex nickname above, then launch the game again.');
				if (usernameInput) {
					usernameInput.focus();
				}
				closePlayer();
				return;
			}
			if (event.data.type !== 'monroe-humane-games-open') {
				return;
			}
			var gameId = String(event.data.gameId || '');
			if (!gameId) {
				return;
			}
			openPlayer(gameId);
		});

		function openAlbum() {
			var parsed = getUsernameFromInput();
			if (!parsed) {
				showToast(i18n.usernameRequired || 'Choose a nickname first.');
				return;
			}
			var albumPath = config.albumPath || 'dex/album.html?embed=1&v=1';
			var base = config.assetsBase || '';
			var url = appendDexParams(base + albumPath, parsed);
			openFrameUrl((parsed.display || parsed.slug) + '\u2019s Adopt\u00e9dex', url);
		}

		root.querySelectorAll('[data-monroe-humane-game]').forEach(function (trigger) {
			trigger.addEventListener('click', function () {
				openPlayer(trigger.getAttribute('data-monroe-humane-game'));
			});
		});

		if (aiPlayerBtn) {
			aiPlayerBtn.addEventListener('click', openAiPlayerPicker);
		}

		if (aiPlayerOverlay) {
			aiPlayerOverlay.querySelectorAll('[data-monroe-humane-games-ai-player-close]').forEach(function (btn) {
				btn.addEventListener('click', closeAiPlayerPicker);
			});
			aiPlayerOverlay.addEventListener('click', function (event) {
				if (event.target === aiPlayerOverlay) {
					closeAiPlayerPicker();
				}
			});
			aiPlayerOverlay.addEventListener('keydown', function (event) {
				if (event.key === 'Escape') {
					event.preventDefault();
					closeAiPlayerPicker();
				}
			});
		}

		if (viewAlbumBtn) {
			viewAlbumBtn.addEventListener('click', openAlbum);
		}

		root.querySelectorAll('[data-monroe-humane-games-filter]').forEach(function (btn) {
			btn.addEventListener('click', function () {
				activeFilter = btn.getAttribute('data-monroe-humane-games-filter') || 'all';
				root.querySelectorAll('[data-monroe-humane-games-filter]').forEach(function (other) {
					other.classList.toggle('is-active', other === btn);
				});
				applyFilter();
				track('filter_change', { filter: activeFilter });
			});
		});

		if (recommendedBtn) {
			recommendedBtn.addEventListener('click', function () {
				var gameId = recommendedBtn.getAttribute('data-target-game');
				if (gameId) openPlayer(gameId);
			});
		}
		if (resumeBtn) {
			resumeBtn.addEventListener('click', function () {
				var gameId = resumeBtn.getAttribute('data-target-game');
				if (gameId) openPlayer(gameId);
			});
		}

		if (copyLinkBtn) {
			copyLinkBtn.addEventListener('click', function () {
				var parsed = getUsernameFromInput();
				if (!parsed) {
					return;
				}
				var link = shareAlbumUrl(parsed.slug);
				if (navigator.clipboard && navigator.clipboard.writeText) {
					navigator.clipboard.writeText(link).then(function () {
						showToast(i18n.linkCopied || 'Link copied!');
					});
				} else {
					window.prompt('Copy this link:', link);
				}
			});
		}

		if (player) {
			player.querySelectorAll('[data-monroe-humane-games-player-close]').forEach(function (btn) {
				btn.addEventListener('click', function () { closePlayer('button'); });
			});
		}

		var params = new URLSearchParams(window.location.search);
		var albumParam = params.get('album');
		if (albumParam && usernameInput) {
			var albumParsed = slugifyUsername(albumParam) || { slug: albumParam.toLowerCase(), display: albumParam };
			if (albumParsed) {
				usernameInput.value = albumParsed.display;
				updateDexControls();
				window.setTimeout(openAlbum, 400);
			}
		}
		applyFilter();
		updateTopActions(getUsernameFromInput());
		if (aiPlayerBtn && !getAiPlayerGames().length) {
			aiPlayerBtn.hidden = true;
		}
		track('launcher_view', { gamesCount: games.length });
	}

	document.addEventListener('DOMContentLoaded', function () {
		var root = document.querySelector('[data-monroe-humane-games-root]');
		if (root) {
			initHumaneGamesLauncher(root);
		}
	});
})();
