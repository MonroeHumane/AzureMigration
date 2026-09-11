import { CatwalkAudio } from './audio';
import { CatwalkEngine, getDogLanesForStage, getStageConfig, positionsForLane } from './engine/game';
import { bindInput } from './input';
import { BOARD_HEIGHT, BOARD_WIDTH, CELL_SIZE, PLAY_TOP_Y } from './models/environment';
import { setCatwalkTheme } from './rendering/palette';
import { ParticleSystem } from './rendering/particles';
import { renderGame } from './rendering/renderer';

// Arcade light/dark, owned by the cabinet's toggle. Light swaps the whole
// playfield to a daytime palette and turns the neon bloom off; the next frame
// picks it up, so there is nothing to redraw here.
setCatwalkTheme(
  (window as unknown as { HumaneGamesTheme?: { get?: () => string } }).HumaneGamesTheme?.get?.() === 'light'
    ? 'light'
    : 'dark',
);
window.addEventListener('humane-games-theme', (event) => {
  setCatwalkTheme((event as CustomEvent<{ theme: string }>).detail?.theme === 'light' ? 'light' : 'dark');
});

const root = document.querySelector<HTMLElement>('[data-catwalk-root]');
const canvas = root?.querySelector<HTMLCanvasElement>('[data-game-canvas]');
const context = canvas?.getContext('2d');

if (root && canvas && context) {
  const best = Number(localStorage.getItem('humane-catwalk-best') ?? 0);
  const engine = new CatwalkEngine(Number.isFinite(best) ? best : 0);
  const audio = new CatwalkAudio();
  const particles = new ParticleSystem();
  const reducedMotion = (() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  })();
  particles.setReducedMotion(reducedMotion);

  const triggerHomeSuccessFlash = () => {
    const bezel = root.querySelector<HTMLElement>('.catwalk-bezel') || root;
    bezel.classList.remove('catwalk-home-flash');
    void bezel.offsetWidth;
    bezel.classList.add('catwalk-home-flash');
    window.setTimeout(() => bezel.classList.remove('catwalk-home-flash'), reducedMotion ? 180 : 420);
  };
  const overlay = root.querySelector<HTMLElement>('[data-overlay]');
  const overlayTitle = root.querySelector<HTMLElement>('[data-overlay-title]');
  const overlayCopy = root.querySelector<HTMLElement>('[data-overlay-copy]');
  const startButton = root.querySelector<HTMLButtonElement>('[data-start]');
  const touchMute = root.querySelector<HTMLButtonElement>('[data-touch-mute]');
  const touchPause = root.querySelector<HTMLButtonElement>('[data-touch-pause]');
  const debug = new URLSearchParams(window.location.search).get('debug') === '1';

  let audioEnabled = false;
  let hoveredControl: 'sound' | 'pause' | null = null;

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = BOARD_WIDTH * pixelRatio;
  canvas.height = BOARD_HEIGHT * pixelRatio;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const showOverlay = (title: string, copy: string, action: string) => {
    if (overlayTitle) overlayTitle.textContent = title;
    if (overlayCopy) overlayCopy.textContent = copy;
    if (startButton) startButton.textContent = action;
    overlay?.removeAttribute('hidden');
  };
  const hideOverlay = () => overlay?.setAttribute('hidden', '');

  const togglePause = () => {
    engine.togglePause();
    if (engine.state.status === 'paused') {
      showOverlay('Patrol paused', 'The neighborhood is holding still. Make your next move count.', 'Resume patrol');
    } else if (engine.state.status === 'playing') {
      hideOverlay();
    }
  };

  const toggleSound = async () => {
    audioEnabled = await audio.toggle();
  };

  bindInput({ root, surface: canvas, onMove: (direction) => engine.move(direction), onPause: togglePause });

  startButton?.addEventListener('click', () => {
    if (engine.state.status === 'paused') {
      engine.resume();
      hideOverlay();
      return;
    }
    engine.start();
    hideOverlay();
  });

  touchMute?.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    void toggleSound();
  });
  touchPause?.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    togglePause();
  });

  // Larger HUD hit targets on coarse pointers (canvas icons are ~30px).
  const hudHitPad = () =>
    window.matchMedia('(pointer: coarse)').matches || document.documentElement.classList.contains('catwalk-touch')
      ? 10
      : 0;

  // Mouse hover tracking for vector controls in top HUD
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = BOARD_WIDTH / rect.width;
    const scaleY = BOARD_HEIGHT / rect.height;
    const canvasX = (event.clientX - rect.left) * scaleX;
    const canvasY = (event.clientY - rect.top) * scaleY;
    const pad = hudHitPad();

    let nextHover: 'sound' | 'pause' | null = null;
    if (canvasY >= 10 - pad && canvasY <= 44 + pad) {
      if (canvasX >= 644 - pad && canvasX <= 674 + pad) nextHover = 'sound';
      else if (canvasX >= 680 - pad && canvasX <= 710 + pad) nextHover = 'pause';
    }

    if (nextHover !== hoveredControl) {
      hoveredControl = nextHover;
      canvas.style.cursor = hoveredControl ? 'pointer' : 'default';
    }
  });

  canvas.addEventListener('mouseleave', () => {
    if (hoveredControl) {
      hoveredControl = null;
      canvas.style.cursor = 'default';
    }
  });

  // Vector HUD button click handler
  canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = BOARD_WIDTH / rect.width;
    const scaleY = BOARD_HEIGHT / rect.height;
    const canvasX = (event.clientX - rect.left) * scaleX;
    const canvasY = (event.clientY - rect.top) * scaleY;
    const pad = hudHitPad();

    if (canvasY >= 10 - pad && canvasY <= 44 + pad) {
      if (canvasX >= 644 - pad && canvasX <= 674 + pad) {
        void toggleSound();
      } else if (canvasX >= 680 - pad && canvasX <= 710 + pad) {
        togglePause();
      }
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && engine.state.status === 'playing') {
      engine.pause();
      showOverlay('Patrol paused', 'The neighborhood is holding still. Resume when you are ready.', 'Resume patrol');
    }
  });

  window.addEventListener('message', async (e) => {
    if (e.data && e.data.type === 'arcade:set_mute') {
      audioEnabled = await audio.setEnabled(!e.data.muted);
    }
  });

  let previousTime = performance.now();
  const frame = (timestamp: number) => {
    const delta = Math.min((timestamp - previousTime) / 1000, 0.04);
    previousTime = timestamp;
    engine.update(delta);
    particles.update(delta);

    engine.drainEvents().forEach((event) => {
      audio.play(event);
      if (event === 'step') {
        const catRow = Math.floor((engine.state.cat.y - PLAY_TOP_Y) / CELL_SIZE);
        const onWater = catRow >= 1 && catRow <= 5;
        particles.spawnHop(engine.state.cat.x, engine.state.cat.y, onWater);
        // Denser afterimages when hopping quickly (short action window = rapid inputs)
        const fastHop = engine.state.cat.actionTime > 0.12;
        particles.spawnTrail(engine.state.cat.x, engine.state.cat.y, engine.state.cat.direction, fastHop);
        if (onWater) {
          particles.spawnFishboneSparkle(engine.state.cat.x, engine.state.cat.y);
        }
      }
      if (event === 'home') {
        particles.spawnHome(engine.state.cat.x, PLAY_TOP_Y + 31);
        triggerHomeSuccessFlash();
      }
      if (event === 'caught' || event === 'splash') {
        particles.spawnDefeat(engine.state.cat.x, engine.state.cat.y);
      }
      if (event === 'defeat') {
        const stage = getStageConfig(engine.state.level);
        showOverlay('Out of lives', `The dogs ended this patrol in ${stage.name} at ${engine.state.score} points. Try again for a cleaner sweep.`, 'Try again');

        const finalScore = engine.state.score || 0;
        if (finalScore > 0) {
          const player = (localStorage.getItem('monroeDexUser') || 'PatrolCat').trim();
          if (window.parent && window.parent !== window) {
            try {
              window.parent.postMessage({
                type: 'arcade:score_recorded',
                game: 'catwalk',
                gameId: 'catwalk',
                score: finalScore,
                player
              }, '*');
            } catch (err) {}
          }
          fetch('/arcade-api/v1/scores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              gameId: 'catwalk',
              score: finalScore,
              playerName: player
            })
          }).catch(() => {});

          // Catwalk Milestone Rewards -> Adoptédex claimReward (server authoritative).
          // Only toast / local mark after claimed:true — never pre-bump monroeDexPacks.
          const milestones = [
            { score: 500, key: 'score_500', tier: 'standard' },
            { score: 1500, key: 'score_1500', tier: 'duo' },
            { score: 3000, key: 'score_3000', tier: 'deluxe' }
          ];
          let claimedList: string[] = [];
          try {
            claimedList = JSON.parse(localStorage.getItem('monroe_catwalk_claimed_milestones') || '[]');
          } catch (e) {}

          const Dex = (window as any).MonroeAdoptedex;
          const params = Dex && typeof Dex.getParams === 'function' ? Dex.getParams() : null;
          const user = String((params && params.dexUser) || localStorage.getItem('monroeDexUser') || player || '')
            .trim()
            .toLowerCase();
          const api = String((params && params.dexApi) || (window.location.origin + '/arcade-api/v1/')).replace(/\/?$/, '/');

          milestones.forEach((m) => {
            if (finalScore < m.score || claimedList.includes(m.key)) return;

            const onClaimed = () => {
              if (!claimedList.includes(m.key)) claimedList.push(m.key);
              try {
                localStorage.setItem('monroe_catwalk_claimed_milestones', JSON.stringify(claimedList));
              } catch (e) {}
              if (Dex && typeof Dex.showRewardToast === 'function') {
                Dex.showRewardToast({
                  title: 'Catwalk pack unlocked!',
                  message: `Reached ${m.score} points — ${m.tier} pack ready in your album.`,
                  game: 'Catwalk',
                  tier: m.tier,
                  rare: m.key === 'score_3000',
                });
              }
            };

            if (Dex && typeof Dex.claimReward === 'function' && user) {
              Dex.claimReward(api, user, 'catwalk', m.key, { tier: m.tier, count: 1 })
                .then((result: any) => {
                  if (result && result.claimed) onClaimed();
                })
                .catch((err: any) => console.warn('[Catwalk] claimReward failed:', err));
            } else if (user) {
              fetch(`${api}adoptedex/${encodeURIComponent(user)}/rewards/claim`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ game_id: 'catwalk', reward_key: m.key, tier: m.tier, count: 1 }),
              })
                .then((r) => r.json().catch(() => null))
                .then((result) => {
                  if (result && result.claimed) {
                    onClaimed();
                    if (window.parent && window.parent !== window) {
                      try {
                        window.parent.postMessage({
                          type: 'adoptedex:pack_awarded',
                          action: 'pack_awarded',
                          game: 'catwalk',
                          milestone: m.key,
                          tier: m.tier,
                        }, '*');
                      } catch (e) {}
                    }
                  }
                })
                .catch(() => {});
            }
          });
        }
      }
      if (event === 'level') {
        const stage = getStageConfig(engine.state.level);
        showOverlay(`Entering ${stage.name}`, `${stage.subtitle}. Stay alert and keep your rhythm.`, 'Next patrol');
      }
    });

    if (engine.state.score > engine.state.best) {
      localStorage.setItem('humane-catwalk-best', String(engine.state.best));
    }

    // Dog-near warning dust (throttled via particle life; skip under reduced motion)
    if (engine.state.status === 'playing') {
      const catRow = Math.floor((engine.state.cat.y - PLAY_TOP_Y) / CELL_SIZE);
      if (catRow >= 7 && catRow <= 11) {
        const lane = getDogLanesForStage(engine.state.level).find((l) => l.row === catRow);
        if (lane) {
          const nearest = positionsForLane(lane, engine.state).reduce((best, center) => {
            const d = Math.abs(center - engine.state.cat.x);
            return d < best.d ? { d, center } : best;
          }, { d: Infinity, center: 0 });
          if (nearest.d < 145) {
            const intensity = Math.max(0.35, 1 - nearest.d / 145);
            // Spawn sparingly (~every ~180ms worth of frames via elapsed phase)
            if (Math.floor(engine.state.elapsed * 5.5) !== Math.floor((engine.state.elapsed - delta) * 5.5)) {
              particles.spawnDogWarning(nearest.center, engine.state.cat.y, intensity);
            }
          }
        }
      }
    }

    renderGame(context, engine.state, !audioEnabled, debug, hoveredControl, particles);
    requestAnimationFrame(frame);
  };

  renderGame(context, engine.state, !audioEnabled, debug, hoveredControl, particles);
  requestAnimationFrame(frame);
}

