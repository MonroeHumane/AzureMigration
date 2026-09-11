/**
 * 🐾 MONROE COUNTY HUMANE SOCIETY — 3-RING TRADING CARD BINDER & GALLERY
 * Complete client application managing 9-pocket sheet pagination, 3D card inspection,
 * holographic foil rendering, real shelter pet resolution, and arcade synchronization.
 */

(function () {
	'use strict';

	var Dex = window.MonroeAdoptedex;
	if (!Dex) return;

	var params = Dex.getParams();

	// Web Audio Synthesizer for Authentic Arcade & Binder Feedback
	var SoundEngine = (function () {
		var ctx = null;
		var muted = false;

		function getCtx() {
			if (!ctx) {
				var AudioClass = window.AudioContext || window.webkitAudioContext;
				if (AudioClass) ctx = new AudioClass();
			}
			if (ctx && ctx.state === 'suspended') {
				ctx.resume().catch(function () {});
			}
			return ctx;
		}

		function playPageTurn() {
			if (muted) return;
			var c = getCtx();
			if (!c) return;
			var duration = 0.22;
			var buffer = c.createBuffer(1, Math.floor(c.sampleRate * duration), c.sampleRate);
			var data = buffer.getChannelData(0);
			for (var i = 0; i < data.length; i++) {
				var progress = i / data.length;
				data[i] = (Math.random() * 2 - 1) * Math.sin(progress * Math.PI) * (1 - progress * 0.4);
			}
			var source = c.createBufferSource();
			source.buffer = buffer;
			var filter = c.createBiquadFilter();
			filter.type = 'lowpass';
			filter.frequency.setValueAtTime(1400, c.currentTime);
			filter.frequency.exponentialRampToValueAtTime(400, c.currentTime + duration);
			var gain = c.createGain();
			gain.gain.setValueAtTime(0.2, c.currentTime);
			gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
			source.connect(filter);
			filter.connect(gain);
			gain.connect(c.destination);
			source.start();
		}

		function playCardWhoosh() {
			if (muted) return;
			var c = getCtx();
			if (!c) return;
			var osc = c.createOscillator();
			var gain = c.createGain();
			osc.type = 'sine';
			osc.frequency.setValueAtTime(480, c.currentTime);
			osc.frequency.exponentialRampToValueAtTime(150, c.currentTime + 0.18);
			gain.gain.setValueAtTime(0.15, c.currentTime);
			gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);
			osc.connect(gain);
			gain.connect(c.destination);
			osc.start();
			osc.stop(c.currentTime + 0.18);
		}

		function playFoilShimmer() {
			if (muted) return;
			var c = getCtx();
			if (!c) return;
			[587.33, 880, 1174.66, 1760].forEach(function (freq, idx) {
				var osc = c.createOscillator();
				var gain = c.createGain();
				var t = c.currentTime + idx * 0.05;
				osc.type = 'triangle';
				osc.frequency.setValueAtTime(freq, t);
				gain.gain.setValueAtTime(0.08, t);
				gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
				osc.connect(gain);
				gain.connect(c.destination);
				osc.start(t);
				osc.stop(t + 0.25);
			});
		}

		return {
			playPageTurn: playPageTurn,
			playCardWhoosh: playCardWhoosh,
			playFoilShimmer: playFoilShimmer,
			setMuted: function (m) { muted = !!m; }
		};
	})();

	// Application State
	var state = {
		allShelterPets: [],
		activeCards: [],
		filteredCards: [],
		metIdsSet: {},
		dexNumbers: {},
		viewMode: 'binder', // 'binder' | 'grid'
		currentSheet: 0,
		pocketsPerSheet: 9, // dynamically updated (9 on desktop, 4 on mobile)
		filterSpecies: 'all',
		filterRarity: 'all',
		sortMode: 'dex_asc',
		searchQuery: '',
		unopenedPacks: 1,
		coinBalance: 0,
		inspectorIndex: -1,
		isInspectorFlipped: false,
		freshIds: {},
		seenIdsSnapshot: null,
	};

	// Mascot Map
	var MASCOTS = {
		smokey: { icon: '🐱', name: 'Smokey', desc: 'Curious Explorer' },
		barnaby: { icon: '🐕', name: 'Barnaby', desc: 'Playful Retriever' },
		marmalade: { icon: '🐾', name: 'Marmalade', desc: 'Ginger Tabby' },
		daisy: { icon: '🐶', name: 'Daisy', desc: 'Rescue Pup' },
		pip: { icon: '🐰', name: 'Pip', desc: 'Shelter Bunny' }
	};

	// DOM Elements Cache
	var els = {
		title: document.getElementById('albumTitle'),
		playerMascot: document.getElementById('playerMascot'),
		playerRank: document.getElementById('playerRank'),
		playerTotalStats: document.getElementById('playerTotalStats'),
		packPill: document.getElementById('binderPackPill'),
		packCount: document.getElementById('binderPackCount'),
		openPacksBtn: document.getElementById('binderOpenPacksBtn'),
		quickOpenBtn: document.getElementById('binderQuickOpenBtn'),
		dailyStreakBtn: document.getElementById('binderDailyStreakBtn'),
		buyPackBtn: document.getElementById('binderBuyPackBtn'),
		packReveal: document.getElementById('binderPackReveal'),
		packRevealGrid: document.getElementById('binderPackRevealGrid'),
		packRevealBadge: document.getElementById('binderPackRevealBadge'),
		packRevealRarity: document.getElementById('binderPackRevealRarity'),
		packRevealClose: document.getElementById('binderPackRevealClose'),
		btnViewBinder: document.getElementById('btnViewBinder'),
		btnViewGrid: document.getElementById('btnViewGrid'),
		progressFill: document.getElementById('progressFill'),
		progressPercent: document.getElementById('progressPercent'),
		progressCounts: document.getElementById('progressCounts'),
		search: document.getElementById('binderSearch'),
		searchClear: document.getElementById('binderSearchClear'),
		sortSelect: document.getElementById('binderSortSelect'),
		speciesChips: document.querySelectorAll('[data-filter-species]'),
		rarityChips: document.querySelectorAll('[data-filter-rarity]'),
		filtersToggle: document.getElementById('binderFiltersToggle'),
		filtersPanel: document.getElementById('binderFiltersPanel'),
		filtersBadge: document.getElementById('binderFiltersBadge'),
		shopToggle: document.getElementById('binderShopToggle'),
		shopRow: document.getElementById('binderShopRow'),
		shopWrap: document.getElementById('binderShopWrap'),
		emptyTitle: document.getElementById('emptyTitle'),
		emptyDesc: document.getElementById('emptyDesc'),
		binderBookStage: document.getElementById('binderBookStage'),
		binderGridStage: document.getElementById('binderGridStage'),
		binderPocketsGrid: document.getElementById('binderPocketsGrid'),
		binderShowcaseGrid: document.getElementById('binderShowcaseGrid'),
		sheetPageIndicator: document.getElementById('sheetPageIndicator'),
		btnSheetPrev: document.getElementById('btnSheetPrev'),
		btnSheetNext: document.getElementById('btnSheetNext'),
		sheetDots: document.getElementById('sheetDots'),
		emptyState: document.getElementById('binderEmptyState'),
		btnResetFilters: document.getElementById('btnResetFilters'),
		inspectorModal: document.getElementById('cardInspectorModal'),
		inspectorBackdrop: document.getElementById('inspectorBackdrop'),
		inspectorCloseBtn: document.getElementById('inspectorCloseBtn'),
		inspectorNavPrev: document.getElementById('inspectorNavPrev'),
		inspectorNavNext: document.getElementById('inspectorNavNext'),
		inspectorCardHost: document.getElementById('inspectorCardHost'),
		btnInspectorFlip: document.getElementById('btnInspectorFlip'),
		inspectorAdoptBtn: document.getElementById('inspectorAdoptBtn'),
		btnInspectorShare: document.getElementById('btnInspectorShare'),
		errorToast: document.getElementById('binderErrorToast'),
		live: document.getElementById('binderLive'),
		loadingState: document.getElementById('binderLoadingState'),
		binderMain: document.getElementById('binderMain'),
		swipeHint: document.getElementById('binderSwipeHint'),
		keyHints: document.getElementById('binderKeyHints'),
		packRevealBooster: document.getElementById('binderPackRevealBooster'),
	};

	function showError(msg) {
		if (!els.errorToast) return;
		els.errorToast.textContent = msg;
		els.errorToast.hidden = false;
		setTimeout(function () { els.errorToast.hidden = true; }, 4000);
	}

	function setLoading(isLoading) {
		if (els.loadingState) els.loadingState.hidden = !isLoading;
		if (els.binderMain) els.binderMain.hidden = !!isLoading;
	}


	function isCompactChrome() {
		try {
			return window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
		} catch (e) {
			return window.innerWidth <= 768;
		}
	}

	function countActiveFilters() {
		var n = 0;
		if (state.filterSpecies !== 'all') n++;
		if (state.filterRarity !== 'all') n++;
		if (state.sortMode !== 'dex_asc') n++;
		if (state.searchQuery) n++;
		return n;
	}

	function updateFiltersBadge() {
		var n = countActiveFilters();
		if (!els.filtersBadge) return;
		if (n > 0) {
			els.filtersBadge.hidden = false;
			els.filtersBadge.textContent = String(n);
		} else {
			els.filtersBadge.hidden = true;
			els.filtersBadge.textContent = '0';
		}
	}

	function setFiltersExpanded(expanded) {
		if (!els.filtersPanel || !els.filtersToggle) return;
		els.filtersPanel.classList.toggle('is-collapsed', !expanded);
		els.filtersToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
		els.filtersToggle.classList.toggle('is-open', !!expanded);
	}

	function setShopExpanded(expanded) {
		if (!els.shopWrap) return;
		els.shopWrap.classList.toggle('is-open', !!expanded);
		if (els.shopToggle) {
			els.shopToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
			els.shopToggle.classList.toggle('is-open', !!expanded);
		}
	}

	function syncChromeCollapse() {
		var compact = isCompactChrome();
		if (compact) {
			setFiltersExpanded(false);
			setShopExpanded(false);
		} else {
			setFiltersExpanded(true);
			setShopExpanded(true);
		}
	}

	function kickShine(el, ms) {
		if (!el) return;
		el.classList.add('is-shine-kick');
		window.setTimeout(function () { el.classList.remove('is-shine-kick'); }, ms || 950);
	}


	function determinePocketsPerSheet() {
		return window.innerWidth <= 900 ? 4 : 9;
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Card Generation & Attribute Calculation
	// ──────────────────────────────────────────────────────────────────────────
	function computeCardAttributes(pet, index) {
		var isDog = (pet.type || '').toLowerCase() === 'dog' || (pet.species_label || '').toLowerCase() === 'dog';
		var isCat = (pet.type || '').toLowerCase() === 'cat' || (pet.species_label || '').toLowerCase() === 'cat';
		var species = isDog ? 'dog' : (isCat ? 'cat' : 'other');

		var ageStr = (pet.age_display || pet.age || '').toLowerCase();
		var isArchived = !!(pet.archived || pet.archived_at);

		// Determine Rarity & Holographic Foil
		var rarity = 'common';
		var foil = 'none';
		var rarityLabel = 'Rescue Pet';

		if (isArchived) {
			rarity = 'alumni';
			foil = 'prism';
			rarityLabel = 'Happy Alumni';
		} else if (ageStr.indexOf('senior') !== -1 || ageStr.indexOf('7 year') !== -1 || ageStr.indexOf('8 year') !== -1 || ageStr.indexOf('9 year') !== -1 || ageStr.indexOf('10 year') !== -1 || ageStr.indexOf('11 year') !== -1 || ageStr.indexOf('12 year') !== -1) {
			rarity = 'golden_senior';
			foil = 'gold';
			rarityLabel = 'Golden Senior';
		} else if (pet.location === 'Foster Care' || (pet.description && pet.description.length > 200) || (pet.intake_date && pet.intake_date.indexOf('2025') !== -1)) {
			rarity = 'longtimer';
			foil = 'cosmos';
			rarityLabel = 'Shelter Champion';
		} else if (ageStr.indexOf('month') !== -1 || ageStr.indexOf('baby') !== -1 || ageStr.indexOf('puppy') !== -1 || ageStr.indexOf('kitten') !== -1) {
			rarity = 'tiny_wonder';
			foil = 'aurora';
			rarityLabel = 'Tiny Wonder';
		}

		// Signature Moves
		var moves = isDog ? [
			{ icon: '🎾', name: 'Fetch Frenzy', effect: 'Recovers energy and delivers a joyful squeak.' },
			{ icon: '🐾', name: 'Tail Thump', effect: 'Rhythmically wags tail, lifting spirits by +40.' },
			{ icon: '🐶', name: 'Puppy Dog Eyes', effect: 'Irresistible gaze grants instant belly rubs.' },
			{ icon: '⚡', name: 'Zoomie Dash', effect: 'Sprints in hyper-speed circles across the yard.' }
		] : (isCat ? [
			{ icon: '☀️', name: 'Sunbeam Nap', effect: 'Basks in warm light to completely restore HP.' },
			{ icon: '🎯', name: 'Laser Pounce', effect: 'Acrobatic leap chasing red dots with laser focus.' },
			{ icon: '🧶', name: 'Yarn Tangle', effect: 'Playfully ensnares toys in spinning gymnastics.' },
			{ icon: '🎶', name: 'Purr Motor', effect: 'Vibrates at therapeutic 25Hz frequency for calmness.' }
		] : [
			{ icon: '🥕', name: 'Carrot Crunch', effect: 'Nosh with vigor, brightening everyone\'s day.' },
			{ icon: '✨', name: 'Nose Twitch', effect: 'Quick curious sniffs explore surroundings safely.' }
		]);

		var move = moves[(parseInt(pet.id || '0', 10) + index) % moves.length];

		// Stats
		var seed = parseInt(String(pet.id).slice(-3) || '42', 10);
		var energy = 60 + (seed % 35);
		var cuddle = 75 + ((seed * 3) % 25);
		var loyalty = 80 + ((seed * 7) % 20);

		var numStr = '#' + String(index + 1).padStart(3, '0');
		var photo = pet.image_url || pet.file || 'https://placehold.co/500x500/0f3d32/2dd4bf?text=' + encodeURIComponent(pet.name || 'Pet');

		return {
			id: String(pet.id),
			dexNumber: numStr,
			dexIndex: index + 1,
			name: pet.name || 'Companion',
			species: species,
			speciesLabel: isDog ? '🐕 Dog' : (isCat ? '🐱 Cat' : '🐰 Small Pet'),
			breed: pet.breed || 'Rescue Companion',
			ageDisplay: pet.age_display || pet.age || 'Companion',
			gender: pet.gender || 'Unknown',
			location: pet.location || 'Shelter',
			photoUrl: photo,
			rarity: rarity,
			rarityLabel: rarityLabel,
			foil: foil,
			signatureMove: move,
			stats: { energy: energy, cuddle: cuddle, loyalty: loyalty },
			isAdopted: isArchived,
			adoptionUrl: pet.url || ('/adopt/' + pet.id),
			description: pet.description || 'A loving, loyal friend eager for their forever home.',
			intakeDate: pet.intake_date ? new Date(pet.intake_date).toLocaleDateString() : 'Recent Rescuer'
		};
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Data Loader: Local + Backend + Catalog
	// ──────────────────────────────────────────────────────────────────────────
	async function loadAllData() {
		setLoading(true);
		// Read local state
		var localPacks = localStorage.getItem('monroeDexPacks');
		state.unopenedPacks = localPacks !== null ? Math.max(0, parseInt(localPacks, 10)) : 1;

		var localCoins = localStorage.getItem('monroeDexCoins');
		state.coinBalance = localCoins !== null ? Math.max(0, parseInt(localCoins, 10)) : 0;

		var discoveredJson = localStorage.getItem('monroe_discovered_pets');
		var localMetList = [];
		try {
			localMetList = JSON.parse(discoveredJson || '[]');
		} catch (e) {
			localMetList = [];
		}
		localMetList.forEach(function (id) { state.metIdsSet[String(id)] = true; });

		// Fetch shelter pets
		var shelterPets = [];
		try {
			var r1 = await fetch('/shelter-pets.json');
			if (r1.ok) shelterPets = await r1.json();
		} catch (e) {}

		// Fetch archived pets (alumni)
		var archivedPets = [];
		try {
			var r2 = await fetch('/archived-pets.json');
			if (r2.ok) archivedPets = await r2.json();
		} catch (e) {}

		// Merge catalog
		var combined = (shelterPets || []).concat(archivedPets || []);
		if (!combined.length) {
			combined = [
				{ id: '61388848', name: 'Scoot', type: 'cat', breed: 'Domestic Shorthair', age: '4 months', file: 'https://mchsstorage2urwob6xh6j6s.blob.core.windows.net/pet-photos/61388848.jpg' },
				{ id: '61461825', name: 'Onion Ring', type: 'dog', breed: 'Mixed Breed Large', age: '2 years', file: 'https://mchsstorage2urwob6xh6j6s.blob.core.windows.net/pet-photos/61461825.jpg' },
				{ id: '61448087', name: 'Puma', type: 'dog', breed: 'Terrier Mix', age: '4 years', file: 'https://mchsstorage2urwob6xh6j6s.blob.core.windows.net/pet-photos/61448087.jpg' },
				{ id: '60985568', name: 'Fiona', type: 'dog', breed: 'Mixed Hound', age: '5 years', file: 'https://mchsstorage2urwob6xh6j6s.blob.core.windows.net/pet-photos/60985568.jpg' }
			];
		}
		state.allShelterPets = combined;

		// Fetch backend profile discoveries if available
		if (params.dexUser && params.dexApi) {
			try {
				var serverData = await Dex.fetchDex(params.dexApi, params.dexUser);
				if (serverData) {
					if (serverData.stats && typeof serverData.stats.unopened_packs !== 'undefined') {
						state.unopenedPacks = Math.max(state.unopenedPacks, parseInt(serverData.stats.unopened_packs, 10));
						localStorage.setItem('monroeDexPacks', String(state.unopenedPacks));
					}
					if (serverData.stats && typeof serverData.stats.coin_balance !== 'undefined') {
						state.coinBalance = parseInt(serverData.stats.coin_balance, 10);
						localStorage.setItem('monroeDexCoins', String(state.coinBalance));
					}
					if (Array.isArray(serverData.met_ids)) {
						serverData.met_ids.forEach(function (id) { state.metIdsSet[String(id)] = true; });
					}
				}
			} catch (err) {
				console.warn('[Album] Backend cold start / offline:', err);
			}
		}

		// Ensure that if user has NO discovered cards at all yet, we give them their starter companion so binder isn't barren!
		if (Object.keys(state.metIdsSet).length === 0 && combined.length > 0) {
			state.metIdsSet[String(combined[0].id)] = true;
			try {
				localStorage.setItem('monroe_discovered_pets', JSON.stringify([String(combined[0].id)]));
			} catch (e) {}
		}

		// Build enriched cards array
		state.activeCards = [];
		var petMap = {};
		combined.forEach(function (p) { petMap[String(p.id)] = p; });

		// Add discovered pets
		var discIds = Object.keys(state.metIdsSet);
		var prevSeen = state.seenIdsSnapshot;
		var fresh = {};
		discIds.forEach(function (id, idx) {
			var raw = petMap[id] || { id: id, name: 'Companion #' + id, type: 'dog' };
			state.activeCards.push(computeCardAttributes(raw, idx));
			if (prevSeen && !prevSeen[id]) {
				fresh[id] = true;
			}
		});
		state.freshIds = fresh;
		state.seenIdsSnapshot = {};
		discIds.forEach(function (id) { state.seenIdsSnapshot[id] = true; });

		// Keep Pass card count and album collected list on the same source of truth
		try {
			localStorage.setItem('monroe_discovered_pets', JSON.stringify(Object.keys(state.metIdsSet)));
			localStorage.setItem('monroeDexCards', String(state.activeCards.length));
		} catch (e) {}

		updateHeaderStats();
		applyFilterAndSort();
		setLoading(false);
	}

	function getRankBadge(cardsCount) {
		if (cardsCount >= 25) return 'Humane Hero 👑';
		if (cardsCount >= 15) return 'Master Collector 💎';
		if (cardsCount >= 8) return 'Companion Champion 🏆';
		if (cardsCount >= 3) return 'Shelter Scout ⭐';
		return 'Novice Rescuer 🐾';
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Header & Progress Updates
	// ──────────────────────────────────────────────────────────────────────────
	function updateHeaderStats() {
		var user = (params.dexDisplay || '').trim();
		if (!user || user === 'Guest Rescuer') {
			try {
				user = (localStorage.getItem('monroeDexUser') || '').trim();
			} catch (e) {}
			if (!user) {
				user = params.dexUser || 'Rescuer';
			}
		}
		if (els.title) {
			els.title.textContent = user + '’s Pet Binder';
		}

		var mascotKey = localStorage.getItem('monroeArcadeMascot') || 'smokey';
		var mascot = MASCOTS[mascotKey] || MASCOTS.smokey;
		if (els.playerMascot) {
			els.playerMascot.textContent = mascot.icon;
		}

		var count = state.activeCards.length;
		var totalAvailable = Math.max(87, state.allShelterPets.length);
		var percent = Math.min(100, Math.round((count / totalAvailable) * 100));

		if (els.playerRank) {
			els.playerRank.textContent = getRankBadge(count);
		}

		if (els.playerTotalStats) {
			els.playerTotalStats.textContent = count + ' Collected · 🪙 ' + state.coinBalance + ' Coins';
		}

		if (els.progressFill) {
			els.progressFill.style.width = percent + '%';
		}
		if (els.progressPercent) {
			els.progressPercent.textContent = percent + '% Discovered';
		}
		if (els.progressCounts) {
			els.progressCounts.textContent = count + ' / ' + totalAvailable + ' Companions';
		}

		// Unopened Packs Notification Pill
		if (els.packPill && els.packCount && els.openPacksBtn) {
			if (state.unopenedPacks > 0) {
				els.packCount.textContent = state.unopenedPacks + (state.unopenedPacks === 1 ? ' Pack Ready' : ' Packs Ready');
				var boosterUrl = '../booster/index.html?embed=' + (window.location.search.includes('embed=1') ? '1' : '0')
					+ '&dex_user=' + encodeURIComponent(params.dexUser)
					+ '&dex_api=' + encodeURIComponent(params.dexApi);
				els.openPacksBtn.href = boosterUrl;
				els.packPill.hidden = false;
			} else {
				els.packPill.hidden = true;
			}
		}
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Filtering & Sorting
	// ──────────────────────────────────────────────────────────────────────────
	function applyFilterAndSort() {
		var list = state.activeCards.slice();

		// 1. Filter by species
		if (state.filterSpecies !== 'all') {
			list = list.filter(function (c) {
				return c.species === state.filterSpecies;
			});
		}

		// 2. Filter by rarity
		if (state.filterRarity !== 'all') {
			list = list.filter(function (c) {
				return c.rarity === state.filterRarity;
			});
		}

		// 3. Search query
		if (state.searchQuery) {
			var q = state.searchQuery.toLowerCase();
			list = list.filter(function (c) {
				var haystack = [c.name, c.breed, c.signatureMove.name, c.signatureMove.effect, c.dexNumber, c.location].join(' ').toLowerCase();
				return haystack.indexOf(q) !== -1;
			});
		}

		// 4. Sort
		list.sort(function (a, b) {
			if (state.sortMode === 'name_asc') {
				return a.name.localeCompare(b.name);
			} else if (state.sortMode === 'rarity_desc') {
				var rWeight = { alumni: 5, golden_senior: 4, longtimer: 3, tiny_wonder: 2, common: 1 };
				return (rWeight[b.rarity] || 0) - (rWeight[a.rarity] || 0);
			} else if (state.sortMode === 'type_asc') {
				return a.species.localeCompare(b.species) || a.dexIndex - b.dexIndex;
			}
			// Default dex_asc
			return a.dexIndex - b.dexIndex;
		});

		state.filteredCards = list;
		state.pocketsPerSheet = determinePocketsPerSheet();
		state.currentSheet = Math.min(state.currentSheet, Math.max(0, Math.ceil(list.length / state.pocketsPerSheet) - 1));

		renderCurrentView();
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Render Views (Binder vs Grid)
	// ──────────────────────────────────────────────────────────────────────────
	function renderCurrentView() {
		if (state.viewMode === 'binder') {
			if (els.binderBookStage) els.binderBookStage.hidden = false;
			if (els.binderGridStage) els.binderGridStage.hidden = true;
			renderBinderSheet();
		} else {
			if (els.binderBookStage) els.binderBookStage.hidden = true;
			if (els.binderGridStage) els.binderGridStage.hidden = false;
			renderShowcaseGrid();
		}

		// Empty state (collection empty vs filters empty)
		if (state.filteredCards.length === 0) {
			if (els.emptyState) els.emptyState.hidden = false;
			if (els.binderPocketsGrid) els.binderPocketsGrid.style.display = 'none';
			if (els.binderShowcaseGrid) els.binderShowcaseGrid.style.display = 'none';
			var collectionEmpty = !state.activeCards || state.activeCards.length === 0;
			var filtersOn = countActiveFilters() > 0;
			if (els.emptyTitle) {
				els.emptyTitle.textContent = collectionEmpty ? 'Your binder is empty' : 'No matching cards';
			}
			if (els.emptyDesc) {
				els.emptyDesc.textContent = collectionEmpty
					? 'Open booster packs or claim a Daily Pack to discover shelter companions.'
					: (filtersOn
						? 'No cards match your active filters. Reset filters, or open packs to discover more companions.'
						: 'No cards to show right now.');
			}
			if (els.btnResetFilters) els.btnResetFilters.hidden = collectionEmpty || !filtersOn;
		} else {
			if (els.emptyState) els.emptyState.hidden = true;
			if (els.binderPocketsGrid) els.binderPocketsGrid.style.display = '';
			if (els.binderShowcaseGrid) els.binderShowcaseGrid.style.display = '';
		}
		updateFiltersBadge();
	}

	function renderBinderSheet() {
		if (!els.binderPocketsGrid) return;
		els.binderPocketsGrid.innerHTML = '';

		var totalCards = state.filteredCards.length;
		var totalSheets = Math.max(1, Math.ceil(totalCards / state.pocketsPerSheet));
		var startIndex = state.currentSheet * state.pocketsPerSheet;
		var pageCards = state.filteredCards.slice(startIndex, startIndex + state.pocketsPerSheet);

		// Render pockets (exactly pocketsPerSheet pockets per sheet)
		for (var slot = 0; slot < state.pocketsPerSheet; slot++) {
			var card = pageCards[slot];
			var pocketCell = document.createElement('div');
			pocketCell.className = 'pocket-cell';

			if (card) {
				pocketCell.classList.add('pocket-cell--occupied');
				pocketCell.setAttribute('data-card-id', card.id);
				pocketCell.setAttribute('title', 'Click to inspect ' + card.name + ' in 3D');
				if (state.freshIds && state.freshIds[card.id]) {
					pocketCell.classList.add('pocket-cell--inserting');
					(function (cell, id) {
						window.setTimeout(function () {
							cell.classList.remove('pocket-cell--inserting');
							if (state.freshIds) delete state.freshIds[id];
						}, 700);
					})(pocketCell, card.id);
				}

				var foilClass = card.foil !== 'none' ? ('foil-' + card.foil + ((card.foil === 'prism' || card.foil === 'gold' || card.foil === 'cosmos' || card.foil === 'aurora') ? ' binder-card--foil-flex' : '')) : '';

				pocketCell.innerHTML =
					'<div class="binder-card ' + foilClass + '">' +
						'<div class="binder-card__foil"></div>' +
						'<div class="binder-card__header">' +
							'<span class="binder-card__dex">' + card.dexNumber + '</span>' +
							'<span class="binder-card__name">' + card.name + '</span>' +
							'<span class="binder-card__species">' + card.speciesLabel.slice(0, 2) + '</span>' +
						'</div>' +
						'<div class="binder-card__photo-window">' +
							'<img class="binder-card__photo" src="' + card.photoUrl + '" alt="' + card.name + '" loading="lazy">' +
							'<span class="binder-card__rarity-badge">' + card.rarityLabel + '</span>' +
						'</div>' +
						'<div class="binder-card__body">' +
							'<span class="binder-card__breed">' + card.breed + '</span>' +
							'<div class="binder-card__move">' +
								'<span>' + card.signatureMove.icon + ' ' + card.signatureMove.name + '</span>' +
							'</div>' +
							'<div class="binder-card__stats">' +
								'<span class="binder-card__stat-item">⚡ ' + card.stats.energy + '</span>' +
								'<span class="binder-card__stat-item">💖 ' + card.stats.cuddle + '</span>' +
								'<span class="binder-card__stat-item">⭐ ' + card.stats.loyalty + '</span>' +
							'</div>' +
						'</div>' +
					'</div>';

				(function (c, globalIdx) {
					pocketCell.addEventListener('click', function () {
						openInspector(globalIdx);
					});
				})(card, startIndex + slot);

				bindPocketTilt(pocketCell);
			} else {
				// Empty pocket placeholder
				var slotNum = startIndex + slot + 1;
				pocketCell.innerHTML =
					'<div class="pocket-empty">' +
						'<span class="pocket-empty__paw">🐾</span>' +
						'<span class="pocket-empty__label">Pocket #' + slotNum + '</span>' +
						'<span class="pocket-empty__hint">Open packs to fill this sleeve</span>' +
					'</div>';
			}

			els.binderPocketsGrid.appendChild(pocketCell);
		}

		// Update Sheet Controls
		if (els.sheetPageIndicator) {
			els.sheetPageIndicator.textContent = 'Sheet ' + (state.currentSheet + 1) + ' of ' + totalSheets;
		}

		if (els.btnSheetPrev) {
			els.btnSheetPrev.disabled = state.currentSheet === 0;
		}
		if (els.btnSheetNext) {
			els.btnSheetNext.disabled = state.currentSheet >= totalSheets - 1;
		}

		// Sheet Dots
		if (els.sheetDots) {
			els.sheetDots.innerHTML = '';
			for (var d = 0; d < totalSheets; d++) {
				var dot = document.createElement('button');
				dot.type = 'button';
				dot.className = 'sheet-dot' + (d === state.currentSheet ? ' is-active' : '');
				dot.setAttribute('aria-label', 'Jump to Sheet ' + (d + 1));
				(function (targetSheet) {
					dot.addEventListener('click', function () {
						goToSheet(targetSheet);
					});
				})(d);
				els.sheetDots.appendChild(dot);
			}
		}
	}

	function renderShowcaseGrid() {
		if (!els.binderShowcaseGrid) return;
		els.binderShowcaseGrid.innerHTML = '';

		state.filteredCards.forEach(function (card, idx) {
			var pocketCell = document.createElement('div');
			pocketCell.className = 'pocket-cell pocket-cell--occupied';
			pocketCell.setAttribute('data-card-id', card.id);
			pocketCell.setAttribute('title', 'Click to inspect ' + card.name + ' in 3D');

			var foilClass = card.foil !== 'none' ? ('foil-' + card.foil + ((card.foil === 'prism' || card.foil === 'gold' || card.foil === 'cosmos' || card.foil === 'aurora') ? ' binder-card--foil-flex' : '')) : '';

			pocketCell.innerHTML =
				'<div class="binder-card ' + foilClass + '">' +
					'<div class="binder-card__foil"></div>' +
					'<div class="binder-card__header">' +
						'<span class="binder-card__dex">' + card.dexNumber + '</span>' +
						'<span class="binder-card__name">' + card.name + '</span>' +
						'<span class="binder-card__species">' + card.speciesLabel.slice(0, 2) + '</span>' +
					'</div>' +
					'<div class="binder-card__photo-window">' +
						'<img class="binder-card__photo" src="' + card.photoUrl + '" alt="' + card.name + '" loading="lazy">' +
						'<span class="binder-card__rarity-badge">' + card.rarityLabel + '</span>' +
					'</div>' +
					'<div class="binder-card__body">' +
						'<span class="binder-card__breed">' + card.breed + '</span>' +
						'<div class="binder-card__move">' +
							'<span>' + card.signatureMove.icon + ' ' + card.signatureMove.name + '</span>' +
						'</div>' +
						'<div class="binder-card__stats">' +
							'<span class="binder-card__stat-item">⚡ ' + card.stats.energy + '</span>' +
							'<span class="binder-card__stat-item">💖 ' + card.stats.cuddle + '</span>' +
							'<span class="binder-card__stat-item">⭐ ' + card.stats.loyalty + '</span>' +
						'</div>' +
					'</div>' +
				'</div>';

			pocketCell.addEventListener('click', function () {
				openInspector(idx);
			});

			bindPocketTilt(pocketCell);
			els.binderShowcaseGrid.appendChild(pocketCell);
		});
	}

	function goToSheet(sheetIdx) {
		var totalCards = state.filteredCards.length;
		var totalSheets = Math.max(1, Math.ceil(totalCards / state.pocketsPerSheet));
		if (sheetIdx < 0 || sheetIdx >= totalSheets) return;

		SoundEngine.playPageTurn();
		state.currentSheet = sheetIdx;

		var surface = document.getElementById('binderSheetSurface');
		if (surface) {
			surface.style.transform = 'scale(0.98) rotateY(-4deg)';
			surface.style.opacity = '0.7';
			setTimeout(function () {
				renderBinderSheet();
				surface.style.transform = 'none';
				surface.style.opacity = '1';
			}, 150);
		} else {
			renderBinderSheet();
		}
	}

	function prefersAlbumReducedMotion() {
		try {
			return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		} catch (e) {
			return false;
		}
	}

	function bindPocketTilt(el) {
		function applyTilt(clientX, clientY) {
			var rect = el.getBoundingClientRect();
			var x = clientX - rect.left;
			var y = clientY - rect.top;
			var px = Math.min(1, Math.max(0, x / rect.width));
			var py = Math.min(1, Math.max(0, y / rect.height));
			var deg = Math.atan2(y - rect.height / 2, x - rect.width / 2) * 180 / Math.PI + 180;
			el.style.setProperty('--pointer-x', (px * 100).toFixed(1) + '%');
			el.style.setProperty('--pointer-y', (py * 100).toFixed(1) + '%');
			el.style.setProperty('--pointer-deg', deg.toFixed(1) + 'deg');
			if (!prefersAlbumReducedMotion()) {
				var tiltY = ((px - 0.5) * 14).toFixed(2) + 'deg';
				var tiltX = ((0.5 - py) * 10).toFixed(2) + 'deg';
				el.style.setProperty('--tilt-x', tiltX);
				el.style.setProperty('--tilt-y', tiltY);
				el.classList.add('is-tilting');
			}
		}

		function resetTilt() {
			el.style.setProperty('--pointer-x', '50%');
			el.style.setProperty('--pointer-y', '50%');
			el.style.setProperty('--pointer-deg', '135deg');
			el.style.setProperty('--tilt-x', '0deg');
			el.style.setProperty('--tilt-y', '0deg');
			el.classList.remove('is-tilting');
		}

		el.addEventListener('pointermove', function (e) {
			applyTilt(e.clientX, e.clientY);
		});

		el.addEventListener('pointerdown', function (e) {
			applyTilt(e.clientX, e.clientY);
			kickShine(el, 950);
		});

		el.addEventListener('pointerleave', resetTilt);
		el.addEventListener('pointerup', function () {
			window.setTimeout(resetTilt, 180);
		});
	}

	function bindInspectorTilt() {
		if (!els.inspectorCardHost || els.inspectorCardHost.dataset.tiltBound === '1') return;
		els.inspectorCardHost.dataset.tiltBound = '1';
		var host = els.inspectorCardHost;

		function apply(clientX, clientY) {
			if (prefersAlbumReducedMotion()) return;
			var rect = host.getBoundingClientRect();
			var px = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
			var py = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
			host.style.setProperty('--insp-tilt-y', ((px - 0.5) * 16).toFixed(2) + 'deg');
			host.style.setProperty('--insp-tilt-x', ((0.5 - py) * 12).toFixed(2) + 'deg');
			host.classList.add('is-tilting');
			host.style.setProperty('--pointer-x', (px * 100).toFixed(1) + '%');
			host.style.setProperty('--pointer-y', (py * 100).toFixed(1) + '%');
			host.style.setProperty('--pointer-deg', (Math.atan2(py - 0.5, px - 0.5) * 180 / Math.PI + 180).toFixed(1) + 'deg');
		}

		function reset() {
			host.style.setProperty('--insp-tilt-x', '0deg');
			host.style.setProperty('--insp-tilt-y', '0deg');
			host.classList.remove('is-tilting');
		}

		host.addEventListener('pointermove', function (e) { apply(e.clientX, e.clientY); });
		host.addEventListener('pointerdown', function (e) {
			apply(e.clientX, e.clientY);
			kickShine(host, 950);
		});
		host.addEventListener('pointerleave', reset);
		host.addEventListener('pointerup', function () { window.setTimeout(reset, 160); });
	}

	// ──────────────────────────────────────────────────────────────────────────
	// 3D Card Inspector Modal
	// ──────────────────────────────────────────────────────────────────────────
	function openInspector(cardIndex) {
		if (cardIndex < 0 || cardIndex >= state.filteredCards.length) return;
		state.inspectorIndex = cardIndex;
		state.isInspectorFlipped = false;

		SoundEngine.playCardWhoosh();
		renderInspectorCard();
		bindInspectorTilt();
		kickShine(els.inspectorCardHost, 950);

		if (els.inspectorModal) {
			els.inspectorModal.hidden = false;
			document.body.style.overflow = 'hidden';
		}
	}

	function closeInspector() {
		if (els.inspectorModal) {
			els.inspectorModal.hidden = true;
			document.body.style.overflow = '';
		}
	}

	function renderInspectorCard() {
		var card = state.filteredCards[state.inspectorIndex];
		if (!card || !els.inspectorCardHost) return;

		var foilClass = card.foil !== 'none' ? ('foil-' + card.foil + ((card.foil === 'prism' || card.foil === 'gold' || card.foil === 'cosmos' || card.foil === 'aurora') ? ' binder-card--foil-flex' : '')) : '';

		els.inspectorCardHost.className = 'inspector-card-host' + (state.isInspectorFlipped ? ' is-flipped' : '');

		els.inspectorCardHost.innerHTML =
			'<!-- FRONT FACE -->' +
			'<div class="inspector-face inspector-face--front ' + foilClass + '">' +
				'<div class="binder-card" style="padding: 10px;">' +
					'<div class="binder-card__foil"></div>' +
					'<div class="binder-card__header">' +
						'<span class="binder-card__dex" style="font-size:0.85rem; padding: 2px 6px;">' + card.dexNumber + '</span>' +
						'<h2 class="binder-card__name" id="inspectorPetName" style="font-size:1.25rem;">' + card.name + '</h2>' +
						'<span class="binder-card__species" style="font-size:1rem;">' + card.speciesLabel + '</span>' +
					'</div>' +
					'<div class="binder-card__photo-window" style="aspect-ratio: 1.3 / 1;">' +
						'<img class="binder-card__photo" src="' + card.photoUrl + '" alt="' + card.name + '">' +
						'<span class="binder-card__rarity-badge" style="font-size:0.75rem; padding: 3px 8px;">' + card.rarityLabel + '</span>' +
					'</div>' +
					'<div class="binder-card__body" style="padding: 8px 4px;">' +
						'<span class="binder-card__breed" style="font-size:0.85rem;">🧬 ' + card.breed + ' · 🎂 ' + card.ageDisplay + '</span>' +
						'<div class="binder-card__move" style="padding: 6px 10px; font-size:0.82rem; margin: 4px 0;">' +
							'<div>' +
								'<strong>' + card.signatureMove.icon + ' ' + card.signatureMove.name + '</strong>' +
								'<p style="margin: 2px 0 0; font-size: 0.72rem; font-weight: 500; color: #475569;">' + card.signatureMove.effect + '</p>' +
							'</div>' +
						'</div>' +
						'<div class="binder-card__stats" style="padding: 6px; font-size: 0.8rem;">' +
							'<span>⚡ Energy: ' + card.stats.energy + '</span>' +
							'<span>💖 Cuddle: ' + card.stats.cuddle + '</span>' +
							'<span>⭐ Loyalty: ' + card.stats.loyalty + '</span>' +
						'</div>' +
					'</div>' +
				'</div>' +
			'</div>' +

			'<!-- BACK FACE (Full Rescue Bio & Medallion) -->' +
			'<div class="inspector-face inspector-face--back">' +
				'<div class="inspector-back-header">' +
					'<span style="font-size: 2rem;">🐾</span>' +
					'<h3 class="inspector-back-title">' + card.name + '</h3>' +
					'<div class="inspector-back-subtitle">ID #' + card.id + ' · ' + card.speciesLabel + ' · ' + card.gender + '</div>' +
				'</div>' +
				'<div class="inspector-back-bio">' +
					'<strong>Rescue Story:</strong><br>' +
					(card.description || 'A gentle soul currently thriving at Monroe County Humane Society.') +
				'</div>' +
				'<div class="inspector-back-traits">' +
					'<span class="trait-tag">🏠 ' + card.location + '</span>' +
					'<span class="trait-tag">📅 Intake: ' + card.intakeDate + '</span>' +
					'<span class="trait-tag">' + (card.isAdopted ? '💖 Adopted Alumni' : '✨ Seeking Forever Home') + '</span>' +
				'</div>' +
				'<div class="inspector-back-footer">' +
					'<span>Official Monroe Collector Card</span>' +
					'<span>Tap to Flip 🔄</span>' +
				'</div>' +
			'</div>';

		// Update Adopt button
		if (els.inspectorAdoptBtn) {
			els.inspectorAdoptBtn.href = card.adoptionUrl;
		}

		// Update Prev/Next buttons
		if (els.inspectorNavPrev) {
			els.inspectorNavPrev.disabled = state.inspectorIndex <= 0;
		}
		if (els.inspectorNavNext) {
			els.inspectorNavNext.disabled = state.inspectorIndex >= state.filteredCards.length - 1;
		}
	}

	function toggleInspectorFlip() {
		state.isInspectorFlipped = !state.isInspectorFlipped;
		SoundEngine.playCardWhoosh();
		if (els.inspectorCardHost) {
			els.inspectorCardHost.classList.toggle('is-flipped', state.isInspectorFlipped);
		}
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Event Listeners & Binding
	// ──────────────────────────────────────────────────────────────────────────

	function runAlbumGameplayHooks() {
		if (!Dex || !params.dexUser) return;
		var api = params.dexApi;
		var user = params.dexUser;

		Dex.claimDailyStreak(api, user, 'dex').then(function (res) {
			if (res && res.claimed) {
				state.unopenedPacks = (state.unopenedPacks || 0) + (res.packsAwarded || 1);
				if (typeof res.coinsAwarded === 'number') {
					state.coinBalance = (state.coinBalance || 0) + res.coinsAwarded;
				}
				updateHeaderStats();
				Dex.fetchDex(api, user).then(function (d) {
					if (d && d.stats) {
						state.unopenedPacks = d.stats.unopened_packs || state.unopenedPacks;
						state.coinBalance = typeof d.stats.coin_balance === 'number' ? d.stats.coin_balance : state.coinBalance;
						Dex.syncLocalPacksFromProfile(d);
						updateHeaderStats();
					}
				}).catch(function () {});
			}
			if (els.dailyStreakBtn) {
				els.dailyStreakBtn.title = (res && res.claimed === false)
					? 'Already claimed today — come back tomorrow!'
					: (res && res.claimed ? 'Claimed! See you tomorrow.' : 'Claim your daily streak pack');
			}
		}).catch(function () {});

		var catCount = 0, dogCount = 0;
		(state.activeCards || []).forEach(function (c) {
			var t = String(c.species || c.type || '').toLowerCase();
			if (t.indexOf('cat') >= 0) catCount++;
			else if (t.indexOf('dog') >= 0) dogCount++;
		});
		if (typeof Dex.claimSpeciesScout === 'function') {
			Dex.claimSpeciesScout(api, user, 'cat', catCount).then(function (res) {
				if (res && res.claimed) loadAllData();
			}).catch(function () {});
			Dex.claimSpeciesScout(api, user, 'dog', dogCount).then(function (res) {
				if (res && res.claimed) loadAllData();
			}).catch(function () {});
		}
	}

	function closePackReveal() {
		if (!els.packReveal) return;
		els.packReveal.hidden = true;
		if (els.packRevealGrid) els.packRevealGrid.innerHTML = '';
	}

	function showPackReveal(packData) {
		if (!els.packReveal || !els.packRevealGrid || !Dex || !Dex.createFlipCard) return;
		els.packRevealGrid.innerHTML = '';
		var rarity = packData.pack_rarity || packData.packRarity || 'common';
		var rarityLabel = packData.pack_rarity_label || packData.packRarityLabel || (rarity + ' pack');
		if (els.packRevealBadge) els.packRevealBadge.textContent = '🎁 Pack opened';
		if (els.packRevealRarity) {
			els.packRevealRarity.textContent = rarityLabel + (packData.coins_awarded ? (' · +' + packData.coins_awarded + ' coins') : '');
			els.packRevealRarity.classList.toggle('is-rare', rarity === 'rare' || rarity === 'uncommon');
		}
		(packData.cards || []).forEach(function (pet) {
			var foil = Dex.foilFromRarity(pet.rarity || rarity);
			var li = Dex.createFlipCard(pet, {
				met: true,
				mode: 'collection',
				readOnly: true,
				foil: foil,
				rarity: pet.rarity || rarity,
				highlight: rarity === 'rare' || foil !== 'none',
				startFlipped: false,
			});
			var isRarePull = rarity === 'rare' || foil === 'prism' || foil === 'gold' || foil === 'cosmos';
			if (rarity === 'rare' || foil !== 'none') {
				li.classList.add('adoptedex-card-wrap--foil-flex');
			}
			if (isRarePull) {
				li.classList.add('adoptedex-card-wrap--rare-pulse');
			}
			els.packRevealGrid.appendChild(li);
			var cardBtn = li.querySelector('.adoptedex-card');
			if (cardBtn) {
				setTimeout(function () { cardBtn.classList.add('is-flipped'); }, 400 + Math.random() * 400);
			}
		});
		els.packReveal.hidden = false;
		if ((rarity === 'rare' || rarity === 'uncommon') && Dex.showRewardToast) {
			Dex.showRewardToast({
				title: 'Foil flex!',
				message: 'Holographic ' + rarityLabel + ' — your binder is looking shiny.',
				icon: '✨',
				rare: true,
			});
		}
	}

	function offlineDrawCards(tier) {
		var count = tier === 'deluxe' ? 3 : (tier === 'duo' ? 2 : 1);
		var pool = (state.allShelterPets || []).slice();
		if (!pool.length) return [];
		for (var i = pool.length - 1; i > 0; i--) {
			var j = Math.floor(Math.random() * (i + 1));
			var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
		}
		return pool.slice(0, count).map(function (p) {
			return {
				id: p.id,
				name: p.name,
				file: p.file || p.photo || p.image,
				type: p.type || p.species_label,
				breed: p.breed,
				age: p.age_display || p.age,
				gender: p.gender,
				url: p.url,
				archived: !!p.archived,
			};
		});
	}

	function boosterUrl() {
		return '../booster/index.html?embed=' + (window.location.search.indexOf('embed=1') >= 0 ? '1' : '0')
			+ '&dex_user=' + encodeURIComponent(params.dexUser || '')
			+ '&dex_api=' + encodeURIComponent(params.dexApi || '');
	}

	function quickOpenPack(tier) {
		tier = tier || 'standard';
		if ((state.unopenedPacks || 0) <= 0) {
			showError('No packs to open — earn one in a game, claim Daily, or buy with coins.');
			return;
		}
		if (els.quickOpenBtn) els.quickOpenBtn.disabled = true;
		if (els.packRevealBooster) els.packRevealBooster.href = boosterUrl();

		var openPromise = (Dex && params.dexUser && typeof Dex.openPack === 'function')
			? Dex.openPack(params.dexApi, params.dexUser, tier)
			: Promise.reject(new Error('offline'));

		openPromise.then(function (data) {
			state.unopenedPacks = typeof data.unopened_packs === 'number' ? data.unopened_packs : Math.max(0, (state.unopenedPacks || 1) - 1);
			if (typeof data.coin_balance === 'number') state.coinBalance = data.coin_balance;
			if (Dex && Dex.syncLocalPacksFromProfile) Dex.syncLocalPacksFromProfile(data);
			updateHeaderStats();
			showPackReveal(data);
			loadAllData();
			try {
				if (window.parent && window.parent !== window) {
					window.parent.postMessage({
						type: 'adoptedex:pack_opened',
						tier: data.tier || tier,
						packRarity: data.pack_rarity,
						remainingPacks: data.unopened_packs
					}, '*');
				}
			} catch (e) {}
		}).catch(function (err) {
			console.warn('[Album] openPack failed, offline draw:', err);
			var cards = offlineDrawCards(tier);
			if (!cards.length) {
				showError((err && err.message) || 'Could not open pack.');
				return;
			}
			state.unopenedPacks = Math.max(0, (state.unopenedPacks || 1) - 1);
			try { localStorage.setItem('monroeDexPacks', String(state.unopenedPacks)); } catch (e) {}
			cards.forEach(function (c) {
				if (c && c.id) state.metIdsSet[String(c.id)] = true;
			});
			try { localStorage.setItem('monroe_discovered_pets', JSON.stringify(Object.keys(state.metIdsSet))); } catch (e) {}
			updateHeaderStats();
			showPackReveal({ cards: cards, pack_rarity: 'common', pack_rarity_label: tier + ' pack (offline)', tier: tier, unopened_packs: state.unopenedPacks });
			loadAllData();
		}).then(function () {
			if (els.quickOpenBtn) els.quickOpenBtn.disabled = false;
		});
	}

	function buyPackFromShop() {
		if (!Dex || !params.dexUser) return;
		if ((state.coinBalance || 0) < 25) {
			showError('Need 25 coins to buy a pack. Play games to earn coins!');
			return;
		}
		if (els.buyPackBtn) els.buyPackBtn.disabled = true;
		Dex.buyPackWithCoins(params.dexApi, params.dexUser, 25).then(function (data) {
			if (data && data.ok) {
				if (typeof data.coin_balance === 'number') state.coinBalance = data.coin_balance;
				else state.coinBalance = Math.max(0, (state.coinBalance || 0) - (data.spent || 25));
				state.unopenedPacks = typeof data.unopened_packs === 'number'
					? data.unopened_packs
					: (state.unopenedPacks || 0) + (data.packsAwarded || 1);
				Dex.syncLocalPacksFromProfile({ unopened_packs: state.unopenedPacks, stats: { unopened_packs: state.unopenedPacks, coin_balance: state.coinBalance } });
				updateHeaderStats();
			} else {
				showError((data && data.message) || 'Could not buy pack.');
			}
		}).catch(function (err) {
			showError((err && err.message) || 'Could not buy pack.');
		}).then(function () {
			if (els.buyPackBtn) els.buyPackBtn.disabled = false;
		});
	}

	function bindEvents() {
		// View mode toggles
		if (els.btnViewBinder && els.btnViewGrid) {
			els.btnViewBinder.addEventListener('click', function () {
				state.viewMode = 'binder';
				els.btnViewBinder.classList.add('is-active');
				els.btnViewGrid.classList.remove('is-active');
				els.btnViewBinder.setAttribute('aria-selected', 'true');
				els.btnViewGrid.setAttribute('aria-selected', 'false');
				renderCurrentView();
			});

			els.btnViewGrid.addEventListener('click', function () {
				state.viewMode = 'grid';
				els.btnViewGrid.classList.add('is-active');
				els.btnViewBinder.classList.remove('is-active');
				els.btnViewGrid.setAttribute('aria-selected', 'true');
				els.btnViewBinder.setAttribute('aria-selected', 'false');
				renderCurrentView();
			});
		}

		// Search input
		if (els.search) {
			els.search.addEventListener('input', function () {
				state.searchQuery = (els.search.value || '').trim();
				if (els.searchClear) els.searchClear.hidden = !state.searchQuery;
				applyFilterAndSort();
			});
		}
		if (els.searchClear) {
			els.searchClear.addEventListener('click', function () {
				if (els.search) els.search.value = '';
				state.searchQuery = '';
				els.searchClear.hidden = true;
				applyFilterAndSort();
			});
		}

		// Species chips
		els.speciesChips.forEach(function (chip) {
			chip.addEventListener('click', function () {
				els.speciesChips.forEach(function (c) { c.classList.remove('is-active'); });
				chip.classList.add('is-active');
				state.filterSpecies = chip.getAttribute('data-filter-species') || 'all';
				applyFilterAndSort();
			});
		});

		// Rarity chips
		els.rarityChips.forEach(function (chip) {
			chip.addEventListener('click', function () {
				els.rarityChips.forEach(function (c) { c.classList.remove('is-active'); });
				chip.classList.add('is-active');
				state.filterRarity = chip.getAttribute('data-filter-rarity') || 'all';
				applyFilterAndSort();
			});
		});

		// Sort select
		if (els.sortSelect) {
			els.sortSelect.addEventListener('change', function () {
				state.sortMode = els.sortSelect.value;
				applyFilterAndSort();
			});
		}

		// Filters drawer + shop compaction
		if (els.filtersToggle) {
			els.filtersToggle.addEventListener('click', function () {
				var open = els.filtersToggle.getAttribute('aria-expanded') !== 'true';
				setFiltersExpanded(open);
			});
		}
		if (els.shopToggle) {
			els.shopToggle.addEventListener('click', function () {
				var open = els.shopToggle.getAttribute('aria-expanded') !== 'true';
				setShopExpanded(open);
			});
		}
		syncChromeCollapse();
		var chromeMq;
		try {
			chromeMq = window.matchMedia('(max-width: 768px), (pointer: coarse)');
			var onChromeChange = function () { syncChromeCollapse(); };
			if (chromeMq.addEventListener) chromeMq.addEventListener('change', onChromeChange);
			else if (chromeMq.addListener) chromeMq.addListener(onChromeChange);
		} catch (eMq) {}
		updateFiltersBadge();

		// Sheet navigation
		if (els.btnSheetPrev) {
			els.btnSheetPrev.addEventListener('click', function () {
				goToSheet(state.currentSheet - 1);
			});
		}
		if (els.btnSheetNext) {
			els.btnSheetNext.addEventListener('click', function () {
				goToSheet(state.currentSheet + 1);
			});
		}

		// Empty state reset
		if (els.btnResetFilters) {
			els.btnResetFilters.addEventListener('click', function () {
				state.filterSpecies = 'all';
				state.filterRarity = 'all';
				state.searchQuery = '';
				if (els.search) els.search.value = '';
				if (els.searchClear) els.searchClear.hidden = true;
				els.speciesChips.forEach(function (c, i) { c.classList.toggle('is-active', i === 0); });
				els.rarityChips.forEach(function (c, i) { c.classList.toggle('is-active', i === 0); });
				if (els.sortSelect) { els.sortSelect.value = 'dex_asc'; state.sortMode = 'dex_asc'; }
				applyFilterAndSort();
			});
		}

		// Inspector controls
		if (els.inspectorBackdrop) els.inspectorBackdrop.addEventListener('click', closeInspector);
		if (els.inspectorCloseBtn) els.inspectorCloseBtn.addEventListener('click', closeInspector);
		if (els.btnInspectorFlip) els.btnInspectorFlip.addEventListener('click', toggleInspectorFlip);
		if (els.inspectorCardHost) els.inspectorCardHost.addEventListener('click', toggleInspectorFlip);

		if (els.inspectorNavPrev) {
			els.inspectorNavPrev.addEventListener('click', function () {
				if (state.inspectorIndex > 0) {
					openInspector(state.inspectorIndex - 1);
				}
			});
		}
		if (els.inspectorNavNext) {
			els.inspectorNavNext.addEventListener('click', function () {
				if (state.inspectorIndex < state.filteredCards.length - 1) {
					openInspector(state.inspectorIndex + 1);
				}
			});
		}

		// Share / QR Action
		if (els.btnInspectorShare) {
			els.btnInspectorShare.addEventListener('click', function () {
				var card = state.filteredCards[state.inspectorIndex];
				if (!card) return;
				if (navigator.share) {
					navigator.share({
						title: card.name + ' - Monroe Humane Pet Card',
						text: 'Check out ' + card.name + ' (' + card.breed + ') at Monroe County Humane Society!',
						url: window.location.origin + card.adoptionUrl
					}).catch(function () {});
				} else {
					var url = window.location.origin + card.adoptionUrl;
					if (navigator.clipboard && navigator.clipboard.writeText) {
						navigator.clipboard.writeText(url).then(function () {
							showError('Adoption link copied to clipboard!');
						});
					} else {
						window.open(card.adoptionUrl, '_blank');
					}
				}
			});
		}


		if (els.quickOpenBtn) {
			els.quickOpenBtn.addEventListener('click', quickOpenPack);
		}
		if (els.packRevealClose) {
			els.packRevealClose.addEventListener('click', closePackReveal);
		}
		if (els.packReveal) {
			els.packReveal.addEventListener('click', function (e) {
				if (e.target === els.packReveal) closePackReveal();
			});
		}
		if (els.buyPackBtn) {
			els.buyPackBtn.addEventListener('click', buyPackFromShop);
		}
		if (els.dailyStreakBtn) {
			els.dailyStreakBtn.addEventListener('click', function () {
				if (!Dex || !params.dexUser) return;
				els.dailyStreakBtn.disabled = true;
				Dex.claimDailyStreak(params.dexApi, params.dexUser, 'dex')
					.then(function (res) {
						if (res && res.claimed) {
							loadAllData();
						} else {
							showError('Daily pack already claimed today. See you tomorrow!');
						}
					})
					.catch(function (e) { showError((e && e.message) || 'Daily claim failed'); })
					.then(function () { els.dailyStreakBtn.disabled = false; });
			});
		}

		// Deep-link from Shelter Run / hub: #open-pack or ?pack=
		var hashOpen = (window.location.hash || '').indexOf('open-pack') >= 0;
		var packTier = new URLSearchParams(window.location.search).get('pack');
		if (hashOpen || packTier) {
			setTimeout(function () { quickOpenPack(packTier || 'standard'); }, 400);
		}

		// Touch swipe: turn binder sheets (ignore when inspector open)
		(function bindSheetSwipe() {
			var stage = els.binderBookStage || document.getElementById('binderBookStage');
			if (!stage) return;
			var startX = 0, startY = 0, tracking = false;
			stage.addEventListener('touchstart', function (e) {
				if (!els.inspectorModal || !els.inspectorModal.hidden) return;
				if (state.viewMode !== 'binder') return;
				if (!e.changedTouches || !e.changedTouches.length) return;
				startX = e.changedTouches[0].clientX;
				startY = e.changedTouches[0].clientY;
				tracking = true;
			}, { passive: true });
			stage.addEventListener('touchend', function (e) {
				if (!tracking) return;
				tracking = false;
				if (!e.changedTouches || !e.changedTouches.length) return;
				var dx = e.changedTouches[0].clientX - startX;
				var dy = e.changedTouches[0].clientY - startY;
				if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
				if (dx < 0) goToSheet(state.currentSheet + 1);
				else goToSheet(state.currentSheet - 1);
			}, { passive: true });
		})();

		// Keyboard controls
		window.addEventListener('keydown', function (e) {
			if (!els.inspectorModal || els.inspectorModal.hidden) {
				// Binder view navigation with Arrow keys
				if (e.key === 'ArrowLeft' && state.viewMode === 'binder') {
					goToSheet(state.currentSheet - 1);
				} else if (e.key === 'ArrowRight' && state.viewMode === 'binder') {
					goToSheet(state.currentSheet + 1);
				}
				return;
			}

			// Modal is open
			if (e.key === 'Escape') {
				if (els.packReveal && !els.packReveal.hidden) {
					closePackReveal();
					return;
				}
				closeInspector();
			} else if (e.key === ' ' || e.key === 'Enter') {
				toggleInspectorFlip();
			} else if (e.key === 'ArrowLeft' && state.inspectorIndex > 0) {
				openInspector(state.inspectorIndex - 1);
			} else if (e.key === 'ArrowRight' && state.inspectorIndex < state.filteredCards.length - 1) {
				openInspector(state.inspectorIndex + 1);
			}
		});

		// Responsive layout resize handler
		window.addEventListener('resize', function () {
			var newPockets = determinePocketsPerSheet();
			if (newPockets !== state.pocketsPerSheet) {
				state.pocketsPerSheet = newPockets;
				renderCurrentView();
			}
		});

		// Real-time synchronization bus (Parent & Child iFrame messages)
		window.addEventListener('message', function (event) {
			var data = event.data;
			if (!data || typeof data !== 'object') return;

			if (data.type === 'adoptedex:pet_discovered' || data.type === 'adoptedex:pack_opened' || data.type === 'adoptedex:pack_awarded') {
				loadAllData();
			}
			if (data.type === 'arcade:set_mute') {
				SoundEngine.setMuted(!!data.muted);
			}
		});
	}

	// Bootstrap
	async function init() {
		bindEvents();
		var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
		if (els.swipeHint && fine) els.swipeHint.hidden = true;
		if (els.keyHints && !fine) els.keyHints.hidden = true;
		try {
			await loadAllData();
			runAlbumGameplayHooks();
		} catch (err) {
			console.warn('[Album] load failed', err);
			setLoading(false);
			if (els.binderMain) els.binderMain.hidden = false;
			showError('Could not load collection. Showing offline starter cards if available.');
			try { applyFilterAndSort(); } catch (e2) {}
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
