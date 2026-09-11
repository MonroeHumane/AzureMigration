import { PALETTE } from './palette';
import { circle, line, resetGlow, wire } from './primitives';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: 'spark' | 'ripple' | 'star' | 'dust' | 'fracture' | 'afterimage' | 'sparkle';
}

export class ParticleSystem {
  private particles: Particle[] = [];
  /** When true, skip flashy bursts (trails, sparkles, warning dust). Core hop/home/defeat stay minimal. */
  reducedMotion = false;

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
  }

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
      const splashCount = this.reducedMotion ? 3 : 6;
      for (let i = 0; i < splashCount; i++) {
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
      const dustCount = this.reducedMotion ? 2 : 4;
      for (let i = 0; i < dustCount; i++) {
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

  /**
   * Soft afterimage trail behind the cat on each hop.
   * denser=true for consecutive/fast hops (stronger motion read).
   */
  spawnTrail(
    x: number,
    y: number,
    direction: 'up' | 'down' | 'left' | 'right' = 'up',
    denser = false,
  ): void {
    if (this.reducedMotion) return;
    const dirMap = {
      up: { x: 0, y: 1 },
      down: { x: 0, y: -1 },
      left: { x: 1, y: 0 },
      right: { x: -1, y: 0 },
    } as const;
    const back = dirMap[direction] || dirMap.up;
    const count = denser ? 5 : 3;
    for (let i = 0; i < count; i++) {
      const t = (i + 1) / count;
      this.particles.push({
        x: x + back.x * (8 + i * (denser ? 7 : 9)) + (Math.random() - 0.5) * 4,
        y: y + back.y * (8 + i * (denser ? 7 : 9)) + (Math.random() - 0.5) * 4,
        vx: back.x * (denser ? 12 : 8),
        vy: back.y * (denser ? 12 : 8),
        life: 0.2 + t * (denser ? 0.18 : 0.12),
        maxLife: denser ? 0.42 : 0.34,
        color: i % 2 === 0 ? PALETTE.catGlow : PALETTE.catSoft,
        size: (denser ? 6.2 : 5.5) - i * (denser ? 0.85 : 1.1),
        type: 'afterimage',
      });
    }
    // Extra mid-body ghost outline on fast hops
    if (denser) {
      this.particles.push({
        x: x + back.x * 6,
        y: y + back.y * 6,
        vx: back.x * 4,
        vy: back.y * 4,
        life: 0.18,
        maxLife: 0.18,
        color: PALETTE.cat,
        size: 7.5,
        type: 'afterimage',
      });
    }
  }

  /** Cyan/gold sparkle burst when the cat lands on a fishbone raft. */
  spawnFishboneSparkle(x: number, y: number): void {
    if (this.reducedMotion) {
      this.particles.push({
        x,
        y,
        vx: 0,
        vy: 0,
        life: 0.2,
        maxLife: 0.2,
        color: PALETTE.waterGlow,
        size: 12,
        type: 'ripple',
      });
      return;
    }
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.25;
      const speed = 28 + Math.random() * 55;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 18,
        life: 0.28 + Math.random() * 0.22,
        maxLife: 0.5,
        color: i % 3 === 0 ? PALETTE.warning : i % 2 === 0 ? PALETTE.waterGlow : PALETTE.water,
        size: 1.4 + Math.random() * 1.4,
        type: i % 2 === 0 ? 'sparkle' : 'star',
      });
    }
    this.particles.push({
      x,
      y: y + 2,
      vx: 0,
      vy: 0,
      life: 0.28,
      maxLife: 0.28,
      color: PALETTE.water,
      size: 14,
      type: 'ripple',
    });
  }

  /** Stronger warning dust / grit when a patrol dog is near the cat. */
  spawnDogWarning(x: number, y: number, intensity = 1): void {
    if (this.reducedMotion) return;
    const count = Math.round(5 + intensity * 4);
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI * 0.15 + Math.random() * Math.PI * 1.3;
      const speed = 20 + Math.random() * 45 * intensity;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 18,
        y: y + 10 + Math.random() * 6,
        vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
        vy: -Math.abs(Math.sin(angle)) * speed * 0.55 - 8,
        life: 0.22 + Math.random() * 0.2,
        maxLife: 0.42,
        color: i % 2 === 0 ? PALETTE.warning : PALETTE.dogCoral,
        size: 1.2 + Math.random() * 1.6 * intensity,
        type: 'dust',
      });
    }
    // Brief amber hazard ring under the threat
    this.particles.push({
      x,
      y: y + 12,
      vx: 0,
      vy: 0,
      life: 0.22,
      maxLife: 0.22,
      color: PALETTE.warning,
      size: 10 + intensity * 6,
      type: 'ripple',
    });
  }

  spawnHome(x: number, y: number): void {
    const burst = this.reducedMotion ? 10 : 24;
    for (let i = 0; i < burst; i++) {
      const angle = (i / burst) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      const speed = 50 + Math.random() * 90;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        life: 0.5 + Math.random() * 0.35,
        maxLife: 0.85,
        color: i % 2 === 0 ? PALETTE.catGlow : PALETTE.warning,
        size: 2.2 + Math.random() * 1.5,
        type: i % 3 === 0 ? 'star' : 'spark',
      });
    }

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
    const shards = this.reducedMotion ? 6 : 12;
    for (let i = 0; i < shards; i++) {
      const angle = (i / shards) * Math.PI * 2;
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

      p.x += p.vx * delta;
      p.y += p.vy * delta;

      if (p.type === 'spark' || p.type === 'star' || p.type === 'sparkle') {
        p.vy += 80 * delta;
        p.vx *= 0.95;
      } else if (p.type === 'dust' || p.type === 'afterimage') {
        p.vx *= 0.9;
        p.vy *= 0.9;
      }
    }
  }

  render(context: CanvasRenderingContext2D): void {
    resetGlow(context);
    this.particles.forEach((p) => {
      const progress = 1 - p.life / p.maxLife;
      const alpha = Math.max(0, 1 - progress);

      if (p.type === 'ripple') {
        const radius = p.size * (0.3 + progress * 0.7);
        wire(context, p.color, 1.4, alpha * 0.8);
        context.beginPath();
        context.ellipse(p.x, p.y, radius, radius * 0.45, 0, 0, Math.PI * 2);
        context.stroke();
      } else if (p.type === 'star' || p.type === 'sparkle') {
        wire(context, p.color, p.type === 'sparkle' ? 1.5 : 1.3, alpha, p.type === 'sparkle' ? 5 : 3);
        const s = p.size * (1 - progress * 0.4);
        line(context, { x: p.x - s, y: p.y }, { x: p.x + s, y: p.y });
        line(context, { x: p.x, y: p.y - s }, { x: p.x, y: p.y + s });
        if (p.type === 'sparkle') {
          const d = s * 0.55;
          line(context, { x: p.x - d, y: p.y - d }, { x: p.x + d, y: p.y + d });
          line(context, { x: p.x - d, y: p.y + d }, { x: p.x + d, y: p.y - d });
        } else {
          line(context, { x: p.x - s * 0.7, y: p.y - s * 0.7 }, { x: p.x + s * 0.7, y: p.y + s * 0.7 });
          line(context, { x: p.x - s * 0.7, y: p.y + s * 0.7 }, { x: p.x + s * 0.7, y: p.y - s * 0.7 });
        }
      } else if (p.type === 'fracture') {
        wire(context, p.color, 1.6, alpha, 2);
        const len = p.size * (1 - progress * 0.3);
        const angle = Math.atan2(p.vy, p.vx);
        line(
          context,
          { x: p.x, y: p.y },
          { x: p.x + Math.cos(angle) * len, y: p.y + Math.sin(angle) * len },
        );
      } else if (p.type === 'afterimage') {
        const s = p.size * (1 - progress * 0.35);
        wire(context, p.color, 1.1, alpha * 0.55, 6);
        circle(context, { x: p.x, y: p.y }, s);
        wire(context, p.color, 0.9, alpha * 0.35);
        circle(context, { x: p.x, y: p.y }, s * 0.45);
      } else {
        wire(context, p.color, 1.2, alpha, 2);
        circle(context, { x: p.x, y: p.y }, p.size);
      }
    });
    resetGlow(context);
  }
}
