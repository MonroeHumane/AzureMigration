// Live multi-run visualizer for Puppy Skater tuning.
// Hundreds of independent seeded runs step together; ghosts overlay on one track,
// deaths accumulate into a stacked histogram + survival curve.
import { PHYS, WORLD, VIEW, BIOMES, MILESTONES } from '../src/config.js';
import { createGame, startRun, update, biomeForMeters } from '../src/engine.js';
import { mulberry32, makeHuman, oracleAct, describe } from './bots.js';

const DT = 1 / 60;
const MAX_M = 5200;
const GY = WORLD.groundY;

const view = document.getElementById('view');
const ctx = view.getContext('2d');
const hist = document.getElementById('hist');
const hctx = hist.getContext('2d');
const statsEl = document.getElementById('stats');
const causesEl = document.getElementById('causes');
const ui = {
  play: document.getElementById('bPlay'), speed: document.getElementById('speed'),
  runs: document.getElementById('runs'), restart: document.getElementById('bRestart'),
  mix: document.getElementById('mix'), ghost: document.getElementById('bGhost'),
  obs: document.getElementById('bObs'),
};

const CAUSE_COLOR = { blocks: '#ff8fa3', fish: '#8ecae6', hang: '#ffd166', whale: '#cdb4f0', other: '#7c8db0' };
const ACT_COLOR = { running: '#7ee0a3', jumping: '#8ecae6', ducking: '#f4a261' };

let runs = [], deaths = [], causes = {}, seedBase = 1, completed = [];
let playing = true, showGhosts = true, showObs = true;

function spawnRun(i) {
  const seed = seedBase * 7919 + i * 131 + runs.length;
  const rng = mulberry32(seed);
  const g = createGame();
  g.rand = rng;
  startRun(g);
  const mix = ui.mix.value;
  const isOracle = mix === 'oracle' || (mix === 'blend' && rng() < 0.1);
  const skill = 0.25 + rng() * 0.72;
  const bot = isOracle ? 'oracle' : makeHuman(rng, skill);
  const log = { impossible: [], sequence: [], _flagged: new Set() };
  const run = { g, bot, log, skill, isOracle, id: i, seed, fade: 0 };
  g.onHit = (lives, o) => { run.lastCause = describe(o); run.lastCauseT = o.t; };
  g.onDeath = () => {
    const c = run.lastCause || 'unknown';
    deaths.push({ m: g.meters, cause: c, t: run.lastCauseT || 'other', wy: g.worldY });
    causes[c] = (causes[c] || 0) + 1;
    completed.push(g.meters);
    if (completed.length > 4000) completed.splice(0, completed.length - 4000);
  };
  return run;
}

function rebuild() {
  const n = parseInt(ui.runs.value, 10);
  seedBase++;
  runs = [];
  for (let i = 0; i < n; i++) runs.push(spawnRun(i));
}

function step() {
  const sub = parseInt(ui.speed.value, 10);
  for (let s = 0; s < sub; s++) {
    for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      if (r.g.state === 'GAME_OVER' || r.g.meters >= MAX_M) {
        if (r.g.meters >= MAX_M) { completed.push(MAX_M); }
        runs[i] = spawnRun(r.id + runs.length * 31); // conveyor: fresh seed
        continue;
      }
      if (r.g.state === 'PLAYING') {
        if (r.bot === 'oracle') oracleAct(r.g, r.log); else r.bot.act(r.g, r.log);
      }
      update(r.g, DT);
    }
  }
}

// --- rendering ---------------------------------------------------------------
function drawView() {
  const w = VIEW.W, h = VIEW.H;
  // leader = furthest alive run → its world renders solid
  let lead = null;
  for (const r of runs) if (r.g.state === 'PLAYING' && (!lead || r.g.meters > lead.g.meters)) lead = r;
  const b = lead ? biomeForMeters(lead.g.meters) : BIOMES[0];

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, b.sky[0]); sky.addColorStop(1, b.sky[1]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = b.sun; ctx.beginPath(); ctx.arc(w * 0.72, 120, 40, 0, 7); ctx.fill();

  // ground
  ctx.fillStyle = b.ground; ctx.fillRect(0, GY, w, h - GY);
  ctx.fillStyle = b.groundTop; ctx.fillRect(0, GY, w, 10);
  ctx.fillStyle = b.curb; ctx.fillRect(0, GY + 10, w, 5);

  ctx.save();
  const sx = view.width / w, sy = view.height / h;
  ctx.scale(1, 1); // canvas already logical-size

  // leader's obstacles, solid
  if (lead && showObs) {
    for (const o of lead.g.obstacles) {
      if (o.passed) continue;
      const x0 = o.worldX - lead.g.cameraX;
      if (x0 > w + 40 || x0 + o.w < -40) continue;
      if (o.t === 'blocks') {
        ctx.fillStyle = '#ff8fa3';
        ctx.fillRect(x0, GY - o.h, o.w, o.h);
        ctx.strokeStyle = '#a14a63'; ctx.strokeRect(x0 + .5, GY - o.h + .5, o.w - 1, o.h - 1);
      } else if (o.t === 'hang') {
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(x0, 60, o.w, GY - WORLD.hangBottom - 60);
        ctx.strokeStyle = '#a18a3a'; ctx.strokeRect(x0 + .5, 60, o.w - 1, GY - WORLD.hangBottom - 60.5);
      } else {
        const top = GY - o.top;
        ctx.fillStyle = o.t === 'whale' ? '#7fa8d9' : '#e4572e';
        ctx.beginPath(); ctx.ellipse(x0 + o.w / 2, top + o.h / 2, o.w / 2, o.h / 2, 0, 0, 7); ctx.fill();
      }
    }
    // leader's collectibles
    ctx.fillStyle = '#ffd166';
    for (const c of lead.g.collectibles) {
      if (c.collected) continue;
      const cx = c.worldX - lead.g.cameraX;
      if (cx < -20 || cx > w + 20) continue;
      ctx.beginPath(); ctx.arc(cx, GY - c.alt, 9, 0, 7); ctx.fill();
    }
  }

  // ghost pups — every alive run at its own height/action, translucent
  if (showGhosts) {
    for (const r of runs) {
      if (r.g.state !== 'PLAYING' && r.g.state !== 'DYING') continue;
      const dying = r.g.state === 'DYING';
      const col = dying ? '#ff5d5d' : r.isOracle ? '#ffffff' : ACT_COLOR[r.g.action] || '#7ee0a3';
      ctx.globalAlpha = dying ? 0.5 : r.isOracle ? 0.35 : 0.22;
      ctx.fillStyle = col;
      const px = WORLD.playerX + ((r.id * 37) % 89) - 44, py = GY - r.g.worldY;
      const hh = r.g.action === 'ducking' ? 26 : 40;
      ctx.beginPath(); ctx.ellipse(px, py - hh / 2 - 8, 20, hh / 2, 0, 0, 7); ctx.fill();
      // board
      ctx.fillRect(px - 24, py - 7, 48, 6);
    }
    ctx.globalAlpha = 1;
  }

  // leader solid on top
  if (lead) {
    const py = GY - lead.g.worldY;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#222';
    const hh = lead.g.action === 'ducking' ? 30 : 52;
    ctx.beginPath(); ctx.ellipse(WORLD.playerX, py - hh / 2 - 8, 22, hh / 2, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#333'; ctx.fillRect(WORLD.playerX - 26, py - 8, 52, 7);
    // HUD
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(8, 8, 180, 46);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px monospace';
    ctx.fillText(`${lead.g.meters | 0} m`, 16, 30);
    ctx.font = '11px monospace'; ctx.fillStyle = '#8ecae6';
    ctx.fillText(`spd ${lead.g.speed.toFixed(1)}  ${b.id}${lead.isOracle ? '  oracle' : '  skill ' + lead.skill.toFixed(2)}`, 16, 46);
  }
  ctx.restore();
}

const BIN = 40, BINS = Math.ceil(MAX_M / BIN);
function drawHist() {
  const W = hist.width, H = hist.height;
  hctx.clearRect(0, 0, W, H);
  hctx.fillStyle = '#0d1730'; hctx.fillRect(0, 0, W, H);

  // stacked death bars by cause
  const bins = new Float64Array(BINS);
  const byCause = new Map();
  for (const d of deaths) {
    const bi = Math.min(BINS - 1, Math.floor(d.m / BIN));
    bins[bi]++;
    const key = d.t || 'other';
    if (!byCause.has(key)) byCause.set(key, new Float64Array(BINS));
    byCause.get(key)[bi]++;
  }
  const maxBin = Math.max(1, ...bins);
  const bw = W / BINS, barH = H - 46;
  for (let i = 0; i < BINS; i++) {
    if (!bins[i]) continue;
    let y = H - 26;
    for (const [cause, arr] of byCause) {
      if (!arr[i]) continue;
      const hh = arr[i] / maxBin * barH;
      hctx.fillStyle = CAUSE_COLOR[cause] || CAUSE_COLOR.other;
      hctx.fillRect(i * bw, y - hh, Math.max(1, bw - 1), hh);
      y -= hh;
    }
  }

  // survival curve (fraction of completed+alive runs that reached each distance)
  const all = completed.concat(runs.map(r => r.g.meters));
  if (all.length > 20) {
    hctx.strokeStyle = '#7ee0a3'; hctx.lineWidth = 1.6; hctx.beginPath();
    for (let i = 0; i < BINS; i++) {
      const m = i * BIN;
      let alive = 0;
      for (const d of all) if (d >= m) alive++;
      const y = H - 26 - (alive / all.length) * barH;
      i ? hctx.lineTo(i * bw, y) : hctx.moveTo(0, y);
    }
    hctx.stroke();
  }

  // milestones
  hctx.strokeStyle = '#ffffff55'; hctx.fillStyle = '#fff';
  hctx.font = '11px monospace'; hctx.textAlign = 'center';
  for (const m of MILESTONES) {
    const x = m.at / BIN * bw;
    hctx.beginPath(); hctx.moveTo(x, 14); hctx.lineTo(x, H - 26); hctx.stroke();
    hctx.fillText(m.at + 'm', x, 12);
  }
  hctx.textAlign = 'left';
  hctx.fillStyle = '#7c8db0';
  hctx.fillText('0', 4, H - 8);
  hctx.fillText(MAX_M + 'm', W - 46, H - 8);
  hctx.fillText('← deaths (stacked) / green = survival %', 130, H - 8);
}

function quantiles(arr) {
  if (!arr.length) return '—';
  const s = [...arr].sort((a, b) => a - b);
  const q = p => Math.round(s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]);
  return `p10 ${q(.1)}  p25 ${q(.25)}  p50 ${q(.5)}  p75 ${q(.75)}  p90 ${q(.9)}`;
}

function drawStats() {
  const alive = runs.filter(r => r.g.state === 'PLAYING').length;
  const reach = m => completed.length ? Math.round(100 * completed.filter(d => d >= m).length / completed.length) + '%' : '—';
  statsEl.textContent =
    `alive ${alive}/${runs.length}   completed runs ${completed.length}\n` +
    `distance:  ${quantiles(completed)}\n` +
    `reach: 500m ${reach(500)}   1500m ${reach(1500)}   3000m ${reach(3000)}\n` +
    `impossible ${runs.reduce((a, r) => a + r.log.impossible.length, 0)}   starved-seq ${runs.reduce((a, r) => a + r.log.sequence.length, 0)}`;
  const rows = Object.entries(causes).sort((a, b) => b[1] - a[1]).slice(0, 10);
  causesEl.innerHTML = '<tr><th>obstacle</th><th>deaths</th><th>%</th></tr>' +
    rows.map(([c, n]) => `<tr><td>${c}</td><td>${n}</td><td>${Math.round(100 * n / deaths.length)}%</td></tr>`).join('');
}

function frame() {
  if (playing) step();
  drawView(); drawHist(); drawStats();
  requestAnimationFrame(frame);
}

ui.play.onclick = () => { playing = !playing; ui.play.textContent = playing ? '⏸ pause' : '▶ run'; ui.play.classList.toggle('on', playing); };
ui.restart.onclick = () => { deaths = []; causes = {}; completed = []; rebuild(); };
ui.runs.onchange = rebuild;
ui.mix.onchange = rebuild;
ui.ghost.onclick = () => { showGhosts = !showGhosts; ui.ghost.classList.toggle('on', showGhosts); };
ui.obs.onclick = () => { showObs = !showObs; ui.obs.classList.toggle('on', showObs); };

rebuild();
requestAnimationFrame(frame);
