/**
 * Humane Booster Packs — app controller.
 * Clean ES-module rebuild of the pack-opening ceremony. Preserves the old
 * compiled bundle's contracts:
 *   - ?embed=1 / iframe embedding, arcade:set_mute inbound, M mute
 *   - ?pack / ?tier / ?cards=N deep links
 *   - window.HumaneBoosterBridge { claimReward, openPack, refreshPackCount }
 *   - 'monroe-adoptedex-updated' CustomEvent (remainingPacks, packsByTier,
 *     packOpened, petIds, tier, packRarity, packRarityLabel, synced)
 *   - postMessage to parent: adoptedex:pack_opened / adoptedex:pet_discovered
 *   - localStorage mirrors: monroeDexPacks, monroeDexPacksByTier, monroeDexCoins
 *   - html.booster-no-packs empty state, [data-unopened-count] pills
 *   - Keyboard: 1/2/3 tier, Space/Enter open, ←/→ card nav, Esc close
 *
 * Economy is server-authoritative: all opens go through
 * MonroeAdoptedex.openPack — no offline card generation.
 */
import { PackView } from './pack.js';
import { RevealView } from './reveal.js';
import * as audio from './audio.js';

const Dex = window.MonroeAdoptedex || null;
const Cards = window.MonroeCard || null;
const CardModel = window.MonroeCardModel || null;

const params = new URLSearchParams(window.location.search);
const reducedMotion = (() => {
	try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
})();

// ── Embed mode ─────────────────────────────────────────────────────────────
if (params.get('embed') === '1' || (window.parent && window.parent !== window)) {
	document.documentElement.classList.add('is-embedded', 'humane-embed');
}

// ── Identity ────────────────────────────────────────────────────────────────
const identity = Dex ? Dex.getParams() : {
	dexUser: (params.get('dex_user') || 'guest').toLowerCase(),
	dexDisplay: params.get('dex_display') || 'Guest Rescuer',
	dexApi: params.get('dex_api') || (window.location.origin + '/arcade-api/v1/'),
};

// ── Pack tiers (server-provided, cached to module) ──────────────────────────
const TIER_ORDER = ['standard', 'duo', 'deluxe'];
let PACK_TIERS = {
	standard: { cardCount: 1, label: 'Standard Pack', coinCost: 25 },
	duo:      { cardCount: 2, label: 'Duo Pack', coinCost: 45 },
	deluxe:   { cardCount: 3, label: 'Deluxe Pack', coinCost: 60 },
};

// ── State ───────────────────────────────────────────────────────────────────
const state = {
	packs: 0,
	packsByTier: { standard: 0, duo: 0, deluxe: 0 },
	coins: 0,
	tier: 'standard',
	busy: false,
	reveal: null,
	pack: null,
	els: {},
};

function readMirror(key, fallback) {
	try {
		const raw = localStorage.getItem(key);
		if (raw === null) return fallback;
		const n = parseInt(raw, 10);
		return isNaN(n) ? fallback : Math.max(0, n);
	} catch (e) { return fallback; }
}

function readTierMirror() {
	try {
		const raw = localStorage.getItem('monroeDexPacksByTier');
		if (raw) {
			const t = JSON.parse(raw);
			if (t && typeof t === 'object') return t;
		}
	} catch (e) {}
	return { standard: readMirror('monroeDexPacks', 0), duo: 0, deluxe: 0 };
}

function mirrorState() {
	try {
		localStorage.setItem('monroeDexPacks', String(state.packs));
		localStorage.setItem('monroeDexCoins', String(state.coins));
		localStorage.setItem('monroeDexPacksByTier', JSON.stringify(state.packsByTier));
	} catch (e) {}
	document.documentElement.classList.toggle('booster-no-packs', state.packs <= 0);
	document.querySelectorAll('[data-unopened-count]').forEach((el) => { el.textContent = String(state.packs); });
	document.querySelectorAll('[data-coin-balance]').forEach((el) => { el.textContent = String(state.coins); });
	TIER_ORDER.forEach((t) => {
		document.querySelectorAll(`[data-tier-count="${t}"]`).forEach((el) => {
			el.textContent = String(state.packsByTier[t] || 0);
		});
	});
}

/** Celebration confetti — pure-DOM burst, no lib. Honors reduced motion. */
function confettiBurst(count) {
	if (reducedMotion) return;
	const colors = ['#e8c04a', '#4caf7d', '#7fd6ff', '#f0abfc', '#fdf6e4', '#ff9d5c'];
	const root = document.body;
	for (let i = 0; i < count; i++) {
		const p = document.createElement('span');
		p.className = 'confetti-particle';
		const sz = 5 + Math.random() * 7;
		p.style.cssText = `left:${50 + (Math.random() - 0.5) * 30}%;top:38%;width:${sz}px;height:${sz * (0.5 + Math.random())}px;background:${colors[i % colors.length]};` +
			`--cf-x:${(Math.random() - 0.5) * 88}vw;--cf-y:${34 + Math.random() * 55}vh;--cf-r:${(Math.random() - 0.5) * 720}deg;` +
			`--cf-d:${0.9 + Math.random() * 0.9}s;--cf-delay:${Math.random() * 0.25}s;`;
		root.appendChild(p);
		setTimeout(() => p.remove(), 2400);
	}
}

function emitUpdated(detail) {
	window.dispatchEvent(new CustomEvent('monroe-adoptedex-updated', { detail }));
	if (window.parent && window.parent !== window) {
		try {
			if (detail.packOpened) {
				window.parent.postMessage({
					type: 'adoptedex:pack_opened',
					action: 'pack_opened',
					tier: detail.tier || 'standard',
					packRarity: detail.packRarity,
					remainingPacks: state.packs,
				}, '*');
			}
			if (detail.petIds && detail.petIds.length) {
				window.parent.postMessage({
					type: 'adoptedex:pet_discovered',
					action: 'pet_discovered',
					petIds: detail.petIds,
				}, '*');
			}
		} catch (e) {}
	}
}

function applyServerProfile(data) {
	if (!data) return;
	const stats = data.stats || data.profile || data;
	if (typeof stats.unopened_packs !== 'undefined') {
		state.packs = Math.max(0, parseInt(stats.unopened_packs, 10) || 0);
	}
	if (stats.packs_by_tier) {
		state.packsByTier = Object.assign({ standard: 0, duo: 0, deluxe: 0 }, stats.packs_by_tier);
	}
	if (typeof stats.coin_balance !== 'undefined') {
		state.coins = Math.max(0, parseInt(stats.coin_balance, 10) || 0);
	}
	mirrorState();
	emitUpdated({ synced: true, remainingPacks: state.packs, packsByTier: state.packsByTier });
}

async function refreshFromServer() {
	if (!Dex || !identity.dexUser) { mirrorState(); return false; }
	try {
		const data = await Dex.fetchDex(identity.dexApi, identity.dexUser);
		applyServerProfile(data);
		return true;
	} catch (e) {
		console.warn('[Booster] Adoptédex sync failed:', e);
		mirrorState();
		return false;
	}
}

async function fetchPackTiers() {
	try {
		const res = await fetch(identity.dexApi.replace(/\/?$/, '/') + 'pack-tiers', { credentials: 'same-origin' });
		if (!res.ok) return;
		const data = await res.json();
		TIER_ORDER.forEach((t) => {
			if (data[t] && typeof data[t].cardCount === 'number' && data[t].cardCount > 0) {
				PACK_TIERS[t] = Object.assign(PACK_TIERS[t] || {}, data[t]);
			}
		});
	} catch (e) {}
}

// ── First-visit welcome pack ────────────────────────────────────────────────
async function maybeClaimFirstPack() {
	if (!Dex || !identity.dexUser || identity.dexUser === 'guest') return;
	try {
		const res = await Dex.claimReward(identity.dexApi, identity.dexUser, 'booster', 'first_pack', { tier: 'standard', count: 1 });
		if (res && res.claimed) {
			await refreshFromServer();
			if (Dex.showRewardToast) {
				Dex.showRewardToast({
					title: 'Welcome pack!',
					message: 'Your first Humane Booster pack is ready to tear open.',
					icon: '✨',
					game: 'Booster',
				});
			}
		}
	} catch (e) {}
}

// ── Rendering ───────────────────────────────────────────────────────────────
const app = document.getElementById('app');

function h(tag, cls, html) {
	const el = document.createElement(tag);
	if (cls) el.className = cls;
	if (html != null) el.innerHTML = html;
	return el;
}

function ico(name) {
	return Cards ? Cards.icon(name) : '';
}

function renderHeader() {
	const header = h('header', 'booster-header');
	header.innerHTML = `
		<img class="booster-header__logo" src="/assets/brand/hsmc-wordmark.webp" alt="Humane Society of Monroe County" onerror="this.style.display='none'">
		<div class="booster-header__meta">
			<span class="booster-pill" title="Unopened packs">${ico('pack')}<b data-unopened-count>${state.packs}</b> packs</span>
			<span class="booster-pill booster-pill--coins" title="Coin balance">${ico('coin')}<b data-coin-balance>${state.coins}</b></span>
			<button type="button" class="booster-icon-btn" id="muteBtn" aria-label="Toggle sound"><span class="sound-icon">${audio.isMuted() ? '🔇' : '🔊'}</span></button>
			<a class="booster-icon-btn booster-header__album" href="../dex/album.html?embed=${params.get('embed') === '1' ? '1' : '0'}&dex_user=${encodeURIComponent(identity.dexUser)}&dex_api=${encodeURIComponent(identity.dexApi)}" title="Open your album" aria-label="Open album">📖</a>
		</div>`;
	header.querySelector('#muteBtn').addEventListener('click', toggleMute);
	app.appendChild(header);
}

function renderStage() {
	let stage = state.els.stage;
	if (!stage) {
		stage = h('main', 'booster-stage');
		state.els.stage = stage;
		app.appendChild(stage);
	}
	stage.innerHTML = '';

	if (state.packs <= 0 && !state.busy) {
		renderEmptyState(stage);
		return;
	}

	// Tier selector — only tiers the player actually owns are selectable.
	const bar = h('div', 'pack-selector-bar');
	bar.setAttribute('role', 'tablist');
	bar.setAttribute('aria-label', 'Pack tier');
	TIER_ORDER.forEach((t, i) => {
		const meta = PACK_TIERS[t];
		const owned = state.packsByTier[t] || 0;
		const btn = h('button', 'pack-tier-btn' + (state.tier === t ? ' is-active' : ''), `
			<span class="pack-tier-btn__name">${meta.label.replace(' Pack', '')}</span>
			<span class="pack-tier-btn__count"><b data-tier-count="${t}">${owned}</b> left</span>
			<span class="pack-tier-btn__cards">${meta.cardCount} card${meta.cardCount > 1 ? 's' : ''}</span>`);
		btn.type = 'button';
		btn.setAttribute('role', 'tab');
		btn.setAttribute('aria-selected', state.tier === t ? 'true' : 'false');
		btn.dataset.tier = t;
		btn.title = `${meta.label} — ${meta.cardCount} card${meta.cardCount > 1 ? 's' : ''} (key ${i + 1})`;
		if (owned <= 0) {
			btn.disabled = true;
			btn.title += ' — none owned';
		}
		btn.addEventListener('click', () => switchTier(t));
		bar.appendChild(btn);
	});
	stage.appendChild(bar);

	// Pack
	const wrap = h('div', 'pack-stage');
	stage.appendChild(wrap);
	state.pack = new PackView(wrap, {
		tier: state.tier,
		displayName: identity.dexDisplay,
		onOpen: openCurrentPack,
		disabled: state.busy,
	});

	// Tear prompt
	const prompt = h('button', 'tear-prompt-badge');
	prompt.type = 'button';
	prompt.innerHTML = `${ico('sparkle')} Tear or tap to open`;
	prompt.addEventListener('click', () => state.pack && state.pack.ripOpen());
	stage.appendChild(prompt);
}

function renderEmptyState(stage) {
	const box = h('div', 'booster-empty-inventory');
	const canDaily = identity.dexUser && identity.dexUser !== 'guest';
	box.innerHTML = `
		<p>No packs ready</p>
		<p>Earn packs in the arcade, claim your daily pack, or spend coins below.</p>
		<div class="booster-empty-actions">
			${canDaily ? `<button type="button" class="booster-btn booster-btn--primary" id="emptyDailyBtn">${ico('flame')} Claim Daily Pack</button>` : ''}
			<div class="booster-shop-row">
				${TIER_ORDER.map((t) => {
					const cost = (PACK_TIERS[t] && PACK_TIERS[t].coinCost) || 0;
					const afford = state.coins >= cost;
					return `<button type="button" class="booster-btn booster-btn--shop" data-buy-tier="${t}" ${afford ? '' : 'disabled'} title="${PACK_TIERS[t].label} — ${cost} coins">${ico('coin')} ${PACK_TIERS[t].label.replace(' Pack', '')} · ${cost}</button>`;
				}).join('')}
			</div>
			<a class="booster-btn booster-btn--ghost" href="/games/">Play games to earn packs</a>
		</div>`;
	stage.appendChild(box);

	const daily = box.querySelector('#emptyDailyBtn');
	if (daily) {
		daily.addEventListener('click', async () => {
			daily.disabled = true;
			try {
				const res = await Dex.claimDailyStreak(identity.dexApi, identity.dexUser, 'dex');
				if (res && res.claimed) await refreshFromServer();
				else if (Dex.showRewardToast) Dex.showRewardToast({ title: 'Already claimed', message: 'Daily pack comes back tomorrow!', icon: '🔥' });
			} catch (e) {}
			renderStage();
		});
	}
	box.querySelectorAll('[data-buy-tier]').forEach((btn) => {
		btn.addEventListener('click', () => buyPack(btn.getAttribute('data-buy-tier')));
	});
}

async function buyPack(tier) {
	if (!Dex || state.busy) return;
	state.busy = true;
	try {
		const data = await Dex.buyPackWithCoins(identity.dexApi, identity.dexUser, (PACK_TIERS[tier] || {}).coinCost || 25, tier);
		if (data && data.ok) {
			if (typeof data.coin_balance === 'number') state.coins = data.coin_balance;
			if (typeof data.unopened_packs === 'number') state.packs = data.unopened_packs;
			if (data.packs_by_tier) state.packsByTier = data.packs_by_tier;
			mirrorState();
			emitUpdated({ synced: true, remainingPacks: state.packs, packsByTier: state.packsByTier });
		} else if (Dex.showRewardToast) {
			Dex.showRewardToast({ title: 'Not enough coins', message: (data && data.message) || 'Play games to earn more coins.', icon: '🪙' });
		}
	} catch (e) {
		if (Dex && Dex.showRewardToast) Dex.showRewardToast({ title: 'Purchase failed', message: 'Could not reach the shop — try again.', icon: '🪙' });
	}
	state.busy = false;
	renderStage();
}

function switchTier(tier) {
	if (state.busy || !TIER_ORDER.includes(tier)) return;
	if ((state.packsByTier[tier] || 0) <= 0) return;
	state.tier = tier;
	renderStage();
}

// ── Opening a pack ──────────────────────────────────────────────────────────
async function openCurrentPack() {
	if (state.busy || !Dex) return;
	state.busy = true;
	audio.tear();
	if (state.pack) state.pack.setTearing(true);

	let data = null;
	try {
		data = await Dex.openPack(identity.dexApi, identity.dexUser, state.tier);
	} catch (e) {
		data = null;
	}

	if (!data || !data.ok) {
		// Honest failure: keep the pack sealed, show why, resync.
		state.busy = false;
		if (state.pack) state.pack.setTearing(false);
		if (Dex.showRewardToast) {
			Dex.showRewardToast({
				title: 'Pack not opened',
				message: (data && data.message) || 'Could not reach the arcade — your pack is safe, try again.',
				icon: '🎁',
			});
		}
		await refreshFromServer();
		renderStage();
		return;
	}

	// Commit server state
	state.packs = typeof data.unopened_packs === 'number' ? data.unopened_packs : Math.max(0, state.packs - 1);
	if (data.packs_by_tier) state.packsByTier = data.packs_by_tier;
	if (typeof data.coin_balance === 'number') state.coins = data.coin_balance;
	mirrorState();

	// Merge discovered ids into local mirror for other surfaces — and flag
	// first-ever discoveries so the reveal can stamp them NEW.
	let seen = [];
	try { seen = JSON.parse(localStorage.getItem('monroe_discovered_pets') || '[]'); } catch (e) {}
	const seenSet = new Set(seen.map(String));
	const petIds = (data.cards || []).map((c) => String(c.id));
	data.newIds = petIds.filter((id) => !seenSet.has(id));
	try {
		const merged = Array.from(new Set([...seen.map(String), ...petIds]));
		localStorage.setItem('monroe_discovered_pets', JSON.stringify(merged));
		localStorage.setItem('monroeDexCards', String(merged.length));
	} catch (e) {}

	emitUpdated({
		packOpened: true,
		remainingPacks: state.packs,
		packsByTier: state.packsByTier,
		petIds,
		tier: data.tier || state.tier,
		packRarity: data.pack_rarity,
		packRarityLabel: data.pack_rarity_label,
	});

	if (data.pack_rarity === 'rare' || data.pack_rarity === 'uncommon') {
		audio.fanfare();
		confettiBurst(data.pack_rarity === 'rare' ? 90 : 55);
		if (Dex.showRewardToast) {
			Dex.showRewardToast({
				title: (data.pack_rarity_label || 'Foil pack') + '!',
				message: 'Holographic pull — check your album binder for the foil flex.',
				icon: '✨',
				rare: true,
				game: 'Booster',
			});
		}
	}

	// Reveal
	showReveal(data);
}

function showReveal(data) {
	const stage = state.els.stage;
	stage.innerHTML = '';
	state.reveal = new RevealView(stage, {
		cards: data.cards || [],
		newIds: data.newIds || [],
		tier: data.tier || state.tier,
		packRarity: data.pack_rarity || 'common',
		packRarityLabel: data.pack_rarity_label || 'Pack',
		coinsAwarded: data.coins_awarded || 0,
		canOpenAnother: state.packs > 0,
		onOpenAnother: () => { state.busy = false; state.reveal = null; renderStage(); },
		onDone: () => { state.busy = false; state.reveal = null; renderStage(); },
	});
	state.busy = true; // stays busy until reveal dismissed (keeps pack hidden)
}

// ── Keyboard ────────────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
	if (e.key === 'm' || e.key === 'M') { toggleMute(); return; }
	if (state.reveal) {
		if (e.key === 'Escape') state.reveal.dismiss();
		else if (e.key === 'ArrowLeft') state.reveal.prev();
		else if (e.key === 'ArrowRight') state.reveal.next();
		else if (e.key === ' ' || e.key === 'Enter') state.reveal.flipCurrent();
		return;
	}
	if (state.busy) return;
	if (e.key === '1') switchTier('standard');
	else if (e.key === '2') switchTier('duo');
	else if (e.key === '3') switchTier('deluxe');
	else if ((e.key === ' ' || e.key === 'Enter') && state.packs > 0 && state.pack) {
		e.preventDefault();
		state.pack.ripOpen();
	}
});

function toggleMute() {
	const m = audio.toggleMuted();
	const el = document.querySelector('.sound-icon');
	if (el) el.textContent = m ? '🔇' : '🔊';
}

// ── Inbound cabinet messages ────────────────────────────────────────────────
window.addEventListener('message', (e) => {
	if (!e.data || typeof e.data !== 'object') return;
	if (e.data.type === 'arcade:set_mute') {
		audio.setMuted(!!e.data.muted);
		const el = document.querySelector('.sound-icon');
		if (el) el.textContent = e.data.muted ? '🔇' : '🔊';
	}
	if (e.data.type === 'adoptedex:pack_awarded') {
		refreshFromServer().then(renderStage);
	}
});

// Keep in sync if another surface mutates the mirror (other iframe/tab).
window.addEventListener('storage', (e) => {
	if (!e || e.key === 'monroeDexPacks' || e.key === null) {
		state.packs = readMirror('monroeDexPacks', state.packs);
		state.packsByTier = readTierMirror();
		mirrorState();
	}
});

// ── Public bridge (contract preserved from the compiled bundle) ────────────
window.HumaneBoosterBridge = {
	claimReward(gameId, rewardKey, extra) {
		if (!Dex || !identity.dexUser) {
			return Promise.reject(new Error('MonroeAdoptedex.claimReward unavailable'));
		}
		return Dex.claimReward(identity.dexApi, identity.dexUser, gameId, rewardKey, extra || {}).then((result) => {
			refreshFromServer().then(renderStage);
			return result;
		});
	},
	openPack(tier) {
		if (!Dex || !identity.dexUser) {
			return Promise.reject(new Error('MonroeAdoptedex.openPack unavailable'));
		}
		return Dex.openPack(identity.dexApi, identity.dexUser, tier || 'standard').then((result) => {
			if (result && typeof result.unopened_packs === 'number') {
				state.packs = result.unopened_packs;
				if (result.packs_by_tier) state.packsByTier = result.packs_by_tier;
				mirrorState();
				renderStage();
			} else {
				refreshFromServer().then(renderStage);
			}
			return result;
		});
	},
	refreshPackCount: refreshFromServer,
};

// ── Boot ────────────────────────────────────────────────────────────────────
async function init() {
	audio.init();
	state.packs = readMirror('monroeDexPacks', 0);
	state.packsByTier = readTierMirror();
	state.coins = readMirror('monroeDexCoins', 0);

	// Deep-link tier (?pack= / ?tier= / ?cards=N)
	const deepTier = params.get('pack') || params.get('tier');
	if (TIER_ORDER.includes(deepTier)) state.tier = deepTier;
	const cards = params.get('cards');
	if (cards === '3') state.tier = 'deluxe';
	else if (cards === '2') state.tier = 'duo';
	else if (cards === '1') state.tier = 'standard';

	renderHeader();
	await fetchPackTiers();
	// Register/refresh this device's profile (new profiles get a rescue PIN).
	if (Dex && typeof Dex.ensureProfile === 'function' && identity.dexUser !== 'guest') {
		Dex.ensureProfile(identity.dexApi, identity.dexUser, identity.dexDisplay).then((prof) => {
			if (prof && prof.rescue_pin && Dex.showRewardToast) {
				Dex.showRewardToast({
					title: 'Rescue PIN: ' + prof.rescue_pin,
					message: 'Write this down — it recovers your binder on a new device.',
					icon: '🔑',
					game: 'Adoptédex',
				});
			}
		}).catch(() => {});
	}
	await refreshFromServer();
	await maybeClaimFirstPack();
	renderStage();
}

init();
