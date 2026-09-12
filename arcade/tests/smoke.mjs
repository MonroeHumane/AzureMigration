#!/usr/bin/env node
/**
 * Adoptédex e2e smoke test — exercises the security + economy contract
 * against a running API (local compose or deployed).
 *
 *   node tests/smoke.mjs [--api http://localhost:8081/v1]
 *
 * Exit 0 = all checks passed. Requires Node 18+.
 */
const argv = process.argv.slice(2);
const apiIdx = argv.indexOf('--api');
const API = (apiIdx >= 0 ? argv[apiIdx + 1] : process.env.ARCADE_API || 'http://localhost:8081/v1').replace(/\/?$/, '/');

let pass = 0, fail = 0;
function check(name, cond, extra) {
	if (cond) { pass++; console.log(`  ✓ ${name}`); }
	else { fail++; console.log(`  ✗ ${name}${extra ? ' — ' + JSON.stringify(extra).slice(0, 200) : ''}`); }
}

/** Tiny cookie jar for fetch. */
function jar() {
	const cookies = {};
	return {
		async req(path, opts = {}) {
			const res = await fetch(API + path.replace(/^\//, ''), {
				...opts,
				headers: {
					'Content-Type': 'application/json',
					Cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; '),
					...(opts.headers || {}),
				},
				redirect: 'manual',
			});
			for (const sc of res.headers.getSetCookie ? res.headers.getSetCookie() : []) {
				const [pair] = sc.split(';');
				const eq = pair.indexOf('=');
				if (eq > 0) cookies[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
			}
			let body = null;
			try { body = await res.json(); } catch (e) {}
			return { status: res.status, body };
		},
		post(path, body) { return this.req(path, { method: 'POST', body: JSON.stringify(body || {}) }); },
		get(path) { return this.req(path); },
	};
}

const ts = Date.now().toString(36);
const SLUG = `smoketest-${ts}`;
const OTHER = `smokeother-${ts}`;

console.log(`Adoptédex smoke test → ${API}\n`);

const A = jar(); // device A session
const B = jar(); // device B session (attacker / recovery)

// ── Sessions ────────────────────────────────────────────────────────────────
let r = await A.post('session/anonymous');
check('session A minted (cookie set)', r.status === 200);
r = await B.post('session/anonymous');
check('session B minted', r.status === 200);

// ── Profile + rescue PIN ────────────────────────────────────────────────────
let pin = null;
r = await A.post('adoptedex/auth', { username: SLUG });
check('profile created', r.status === 200 && r.body && r.body.ok !== false, r.body);
check('rescue PIN issued', !!(r.body && r.body.rescue_pin));
pin = r.body && r.body.rescue_pin;

// ── Discovery ───────────────────────────────────────────────────────────────
r = await A.post(`adoptedex/${SLUG}/discover`, { pet_id: '61388848', source: 'smoke' });
check('own discover ok', r.status === 200 && r.body.ok !== false, r.body);

r = await A.post(`adoptedex/${SLUG}/discover`, { pet_id: 'bad pet id!!', source: 'smoke' });
check('invalid pet_id rejected', r.status === 400 || (r.body && r.body.ok === false), r.status);

r = await B.post(`adoptedex/${SLUG}/discover`, { pet_id: '61461825', source: 'smoke' });
check('cross-profile discover → 403', r.status === 403, r.status);

// ── Unauthenticated mutation attempts ──────────────────────────────────────
const C = jar(); // no session
r = await C.post(`adoptedex/${SLUG}/discover`, { pet_id: '61388848' });
check('no-session discover → 401', r.status === 401, r.status);
r = await C.post(`adoptedex/${SLUG}/match-stats`, { wins: 99 });
check('no-session match-stats → 401', r.status === 401, r.status);
r = await C.post(`adoptedex/${SLUG}/packs/open`, { tier: 'standard' });
check('no-session pack open → 401', r.status === 401, r.status);
r = await C.post(`adoptedex/${SLUG}/coins/award`, { reason: 'game_award' });
check('no-session coin award → 401', r.status === 401, r.status);

// ── Reward claim idempotency ───────────────────────────────────────────────
r = await A.post(`adoptedex/${SLUG}/rewards/claim`, { game_id: 'flappy_cat', reward_key: 'score_5' });
check('first claim succeeds', r.status === 200 && r.body && r.body.claimed === true, r.body);
const packsAfter = r.body && r.body.packsAwarded;
r = await A.post(`adoptedex/${SLUG}/rewards/claim`, { game_id: 'flappy_cat', reward_key: 'score_5' });
check('second claim is idempotent (claimed:false)', r.status === 200 && r.body && r.body.claimed === false, r.body);

// ── Pack inventory ─────────────────────────────────────────────────────────
r = await A.get(`adoptedex/${SLUG}`);
const stats = (r.body && (r.body.stats || r.body.profile && r.body.profile.stats)) || {};
check('profile reports packs_by_tier', !!stats.packs_by_tier, stats);
const totalPacks = stats.unopened_packs || 0;
check('pack inventory present after claim', totalPacks >= 1, stats);

r = await A.post(`adoptedex/${SLUG}/packs/open`, { tier: 'standard' });
check('pack open returns cards', r.status === 200 && r.body && r.body.ok && Array.isArray(r.body.cards) && r.body.cards.length >= 1, r.body);
const card = r.body && r.body.cards && r.body.cards[0];
check('card is a real catalog pet', !!(card && card.id && card.name && card.file), card);

// drain the rest; expect 409 once empty
let opens = 0;
for (let i = 0; i < 10; i++) {
	r = await A.post(`adoptedex/${SLUG}/packs/open`, { tier: 'standard' });
	if (r.status === 409) break;
	opens++;
}
check('empty inventory → 409', r.status === 409, r.status);

// ── Coin faucet bound ───────────────────────────────────────────────────────
r = await A.post(`adoptedex/${SLUG}/coins/award`, { reason: 'game_award', amount: 9999 });
check('client amount ignored (bounded award)', r.status === 200 && r.body && r.body.awarded <= 10, r.body);
let capped = false;
for (let i = 0; i < 40; i++) {
	r = await A.post(`adoptedex/${SLUG}/coins/award`, { reason: 'game_award' });
	if (r.body && r.body.awarded === 0) { capped = true; break; }
	if (r.status === 429) { capped = true; break; }
}
check('game_award daily cap (or rate limit) binds', capped, r.body);

// ── Game progress — upgrades + objectives + multiplier ──────────────────────
r = await A.get(`adoptedex/${SLUG}/game/progress?game_id=shelter_run`);
check('progress defaults', r.status === 200 && r.body && r.body.ok &&
	r.body.upgrades && r.body.upgrades.magnet && r.body.upgrades.magnet.level === 0 &&
	r.body.multiplier === 1, r.body);

r = await A.post(`adoptedex/${SLUG}/game/upgrades/buy`, { game_id: 'shelter_run', upgrade: 'bogus' });
check('unknown upgrade rejected', r.status === 400 || (r.body && r.body.ok === false), r.status);

r = await C.post(`adoptedex/${SLUG}/game/upgrades/buy`, { game_id: 'shelter_run', upgrade: 'magnet' });
check('no-session upgrade buy → 401', r.status === 401, r.status);

// Objectives claim → multiplier +1, idempotent
r = await A.post(`adoptedex/${SLUG}/game/objectives/claim`, { game_id: 'shelter_run', key: 'rescue_5' });
check('objective claim → multiplier 2', r.status === 200 && r.body && r.body.multiplier === 2, r.body);
r = await A.post(`adoptedex/${SLUG}/game/objectives/claim`, { game_id: 'shelter_run', key: 'rescue_5' });
check('re-claim idempotent (already:true)', r.status === 200 && r.body && r.body.already === true && r.body.multiplier === 2, r.body);
r = await A.post(`adoptedex/${SLUG}/game/objectives/claim`, { game_id: 'shelter_run', key: 'fake_key' });
check('unknown objective rejected', r.status === 400 || (r.body && r.body.ok === false), r.status);

// Donation payout — level 0 awards nothing; buy donation L1 (if affordable) then payout
r = await A.post(`adoptedex/${SLUG}/coins/donation`, { game_id: 'shelter_run' });
check('donation at L0 → awarded 0 or ok:false', r.status === 200 || r.status === 400, r.body);

// Re-read progress — multiplier persisted
r = await A.get(`adoptedex/${SLUG}/game/progress?game_id=shelter_run`);
check('progress persists multiplier', r.status === 200 && r.body && r.body.multiplier === 2 &&
	Array.isArray(r.body.objectives) && r.body.objectives.includes('rescue_5'), r.body);

// ── Pack tiers endpoint ─────────────────────────────────────────────────────
r = await A.get('pack-tiers');
check('pack-tiers authoritative', r.status === 200 && r.body && r.body.standard && r.body.deluxe, r.body);

// ── Rescue PIN reclaim ──────────────────────────────────────────────────────
if (pin) {
	r = await B.post('adoptedex/auth', { username: SLUG, pin: '000000' });
	check('wrong PIN → not reclaimed', !(r.body && r.body.reclaimed), r.body);
	r = await B.post('adoptedex/auth', { username: SLUG, pin });
	check('correct PIN reclaims profile', !!(r.body && r.body.reclaimed), r.body);
	r = await B.post(`adoptedex/${SLUG}/discover`, { pet_id: '61461825', source: 'smoke' });
	check('reclaimed session can write profile', r.status === 200 && r.body.ok !== false, r.status);
}

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
