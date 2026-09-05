import { PALETTE } from './palette';
import { circle, line, polyline, resetGlow, wire } from './primitives';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: 'spark' | 'ripple' | 'star' | 'dust' | 'fracture';
}

export class ParticleSystem {
  private particles: Particle[] = [];

  spawnHop(x: number, y: number, isWater: boolean): void {
    if (isWater) {
      // Expanding water ripple ring
      this.particles.push({
        x,
        y: y + 4,
        vx: 0,
        vy: 0,
        life: 0.35,
        maxLife: 0.35,
        color: PALETTE.water,
        size: 10,
        type: 'ripple',
      });
      // Cyan splash droplets
      for (let i = 0; i < 6; i++) {
        const angle = -Math.PI * 0.8 + Math.random() * Math.PI * 0.6;
        const speed = 35 + Math.random() * 50;
        this.particles.push({
          x: x + (Math.random() - 0.5) * 8,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.3 + Math.random() * 0.15,
          maxLife: 0.45,
          color: Math.random() > 0.4 ? PALETTE.water : PALETTE.waterGlow,
          size: 1.2 + Math.random() * 1.0,
          type: 'spark',
        });
      }
    } else {
      // Ground dust ring
      this.particles.push({
        x,
        y: y + 8,
        vx: 0,
        vy: 0,
        life: 0.25,
        maxLife: 0.25,
        color: PALETTE.catSoft,
        size: 8,
        type: 'ripple',
      });
      // Puffed dust flecks
      for (let i = 0; i < 4; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 15 + Math.random() * 25;
        this.particles.push({
          x,
          y: y + 6,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 10,
          life: 0.2 + Math.random() * 0.15,
          maxLife: 0.35,
          color: '#529671',
          size: 1.0 + Math.random() * 0.8,
          type: 'dust',
        });
      }
    }
  }

  spawnHome(x: number, y: number): void {
    // Joyful celebration starburst
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      const speed = 50 + Math.random() * 90;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30, // Initial upward burst
        life: 0.5 + Math.random() * 0.35,
        maxLife: 0.85,
        color: i % 2 === 0 ? PALETTE.catGlow : PALETTE.warning,
        size: 2.2 + Math.random() * 1.5,
        type: i % 3 === 0 ? 'star' : 'spark',
      });
    }

    // Expanding golden celebration shockwave
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.5,
      maxLife: 0.5,
      color: PALETTE.warning,
      size: 32,
      type: 'ripple',
    });
  }

  spawnDefeat(x: number, y: number): void {
    // Fracture line shards
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const speed = 40 + Math.random() * 60;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.2,
        maxLife: 0.6,
        color: PALETTE.dogCoral,
        size: 8,
        type: 'fracture',
      });
    }
  }

  update(delta: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Physics integration
      p.x += p.vx * delta;
      p.y += p.vy * delta;

      // Friction & slight gravity for physical sparks
      if (p.type === 'spark' || p.type === 'star') {
        p.vy += 80 * delta; // Gravity
        p.vx *= 0.95;
      } else if (p.type === 'dust') {
        p.vx *= 0.90;
        p.vy *= 0.90;
      }
    }
  }

  render(context: CanvasRenderingContext2D): void {
    resetGlow(context);
    this.particles.forEach((p) => {
      const progress = 1 - p.life / p.maxLife; // 0 at birth, 1 at death
      const alpha = Math.max(0, 1 - progress);

      if (p.type === 'ripple') {
        const radius = p.size * (0.3 + progress * 0.7);
        wire(context, p.color, 1.4, alpha * 0.8);
        context.beginPath();
        context.ellipse(p.x, p.y, radius, radius * 0.45, 0, 0, Math.PI * 2);
        context.stroke();
      } else if (p.type === 'star') {
        wire(context, p.color, 1.3, alpha, 3);
        const s = p.size * (1 - progress * 0.4);
        line(context, { x: p.x - s, y: p.y }, { x: p.x + s, y: p.y });
        line(context, { x: p.x, y: p.y - s }, { x: p.x, y: p.y + s });
        line(context, { x: p.x - s * 0.7, y: p.y - s * 0.7 }, { x: p.x + s * 0.7, y: p.y + s * 0.7 });
        line(context, { x: p.x - s * 0.7, y: p.y + s * 0.7 }, { x: p.x + s * 0.7, y: p.y - s * 0.7 });
      } else if (p.type === 'fracture') {
        wire(context, p.color, 1.6, alpha, 2);
        const len = p.size * (1 - progress * 0.3);
        const angle = Math.atan2(p.vy, p.vx);
        line(
          context,
          { x: p.x, y: p.y },
          { x: p.x + Math.cos(angle) * len, y: p.y + Math.sin(angle) * len },
        );
      } else {
        // Spark or dust dot
        wire(context, p.color, 1.2, alpha, 2);
        circle(context, { x: p.x, y: p.y }, p.size);
      }
    });
    resetGlow(context);
  }
}
