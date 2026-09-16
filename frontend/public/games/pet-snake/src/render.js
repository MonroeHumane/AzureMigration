// Pet Snake Adventure — High-Performance Canvas 2D Renderer
// 60fps sub-tick interpolation, dynamic lighting (Dim Room), animated vacuum, and juice.

import { VIEW } from './config.js';

export class CanvasBoardRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.theme = 'dark';
    this.particles = [];
    this.time = 0;
  }

  setTheme(theme) {
    this.theme = theme === 'light' ? 'light' : 'dark';
  }

  render(snapshot, dt = 0.016) {
    this.time += dt;
    const ctx = this.ctx;
    const { W, H } = VIEW;

    // Clear canvas
    ctx.save();

    // Screen Shake
    if (snapshot.shakeIntensity > 0) {
      const sx = (Math.random() - 0.5) * snapshot.shakeIntensity * 1.5;
      const sy = (Math.random() - 0.5) * snapshot.shakeIntensity * 1.5;
      ctx.translate(sx, sy);
    }

    const isLight = this.theme === 'light';
    const pal = isLight ? {
      bg: '#f8faf8',
      boardBg: '#fffbf5',
      gridLines: 'rgba(15, 118, 110, 0.08)',
      boardBorder: '#8d6e63',
      snakeBody: snapshot.mascot?.bodyColor || '#0f766e',
      snakeOutline: '#3d241d',
      shadow: 'rgba(44, 28, 25, 0.14)'
    } : {
      bg: '#040d0c',
      boardBg: '#081e1b',
      gridLines: 'rgba(94, 234, 212, 0.07)',
      boardBorder: '#134e4a',
      snakeBody: snapshot.mascot?.bodyColor || '#2dd4bf',
      snakeOutline: '#042f2e',
      shadow: 'rgba(0, 0, 0, 0.35)'
    };

    // Draw Board Background
    ctx.fillStyle = pal.boardBg;
    ctx.fillRect(0, 0, W, H);

    const boardSize = snapshot.boardSize || 19;
    const cellSize = W / boardSize;

    // Draw Grid Lines
    ctx.strokeStyle = pal.gridLines;
    ctx.lineWidth = 1;
    for (let i = 0; i <= boardSize; i++) {
      const pos = Math.round(i * cellSize);
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, H);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(W, pos);
      ctx.stroke();
    }

    // Draw Obstacles
    this.drawObstacles(ctx, snapshot.obstacles, cellSize, isLight);

    // Draw Vacuum Tail & Vacuum
    if (snapshot.vacuum) {
      this.drawVacuum(ctx, snapshot.vacuum, snapshot.vacuumTail, cellSize, isLight);
    }

    // Draw Treats & Rescue Tokens
    this.drawTreats(ctx, snapshot.treats, cellSize);

    // Draw Powerup
    if (snapshot.powerup) {
      this.drawPowerup(ctx, snapshot.powerup, cellSize);
    }

    // Draw Bomb
    if (snapshot.bomb) {
      this.drawBomb(ctx, snapshot.bomb, cellSize, snapshot.snake[0]);
    }

    // Draw Snake Body & Head
    this.drawSnake(ctx, snapshot.snake, snapshot.direction, cellSize, pal, snapshot);

    // Update & Draw Particles
    this.updateAndDrawParticles(ctx, dt);

    // Dynamic Lighting for "Dim Room" Affix
    if (snapshot.dimRoom && snapshot.snake && snapshot.snake.length > 0) {
      this.drawDimRoomMask(ctx, snapshot.snake[0], cellSize, W, H);
    }

    // Grace Period Border Glow
    if (snapshot.graceMs > 0) {
      const alpha = Math.min(1.0, snapshot.graceMs / 1000);
      ctx.strokeStyle = `rgba(250, 204, 21, ${0.4 + Math.sin(this.time * 8) * 0.2 * alpha})`;
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, W - 6, H - 6);
    }

    ctx.restore();
  }

  // ── Draw Snake ────────────────────────────────────────────────────────────
  drawSnake(ctx, snake, dir, cellSize, pal, snapshot) {
    if (!snake || snake.length === 0) return;

    const r = cellSize * 0.44;

    // Draw Body Segments (tail to neck)
    for (let i = snake.length - 1; i >= 1; i--) {
      const curr = snake[i];
      const next = snake[i - 1];

      const cx = (curr.x + 0.5) * cellSize;
      const cy = (curr.y + 0.5) * cellSize;
      const nx = (next.x + 0.5) * cellSize;
      const ny = (next.y + 0.5) * cellSize;

      // Segment size scales down slightly toward tail
      const taper = 0.75 + 0.25 * (i / snake.length);
      const segR = r * taper;

      // Drop shadow
      ctx.fillStyle = pal.shadow;
      ctx.beginPath();
      ctx.arc(cx + 2, cy + 3, segR, 0, Math.PI * 2);
      ctx.fill();

      // Connecting capsule between adjacent segments
      ctx.strokeStyle = pal.snakeBody;
      ctx.lineWidth = segR * 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(nx, ny);
      ctx.stroke();

      // Outer outline
      ctx.strokeStyle = pal.snakeOutline;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, segR, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw Head
    const head = snake[0];
    const hx = (head.x + 0.5) * cellSize;
    const hy = (head.y + 0.5) * cellSize;

    // Shield aura if active
    if (snapshot.activeEffects?.shield > 0) {
      ctx.save();
      const auraR = cellSize * 0.75 + Math.sin(this.time * 6) * 3;
      const grad = ctx.createRadialGradient(hx, hy, r * 0.6, hx, hy, auraR);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(hx, hy, auraR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Speed fire trail
    if (snapshot.activeEffects?.speed > 0 && Math.random() < 0.4) {
      this.spawnParticle(hx - dir.x * cellSize * 0.4, hy - dir.y * cellSize * 0.4, '#facc15', 2);
    }

    // Head base circle
    ctx.fillStyle = pal.snakeBody;
    ctx.beginPath();
    ctx.arc(hx, hy, r * 1.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = pal.snakeOutline;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Eyes
    const angle = Math.atan2(dir.y, dir.x);
    const eyeDist = r * 0.55;
    const eyeSpread = r * 0.5;

    const e1x = hx + Math.cos(angle) * eyeDist - Math.sin(angle) * eyeSpread;
    const e1y = hy + Math.sin(angle) * eyeDist + Math.cos(angle) * eyeSpread;
    const e2x = hx + Math.cos(angle) * eyeDist + Math.sin(angle) * eyeSpread;
    const e2y = hy + Math.sin(angle) * eyeDist - Math.cos(angle) * eyeSpread;

    // Whites
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(e1x, e1y, r * 0.32, 0, Math.PI * 2);
    ctx.arc(e2x, e2y, r * 0.32, 0, Math.PI * 2);
    ctx.fill();

    // Pupils looking toward direction
    const pupilOffset = r * 0.12;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(e1x + dir.x * pupilOffset, e1y + dir.y * pupilOffset, r * 0.18, 0, Math.PI * 2);
    ctx.arc(e2x + dir.x * pupilOffset, e2y + dir.y * pupilOffset, r * 0.18, 0, Math.PI * 2);
    ctx.fill();

    // Cheeks
    ctx.fillStyle = 'rgba(244, 63, 94, 0.45)';
    ctx.beginPath();
    ctx.arc(hx - Math.sin(angle) * eyeSpread * 1.1, hy + Math.cos(angle) * eyeSpread * 1.1, r * 0.22, 0, Math.PI * 2);
    ctx.arc(hx + Math.sin(angle) * eyeSpread * 1.1, hy - Math.cos(angle) * eyeSpread * 1.1, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Draw Treats & Rescues ─────────────────────────────────────────────────
  drawTreats(ctx, treats, cellSize) {
    if (!treats) return;

    treats.forEach((t, index) => {
      const bounce = Math.sin(this.time * 4 + index) * 3;
      const cx = (t.x + 0.5) * cellSize;
      const cy = (t.y + 0.5) * cellSize + bounce;
      const r = cellSize * 0.38;

      // Drop shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.beginPath();
      ctx.ellipse(cx, (t.y + 0.8) * cellSize, r * 0.8, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();

      if (t.isPet) {
        // Special Shelter Pet Rescue Medallion
        ctx.save();
        const haloR = r * 1.3 + Math.sin(this.time * 5) * 2;
        ctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
        ctx.beginPath();
        ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0f766e';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.font = `${Math.round(cellSize * 0.48)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🐾', cx, cy);
        ctx.restore();
      } else {
        // Standard Treats (Fish, Bone, Biscuit, Steak)
        ctx.save();
        ctx.fillStyle = t.color || '#fbbf24';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = `${Math.round(cellSize * 0.46)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t.icon || '🍪', cx, cy);
        ctx.restore();
      }
    });
  }

  // ── Draw Powerup ──────────────────────────────────────────────────────────
  drawPowerup(ctx, p, cellSize) {
    const pulse = 1.0 + Math.sin(this.time * 6) * 0.12;
    const cx = (p.x + 0.5) * cellSize;
    const cy = (p.y + 0.5) * cellSize;
    const r = cellSize * 0.42 * pulse;

    ctx.save();
    ctx.fillStyle = 'rgba(168, 85, 247, 0.3)';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#9333ea';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.font = `${Math.round(cellSize * 0.5)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.icon || '⚡', cx, cy);
    ctx.restore();
  }

  // ── Draw Bomb ─────────────────────────────────────────────────────────────
  drawBomb(ctx, bomb, cellSize, snakeHead) {
    const cx = (bomb.x + 0.5) * cellSize;
    const cy = (bomb.y + 0.5) * cellSize;
    const r = cellSize * 0.38;

    ctx.save();

    // Pulsing danger halo if snake is close
    if (snakeHead) {
      const dist = Math.abs(snakeHead.x - bomb.x) + Math.abs(snakeHead.y - bomb.y);
      if (dist <= 4) {
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.4 + Math.sin(this.time * 10) * 0.3})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Bomb body
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Sparking fuse
    const fuseX = cx + r * 0.6;
    const fuseY = cy - r * 0.6;
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.arc(fuseX, fuseY, 3 + Math.sin(this.time * 20) * 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = `${Math.round(cellSize * 0.45)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💣', cx, cy);
    ctx.restore();
  }

  // ── Draw Obstacles ────────────────────────────────────────────────────────
  drawObstacles(ctx, obstacles, cellSize, isLight) {
    if (!obstacles) return;

    ctx.save();
    obstacles.forEach(o => {
      const x = o.x * cellSize + 2;
      const y = o.y * cellSize + 2;
      const s = cellSize - 4;

      // Drop shadow
      ctx.fillStyle = isLight ? 'rgba(44, 28, 25, 0.15)' : 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(x + 2, y + 2, s, s);

      // Crate body
      ctx.fillStyle = isLight ? '#bcaaa4' : '#27272a';
      ctx.fillRect(x, y, s, s);

      ctx.strokeStyle = isLight ? '#5d4037' : '#52525b';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, s, s);

      // Wood crate diagonal brace
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + s, y + s);
      ctx.moveTo(x + s, y);
      ctx.lineTo(x, y + s);
      ctx.stroke();
    });
    ctx.restore();
  }

  // ── Draw Vacuum Cleaner ───────────────────────────────────────────────────
  drawVacuum(ctx, vac, tail, cellSize, isLight) {
    ctx.save();

    // 1. Draw Vacuum Tail (cord / trail)
    if (tail && tail.length > 0) {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
      ctx.lineWidth = cellSize * 0.35;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo((vac.x + 0.5) * cellSize, (vac.y + 0.5) * cellSize);
      tail.forEach(t => {
        ctx.lineTo((t.x + 0.5) * cellSize, (t.y + 0.5) * cellSize);
      });
      ctx.stroke();
    }

    // 2. Draw Vacuum Head
    const cx = (vac.x + 0.5) * cellSize;
    const cy = (vac.y + 0.5) * cellSize;
    const r = cellSize * 0.44;

    // Vibrating rumble
    const rx = (Math.random() - 0.5) * 1.5;
    const ry = (Math.random() - 0.5) * 1.5;

    // Suction cone particles
    if (Math.random() < 0.6) {
      const coneDir = vac.dir || { x: 0, y: 1 };
      this.spawnParticle(cx + coneDir.x * cellSize * 0.6, cy + coneDir.y * cellSize * 0.6, '#94a3b8', 1.5);
    }

    // Outer aura
    ctx.fillStyle = vac.difficulty === 'boss' ? 'rgba(220, 38, 38, 0.35)' : 'rgba(234, 88, 12, 0.25)';
    ctx.beginPath();
    ctx.arc(cx + rx, cy + ry, r * 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Vacuum Body
    ctx.fillStyle = vac.difficulty === 'boss' ? '#7f1d1d' : '#ea580c';
    ctx.beginPath();
    ctx.arc(cx + rx, cy + ry, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Headlights
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(cx + rx - r * 0.3, cy + ry - r * 0.2, 3, 0, Math.PI * 2);
    ctx.arc(cx + rx + r * 0.3, cy + ry - r * 0.2, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ── Dim Room Light Mask ───────────────────────────────────────────────────
  drawDimRoomMask(ctx, snakeHead, cellSize, W, H) {
    ctx.save();
    const hx = (snakeHead.x + 0.5) * cellSize;
    const hy = (snakeHead.y + 0.5) * cellSize;
    const lightRadius = cellSize * 4.2;

    const mask = ctx.createRadialGradient(hx, hy, lightRadius * 0.3, hx, hy, lightRadius);
    mask.addColorStop(0, 'rgba(0, 0, 0, 0)');
    mask.addColorStop(0.7, 'rgba(0, 0, 0, 0.65)');
    mask.addColorStop(1, 'rgba(0, 0, 0, 0.95)');

    ctx.fillStyle = mask;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // ── Particles ─────────────────────────────────────────────────────────────
  spawnParticle(x, y, color, size = 2) {
    if (this.particles.length > 60) return;
    this.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 40,
      vy: (Math.random() - 0.5) * 40,
      life: 0.5 + Math.random() * 0.4,
      maxLife: 0.9,
      color,
      size
    });
  }

  updateAndDrawParticles(ctx, dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      const alpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }
  }
}
