// ═══════════════════════════════════════════════════════════════
//  BUSINESS TYCOON - Render Orchestrator (depth sorting, frame)
// ═══════════════════════════════════════════════════════════════

import { getCtx, getSize, getZoom, toScreen, toTile, getMouse } from '../engine.js';
import { getCanvas } from '../engine.js';
import { getRoomInstances } from '../map.js';
import { getAllExpansions, isExpansionAvailable, isExpansionPurchased } from '../floorplan.js';
import { G } from '../game.js';
import { COMPANY_TYPES, WIN_REVENUE } from '../config.js';
import { drawFloor, drawBuildGrid, drawExpansionZones } from './floor.js';
import { drawBackWalls, drawFrontWalls, drawWallShadows } from './walls.js';
import { drawFurniture } from './furniture.js';
import { drawAgent, drawVisitor, hoveredAgent, setHoveredAgent } from './agents.js';
import { drawRoomActivity, drawParticles, drawEntrance, drawConstruction } from './effects.js';
import { drawBuildGhost } from '../build-mode.js';

let gameOverOverlayShown = false;

export function updateHover() {
  const zoom = getZoom();
  const { x: mouseX, y: mouseY } = getMouse();
  let found = null;
  let foundFurniture = null;

  for (const agent of G.agents) {
    const s = toScreen(agent.x, agent.y);
    const dx = mouseX - s.x, dy = mouseY - (s.y - 10 * zoom);
    if (Math.abs(dx) < 14 * zoom && Math.abs(dy) < 20 * zoom) {
      found = agent;
      break;
    }
  }

  // Check interactive furniture hover
  if (!found) {
    for (const room of getRoomInstances()) {
      for (const f of room.furnitureList) {
        if (!f.interactive) continue;
        const s = toScreen(f.x, f.y);
        const dx = mouseX - s.x, dy = mouseY - (s.y - 10 * zoom);
        if (Math.abs(dx) < 20 * zoom && Math.abs(dy) < 25 * zoom) {
          foundFurniture = { furniture: f, room };
          break;
        }
      }
      if (foundFurniture) break;
    }
  }

  // Check expansion zone hover
  let hoveredExpansion = null;
  if (!found && !foundFurniture && !G.buildMode) {
    const { tx, ty } = toTile(mouseX, mouseY);
    for (const exp of getAllExpansions()) {
      if (isExpansionPurchased(exp.id) || !isExpansionAvailable(exp)) continue;
      if (tx >= exp.x && tx < exp.x + exp.w && ty >= exp.y && ty < exp.y + exp.h) {
        hoveredExpansion = exp;
        break;
      }
    }
  }

  setHoveredAgent(found);
  G._hoveredFurniture = foundFurniture;
  G._hoveredExpansion = hoveredExpansion;
  getCanvas().classList.toggle('pointer', !!found || !!foundFurniture || !!hoveredExpansion || G.buildMode);
}

export function render() {
  const ctx = getCtx();
  const { W, H } = getSize();

  ctx.clearRect(0, 0, W, H);

  // Background - sunny sky over grass
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#d4efff');
  bg.addColorStop(0.55, '#a8daf0');
  bg.addColorStop(1, '#8ecae6');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Floor tiles + expansion zones + build grid overlay
  drawFloor();
  drawExpansionZones();
  drawBuildGrid();

  // Wall shadows on floor (subtle)
  drawWallShadows();

  // Back walls (behind furniture/agents - NW-facing, full height)
  drawBackWalls();

  // Depth-sorted renderables (furniture + agents)
  const renderables = [];
  for (const room of getRoomInstances()) {
    for (const f of room.furnitureList) {
      renderables.push({ type: 'f', data: f, depth: f.x + f.y, y: f.y });
    }
  }
  for (const agent of G.agents) {
    renderables.push({ type: 'a', data: agent, depth: agent.x + agent.y, y: agent.y });
  }
  for (const v of G.visitors) {
    if (v.state !== 'gone') {
      renderables.push({ type: 'v', data: v, depth: v.x + v.y, y: v.y });
    }
  }
  renderables.sort((a, b) => a.depth - b.depth || a.y - b.y);

  for (const r of renderables) {
    if (r.type === 'f') drawFurniture(r.data);
    else if (r.type === 'v') drawVisitor(r.data);
    else drawAgent(r.data);
  }

  // Front walls (AFTER furniture - SE-facing, short, transparent peek-inside)
  drawFrontWalls();

  // Overlays
  drawConstruction();
  drawRoomActivity();
  drawParticles();
  drawEntrance();
  drawBuildGhost();

  // Expansion hover tooltip
  if (G._hoveredExpansion) {
    drawExpansionTooltip(ctx);
  }

  // Game over overlay
  if (G.gameOver) {
    drawGameOverOverlay(ctx, W, H);
  }
}

function drawExpansionTooltip(ctx) {
  const exp = G._hoveredExpansion;
  const { x: mx, y: my } = getMouse();
  const canAfford = G.money >= exp.cost;

  const text = `🗺️ ${exp.name} - $${exp.cost.toLocaleString()}`;
  const hint = canAfford ? 'Click to buy' : 'Not enough funds';
  ctx.font = 'bold 12px system-ui';
  const textW = ctx.measureText(text).width;
  ctx.font = '10px system-ui';
  const hintW = ctx.measureText(hint).width;
  const boxW = Math.max(textW, hintW) + 24;
  const boxH = 42;
  const bx = mx - boxW / 2;
  const by = my - boxH - 14;

  ctx.fillStyle = 'rgba(255, 252, 247, 0.97)';
  ctx.beginPath();
  ctx.roundRect(bx, by, boxW, boxH, 8);
  ctx.fill();
  ctx.strokeStyle = canAfford ? 'rgba(240,180,80,0.5)' : 'rgba(224,80,80,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#2c2419';
  ctx.font = 'bold 12px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(text, mx, by + 17);
  ctx.fillStyle = canAfford ? '#2d9a58' : '#c0392b';
  ctx.font = '10px system-ui';
  ctx.fillText(hint, mx, by + 33);
}

function drawGameOverOverlay(ctx, W, H) {
  ctx.fillStyle = 'rgba(44, 36, 25, 0.45)';
  ctx.fillRect(0, 0, W, H);

  // Show HTML overlay on first call
  if (!gameOverOverlayShown) {
    gameOverOverlayShown = true;
    showGameOverOverlay();
  }
}

function getShelterEndStats() {
  const adoptions = G.adoptedCount || 0;
  const donations = Math.round(G.totalRevenue || 0);
  const reputation = Math.round(G.reputation || 0);
  const carePlansDone = (G.completedLog || []).filter(e => e.source === 'adoption').length;
  const petsInCare = (G.agents || []).filter(a => a.petId).length;
  const carePlansActive = (G.projects || []).filter(p => p.isCarePlan).length;
  return { adoptions, donations, reputation, carePlansDone, petsInCare, carePlansActive };
}

function showGameOverOverlay() {
  const existing = document.getElementById('game-over-overlay');
  if (existing) existing.remove();

  const isWin = G.gameWon;
  const companyDef = COMPANY_TYPES[G.companyType] || { name: 'Humane Society', icon: '🐾' };
  const stats = getShelterEndStats();
  const metGoalAdoptions = stats.adoptions >= 25;
  const metGoalDonations = stats.donations >= WIN_REVENUE;

  const overlay = document.createElement('div');
  overlay.id = 'game-over-overlay';
  overlay.className = isWin ? 'go-overlay--win' : 'go-overlay--lose';

  overlay.innerHTML = `
    <div class="go-card" role="dialog" aria-labelledby="go-title" aria-modal="true">
      <header class="go-header">
        <div class="go-badge" aria-hidden="true">${isWin ? '🏠' : '🐾'}</div>
        <h2 class="go-title" id="go-title">${isWin ? 'Mission Accomplished!' : 'Operations Suspended'}</h2>
        <p class="go-subtitle">
          ${companyDef.icon} Monroe Humane Society · Week ${G.week}
        </p>
      </header>

      <div class="go-hero ${isWin ? 'go-hero--win' : 'go-hero--lose'}">
        ${isWin ? `
          <div class="go-hero-value">${stats.adoptions}</div>
          <div class="go-hero-label">Forever homes found</div>
          <p class="go-hero-note">
            ${metGoalAdoptions && metGoalDonations
              ? 'You hit both mission goals - 25+ adoptions and $' + WIN_REVENUE.toLocaleString() + '+ in donations.'
              : metGoalAdoptions
                ? 'Goal reached: 25 pets adopted into loving homes.'
                : 'Goal reached: $' + WIN_REVENUE.toLocaleString() + '+ in adoption donations.'}
          </p>
        ` : `
          <div class="go-hero-value">Day ${G.day}</div>
          <div class="go-hero-label">Shelter funds exhausted</div>
          <p class="go-hero-note">
            Balance fell below $${Math.abs(-5000).toLocaleString()}. Intake, care, and adoptions paused until new funding.
          </p>
        `}
      </div>

      <div class="go-stats" aria-label="Run summary">
        <div class="go-stat">
          <div class="go-stat-val">${stats.adoptions}</div>
          <div class="go-stat-lbl">Adoptions</div>
        </div>
        <div class="go-stat">
          <div class="go-stat-val">$${stats.donations.toLocaleString()}</div>
          <div class="go-stat-lbl">Donations</div>
        </div>
        <div class="go-stat">
          <div class="go-stat-val">${stats.reputation}%</div>
          <div class="go-stat-lbl">Trust</div>
        </div>
        <div class="go-stat">
          <div class="go-stat-val">${stats.petsInCare}</div>
          <div class="go-stat-lbl">In care now</div>
        </div>
      </div>

      <div class="go-mission">
        <div class="go-section-label">Mission goals</div>
        <ul class="go-goal-list">
          <li class="${metGoalAdoptions ? 'go-goal--done' : ''}">
            <span class="go-goal-check" aria-hidden="true">${metGoalAdoptions ? '✓' : '○'}</span>
            <span>25 pets find forever homes</span>
            <span class="go-goal-progress">${Math.min(stats.adoptions, 25)}/25</span>
          </li>
          <li class="${metGoalDonations ? 'go-goal--done' : ''}">
            <span class="go-goal-check" aria-hidden="true">${metGoalDonations ? '✓' : '○'}</span>
            <span>$${WIN_REVENUE.toLocaleString()} in adoption donations</span>
            <span class="go-goal-progress">$${stats.donations.toLocaleString()}</span>
          </li>
        </ul>
      </div>

      <div class="go-lesson">
        ${isWin ? getShelterSuccessLesson(stats) : getShelterHardshipLesson(stats)}
      </div>

      <div class="go-actions">
        ${isWin ? '<button type="button" class="go-btn go-btn--secondary" id="keep-playing-btn">Keep Serving Pets</button>' : ''}
        <button type="button" class="go-btn go-btn--primary" id="restart-btn">
          ${isWin ? 'Start a New Shelter Run' : 'Try Again'}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  if (isWin) {
    document.getElementById('keep-playing-btn').addEventListener('click', () => {
      overlay.remove();
      gameOverOverlayShown = false;
      G.gameOver = false;
      G.gameWon = false;
    });
  }

  document.getElementById('restart-btn').addEventListener('click', () => {
    overlay.remove();
    gameOverOverlayShown = false;
    window.dispatchEvent(new CustomEvent('studio-tycoon-restart'));
  });
}

function getShelterSuccessLesson(stats) {
  const tips = [
    'Your shelter kept pets healthy, moved care plans forward, and connected animals with adopters.',
  ];
  if (stats.reputation >= 70) {
    tips.push('<strong>High community trust</strong> helps adopters choose your humane society.');
  }
  if (stats.adoptions >= 25) {
    tips.push(`<strong>${stats.adoptions} adoptions</strong> mean more empty kennels and more lives saved.`);
  }
  if (stats.donations >= WIN_REVENUE) {
    tips.push('Strong <strong>donation income</strong> funds intake, medical care, and enrichment.');
  }
  return tips.join(' ');
}

function getShelterHardshipLesson(stats) {
  const tips = [
    'Shelters need steady donations and completed adoptions to cover daily care costs.',
  ];
  if (stats.adoptions < 5) {
    tips.push('Finish <strong>care plans</strong> and move pets through intake → ready → adoption to bring in donations.');
  } else if (stats.petsInCare > 8) {
    tips.push('Too many pets in care at once raises costs. <strong>Balance intake</strong> with adoption throughput.');
  } else {
    tips.push('Watch daily spending vs. adoption fees. <strong>Programs and vet care</strong> add up quickly.');
  }
  if (stats.reputation < 40) {
    tips.push('Low <strong>community trust</strong> slows adopter traffic - keep habitats staffed and pets happy.');
  }
  return tips.join(' ');
}

export function resetRenderer() {
  gameOverOverlayShown = false;
}
