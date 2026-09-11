import { CatwalkAudio } from './audio';
import { CatwalkEngine, getStageConfig } from './engine/game';
import { bindInput } from './input';
import { BOARD_HEIGHT, BOARD_WIDTH, CELL_SIZE, PLAY_TOP_Y } from './models/environment';
import { ParticleSystem } from './rendering/particles';
import { renderGame } from './rendering/renderer';

type AdoptedexApi = {
  getParams: () => { dexUser: string; dexDisplay: string; dexApi: string };
  claimReward: (
    base: string,
    user: string,
    gameId: string,
    rewardKey: string,
    extra?: Record<string, unknown>
  ) => Promise<{ ok?: boolean; claimed?: boolean; offline?: boolean }>;
  discoverPet: (
    base: string,
    user: string,
    petId: string,
    source?: string
  ) => Promise<unknown>;
};

declare global {
  interface Window {
    MonroeAdoptedex?: AdoptedexApi;
  }
}

const CATWALK_MILESTONES = [
  { score: 500, key: 'score_500', tier: 'standard' },
  { score: 1500, key: 'score_1500', tier: 'duo' },
  { score: 3000, key: 'score_3000', tier: 'deluxe' },
] as const;

/** Real shelter pet ids only — discover when a mapped companion is actually shown. */
const FEATURED_PATROL_PET_ID = '58223344'; // Smokey (cat) in Adoptedex shelter pool

const root = document.querySelector<HTMLElement>('[data-catwalk-root]');
const canvas = root?.querySelector<HTMLCanvasElement>('[data-game-canvas]');
const context = canvas?.getContext('2d');

if (root && canvas && context) {
  const best = Number(localStorage.getItem('humane-catwalk-best') ?? 0);
  const engine = new CatwalkEngine(Number.isFinite(best) ? best : 0);
  const audio = new CatwalkAudio();
  const particles = new ParticleSystem();
  const overlay = root.querySelector<HTMLElement>('[data-overlay]');
  const overlayTitle = root.querySelector<HTMLElement>('[data-overlay-title]');
  const overlayCopy = root.querySelector<HTMLElement>('[data-overlay-copy]');
  const startButton = root.querySelector<HTMLButtonElement>('[data-start]');
  const touchMute = root.querySelector<HTMLButtonElement>('[data-touch-mute]');
  const touchPause = root.querySelector<HTMLButtonElement>('[data-touch-pause]');
  const debug = new URLSearchParams(window.location.search).get('debug') === '1';

  let audioEnabled = false;
  let hoveredControl: 'sound' | 'pause' | null = null;
  const claimedMilestones = new Set<string>();
  let discoveredFeatured = false;

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

  const dexParams = () => {
    try {
      return window.MonroeAdoptedex?.getParams() ?? null;
    } catch {
      return null;
    }
  };

  /** Server-authoritative pack/coin claim — never invent monroeDexPacks here. */
  const claimCatwalkMilestone = (key: string, tier: string) => {
    if (claimedMilestones.has(key)) return;
    claimedMilestones.add(key);
    const adoptedex = window.MonroeAdoptedex;
    const params = dexParams();
    if (!adoptedex || !params?.dexUser) return;
    adoptedex
      .claimReward(params.dexApi, params.dexUser, 'catwalk', key, { tier, count: 1 })
      .catch(() => {
        // Allow a later retry if the network blip happened before offline fallback ran.
        claimedMilestones.delete(key);
      });
  };

  const discoverFeaturedPetIfShown = () => {
    if (discoveredFeatured) return;
    const adoptedex = window.MonroeAdoptedex;
    const params = dexParams();
    if (!adoptedex || !params?.dexUser) return;
    discoveredFeatured = true;
    adoptedex.discoverPet(params.dexApi, params.dexUser, FEATURED_PATROL_PET_ID, 'catwalk').catch(() => {
      discoveredFeatured = false;
    });
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
    // First patrol introduces Smokey as the featured shelter cat on the night beat.
    discoverFeaturedPetIfShown();
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
      }
      if (event === 'home') {
        particles.spawnHome(engine.state.cat.x, PLAY_TOP_Y + 31);
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

          // Pack/coin milestones via shared MonroeAdoptedex (server reward table).
          CATWALK_MILESTONES.forEach((m) => {
            if (finalScore >= m.score) {
              claimCatwalkMilestone(m.key, m.tier);
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

    renderGame(context, engine.state, !audioEnabled, debug, hoveredControl, particles);
    requestAnimationFrame(frame);
  };

  renderGame(context, engine.state, !audioEnabled, debug, hoveredControl, particles);
  requestAnimationFrame(frame);
}
