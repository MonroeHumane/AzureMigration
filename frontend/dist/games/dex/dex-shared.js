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

		var api = params.get('dex_api') || params.get('api') || (window.location.origin + '/arcade-api/v1/');

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
		return fetch(apiUrl(base, 'adoptedex/' + encodeURIComponent(user) + '/discover'), {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ pet_id: petId, source: source || 'dex' }),
		}).then(function (res) {
			if (!res.ok) {
				throw new Error('Could not save discovery.');
			}
			return res.json();
		});
	}

	function discoverBulk(base, user, petIds, source) {
		return fetch(apiUrl(base, 'adoptedex/' + encodeURIComponent(user) + '/discover/bulk'), {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ pet_ids: petIds, source: source || 'match' }),
		}).then(function (res) {
			if (!res.ok) {
				throw new Error('Could not save discoveries.');
			}
			return res.json();
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
		return fetch(apiUrl(base, 'adoptedex/' + encodeURIComponent(user) + '/rewards/claim'), {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		}).then(function (res) {
			if (!res.ok) {
				throw new Error('Could not claim reward.');
			}
			return res.json();
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
		return fetch(apiUrl(base, 'adoptedex/' + encodeURIComponent(user) + '/packs/open'), {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ tier: tier || 'standard' }),
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
		return fetch(apiUrl(base, 'adoptedex/' + encodeURIComponent(user) + '/coins/award'), {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ amount: amount, reason: reason || 'game_award' }),
		}).then(function (res) {
			if (!res.ok) {
				throw new Error('Could not award coins.');
			}
			return res.json();
		});
	}

	function spendCoins(base, user, amount, reason) {
		return fetch(apiUrl(base, 'adoptedex/' + encodeURIComponent(user) + '/coins/spend'), {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ amount: amount, reason: reason || 'game_spend' }),
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

		var li = document.createElement('li');
		li.className = 'adoptedex-card-wrap';
		if (opts.highlight) {
			li.classList.add('adoptedex-card-wrap--highlight');
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
			art.appendChild(img);
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
	};
})(window);
