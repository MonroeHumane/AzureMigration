// Headless tuning harness for Puppy Skater — runs the real engine + levelgen
// with seeded bots and reports difficulty/fairness stats.
// Usage: node tools/tune_puppy_skater.mjs [runs] [seed]
import { PHYS, WORLD, MILESTONES } from '../public/games/puppy-skater/src/config.js';
import { createGame, startRun, update } from '../public/games/puppy-skater/src/engine.js';
import { difficultyKey } from '../public/games/puppy-skater/src/levelgen.js';
import { mulberry32, oracleAct, makeHuman, describe } from '../public/games/puppy-skater/dev/bots.js';

const DT = 1 / 60;
const RUNS = parseInt(process.argv[2] || '1000', 10);
const BASE_SEED = parseInt(process.argv[3] || '1337', 10);
const MAX_M = 5000;

function runOnce(seed, makeBot) {
  const rng = mulberry32(seed);
  const g = createGame();
  g.rand = rng; // deterministic spawning
  startRun(g);
  const bot = makeBot(rng);
  const log = { impossible: [], sequence: [], hits: [], nearMisses: 0, rescues: 0, _flagged: new Set() };
  g.onHit = (lives, o) => log.hits.push({ m: g.meters | 0, desc: describe(o), t: o.t, speed: +g.speed.toFixed(2), lives });
  g.onNearMiss = () => log.nearMisses++;
  g.onCollect = () => log.rescues++;
  const act = bot === 'oracle' ? () => oracleAct(g, log) : () => bot.act(g, log);

  let frames = 0;
  const maxFrames = 60 * 60 * 8;
  while (g.state !== 'GAME_OVER' && g.meters < MAX_M && frames++ < maxFrames) {
    if (g.state === 'PLAYING') act();
    update(g, DT);
  }
  log.meters = g.meters | 0;
  log.survived = g.meters >= MAX_M;
  return log;
}

const pct = (n, d) => (100 * n / d).toFixed(1) + '%';
function quantile(sorted, p) { return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]; }

console.log(`\n=== Puppy Skater tuning — ${RUNS} runs/mode, seed ${BASE_SEED} ===`);
console.log(`PHYS speed ${PHYS.speedBase}→${PHYS.speedMax} (+${PHYS.speedGain}/f)  jump ${PHYS.jumpHeight}px/${PHYS.jumpMs}ms  duck ${PHYS.duckMs}ms  lives ${PHYS.lives}  iframes ${PHYS.invincibleMs}ms`);

function report(mode, makeBot) {
  const dists = [], deathCause = {}, deathBand = {}, hitsAll = [], imposs = [], seqs = [], nm = [], res = [];
  const milestones = Object.fromEntries(MILESTONES.map(m => [m.at, 0]));
  let survived = 0;
  for (let i = 0; i < RUNS; i++) {
    const r = runOnce(BASE_SEED + i, makeBot(i));
    dists.push(r.meters);
    imposs.push(...r.impossible); seqs.push(...r.sequence);
    hitsAll.push(...r.hits); nm.push(r.nearMisses); res.push(r.rescues);
    if (r.survived) survived++;
    for (const m of MILESTONES) if (r.meters >= m.at) milestones[m.at]++;
    if (!r.survived && r.hits.length) {
      const last = r.hits[r.hits.length - 1];
      deathCause[last.desc] = (deathCause[last.desc] || 0) + 1;
      deathBand[difficultyKey(last.m)] = (deathBand[difficultyKey(last.m)] || 0) + 1;
    }
  }
  dists.sort((a, b) => a - b);
  console.log(`\n--- ${mode.toUpperCase()} ---`);
  console.log(`distance  p10 ${quantile(dists, .1)}  p25 ${quantile(dists, .25)}  p50 ${quantile(dists, .5)}  p75 ${quantile(dists, .75)}  p90 ${quantile(dists, .9)}  max ${dists[dists.length - 1]}  survived ${survived}`);
  console.log(`milestones: ${Object.entries(milestones).map(([m, n]) => m + 'm:' + pct(n, RUNS)).join('  ')}`);
  console.log(`death bands ${JSON.stringify(deathBand)}  hits/run ${(hitsAll.length / RUNS).toFixed(2)}  nearMiss/run ${(nm.reduce((a, b) => a + b) / RUNS).toFixed(1)}  rescues/run ${(res.reduce((a, b) => a + b) / RUNS).toFixed(1)}`);
  const dc = Object.entries(deathCause).sort((a, b) => b[1] - a[1]);
  console.log('death causes: ' + dc.map(([d, n]) => `${d}:${pct(n, dc.reduce((a, x) => a + x[1], 0))}`).join('  '));
  if (imposs.length || seqs.length) {
    const bi = {}, bs = {};
    for (const e of imposs) bi[e.desc] = (bi[e.desc] || 0) + 1;
    for (const e of seqs) { const k = e.a + '→' + e.b; bs[k] = (bs[k] || 0) + 1; }
    console.log('IMPOSSIBLE: ' + JSON.stringify(bi));
    console.log('TIGHT SEQUENCES: ' + JSON.stringify(bs));
  } else console.log('no impossible patterns / tight sequences');
}

report('oracle', () => () => 'oracle');
// skill mix: mostly mid-skill players, some strong, some weak
report('human', i => rng => makeHuman(rng, Math.min(1, Math.max(0.05, 0.15 + 0.7 * ((i % 10) / 9)))));
console.log('');
