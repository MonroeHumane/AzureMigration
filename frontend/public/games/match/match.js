(function () {
	'use strict';

	const HINT_KEY = 'monroePetMatch_hint';
	const TIMING = {
		flipMs: 220,
		flipEase: 'cubic-bezier(0.33, 1, 0.68, 1)',
		mismatchShakeMs: 450,
		mismatchHoldMs: 520,
		matchPopMs: 350,
		previewRevealMs: 180,
		previewHoldMs: 550,
		previewWaveCapMs: 600,
		reducedMotionHoldMs: 750,
	};
	const LEVEL_INTRO_MS = 2000;
	const MAX_LEVEL = 10;

	// Pair counts must be non-decreasing level over level so difficulty never
	// steps backward; grid shape (cols x rows) still varies for visual variety.
	const LEVELS = [
		{ cols: 2, rows: 2, pairs: 2, stars3: 3, stars2: 5 },
		{ cols: 2, rows: 3, pairs: 3, stars3: 4, stars2: 7 },
		{ cols: 3, rows: 4, pairs: 6, stars3: 9, stars2: 14 },
		{ cols: 4, rows: 4, pairs: 8, stars3: 12, stars2: 18 },
		{ cols: 3, rows: 6, pairs: 9, stars3: 13, stars2: 19 },
		{ cols: 4, rows: 5, pairs: 10, stars3: 15, stars2: 22 },
		{ cols: 5, rows: 4, pairs: 10, stars3: 15, stars2: 22 },
		{ cols: 4, rows: 6, pairs: 12, stars3: 18, stars2: 26 },
		{ cols: 5, rows: 6, pairs: 15, stars3: 22, stars2: 32 },
		{ cols: 6, rows: 6, pairs: 18, stars3: 27, stars2: 38 },
	];

	const DESKTOP_MIN_WIDTH = 900;

	const els = {
		app: document.getElementById('petMatchApp'),
		board: document.getElementById('pmBoard'),
		level: document.getElementById('pmLevel'),
		moves: document.getElementById('pmMoves'),
		pairs: document.getElementById('pmPairs'),
		progressBar: document.getElementById('pmProgressBar'),
		live: document.getElementById('pmLive'),
		levelIntro: document.getElementById('pmLevelIntro'),
		levelSelect: document.getElementById('pmLevelSelect'),
		prev: document.getElementById('pmPrev'),
		nextLevel: document.getElementById('pmNextLevel'),
		restart: document.getElementById('pmRestart'),
		newGame: document.getElementById('pmNewGame'),
		error: document.getElementById('pmError'),
		winModal: document.getElementById('pmWinModal'),
		winPanel: document.getElementById('pmWinPanel'),
		winStars: document.getElementById('pmWinStars'),
		winMessage: document.getElementById('pmWinMessage'),
		winPraise: document.getElementById('pmWinPraise'),
		winMeet: document.getElementById('pmWinMeet'),
		winMeetGrid: document.getElementById('pmWinMeetGrid'),
		next: document.getElementById('pmNext'),
		retry: document.getElementById('pmRetry'),
		confirmModal: document.getElementById('pmConfirmModal'),
		confirmYes: document.getElementById('pmConfirmYes'),
		confirmNo: document.getElementById('pmConfirmNo'),
		rewardModal: document.getElementById('pmPackRewardModal'),
		rewardTitle: document.getElementById('pmRewardTitle'),
		rewardBadge: document.getElementById('pmRewardBadge'),
		rewardMessage: document.getElementById('pmRewardMessage'),
		openPackBtn: document.getElementById('pmOpenPackBtn'),
		keepMatchingBtn: document.getElementById('pmKeepMatchingBtn'),
		boosterEmbedModal: document.getElementById('pmBoosterEmbedModal'),
		boosterFrame: document.getElementById('pmBoosterFrame'),
		boosterCloseBtn: document.getElementById('pmBoosterCloseBtn'),
		quickRestart: document.getElementById('pmQuickRestart'),
		toggleControls: document.getElementById('pmToggleControls'),
		controls: document.querySelector('.pet-match-controls'),
	};

	let petPool = null;
	let roundPets = [];
	let deck = [];
	let state = 'idle';
	let firstIndex = null;
	let moves = 0;
	let matchedPairs = 0;
	let inputLocked = false;
	let currentLevel = 1;
	let progress = freshProgress();
	let levelIntroTimer = null;
	let focusTrapHandler = null;
	let confirmResolve = null;
	let lastFocusedBeforeModal = null;
	let reducedMotionCached = null;
	let previewGeneration = 0;
	let previewTimers = [];
	let gameGeneration = 0;
	let gameplayTimers = [];

	function freshProgress() {
		return { bestLevel: 1, lastLevel: 1 };
	}

	function recordLevelComplete(level) {
		progress.lastLevel = level;
		if (level >= progress.bestLevel && level < MAX_LEVEL) {
			progress.bestLevel = level + 1;
		} else {
			progress.bestLevel = Math.max(progress.bestLevel, level);
		}
	}

	function resetAllProgress() {
		progress = freshProgress();
	}

	function levelConfig(level) {
		return LEVELS[Math.max(0, Math.min(MAX_LEVEL - 1, level - 1))];
	}

	function prefersReducedMotion() {
		if (reducedMotionCached === null) {
			reducedMotionCached = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		}
		return reducedMotionCached;
	}

	function applyTimingCssVars() {
		if (!els.app) {
			return;
		}
		els.app.style.setProperty('--pm-flip-ms', `${TIMING.flipMs}ms`);
		els.app.style.setProperty('--pm-flip-ease', TIMING.flipEase);
	}

	function delay(ms) {
		return new Promise((resolve) => {
			const id = window.setTimeout(resolve, ms);
			previewTimers.push(id);
		});
	}

	function clearGameplayTimers() {
		gameplayTimers.forEach((id) => window.clearTimeout(id));
		gameplayTimers = [];
	}

	function bumpGameGeneration() {
		gameGeneration += 1;
		clearGameplayTimers();
	}

	function later(ms, fn) {
		const gen = gameGeneration;
		const id = window.setTimeout(() => {
			if (gen !== gameGeneration) {
				return;
			}
			fn();
		}, ms);
		gameplayTimers.push(id);
	}

	function cancelPreviewTimers() {
		previewTimers.forEach((id) => window.clearTimeout(id));
		previewTimers = [];
	}

	function abortPreview() {
		previewGeneration += 1;
		cancelPreviewTimers();
		if (els.board) {
			els.board.classList.remove('is-preview');
		}
		if (state === 'preview') {
			state = 'idle';
			lockBoard(false);
			deck.forEach((card, index) => {
				if (!card.matched) {
					card.faceUp = false;
					refreshCardUi(index);
				}
			});
		}
	}

	function setCardFace(index, faceUp) {
		const card = deck[index];
		if (!card || card.matched) {
			return;
		}
		card.faceUp = faceUp;
		refreshCardUi(index);
	}

	function waitForFlipTransition(extraMs) {
		const duration = TIMING.flipMs + (extraMs || 0) + 50;
		return new Promise((resolve) => {
			let done = false;
			const inner = els.board && els.board.querySelector('.pet-match-card__inner');
			const finish = () => {
				if (done) {
					return;
				}
				done = true;
				if (inner) {
					inner.removeEventListener('transitionend', onEnd);
				}
				resolve();
			};
			const onEnd = (event) => {
				if (event.propertyName === 'transform') {
					finish();
				}
			};
			if (inner && !prefersReducedMotion()) {
				inner.addEventListener('transitionend', onEnd);
			}
			const id = window.setTimeout(finish, duration);
			previewTimers.push(id);
		});
	}

	async function flipAll(faceUp) {
		deck.forEach((card, index) => {
			if (!card.matched) {
				card.faceUp = faceUp;
				refreshCardUi(index);
			}
		});
		if (prefersReducedMotion()) {
			await new Promise((resolve) => {
				window.requestAnimationFrame(() => {
					window.requestAnimationFrame(() => {
						const id = window.setTimeout(resolve, 0);
						previewTimers.push(id);
					});
				});
			});
			return;
		}
		await waitForFlipTransition(0);
	}

	function previewStaggerMs(cardCount) {
		if (cardCount <= 1) {
			return 0;
		}
		const total = cardCount * TIMING.previewRevealMs;
		if (total <= TIMING.previewWaveCapMs) {
			return TIMING.previewRevealMs;
		}
		return Math.max(0, Math.floor(TIMING.previewWaveCapMs / cardCount));
	}

	async function runRoundPreview() {
		const gen = previewGeneration;
		cancelPreviewTimers();

		state = 'preview';
		lockBoard(true);
		if (els.board) {
			els.board.classList.add('is-preview');
		}

		const cardCount = deck.length;

		// Give the level-intro announcement (level number, pairs, grid size) a
		// moment to reach screen readers before replacing it — otherwise this
		// message overwrites it in the same tick and it's never announced.
		await delay(TIMING.previewRevealMs);
		if (gen !== previewGeneration) {
			return;
		}
		setLiveMessage('Watch the pets…');

		if (prefersReducedMotion()) {
			deck.forEach((card, index) => {
				if (!card.matched) {
					setCardFace(index, true);
				}
			});
			if (gen !== previewGeneration) {
				return;
			}
			await delay(TIMING.reducedMotionHoldMs);
			if (gen !== previewGeneration) {
				return;
			}
			await flipAll(false);
		} else {
			const stagger = previewStaggerMs(cardCount);
			for (let i = 0; i < cardCount; i += 1) {
				if (gen !== previewGeneration) {
					return;
				}
				setCardFace(i, true);
				if (i < cardCount - 1 && stagger > 0) {
					await delay(stagger);
				}
			}
			if (gen !== previewGeneration) {
				return;
			}
			await waitForFlipTransition(0);
			if (gen !== previewGeneration) {
				return;
			}
			await delay(TIMING.previewHoldMs);
			if (gen !== previewGeneration) {
				return;
			}
			await flipAll(false);
			if (gen !== previewGeneration) {
				return;
			}
			await waitForFlipTransition(0);
		}

		if (gen !== previewGeneration) {
			return;
		}

		if (els.board) {
			els.board.classList.remove('is-preview');
		}
		state = 'idle';
		lockBoard(false);
		setLiveMessage('Cards hidden - find the pairs.');
		focusFirstPlayableCard();
		maybeShowFirstFlipHint();
	}

	function shuffle(array) {
		for (let i = array.length - 1; i > 0; i -= 1) {
			const j = Math.floor(Math.random() * (i + 1));
			[array[i], array[j]] = [array[j], array[i]];
		}
		return array;
	}

	function getPetsApiUrl() {
		const params = new URLSearchParams(window.location.search);
		return params.get('pets_api') || '';
	}

	function getDexParams() {
		const params = new URLSearchParams(window.location.search);
		return {
			user: (params.get('dex_user') || '').trim().toLowerCase(),
			api: (params.get('dex_api') || '').replace(/\/?$/, '/'),
		};
	}

	// Pack rewards are tied to LEVEL completions, not raw pairs matched - a
	// player could cross "5 matches" within their first level and a half,
	// which made rewards feel handed out rather than earned. Keyed by level
	// number (MAX_LEVEL is 10, see LEVELS above) so this scales if the level
	// count ever changes.
	const LEVEL_MILESTONES = {
		3: { tier: 'standard', title: 'Level 3 Milestone!', badge: '🎁 STANDARD FOIL PACK', message: 'You cleared Level 3! Rip open your shiny foil pack to reveal a real shelter pet card for your album.' },
		5: { tier: 'duo', title: 'Level 5 Milestone!', badge: '✨ DUO FOIL PACK', message: 'Five levels down! Rip open your Duo pack to reveal 2 shelter pet cards.' },
		10: { tier: 'deluxe', title: 'Level 10 Champion!', badge: '🏆 DELUXE FOIL PACK', message: "You've cleared every level! Rip open your Deluxe pack for 3 collectible shelter pet cards." },
	};

	function getSavedStats() {
		try {
			return {
				totalMatches: parseInt(localStorage.getItem('monroePetMatch_totalMatches') || '0', 10),
				claimedMilestones: JSON.parse(localStorage.getItem('monroePetMatch_claimed') || '[]')
			};
		} catch {
			return { totalMatches: 0, claimedMilestones: [] };
		}
	}

	function saveStats(totalMatches, claimed) {
		try {
			localStorage.setItem('monroePetMatch_totalMatches', String(totalMatches));
			localStorage.setItem('monroePetMatch_claimed', JSON.stringify(claimed));
		} catch {}
	}

	let currentRewardTier = 'standard';
	// Set by showWinModal() when the just-completed level is a milestone;
	// hideWinModal() shows the pack reward modal once the win modal itself
	// has been dismissed, rather than stacking two modals at once.
	let pendingLevelMilestone = null;

	// ---- Dex / Stats helpers ----------------------------------------

	function getDexRestBase() {
		const dex = getDexParams();
		if (dex.api) return dex.api;
		return window.location.origin + '/wp-json/monroe/v1/';
	}

	function getDexUser() {
		const dex = getDexParams();
		return (dex.user || (localStorage.getItem('monroeDexUser') || '').trim()).toLowerCase();
	}

	// Local state — kept in sync with server
	let localStats = {
		totalMatches: 0,
		claimedMilestones: [],   // e.g. [5, 10, 25]
		claimedLevelWins: [],    // e.g. [1, 2, 3]
	};

	function readLocalStats() {
		try {
			localStats.totalMatches = parseInt(localStorage.getItem('monroePetMatch_totalMatches') || '0', 10);
			localStats.claimedMilestones = JSON.parse(localStorage.getItem('monroePetMatch_claimed') || '[]');
			localStats.claimedLevelWins = JSON.parse(localStorage.getItem('monroePetMatch_levelWins') || '[]');
		} catch {
			localStats = { totalMatches: 0, claimedMilestones: [], claimedLevelWins: [] };
		}
	}

	function writeLocalStats() {
		try {
			localStorage.setItem('monroePetMatch_totalMatches', String(localStats.totalMatches));
			localStorage.setItem('monroePetMatch_claimed', JSON.stringify(localStats.claimedMilestones));
			localStorage.setItem('monroePetMatch_levelWins', JSON.stringify(localStats.claimedLevelWins));
		} catch {}
	}

	/** Merge server state into localStats — always take the union / maximum. */
	function mergeServerStats(serverData) {
		if (!serverData || !serverData.ok) return;
		localStats.totalMatches = Math.max(localStats.totalMatches, serverData.total_pairs || 0);
		const serverClaimed = Array.isArray(serverData.claimed_milestones) ? serverData.claimed_milestones : [];
		const serverLevelWins = Array.isArray(serverData.claimed_level_wins) ? serverData.claimed_level_wins : [];
		serverClaimed.forEach((m) => { if (!localStats.claimedMilestones.includes(m)) localStats.claimedMilestones.push(m); });
		serverLevelWins.forEach((l) => { if (!localStats.claimedLevelWins.includes(l)) localStats.claimedLevelWins.push(l); });
		writeLocalStats();
	}

	/** Load server match stats on init and merge them. Fire-and-forget, non-blocking. */
	function loadServerMatchStats() {
		const user = getDexUser();
		if (!user) return;
		const restBase = getDexRestBase();
		fetch(`${restBase}adoptedex/${encodeURIComponent(user)}/match-stats`, { credentials: 'same-origin' })
			.then((res) => res.ok ? res.json() : null)
			.then((data) => { if (data) mergeServerStats(data); })
			.catch(() => {});
	}

	/**
	 * Save stats to server; optionally signal a new milestone or level win.
	 * The server awards the pack and de-dupes atomically.
	 */
	async function saveMatchStatsToServer(options) {
		const opts = options || {};
		const user = getDexUser();
		if (!user) return null;
		const restBase = getDexRestBase();
		try {
			const body = {
				total_pairs: localStats.totalMatches,
				claimed_milestones: localStats.claimedMilestones,
				claimed_level_wins: localStats.claimedLevelWins,
			};
			if (opts.new_milestone) {
				body.new_milestone = opts.new_milestone;
				body.new_milestone_tier = opts.new_milestone_tier || 'standard';
			}
			if (opts.new_level_win) {
				body.new_level_win = opts.new_level_win;
			}
			const res = await fetch(
				`${restBase}adoptedex/${encodeURIComponent(user)}/match-stats`,
				{ method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) }
			);
			if (!res.ok) return null;
			const data = await res.json();
			mergeServerStats(data);
			return data;
		} catch (e) {
			console.warn('[Pet Match] Server stats sync failed:', e);
			return null;
		}
	}

	/**
	 * Lifetime pairs-matched counter, kept purely as a stat - no pack reward
	 * is tied to this anymore (see LEVEL_MILESTONES). Synced periodically
	 * rather than on every single match to avoid hammering the server.
	 */
	function recordMatchForStats() {
		readLocalStats();
		localStats.totalMatches += 1;
		writeLocalStats();

		if (localStats.totalMatches % 5 === 0) {
			saveMatchStatsToServer({});
		}
	}

	function showPackRewardModal(milestone) {
		if (!els.rewardModal) return;
		if (els.rewardTitle) els.rewardTitle.textContent = milestone.title || 'Pet Booster Pack Unlocked!';
		if (els.rewardBadge) els.rewardBadge.textContent = milestone.badge || '🎁 FOIL PACK';
		if (els.rewardMessage) els.rewardMessage.textContent = milestone.message || 'You unlocked a free pet booster pack for your album!';
		openModal(els.rewardModal, hidePackRewardModal);
	}

	function hidePackRewardModal() {
		if (!els.rewardModal) return;
		closeModal(els.rewardModal);
	}

	function openBoosterPackOverlay(tier) {
		hidePackRewardModal();
		if (!els.boosterEmbedModal || !els.boosterFrame) {
			window.open('../booster/index.html?embed=1&pack=' + (tier || currentRewardTier), '_blank');
			return;
		}
		const dex = getDexParams();
		const user = dex.user || (localStorage.getItem('monroeDexUser') || '').trim();
		const src = `../booster/index.html?embed=1&pack=${encodeURIComponent(tier || currentRewardTier)}${user ? '&user=' + encodeURIComponent(user) : ''}`;
		els.boosterFrame.src = src;
		openModal(els.boosterEmbedModal, closeBoosterPackOverlay);
	}

	function closeBoosterPackOverlay() {
		if (!els.boosterEmbedModal) return;
		closeModal(els.boosterEmbedModal);
		if (els.boosterFrame) {
			els.boosterFrame.src = 'about:blank';
		}
	}

	async function loadManifestFallback() {
		const response = await fetch(`manifest.json?_=${Date.now()}`, { cache: 'no-store' });
		if (!response.ok) {
			throw new Error('Could not load image catalog.');
		}
		const data = await response.json();
		if (!data || !Array.isArray(data.images) || data.images.length === 0) {
			throw new Error('Image catalog is empty.');
		}
		return data;
	}

	async function loadPetPool() {
		// 1. Try Live WordPress REST feed
		const apiUrl = getPetsApiUrl() || '/wp-json/monroe/v1/featured-pets';
		try {
			const res = await fetch(`${apiUrl}${apiUrl.includes('?') ? '&' : '?'}_=${Date.now()}`, {
				cache: 'no-store',
				credentials: 'same-origin'
			});
			if (res.ok) {
				const data = await res.json();
				const list = Array.isArray(data) ? data : (data && Array.isArray(data.images) ? data.images : (data && Array.isArray(data.animals) ? data.animals : []));
				if (list && list.length >= 4) {
					const mapped = list.map((p) => {
						const name = p.name || 'Shelter Pet';
						const breed = p.breed || p.species_label || 'Companion';
						const file = p.image || p.photo || p.file || '';
						return {
							id: String(p.id || name),
							name: name,
							breed: breed,
							type: p.type || 'companion',
							file: file,
							alt: `${name} (${breed})`,
							url: p.url || ('/adopt/' + encodeURIComponent(p.id))
						};
					}).filter(p => !!p.file);
					if (mapped.length >= 4) {
						return { images: mapped };
					}
				}
			}
		} catch (err) {
			console.warn('Live pet feed unavailable, trying fallback:', err);
		}

		// 2. Try bundled shelter-pets.json
		try {
			const resFallback = await fetch(`../../shelter-pets.json?_=${Date.now()}`);
			if (resFallback.ok) {
				const dataFallback = await resFallback.json();
				if (Array.isArray(dataFallback) && dataFallback.length >= 4) {
					const mappedFallback = dataFallback.map(p => ({
						id: String(p.id || p.name),
						name: p.name,
						breed: p.breed || 'Companion',
						type: p.type || 'companion',
						file: p.image,
						alt: `${p.name} (${p.breed})`,
						url: p.url
					})).filter(p => !!p.file);
					return { images: mappedFallback };
				}
			}
		} catch (err2) {
			console.warn('Fallback shelter-pets.json load failed:', err2);
		}

		// 3. Fallback to vector SVGs
		return loadManifestFallback();
	}

	function buildDeck(level, images) {
		const config = levelConfig(level);
		const pool = shuffle([...images]);
		if (pool.length < config.pairs) {
			throw new Error('Not enough adoptable pets with photos for this level.');
		}
		const picked = pool.slice(0, config.pairs);
		roundPets = picked.map((image) => ({ ...image }));
		const cards = [];
		picked.forEach((image) => {
			cards.push({ matchId: image.id, image, faceUp: false, matched: false });
			cards.push({ matchId: image.id, image, faceUp: false, matched: false });
		});
		return shuffle(cards);
	}

	function preloadDeckImages(cards) {
		const seen = new Set();
		cards.forEach((card) => {
			const file = card.image && card.image.file;
			if (!file || seen.has(file)) {
				return;
			}
			seen.add(file);
			const img = new Image();
			img.src = file;
		});
	}

	function cardLabel(card, index, faceDown) {
		const position = index + 1;
		if (faceDown || !card.faceUp) {
			return `Card ${position}, face down`;
		}
		return `Card ${position}, ${card.image.alt}`;
	}

	function cardButton(index) {
		return els.board.querySelector(`[data-index="${index}"]`);
	}

	function isDesktopEmbed() {
		return document.documentElement.classList.contains('humane-embed')
			&& window.innerWidth >= DESKTOP_MIN_WIDTH;
	}

	function updateLayoutMode() {
		if (els.app) {
			els.app.classList.toggle('pet-match-app--wide', isDesktopEmbed());
		}
	}

	function boardGapFor(config) {
		const total = config.cols * config.rows;
		if (total <= 12) {
			return 10;
		}
		if (total <= 24) {
			return 8;
		}
		return 6;
	}

	// Cell size itself is computed in CSS (see --cell in match.css), fit to
	// the board-wrap's container-query box - the browser's own layout engine
	// guarantees it fits without ever exceeding the available space, so
	// there's no JS measurement step (and no resize listener) needed here.
	function applyBoardGridVars(config) {
		if (!els.board) {
			return;
		}
		els.board.style.setProperty('--cols', String(config.cols));
		els.board.style.setProperty('--rows', String(config.rows));
		els.board.style.setProperty('--board-gap', `${boardGapFor(config)}px`);
	}

	function focusFirstPlayableCard() {
		const cards = els.board.querySelectorAll('.pet-match-card:not(.is-matched)');
		if (cards.length > 0) {
			cards[0].focus();
		}
	}

	function moveCardFocus(currentIndex, deltaCol, deltaRow) {
		const config = levelConfig(currentLevel);
		const row = Math.floor(currentIndex / config.cols);
		const col = currentIndex % config.cols;
		const nextRow = Math.max(0, Math.min(config.rows - 1, row + deltaRow));
		const nextCol = Math.max(0, Math.min(config.cols - 1, col + deltaCol));
		const nextIndex = nextRow * config.cols + nextCol;
		const button = cardButton(nextIndex);
		if (button) {
			button.focus();
		}
	}

	function onCardKeydown(event, index) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onCardClick(index);
			return;
		}

		switch (event.key) {
			case 'ArrowLeft':
				event.preventDefault();
				moveCardFocus(index, -1, 0);
				break;
			case 'ArrowRight':
				event.preventDefault();
				moveCardFocus(index, 1, 0);
				break;
			case 'ArrowUp':
				event.preventDefault();
				moveCardFocus(index, 0, -1);
				break;
			case 'ArrowDown':
				event.preventDefault();
				moveCardFocus(index, 0, 1);
				break;
			default:
				break;
		}
	}

	function renderBoard() {
		const config = levelConfig(currentLevel);
		applyBoardGridVars(config);
		els.board.innerHTML = '';

		deck.forEach((card, index) => {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'pet-match-card';
			button.dataset.index = String(index);
			button.setAttribute('role', 'gridcell');
			button.setAttribute('aria-label', cardLabel(card, index, true));

			const inner = document.createElement('span');
			inner.className = 'pet-match-card__inner';

			const back = document.createElement('span');
			back.className = 'pet-match-card__face pet-match-card__back';
			back.setAttribute('aria-hidden', 'true');
			back.innerHTML = `<svg class="match-card-paw-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
				<circle cx="50" cy="50" r="46" stroke="#007a3d" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="60 6 30 5 80 8" />
				<g transform="translate(50, 52)">
					<g transform="translate(-20, -15) rotate(-24)"><ellipse cx="0" cy="0" rx="6" ry="10" fill="#007a3d"/><g stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"><line x1="-4" y1="-5" x2="4" y2="-2"/><line x1="-4.5" y1="-1" x2="4.5" y2="2"/><line x1="-4" y1="3" x2="4" y2="6"/></g></g>
					<g transform="translate(-7, -25) rotate(-8)"><ellipse cx="0" cy="0" rx="6.5" ry="11.5" fill="#007a3d"/><g stroke="#ffffff" stroke-width="1.3" stroke-linecap="round"><line x1="-4.5" y1="-6" x2="4.5" y2="-3"/><line x1="-5" y1="-2" x2="5" y2="1"/><line x1="-5" y1="2" x2="5" y2="5"/><line x1="-4" y1="6" x2="4" y2="9"/></g></g>
					<g transform="translate(9, -24) rotate(10)"><ellipse cx="0" cy="0" rx="6.5" ry="11.5" fill="#007a3d"/><g stroke="#ffffff" stroke-width="1.3" stroke-linecap="round"><line x1="-4.5" y1="-6" x2="4.5" y2="-3"/><line x1="-5" y1="-2" x2="5" y2="1"/><line x1="-5" y1="2" x2="5" y2="5"/><line x1="-4" y1="6" x2="4" y2="9"/></g></g>
					<g transform="translate(21, -12) rotate(26)"><ellipse cx="0" cy="0" rx="5.5" ry="9.5" fill="#007a3d"/><g stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"><line x1="-4" y1="-5" x2="4" y2="-2"/><line x1="-4" y1="-1" x2="4" y2="2"/><line x1="-3.5" y1="3" x2="3.5" y2="6"/></g></g>
					<g transform="translate(0, 10)">
						<path d="M -16,5 C -17,-2 -11,-10 0,-10 C 11,-10 17,-2 16,5 C 14,14 7,18 0,18 C -7,18 -14,14 -16,5 Z" fill="#007a3d"/>
						<g stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"><line x1="-11" y1="-5" x2="9" y2="-1"/><line x1="-13" y1="-1" x2="11" y2="3"/><line x1="-13" y1="3" x2="11" y2="7"/><line x1="-11" y1="7" x2="9" y2="11"/><line x1="-7" y1="11" x2="6" y2="14"/></g>
					</g>
				</g>
			</svg>`;

			const front = document.createElement('span');
			front.className = 'pet-match-card__face pet-match-card__front';
			const img = document.createElement('img');
			img.src = card.image.file;
			img.alt = card.image.alt;
			img.loading = 'eager';
			img.decoding = 'async';
			front.appendChild(img);

			inner.appendChild(back);
			inner.appendChild(front);
			button.appendChild(inner);

			if (card.faceUp || card.matched) {
				button.classList.add('is-flipped');
			}
			if (card.matched) {
				button.classList.add('is-matched', 'is-locked');
			}

			button.addEventListener('click', () => onCardClick(index));
			button.addEventListener('keydown', (event) => onCardKeydown(event, index));
			els.board.appendChild(button);
		});
	}

	function updateLevelSelect() {
		if (!els.levelSelect) {
			return;
		}

		const previous = String(currentLevel);
		els.levelSelect.innerHTML = '';

		for (let level = 1; level <= MAX_LEVEL; level += 1) {
			const option = document.createElement('option');
			option.value = String(level);
			const config = levelConfig(level);
			option.textContent = `${level} (${config.pairs} pairs)`;
			if (level > progress.bestLevel) {
				option.disabled = true;
				option.textContent += ' - locked';
			}
			els.levelSelect.appendChild(option);
		}

		els.levelSelect.value = previous;
		if (els.levelSelect.value !== previous) {
			els.levelSelect.value = String(Math.min(currentLevel, progress.bestLevel));
		}
	}

	function updateControlButtons() {
		if (els.prev) {
			els.prev.disabled = currentLevel <= 1;
		}
		if (els.nextLevel) {
			els.nextLevel.disabled = currentLevel >= progress.bestLevel || currentLevel >= MAX_LEVEL;
		}
	}

	function updateHud() {
		const config = levelConfig(currentLevel);
		els.level.textContent = String(currentLevel);
		els.moves.textContent = String(moves);
		els.pairs.textContent = `${matchedPairs} / ${config.pairs}`;

		if (els.progressBar && config.pairs > 0) {
			els.progressBar.style.width = `${Math.round((matchedPairs / config.pairs) * 100)}%`;
		}

		updateLevelSelect();
		updateControlButtons();
	}

	function setLiveMessage(message) {
		els.live.textContent = message;
	}

	function clearLevelIntro() {
		if (levelIntroTimer) {
			window.clearTimeout(levelIntroTimer);
			levelIntroTimer = null;
		}
		if (els.levelIntro) {
			els.levelIntro.hidden = true;
			els.levelIntro.textContent = '';
		}
	}

	function showLevelIntro(level) {
		const config = levelConfig(level);
		if (!els.levelIntro) {
			setLiveMessage(`Level ${level} - ${config.pairs} pairs (${config.cols}×${config.rows})`);
			return;
		}

		clearLevelIntro();
		const text = `Level ${level} - ${config.pairs} pairs (${config.cols}×${config.rows})`;
		els.levelIntro.textContent = text;
		els.levelIntro.hidden = false;
		setLiveMessage(text);
		levelIntroTimer = window.setTimeout(() => {
			clearLevelIntro();
			if (els.live.textContent === text) {
				setLiveMessage('');
			}
		}, LEVEL_INTRO_MS);
	}

	function maybeShowFirstFlipHint() {
		if (currentLevel !== 1) {
			return;
		}
		try {
			if (sessionStorage.getItem(HINT_KEY)) {
				return;
			}
			sessionStorage.setItem(HINT_KEY, '1');
		} catch {
			return;
		}
		later(800, () => {
			if (state === 'idle' && moves === 0 && matchedPairs === 0) {
				setLiveMessage('Flip two cards to find matching pairs.');
			}
		});
	}

	function refreshCardUi(index) {
		const card = deck[index];
		const button = cardButton(index);
		if (!button || !card) {
			return;
		}
		button.classList.toggle('is-flipped', card.faceUp || card.matched);
		button.classList.toggle('is-matched', card.matched);
		button.classList.toggle('is-locked', card.matched || inputLocked);
		button.setAttribute('aria-label', cardLabel(card, index, !(card.faceUp || card.matched)));
	}

	function pulseCard(index, className, durationMs) {
		const button = cardButton(index);
		if (!button) {
			return;
		}
		button.classList.add(className);
		later(durationMs, () => {
			button.classList.remove(className);
		});
	}

	function lockBoard(locked) {
		inputLocked = locked;
		els.board.querySelectorAll('.pet-match-card').forEach((button) => {
			const index = Number(button.dataset.index);
			const card = deck[index];
			if (card && !card.matched) {
				button.classList.toggle('is-locked', locked);
			}
		});
	}

	function starRatingForMoves(level, moveCount) {
		const config = levelConfig(level);
		if (moveCount <= config.stars3) {
			return 3;
		}
		if (moveCount <= config.stars2) {
			return 2;
		}
		return 1;
	}

	function praiseForStars(stars) {
		if (stars >= 3) {
			return 'Sharp memory!';
		}
		if (stars >= 2) {
			return 'Nice work!';
		}
		return 'You did it!';
	}

	function renderStars(stars) {
		if (!els.winStars) {
			return;
		}
		els.winStars.innerHTML = '';
		els.winStars.setAttribute('aria-label', `${stars} of 3 stars`);
		for (let i = 1; i <= 3; i += 1) {
			const star = document.createElement('span');
			star.className = 'pet-match-stars__star';
			star.textContent = '★';
			if (i <= stars) {
				star.classList.add('is-earned');
			}
			els.winStars.appendChild(star);
		}
	}

	function meetGridLayout(petCount) {
		if (petCount <= 1) {
			return { cols: 1, gapPx: 0 };
		}
		if (petCount <= 3) {
			return { cols: petCount, gapPx: 8 };
		}
		if (petCount <= 4) {
			return { cols: 2, gapPx: 8 };
		}
		if (petCount <= 6) {
			return { cols: 3, gapPx: 8 };
		}
		if (petCount <= 8) {
			return { cols: 4, gapPx: 7 };
		}
		if (petCount <= 10) {
			return { cols: 5, gapPx: 7 };
		}
		if (petCount <= 12) {
			return { cols: 4, gapPx: 7 };
		}
		if (petCount <= 15) {
			return { cols: 5, gapPx: 6 };
		}
		return { cols: 6, gapPx: 6 };
	}

	function meetFillForCount(petCount) {
		if (petCount <= 4) {
			return 0.95;
		}
		if (petCount <= 8) {
			return 0.93;
		}
		if (petCount <= 12) {
			return 0.91;
		}
		return 0.88;
	}

	function meetLinkMetaPx(petCount) {
		if (petCount <= 4) {
			return 72;
		}
		if (petCount <= 8) {
			return 56;
		}
		if (petCount <= 12) {
			return 50;
		}
		return 46;
	}

	function meetDensity(petCount) {
		if (petCount <= 4) {
			return 'low';
		}
		if (petCount <= 8) {
			return 'medium';
		}
		return 'high';
	}

	/** Same as in-game cards: square face, 1:1. */
	function updateMeetSizing(petCount) {
		if (!els.winPanel || !els.winMeetGrid || !els.winMeet || els.winMeet.hidden || !petCount) {
			return;
		}

		const layout = meetGridLayout(petCount);
		const cols = layout.cols;
		const rows = Math.ceil(petCount / cols);
		const gapPx = layout.gapPx;
		const fill = meetFillForCount(petCount);

		const modalPadY = 24;
		const maxPanelW = Math.min(window.innerWidth * 0.96, 928);
		const maxPanelH = Math.min(window.innerHeight * 0.92, 900);

		let chromeH = modalPadY * 2;
		els.winPanel.querySelectorAll(
			'.pet-match-modal__hero, .pet-match-modal__score, .pet-match-modal__actions'
		).forEach((el) => {
			chromeH += el.offsetHeight;
		});

		const meetStyle = window.getComputedStyle(els.winMeet);
		chromeH += parseFloat(meetStyle.paddingTop) + parseFloat(meetStyle.paddingBottom);
		const meetTitle = els.winMeet.querySelector('h3');
		const meetHint = els.winMeet.querySelector('.pet-match-meet__hint');
		if (meetTitle) {
			chromeH += meetTitle.offsetHeight;
		}
		if (meetHint) {
			chromeH += meetHint.offsetHeight + 8;
		}

		const availH = Math.max(100, maxPanelH - chromeH);
		const availW = Math.max(200, maxPanelW
			- parseFloat(meetStyle.paddingLeft)
			- parseFloat(meetStyle.paddingRight));

		const linkMetaPx = meetLinkMetaPx(petCount);
		const availHForPhotos = availH - gapPx * (rows - 1) - rows * linkMetaPx;
		const widthBudget = availW * fill - gapPx * Math.max(0, cols - 1);
		const imgByWidth = widthBudget / cols;
		const imgByHeight = availHForPhotos / rows;
		let imgSize = Math.min(imgByWidth, imgByHeight);
		const totalGridH = imgSize * rows + gapPx * (rows - 1) + rows * linkMetaPx;
		if (totalGridH > availH) {
			imgSize = Math.max(52, (availH - gapPx * (rows - 1) - rows * linkMetaPx) / rows);
		}
		let imgW = Math.floor(imgSize);
		const contentW = cols * imgW + gapPx * Math.max(0, cols - 1);
		if (contentW > availW) {
			imgW = Math.max(52, Math.floor((availW - gapPx * Math.max(0, cols - 1)) / cols));
		}
		const minSize = petCount <= 3 ? 112 : (petCount <= 6 ? 88 : 64);
		imgW = Math.max(minSize, imgW);
		const imgH = imgW;

		const density = meetDensity(petCount);
		els.winMeetGrid.dataset.density = density;
		if (els.winMeet) {
			els.winMeet.dataset.density = density;
		}
		els.winMeetGrid.style.setProperty('--meet-cols', String(cols));
		els.winMeetGrid.style.setProperty('--meet-gap', `${gapPx}px`);
		els.winMeetGrid.style.setProperty('--meet-img-w', `${imgW}px`);
		els.winMeetGrid.style.setProperty('--meet-img-h', `${imgH}px`);
	}

	function scheduleMeetSizing() {
		if (!els.winMeetGrid || !els.winMeet || els.winMeet.hidden) {
			return;
		}
		const petCount = Number(els.winMeetGrid.dataset.count) || 0;
		if (!petCount) {
			return;
		}
		const run = () => updateMeetSizing(petCount);
		run();
		window.requestAnimationFrame(() => {
			run();
			window.requestAnimationFrame(run);
		});
		window.setTimeout(run, 60);
		window.setTimeout(run, 180);
	}

	function renderMeetThePets() {
		if (!els.winMeet || !els.winMeetGrid) {
			return;
		}

		const pets = roundPets.filter((pet) => pet && pet.url && pet.file);
		els.winMeetGrid.innerHTML = '';
		delete els.winMeetGrid.dataset.density;
		if (els.winMeet) {
			delete els.winMeet.dataset.density;
		}
		['--meet-cols', '--meet-img-w', '--meet-img-h', '--meet-gap'].forEach((prop) => {
			els.winMeetGrid.style.removeProperty(prop);
		});

		if (!pets.length) {
			els.winMeet.hidden = true;
			if (els.winPanel) {
				els.winPanel.classList.remove('pet-match-modal__panel--wide');
			}
			return;
		}

		els.winMeet.hidden = false;
		if (els.winPanel) {
			els.winPanel.classList.add('pet-match-modal__panel--win', 'pet-match-modal__panel--wide');
		}

		els.winMeetGrid.dataset.count = String(pets.length);

		pets.forEach((pet) => {
			const li = document.createElement('li');
			const link = document.createElement('a');
			link.className = 'pet-match-meet__link';
			link.href = pet.url;
			link.target = '_blank';
			link.rel = 'noopener noreferrer';
			link.setAttribute('aria-label', `View ${pet.name || pet.alt} profile`);

			const photo = document.createElement('span');
			photo.className = 'pet-match-meet__photo';

			const img = document.createElement('img');
			img.src = pet.file;
			img.alt = '';
			img.loading = 'lazy';
			img.decoding = 'async';

			photo.appendChild(img);

			const name = document.createElement('span');
			name.className = 'pet-match-meet__name';
			name.textContent = pet.name || pet.alt || 'Adoptable pet';

			const cta = document.createElement('span');
			cta.className = 'pet-match-meet__cta';
			cta.textContent = 'View profile';

			link.append(photo, name, cta);
			li.appendChild(link);
			els.winMeetGrid.appendChild(li);
		});

		scheduleMeetSizing();
	}

	function getFocusableIn(container) {
		return Array.from(container.querySelectorAll(
			'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
		)).filter((node) => node.offsetParent !== null || node === document.activeElement);
	}

	function releaseFocusTrap() {
		if (focusTrapHandler) {
			document.removeEventListener('keydown', focusTrapHandler);
			focusTrapHandler = null;
		}
	}

	function trapFocus(modal, onEscape) {
		releaseFocusTrap();
		const panel = modal.querySelector('.pet-match-modal__panel');
		if (!panel) {
			return;
		}

		const focusables = getFocusableIn(panel);
		if (focusables.length > 0) {
			focusables[0].focus();
		}

		focusTrapHandler = (event) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				onEscape();
				return;
			}
			if (event.key !== 'Tab') {
				return;
			}
			const items = getFocusableIn(panel);
			if (items.length === 0) {
				return;
			}
			const first = items[0];
			const last = items[items.length - 1];
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		};
		document.addEventListener('keydown', focusTrapHandler);
	}

	function openModal(modal, onEscape) {
		lastFocusedBeforeModal = document.activeElement;
		modal.hidden = false;
		modal.setAttribute('aria-hidden', 'false');
		trapFocus(modal, onEscape);
	}

	function closeModal(modal) {
		modal.hidden = true;
		modal.setAttribute('aria-hidden', 'true');
		releaseFocusTrap();
		if (lastFocusedBeforeModal && typeof lastFocusedBeforeModal.focus === 'function') {
			lastFocusedBeforeModal.focus();
		}
		lastFocusedBeforeModal = null;
	}

	function onCardClick(index) {
		if (inputLocked || state === 'won' || state === 'preview') {
			return;
		}

		const card = deck[index];
		if (!card || card.matched || card.faceUp) {
			return;
		}

		card.faceUp = true;
		refreshCardUi(index);

		if (state === 'idle') {
			state = 'oneFlipped';
			firstIndex = index;
			return;
		}

		if (state === 'oneFlipped' && firstIndex !== null) {
			state = 'checking';
			moves += 1;
			updateHud();
			lockBoard(true);

			const first = deck[firstIndex];
			const second = card;

			if (first.matchId === second.matchId) {
				first.matched = true;
				second.matched = true;
				matchedPairs += 1;
				refreshCardUi(firstIndex);
				refreshCardUi(index);
				pulseCard(firstIndex, 'is-match-pop', TIMING.matchPopMs);
				pulseCard(index, 'is-match-pop', TIMING.matchPopMs);
				setLiveMessage('Match!');
				state = 'idle';
				firstIndex = null;
				lockBoard(false);

				recordMatchForStats();

				if (matchedPairs >= levelConfig(currentLevel).pairs) {
					state = 'won';
					recordLevelComplete(currentLevel);
					updateLevelSelect();
					updateControlButtons();
					later(350, showWinModal);
				}
				return;
			}

			pulseCard(firstIndex, 'is-shake', TIMING.mismatchShakeMs);
			pulseCard(index, 'is-shake', TIMING.mismatchShakeMs);
			setLiveMessage('Not a match.');
			later(TIMING.mismatchHoldMs, () => {
				first.faceUp = false;
				second.faceUp = false;
				refreshCardUi(firstIndex);
				refreshCardUi(index);
				setLiveMessage('');
				state = 'idle';
				firstIndex = null;
				lockBoard(false);
			});
		}
	}

	function showWinModal() {
		const config = levelConfig(currentLevel);
		const stars = starRatingForMoves(currentLevel, moves);
		renderStars(stars);
		els.winMessage.textContent = `You matched all ${config.pairs} pairs in ${moves} moves.`;
		if (els.winPraise) {
			els.winPraise.textContent = praiseForStars(stars);
		}
		renderMeetThePets();

		// Award a pack only at milestone levels (see LEVEL_MILESTONES). The
		// local claimedLevelWins check below is just to skip a pointless
		// network call for a level already claimed on this device — the
		// actual dedup is server-side (monroe_adoptedex_claim_reward's
		// unique key), via the shared reward-claim endpoint every game uses
		// now instead of Match hand-rolling its own array-membership check
		// the way it used to. The reward popup only shows once the server
		// confirms the claim actually happened, not just because the
		// client thinks it should.
		const milestone = LEVEL_MILESTONES[currentLevel];
		const user = getDexUser();
		if (user && milestone) {
			readLocalStats();
			if (!localStats.claimedLevelWins.includes(currentLevel)) {
				const restBase = getDexRestBase();
				MonroeAdoptedex.claimReward(restBase, user, 'match', 'level_' + currentLevel, {
					tier: milestone.tier,
					count: 1,
				}).then((result) => {
					if (result && result.claimed) {
						localStats.claimedLevelWins.push(currentLevel);
						writeLocalStats();
						currentRewardTier = milestone.tier;
						pendingLevelMilestone = milestone;
					}
				}).catch((e) => {
					console.warn('[Pet Match] Reward claim failed:', e);
				});
			}
		}

		if (currentLevel >= MAX_LEVEL) {
			els.next.textContent = 'Play level 1';
		} else {
			els.next.textContent = 'Next level';
		}

		openModal(els.winModal, hideWinModal);
		scheduleMeetSizing();
	}

	function hideWinModal() {
		closeModal(els.winModal);
		if (els.winMeet) {
			els.winMeet.hidden = true;
		}
		if (els.winPanel) {
			els.winPanel.classList.remove('pet-match-modal__panel--wide');
		}

		if (pendingLevelMilestone) {
			const milestone = pendingLevelMilestone;
			pendingLevelMilestone = null;
			later(300, () => showPackRewardModal(milestone));
		}
	}

	function showConfirmModal() {
		return new Promise((resolve) => {
			if (!els.confirmModal) {
				resolve(window.confirm('Start over from level 1? Progress this session will reset.'));
				return;
			}
			confirmResolve = resolve;
			openModal(els.confirmModal, () => {
				resolveConfirm(false);
			});
		});
	}

	function resolveConfirm(value) {
		if (!confirmResolve) {
			return;
		}
		const resolve = confirmResolve;
		confirmResolve = null;
		closeModal(els.confirmModal);
		resolve(value);
	}

	function startLevel(level, options) {
		const opts = options || {};
		bumpGameGeneration();
		abortPreview();
		hideWinModal();
		clearLevelIntro();

		if (!petPool || !Array.isArray(petPool.images)) {
			showError('Adoptable pets are not loaded yet.');
			return;
		}

		const target = Math.max(1, Math.min(MAX_LEVEL, level));
		if (target > progress.bestLevel && !opts.allowLocked) {
			startLevel(progress.bestLevel);
			setLiveMessage(`Level ${target} is locked. Beat level ${target - 1} first.`);
			return;
		}

		currentLevel = target;

		try {
			deck = buildDeck(currentLevel, petPool.images);
			preloadDeckImages(deck);
		} catch (error) {
			showError(error.message);
			return;
		}

		if (els.error) {
			els.error.hidden = true;
			els.error.textContent = '';
		}

		state = 'idle';
		firstIndex = null;
		moves = 0;
		matchedPairs = 0;
		inputLocked = false;
		setLiveMessage('');
		updateHud();
		renderBoard();
		showLevelIntro(currentLevel);
		void runRoundPreview();
		progress.lastLevel = currentLevel;
	}

	function showError(message, options) {
		const opts = options || {};
		if (els.error) {
			els.error.hidden = false;
			els.error.innerHTML = '';
			const text = document.createElement('p');
			text.textContent = message;
			els.error.appendChild(text);
			if (opts.adoptLink) {
				const link = document.createElement('a');
				link.href = '/adopt/';
				link.textContent = 'Browse adoptable pets';
				link.className = 'pet-match-error__link';
				els.error.appendChild(link);
			}
		}
		if (els.board) {
			els.board.innerHTML = '';
		}
		console.error('[Pet Match]', message);
	}

	function bindControls() {
		if (els.restart) {
			els.restart.addEventListener('click', () => startLevel(currentLevel));
		}
		if (els.quickRestart) {
			els.quickRestart.addEventListener('click', () => startLevel(currentLevel));
		}
		if (els.toggleControls && els.controls) {
			els.toggleControls.addEventListener('click', () => {
				els.controls.classList.toggle('is-open');
			});
		}
		if (els.retry) {
			els.retry.addEventListener('click', () => startLevel(currentLevel));
		}
		if (els.openPackBtn) {
			els.openPackBtn.addEventListener('click', () => openBoosterPackOverlay());
		}
		if (els.keepMatchingBtn) {
			els.keepMatchingBtn.addEventListener('click', hidePackRewardModal);
		}
		if (els.boosterCloseBtn) {
			els.boosterCloseBtn.addEventListener('click', closeBoosterPackOverlay);
		}
		if (els.next) {
			els.next.addEventListener('click', () => {
				hideWinModal();
				if (currentLevel >= MAX_LEVEL) {
					startLevel(1);
				} else {
					startLevel(currentLevel + 1);
				}
			});
		}
		if (els.newGame) {
			els.newGame.addEventListener('click', async () => {
				const confirmed = await showConfirmModal();
				if (!confirmed) {
					return;
				}
				resetAllProgress();
				setLiveMessage('Loading pets…');
				try {
					petPool = await loadPetPool();
					setLiveMessage('New game - level 1.');
					startLevel(1);
				} catch (error) {
					const message = error && error.message ? error.message : 'Unable to start a new game.';
					setLiveMessage('');
					showError(message, { adoptLink: true });
				}
			});
		}
		if (els.confirmYes) {
			els.confirmYes.addEventListener('click', () => resolveConfirm(true));
		}
		if (els.confirmNo) {
			els.confirmNo.addEventListener('click', () => resolveConfirm(false));
		}
		if (els.levelSelect) {
			els.levelSelect.addEventListener('change', () => {
				const chosen = Number(els.levelSelect.value);
				if (!Number.isFinite(chosen)) {
					return;
				}
				startLevel(chosen);
			});
		}
		if (els.prev) {
			els.prev.addEventListener('click', () => {
				if (currentLevel > 1) {
					startLevel(currentLevel - 1);
				}
			});
		}
		if (els.nextLevel) {
			els.nextLevel.addEventListener('click', () => {
				if (currentLevel < progress.bestLevel) {
					startLevel(currentLevel + 1);
				}
			});
		}

		let layoutTimer = null;
		function onLayoutChange() {
			window.clearTimeout(layoutTimer);
			layoutTimer = window.setTimeout(() => {
				updateLayoutMode();
				if (els.winModal && !els.winModal.hidden) {
					scheduleMeetSizing();
				}
			}, 80);
		}

		window.addEventListener('resize', onLayoutChange);
	}

	async function init() {
		if (!els.board) {
			return;
		}

		applyTimingCssVars();
		updateLayoutMode();
		bindControls();
		setLiveMessage('Loading pets…');

		// Persist user slug so the booster overlay can pick it up
		const user = getDexUser();
		if (user) {
			try { localStorage.setItem('monroeDexUser', user); } catch {}
		}

		// Bootstrap local stats then merge server state (non-blocking)
		readLocalStats();
		loadServerMatchStats();

		try {
			petPool = await loadPetPool();
			progress = freshProgress();
			startLevel(1);
		} catch (error) {
			const message = error && error.message ? error.message : 'Unable to start Pet Match.';
			setLiveMessage('');
			showError(message, { adoptLink: true });
		}
	}

	init();
})();
