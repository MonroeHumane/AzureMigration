(function (global) {
	'use strict';

	var PLACEHOLDER_SVG = 'data:image/svg+xml,' + encodeURIComponent(
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="#0a2922" width="100" height="100" rx="14"/><rect x="4" y="4" width="92" height="92" rx="10" stroke="#ffb347" stroke-width="2" fill="none"/><circle cx="50" cy="50" r="38" stroke="#007a3d" stroke-width="2" stroke-dasharray="40 4 20 4 50 6" fill="#fdfbf7"/><g transform="translate(50, 52)"><g transform="translate(-18, -13) rotate(-24)"><ellipse cx="0" cy="0" rx="5" ry="8.5" fill="#007a3d"/><g stroke="#ffffff" stroke-width="1"><line x1="-3" y1="-4" x2="3" y2="-1"/><line x1="-3.5" y1="0" x2="3.5" y2="3"/></g></g><g transform="translate(-6, -21) rotate(-8)"><ellipse cx="0" cy="0" rx="5.5" ry="9.5" fill="#007a3d"/><g stroke="#ffffff" stroke-width="1"><line x1="-3.5" y1="-5" x2="3.5" y2="-2"/><line x1="-4" y1="-1" x2="4" y2="2"/><line x1="-3.5" y1="3" x2="3.5" y2="6"/></g></g><g transform="translate(8, -20) rotate(10)"><ellipse cx="0" cy="0" rx="5.5" ry="9.5" fill="#007a3d"/><g stroke="#ffffff" stroke-width="1"><line x1="-3.5" y1="-5" x2="3.5" y2="-2"/><line x1="-4" y1="-1" x2="4" y2="2"/><line x1="-3.5" y1="3" x2="3.5" y2="6"/></g></g><g transform="translate(19, -10) rotate(26)"><ellipse cx="0" cy="0" rx="4.5" ry="8" fill="#007a3d"/><g stroke="#ffffff" stroke-width="1"><line x1="-3" y1="-4" x2="3" y2="-1"/><line x1="-3" y1="0" x2="3" y2="3"/></g></g><g transform="translate(0, 9)"><path d="M -13,4 C -14,-2 -9,-8 0,-8 C 9,-8 14,-2 13,4 C 11,11 6,15 0,15 C -6,15 -11,11 -13,4 Z" fill="#007a3d"/><g stroke="#ffffff" stroke-width="1.1"><line x1="-9" y1="-4" x2="7" y2="-1"/><line x1="-10" y1="-1" x2="9" y2="2"/><line x1="-9" y1="3" x2="7" y2="6"/><line x1="-7" y1="7" x2="5" y2="10"/></g></g></g></svg>'
	);

	function getParams() {
		var params = new URLSearchParams(window.location.search);
		var user = params.get('dex_user') || params.get('user') || params.get('album');
		if (!user) {
			try {
				user = localStorage.getItem('monroeDexUser') || '';
			} catch (e) {}
		}

		var display = params.get('dex_display') || params.get('display');
		if (!display) {
			try {
				display = localStorage.getItem('monroeDexDisplay') || '';
			} catch (e) {}
		}

		if (!user) {
			user = 'guest';
		}

		var guestDefault = !display || display === 'Guest Rescuer';
		if (guestDefault) {
			var fallbackDisplay = '';
			try {
				fallbackDisplay = (localStorage.getItem('monroeDexUser') || '').trim();
			} catch (e) {}
			if (!fallbackDisplay && user && String(user).toLowerCase() !== 'guest') {
				fallbackDisplay = String(user).trim();
			}
			display = fallbackDisplay || display || 'Guest Rescuer';
		}

		var defaultApi = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
			? 'https://mchs-arcade-api.livelyfield-d0a70609.eastus.azurecontainerapps.io/arcade-api/v1/'
			: (window.location.origin + '/arcade-api/v1/');
		var api = params.get('dex_api') || params.get('api') || defaultApi;

		return {
			dexUser: String(user || '').trim().toLowerCase(),
			dexDisplay: String(display || '').trim(),
			dexApi: String(api || '').replace(/\/?$/, '/'),
		};
	}

	function apiUrl(base, path) {
		if (!base) {
			return path;
		}
		return base + path.replace(/^\//, '');
	}

	var arcadeSessionPromise = null;

	function ensureArcadeSession(base) {
		if (arcadeSessionPromise) {
			return arcadeSessionPromise;
		}
		arcadeSessionPromise = fetch(apiUrl(base, 'session/anonymous'), {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/json' },
			body: '{}',
		}).then(function (res) {
			if (!res.ok) {
				arcadeSessionPromise = null;
			}
			return res;
		}).catch(function (err) {
			arcadeSessionPromise = null;
			throw err;
		});
		return arcadeSessionPromise;
	}

	function fetchDex(base, user) {
		return fetch(apiUrl(base, 'adoptedex/' + encodeURIComponent(user)), { credentials: 'same-origin' })
			.then(function (res) {
				if (!res.ok) {
					throw new Error('Could not load Adoptédex.');
				}
				return res.json();
			});
	}

	function discoverPet(base, user, petId, source) {
		return ensureArcadeSession(base).then(function () {
			return fetch(apiUrl(base, 'adoptedex/' + encodeURIComponent(user) + '/discover'), {
				method: 'POST',
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pet_id: petId, source: source || 'dex' }),
			});
		}).then(function (res) {
			if (!res.ok) {
				throw new Error('Could not save discovery.');
			}
			return res.json();
		}).then(function (data) {
			if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
				try {
					window.parent.postMessage({ type: 'adoptedex:pet_discovered', pet_id: petId }, '*');
				} catch (e) {}
			}
			return data;
		});
	}

	function discoverBulk(base, user, petIds, source) {
		return ensureArcadeSession(base).then(function () {
			return fetch(apiUrl(base, 'adoptedex/' + encodeURIComponent(user) + '/discover/bulk'), {
				method: 'POST',
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pet_ids: petIds, source: source || 'match' }),
			});
		}).then(function (res) {
			if (!res.ok) {
				throw new Error('Could not save discoveries.');
			}
			return res.json();
		}).then(function (data) {
			if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
				try {
					window.parent.postMessage({ type: 'adoptedex:pet_discovered', pet_ids: petIds }, '*');
				} catch (e) {}
			}
			return data;
		});
	}

	/**
	 * Generic one-time reward claim, shared by every game instead of each
	 * one hand-rolling its own "have I already given this player X" check.
	 * The server's unique key on (profile, game_id, reward_key) is the
	 * actual dedup — pass extra.tier/extra.count for a pack reward and/or
	 * extra.coins for a coin reward. Resolves with { ok, claimed, ... }
	 * even when claimed is false (already-claimed is a normal outcome, not
	 * an error) — only a genuine request failure throws.
	 */
	function claimReward(base, user, gameId, rewardKey, extra) {
		var body = Object.assign({ game_id: gameId, reward_key: rewardKey }, extra || {});
		return ensureArcadeSession(base).then(function () {
			return fetch(apiUrl(base, 'adoptedex/' + encodeURIComponent(user) + '/rewards/claim'), {
				method: 'POST',
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
		}).then(function (res) {
			if (!res.ok) {
				throw new Error('Could not claim reward.');
			}
			return res.json();
		}).then(function (data) {
			if (data && data.claimed) {
				try {
					var awarded = typeof data.packsAwarded === 'number' ? data.packsAwarded : ((extra && extra.count) ? extra.count : 1);
					if (awarded > 0) {
						var cur = parseInt(localStorage.getItem('monroeDexPacks') || '0', 10);
						if (isNaN(cur)) cur = 0;
						localStorage.setItem('monroeDexPacks', String(cur + awarded));
					}
					if (typeof data.coinsAwarded === 'number' && data.coinsAwarded > 0) {
						var coins = parseInt(localStorage.getItem('monroeDexCoins') || '0', 10);
						if (isNaN(coins)) coins = 0;
						localStorage.setItem('monroeDexCoins', String(coins + data.coinsAwarded));
					}
				} catch (e) {}
				if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
					try {
						window.parent.postMessage({ type: 'adoptedex:pack_awarded', extra: extra, packsAwarded: data.packsAwarded, reward_key: data.reward_key }, '*');
					} catch (e) {}
				}
			}
			return data;
		}).catch(function (err) {
			console.warn('[Adoptedex] claimReward network offline fallback:', err);
			try {
				var count = (extra && extra.count) ? extra.count : 1;
				var cur = parseInt(localStorage.getItem('monroeDexPacks') || '1', 10);
				var next = cur + count;
				localStorage.setItem('monroeDexPacks', String(next));
				if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
					window.parent.postMessage({
						type: 'adoptedex:pack_awarded',
						extra: extra,
						offline: true,
						remainingPacks: next
					}, '*');
				}
			} catch (e) {}
			return { ok: true, claimed: true, offline: true };
		});
	}

	/**
	 * Server-authoritative pack open: the server decides which pets and
	 * what pack rarity/coins come out, this just asks and renders whatever
	 * comes back. See packages/humane-booster's dexSyncBridge.openPack for
	 * the TypeScript twin of this same call — same endpoint, same contract,
	 * kept in sync by hand since the TS package and this vanilla client
	 * don't share a build step.
	 */
	function openPack(base, user, tier) {
		return ensureArcadeSession(base).then(function () {
			return fetch(apiUrl(base, 'adoptedex/' + encodeURIComponent(user) + '/packs/open'), {
				method: 'POST',
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tier: tier || 'standard' }),
			});
		}).then(function (res) {
			return res.json().then(function (data) {
				if (!res.ok || !data || !data.ok) {
					throw new Error((data && data.message) || 'Could not open pack.');
				}
				return data;
			});
		});
	}

	function awardCoins(base, user, amount, reason) {
		return ensureArcadeSession(base).then(function () {
			return fetch(apiUrl(base, 'adoptedex/' + encodeURIComponent(user) + '/coins/award'), {
				method: 'POST',
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ amount: amount, reason: reason || 'game_award' }),
			});
		}).then(function (res) {
			if (!res.ok) {
				throw new Error('Could not award coins.');
			}
			return res.json();
		});
	}

	function spendCoins(base, user, amount, reason) {
		return ensureArcadeSession(base).then(function () {
			return fetch(apiUrl(base, 'adoptedex/' + encodeURIComponent(user) + '/coins/spend'), {
				method: 'POST',
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ amount: amount, reason: reason || 'game_spend' }),
			});
		}).then(function (res) {
			return res.json().then(function (data) {
				if (!res.ok || !data || !data.ok) {
					throw new Error((data && data.message) || 'Could not spend coins.');
				}
				return data;
			});
		});
	}

	function onImgError(img) {
		img.onerror = null;
		img.src = PLACEHOLDER_SVG;
		img.classList.add('is-placeholder');
	}

	function buildDexNumberMap(activePets) {
		var map = {};
		var sorted = (activePets || []).slice().sort(function (a, b) {
			var nameCmp = String(a.name || '').localeCompare(String(b.name || ''));
			if (nameCmp !== 0) {
				return nameCmp;
			}
			return String(a.id || '').localeCompare(String(b.id || ''));
		});
		sorted.forEach(function (pet, index) {
			if (pet && pet.id) {
				map[pet.id] = index + 1;
			}
		});
		return map;
	}

	function formatDexNumber(num) {
		if (!num || num < 1) {
			return '';
		}
		return '#' + String(num).padStart(3, '0');
	}

	function typeClassFromPet(pet) {
		var type = String((pet && pet.type) || '').toLowerCase();
		if (type.indexOf('dog') >= 0) {
			return 'dog';
		}
		if (type.indexOf('cat') >= 0) {
			return 'cat';
		}
		return 'other';
	}

	function petStatRows(pet) {
		var rows = [];
		if (pet.type) {
			rows.push({ label: 'Type', value: pet.type });
		}
		if (pet.breed) {
			rows.push({ label: 'Breed', value: pet.breed });
		}
		if (pet.age) {
			rows.push({ label: 'Age', value: pet.age });
		}
		if (pet.gender) {
			rows.push({ label: 'Gender', value: pet.gender });
		}
		if (pet.archived) {
			rows.push({ label: 'Status', value: 'Found a home' });
		}
		return rows;
	}

	function createFlipCard(pet, options) {
		var opts = options || {};
		var met = !!opts.met;
		var mode = opts.mode || 'collection';
		var readOnly = !!opts.readOnly;
		var dexNum = opts.dexNumber || 0;
		var showUnmet = mode === 'available' && !met;
		var typeClass = typeClassFromPet(pet);
		var displayName = showUnmet ? '???' : (pet.name || 'Pet');
		var foil = opts.foil || pet.foil || '';
		var rarity = opts.rarity || pet.rarity || '';

		var li = document.createElement('li');
		li.className = 'adoptedex-card-wrap';
		if (opts.highlight) {
			li.classList.add('adoptedex-card-wrap--highlight');
		}
		if (foil && foil !== 'none') {
			li.classList.add('adoptedex-card-wrap--foil', 'adoptedex-card-wrap--foil-' + String(foil).replace(/[^a-z0-9_-]/gi, ''));
		}
		if (rarity && /rare|alumni|golden|longtimer|uncommon|holographic|prism|cosmos|aurora/i.test(String(rarity))) {
			li.classList.add('adoptedex-card-wrap--rare');
		}
		li.setAttribute('data-pet-id', pet.id || '');

		var card = document.createElement('button');
		card.type = 'button';
		card.className = 'adoptedex-card';
		if (showUnmet) {
			card.classList.add('adoptedex-card--unmet');
		}
		if (pet.archived) {
			card.classList.add('adoptedex-card--archived');
		}
		if (foil && foil !== 'none') {
			card.classList.add('adoptedex-card--foil');
		}
		if (opts.startFlipped) {
			card.classList.add('is-flipped');
		}
		card.setAttribute('data-pet-id', pet.id || '');
		card.setAttribute('aria-label', (met ? 'View ' : 'Discover ') + (pet.name || 'pet'));

		var front = document.createElement('div');
		front.className = 'adoptedex-card__face adoptedex-card__face--front adoptedex-card__face--' + typeClass;

		var num = document.createElement('span');
		num.className = 'adoptedex-card__num';
		num.textContent = formatDexNumber(dexNum);

		var art = document.createElement('div');
		art.className = 'adoptedex-card__art';

		var halo = document.createElement('span');
		halo.className = 'adoptedex-card__halo';
		halo.setAttribute('aria-hidden', 'true');

		if (showUnmet) {
			var silhouette = document.createElement('span');
			silhouette.className = 'adoptedex-card__silhouette';
			silhouette.setAttribute('aria-hidden', 'true');
			silhouette.innerHTML = '<span class="adoptedex-card__paw">🐾</span><span class="adoptedex-card__q">?</span>';
			art.appendChild(halo);
			art.appendChild(silhouette);
		} else {
			var img = document.createElement('img');
			img.className = 'adoptedex-card__photo';
			img.src = pet.file || PLACEHOLDER_SVG;
			img.alt = '';
			img.loading = 'lazy';
			img.decoding = 'async';
			img.onerror = function () { onImgError(img); };
			art.appendChild(halo);
			if (foil && foil !== 'none') {
				var sheen = document.createElement('span');
				sheen.className = 'adoptedex-card__foil-sheen';
				sheen.setAttribute('aria-hidden', 'true');
				art.appendChild(sheen);
			}
			art.appendChild(img);
			if (rarity) {
				var rarityPill = document.createElement('span');
				rarityPill.className = 'adoptedex-card__rarity';
				rarityPill.textContent = String(rarity).replace(/_/g, ' ');
				art.appendChild(rarityPill);
			}
		}

		var name = document.createElement('span');
		name.className = 'adoptedex-card__name';
		name.textContent = displayName;

		var typePill = document.createElement('span');
		typePill.className = 'adoptedex-card__type adoptedex-card__type--' + typeClass;
		typePill.textContent = pet.type || 'Pet';

		front.append(num, art, name, typePill);

		var back = document.createElement('div');
		back.className = 'adoptedex-card__face adoptedex-card__face--back adoptedex-card__face--' + typeClass;

		var backTitle = document.createElement('span');
		backTitle.className = 'adoptedex-card__back-title';
		backTitle.textContent = showUnmet ? 'Unknown friend' : (pet.name || 'Pet');

		var stats = document.createElement('dl');
		stats.className = 'adoptedex-card__stats';
		petStatRows(pet).forEach(function (row) {
			var dt = document.createElement('dt');
			dt.textContent = row.label;
			var dd = document.createElement('dd');
			dd.textContent = row.value;
			stats.appendChild(dt);
			stats.appendChild(dd);
		});

		var actions = document.createElement('div');
		actions.className = 'adoptedex-card__actions';

		if (pet.url && !pet.archived) {
			var profile = document.createElement('a');
			profile.className = 'adoptedex-btn adoptedex-btn--ghost adoptedex-card__profile';
			profile.href = pet.url;
			profile.target = '_blank';
			profile.rel = 'noopener noreferrer';
			profile.textContent = 'View on shelter site';
			actions.appendChild(profile);
		}

		if (!readOnly && showUnmet) {
			var register = document.createElement('button');
			register.type = 'button';
			register.className = 'adoptedex-btn adoptedex-btn--primary adoptedex-card__register';
			register.setAttribute('data-register', '1');
			register.textContent = 'Add to my album';
			register.addEventListener('click', function (e) {
				e.stopPropagation();
				if (typeof opts.onRegister === 'function') {
					opts.onRegister(pet);
				}
			});
			actions.appendChild(register);
		}

		if (pet.archived && mode === 'past') {
			var badge = document.createElement('span');
			badge.className = 'adoptedex-card__archived-badge';
			badge.textContent = 'Found a home?';
			back.insertBefore(badge, back.firstChild);
		}

		back.append(backTitle, stats);
		if (actions.childNodes.length) {
			back.appendChild(actions);
		}

		card.append(front, back);

		card.addEventListener('click', function (e) {
			if (e.target.closest('a, [data-register]')) {
				return;
			}
			card.classList.toggle('is-flipped');
		});

		li.appendChild(card);
		return li;
	}

	function renderGrid(container, pets, metSet, mode, gridOptions) {
		var opts = gridOptions || {};
		container.innerHTML = '';
		var list = document.createElement('ul');
		list.className = 'adoptedex-grid';

		var highlightId = opts.highlightPetId || '';

		pets.forEach(function (pet) {
			var met = !!metSet[pet.id];
			if (pet.archived && !met) {
				return;
			}
			if (mode === 'collection' && (!met || pet.archived)) {
				return;
			}
			if (mode === 'past' && (!met || !pet.archived)) {
				return;
			}
			list.appendChild(createFlipCard(pet, {
				met: met,
				mode: mode,
				dexNumber: (opts.dexNumbers && opts.dexNumbers[pet.id]) || 0,
				readOnly: !!opts.readOnly,
				onRegister: opts.onRegister,
				highlight: highlightId && pet.id === highlightId,
				startFlipped: highlightId && pet.id === highlightId,
			}));
		});

		if (!list.childNodes.length) {
			var empty = document.createElement('p');
			empty.className = 'adoptedex-empty';
			if (mode === 'available') {
				empty.textContent = 'No adoptable pets listed at the shelter right now.';
			} else if (mode === 'collection') {
				empty.textContent = 'No pets in your collection yet. Try Meet someone new or play Pet Match!';
			} else if (mode === 'past') {
				empty.textContent = 'No past friends in your album yet.';
			} else {
				empty.textContent = 'No pets in this view yet.';
			}
			container.appendChild(empty);
			return;
		}

		container.appendChild(list);
	}

	function formatStats(stats) {
		if (!stats) {
			return '';
		}
		var parts = [stats.met + ' cards collected'];
		if (stats.unopened_packs > 0) {
			parts.push('🎁 ' + stats.unopened_packs + ' packs to open');
		}
		if (stats.still_here > 0) {
			parts.push(stats.still_here + ' at shelter');
		}
		if (stats.found_home > 0) {
			parts.push(stats.found_home + ' adopted');
		}
		if (stats.coin_balance > 0) {
			parts.push('🪙 ' + stats.coin_balance);
		}
		return parts.join(' · ');
	}


	var TOAST_CSS_ID = 'monroe-adoptedex-reward-toast-css';
	var TOAST_STYLE = [
		'#monroe-adoptedex-toast-root{position:fixed;inset:auto 0 0 0;z-index:2147483000;pointer-events:none;',
		'display:flex;flex-direction:column;align-items:center;gap:10px;padding:12px;',
		'padding-bottom:max(12px,env(safe-area-inset-bottom,0px));padding-left:max(12px,env(safe-area-inset-left,0px));',
		'padding-right:max(12px,env(safe-area-inset-right,0px));}',
		'.adx-toast{pointer-events:auto;min-width:min(92vw,320px);max-width:min(96vw,420px);',
		'background:linear-gradient(160deg,#0f3d32 0%,#08241f 55%,#041814 100%);color:#fef6ea;',
		'border:2px solid rgba(255,179,71,.85);border-radius:16px;box-shadow:0 18px 40px rgba(0,0,0,.45);',
		'padding:14px 16px;display:flex;gap:12px;align-items:center;animation:adxToastIn .35s ease-out;}',
		'.adx-toast--rare{border-color:#fef08a;box-shadow:0 0 0 2px rgba(254,240,138,.35),0 18px 40px rgba(0,0,0,.5);}',
		'.adx-toast__icon{font-size:1.75rem;line-height:1;flex:0 0 auto;}',
		'.adx-toast__body{flex:1 1 auto;min-width:0;}',
		'.adx-toast__title{font-weight:800;font-size:1.05rem;margin:0 0 2px;color:#fef08a;}',
		'.adx-toast__msg{margin:0;font-size:.92rem;line-height:1.35;color:#ccfbf1;}',
		'.adx-toast__cta{margin-top:8px;display:inline-flex;align-items:center;justify-content:center;',
		'min-height:44px;min-width:44px;padding:8px 14px;border-radius:999px;border:0;',
		'background:#ffb347;color:#2c1c19;font-weight:800;cursor:pointer;touch-action:manipulation;}',
		'.adx-toast__dismiss{flex:0 0 auto;min-width:44px;min-height:44px;border:0;border-radius:999px;',
		'background:rgba(255,255,255,.12);color:#fff;font-size:1.2rem;cursor:pointer;touch-action:manipulation;}',
		'@keyframes adxToastIn{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:none}}',
		'#monroe-adoptedex-overlay-root{position:fixed;inset:0;z-index:2147483001;display:flex;align-items:center;',
		'justify-content:center;padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right))',
		'max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));',
		'background:rgba(8,20,16,.72);backdrop-filter:blur(4px);}',
		'#monroe-adoptedex-overlay-root[hidden]{display:none!important;}',
		'.adx-overlay-card{background:linear-gradient(180deg,#fffaf3,#fef6ea);color:#2c1c19;border-radius:20px;',
		'max-width:min(96vw,440px);width:100%;padding:18px 16px 16px;box-shadow:0 24px 60px rgba(0,0,0,.4);',
		'border:2px solid rgba(26,79,75,.25);text-align:center;}',
		'.adx-overlay-card h2{margin:0 0 6px;font-size:1.25rem;}',
		'.adx-overlay-card p{margin:0 0 12px;color:#4b5563;line-height:1.4;}',
		'.adx-overlay-card .adoptedex-card-wrap{list-style:none;margin:0 auto 12px;max-width:200px;}',
		'.adx-overlay-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;}',
		'.adx-overlay-actions button,.adx-overlay-actions a{min-height:44px;min-width:44px;padding:10px 16px;',
		'border-radius:999px;border:0;font-weight:800;cursor:pointer;touch-action:manipulation;text-decoration:none;',
		'display:inline-flex;align-items:center;justify-content:center;}',
		'.adx-btn-primary{background:#1a4f4b;color:#fffaf3;}',
		'.adx-btn-ghost{background:rgba(26,79,75,.12);color:#1a4f4b;}',
		'.adoptedex-card-wrap--rare .adoptedex-card,.adoptedex-card--foil{',
		'box-shadow:0 0 0 2px rgba(254,240,138,.55),0 12px 28px rgba(255,179,71,.28);}',
		'.adoptedex-card__foil-sheen{position:absolute;inset:0;border-radius:inherit;pointer-events:none;',
		'background:linear-gradient(115deg,transparent 20%,rgba(255,255,255,.4) 45%,transparent 70%);',
		'animation:adxFoil 3.6s linear infinite;mix-blend-mode:screen;opacity:.28;}',
		'.adoptedex-card__art{position:relative;overflow:hidden;}',
		'.adoptedex-card__rarity{position:absolute;left:8px;bottom:8px;font-size:.65rem;font-weight:800;',
		'text-transform:uppercase;letter-spacing:.04em;background:rgba(15,61,50,.85);color:#fef08a;',
		'padding:3px 7px;border-radius:999px;}',
		'@keyframes adxFoil{from{transform:translateX(-40%)}to{transform:translateX(40%)}}'
	].join('');

	function ensureToastStyles() {
		if (typeof document === 'undefined') return;
		if (document.getElementById(TOAST_CSS_ID)) return;
		var style = document.createElement('style');
		style.id = TOAST_CSS_ID;
		style.textContent = TOAST_STYLE;
		document.head.appendChild(style);
	}

	function toastRoot() {
		ensureToastStyles();
		var root = document.getElementById('monroe-adoptedex-toast-root');
		if (!root) {
			root = document.createElement('div');
			root.id = 'monroe-adoptedex-toast-root';
			root.setAttribute('aria-live', 'polite');
			document.body.appendChild(root);
		}
		return root;
	}

	/**
	 * Shared pack/reward toast used by every game. Prefer calling this only
	 * after claimReward resolves with claimed:true (server authoritative).
	 */
	function showRewardToast(opts) {
		opts = opts || {};
		if (typeof document === 'undefined') return null;
		var root = toastRoot();
		var el = document.createElement('div');
		el.className = 'adx-toast' + (opts.rare || opts.rarity === 'rare' ? ' adx-toast--rare' : '');
		el.setAttribute('role', 'status');

		var icon = document.createElement('div');
		icon.className = 'adx-toast__icon';
		icon.textContent = opts.icon || '🎁';

		var body = document.createElement('div');
		body.className = 'adx-toast__body';
		var title = document.createElement('p');
		title.className = 'adx-toast__title';
		title.textContent = opts.title || 'Pack earned!';
		var msg = document.createElement('p');
		msg.className = 'adx-toast__msg';
		msg.textContent = opts.message || opts.msg || ('Nice work' + (opts.game ? ' in ' + opts.game : '') + ' — a shelter pet pack is waiting in your album.');
		body.appendChild(title);
		body.appendChild(msg);

		if (opts.href || opts.onOpen) {
			var cta = document.createElement(opts.href ? 'a' : 'button');
			cta.className = 'adx-toast__cta';
			if (opts.href) {
				cta.href = opts.href;
				cta.target = opts.target || '_self';
			} else {
				cta.type = 'button';
				cta.addEventListener('click', function () {
					try { opts.onOpen(); } catch (e) {}
					el.remove();
				});
			}
			cta.textContent = opts.ctaLabel || 'Open packs';
			body.appendChild(cta);
		}

		var dismiss = document.createElement('button');
		dismiss.type = 'button';
		dismiss.className = 'adx-toast__dismiss';
		dismiss.setAttribute('aria-label', 'Dismiss');
		dismiss.textContent = '×';
		dismiss.addEventListener('click', function () { el.remove(); });

		el.append(icon, body, dismiss);
		root.appendChild(el);
		var ttl = typeof opts.duration === 'number' ? opts.duration : 6500;
		if (ttl > 0) {
			setTimeout(function () { if (el.parentNode) el.remove(); }, ttl);
		}
		return el;
	}

	function overlayRoot() {
		ensureToastStyles();
		var root = document.getElementById('monroe-adoptedex-overlay-root');
		if (!root) {
			root = document.createElement('div');
			root.id = 'monroe-adoptedex-overlay-root';
			root.hidden = true;
			root.addEventListener('click', function (e) {
				if (e.target === root) closeMeetOverlay();
			});
			document.body.appendChild(root);
		}
		return root;
	}

	function closeMeetOverlay() {
		var root = document.getElementById('monroe-adoptedex-overlay-root');
		if (root) {
			root.hidden = true;
			root.innerHTML = '';
		}
	}

	function foilFromRarity(rarity) {
		var r = String(rarity || '').toLowerCase();
		if (r.indexOf('alumni') >= 0 || r === 'prism') return 'prism';
		if (r.indexOf('golden') >= 0 || r === 'gold') return 'gold';
		if (r.indexOf('longtimer') >= 0 || r === 'cosmos') return 'cosmos';
		if (r.indexOf('tiny') >= 0 || r === 'aurora') return 'aurora';
		if (r === 'rare' || r === 'uncommon') return 'gold';
		return 'none';
	}

	/**
	 * Show a createFlipCard overlay for a newly met / pack-pulled pet.
	 * Used by Meet-the-Pet and album pack reveal.
	 */
	function showFlipCardOverlay(pet, options) {
		options = options || {};
		if (!pet || typeof document === 'undefined') return null;
		var root = overlayRoot();
		root.innerHTML = '';
		root.hidden = false;
		var panel = document.createElement('div');
		panel.className = 'adx-overlay-card';
		var h = document.createElement('h2');
		h.textContent = options.title || ('Meet ' + (pet.name || 'a new friend') + '!');
		var p = document.createElement('p');
		p.textContent = options.message || 'Tap the card to flip and learn more. Added to your Adoptédex.';
		var wrap = createFlipCard(pet, {
			met: true,
			mode: 'collection',
			readOnly: true,
			dexNumber: options.dexNumber || 0,
			foil: options.foil || foilFromRarity(pet.rarity || options.rarity),
			rarity: pet.rarity || options.rarity || '',
			highlight: true,
			startFlipped: !!options.startFlipped,
		});
		// animate flip in
		var cardBtn = wrap.querySelector('.adoptedex-card');
		if (cardBtn && !options.startFlipped) {
			setTimeout(function () { cardBtn.classList.add('is-flipped'); }, 450);
		}
		var actions = document.createElement('div');
		actions.className = 'adx-overlay-actions';
		var closeBtn = document.createElement('button');
		closeBtn.type = 'button';
		closeBtn.className = 'adx-btn-primary';
		closeBtn.textContent = options.closeLabel || 'Awesome!';
		closeBtn.addEventListener('click', closeMeetOverlay);
		actions.appendChild(closeBtn);
		if (pet.url) {
			var link = document.createElement('a');
			link.className = 'adx-btn-ghost';
			link.href = pet.url;
			link.target = '_blank';
			link.rel = 'noopener noreferrer';
			link.textContent = 'View on shelter site';
			actions.appendChild(link);
		}
		panel.append(h, p, wrap, actions);
		root.appendChild(panel);
		return root;
	}

	/**
	 * Once-per-calendar-day streak pack (server stores date-scoped key).
	 */
	function claimDailyStreak(base, user, gameId) {
		gameId = gameId || 'dex';
		return claimReward(base, user, gameId, 'daily_streak', { tier: 'standard', count: 1 }).then(function (data) {
			if (data && data.claimed) {
				showRewardToast({
					title: 'Daily Streak Pack!',
					message: 'Thanks for checking in today — a free pack is waiting in your album.',
					game: 'Adoptédex',
					icon: '🔥',
					rare: true,
				});
			}
			return data;
		});
	}

	/**
	 * Species Scout: after discovering N pets of one type, claim bonus pack.
	 * Client counts; server unique key dedups.
	 */
	function claimSpeciesScout(base, user, species, count) {
		species = String(species || '').toLowerCase();
		if (species.indexOf('cat') >= 0) species = 'cat';
		else if (species.indexOf('dog') >= 0) species = 'dog';
		else return Promise.resolve({ ok: false, claimed: false });

		var key = null;
		if (count >= 10) key = 'species_scout_' + species + '_10';
		else if (count >= 3) key = 'species_scout_' + species + '_3';
		else return Promise.resolve({ ok: true, claimed: false });

		return claimReward(base, user, 'dex', key, { tier: 'standard', count: 1 }).then(function (data) {
			if (data && data.claimed) {
				showRewardToast({
					title: 'Species Scout bonus!',
					message: 'You met ' + count + ' ' + species + (count === 1 ? '' : 's') + ' — bonus pack unlocked.',
					icon: species === 'cat' ? '🐱' : '🐕',
					rare: count >= 10,
				});
			}
			return data;
		});
	}

	/**
	 * Coin shop: spend server coins for 1 pack (reason buy_pack).
	 */
	function buyPackWithCoins(base, user, cost) {
		cost = typeof cost === 'number' ? cost : 25;
		return spendCoins(base, user, cost, 'buy_pack').then(function (data) {
			if (data && data.ok) {
				try {
					var cur = parseInt(localStorage.getItem('monroeDexPacks') || '0', 10);
					var next = (isNaN(cur) ? 0 : cur) + (data.packsAwarded || 1);
					localStorage.setItem('monroeDexPacks', String(next));
					if (typeof data.coin_balance === 'number') {
						localStorage.setItem('monroeDexCoins', String(data.coin_balance));
					}
				} catch (e) {}
				showRewardToast({
					title: 'Pack purchased!',
					message: 'Spent ' + (data.spent || cost) + ' coins on a shelter pet pack.',
					icon: '🪙',
				});
				if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
					try {
						window.parent.postMessage({ type: 'adoptedex:pack_awarded', source: 'coin_shop', extra: { count: 1 } }, '*');
					} catch (e) {}
				}
			}
			return data;
		});
	}

	/**
	 * Meet-the-Pet: discover one random unmet pet and celebrate with flip card.
	 */
	function meetRandomPet(base, user, pets, metSet, source) {
		metSet = metSet || {};
		var unmet = (pets || []).filter(function (p) {
			return p && p.id && !metSet[p.id] && !p.archived;
		});
		if (!unmet.length) {
			return Promise.resolve({ ok: false, message: 'No unmet pets' });
		}
		var pick = unmet[Math.floor(Math.random() * unmet.length)];
		return discoverPet(base, user, pick.id, source || 'meet_the_pet').then(function (data) {
			showFlipCardOverlay(pick, {
				title: 'Meet ' + (pick.name || 'a new friend') + '!',
				message: 'A new shelter friend joined your Adoptédex. Tap the card to flip!',
				foil: foilFromRarity(pick.rarity),
				rarity: pick.rarity || '',
			});
			return { ok: true, pet: pick, data: data };
		});
	}

	/** Sync local monroeDexPacks from server profile (booster / album bridge). */
	function syncLocalPacksFromProfile(profileOrStats) {
		try {
			var packs = null;
			if (profileOrStats && typeof profileOrStats.unopened_packs !== 'undefined') {
				packs = parseInt(profileOrStats.unopened_packs, 10);
			} else if (profileOrStats && profileOrStats.stats && typeof profileOrStats.stats.unopened_packs !== 'undefined') {
				packs = parseInt(profileOrStats.stats.unopened_packs, 10);
			} else if (profileOrStats && profileOrStats.profile && typeof profileOrStats.profile.unopened_packs !== 'undefined') {
				packs = parseInt(profileOrStats.profile.unopened_packs, 10);
			}
			if (packs !== null && !isNaN(packs)) {
				localStorage.setItem('monroeDexPacks', String(Math.max(0, packs)));
				window.dispatchEvent(new CustomEvent('monroe-adoptedex-updated', {
					detail: { remainingPacks: packs, synced: true }
				}));
			}
			return packs;
		} catch (e) {
			return null;
		}
	}

	global.MonroeAdoptedex = {
		getParams: getParams,
		fetchDex: fetchDex,
		discoverPet: discoverPet,
		discoverBulk: discoverBulk,
		claimReward: claimReward,
		openPack: openPack,
		awardCoins: awardCoins,
		spendCoins: spendCoins,
		renderGrid: renderGrid,
		createFlipCard: createFlipCard,
		buildDexNumberMap: buildDexNumberMap,
		formatDexNumber: formatDexNumber,
		formatStats: formatStats,
		onImgError: onImgError,
		PLACEHOLDER_SVG: PLACEHOLDER_SVG,
		showRewardToast: showRewardToast,
		showFlipCardOverlay: showFlipCardOverlay,
		closeMeetOverlay: closeMeetOverlay,
		claimDailyStreak: claimDailyStreak,
		claimSpeciesScout: claimSpeciesScout,
		buyPackWithCoins: buyPackWithCoins,
		meetRandomPet: meetRandomPet,
		syncLocalPacksFromProfile: syncLocalPacksFromProfile,
		foilFromRarity: foilFromRarity,
		ensureToastStyles: ensureToastStyles,
	};
})(window);
