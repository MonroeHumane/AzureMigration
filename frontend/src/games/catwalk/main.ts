import { CatwalkAudio } from './audio';
import { CatwalkEngine, getStageConfig } from './engine/game';
import { bindInput } from './input';
import { BOARD_HEIGHT, BOARD_WIDTH, CELL_SIZE, PLAY_TOP_Y } from './models/environment';
import { ParticleSystem } from './rendering/particles';
import { renderGame } from './rendering/renderer';

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

  // Mouse hover tracking for vector controls in top HUD
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = BOARD_WIDTH / rect.width;
    const scaleY = BOARD_HEIGHT / rect.height;
    const canvasX = (event.clientX - rect.left) * scaleX;
    const canvasY = (event.clientY - rect.top) * scaleY;

    let nextHover: 'sound' | 'pause' | null = null;
    if (canvasY >= 10 && canvasY <= 44) {
      if (canvasX >= 644 && canvasX <= 674) nextHover = 'sound';
      else if (canvasX >= 680 && canvasX <= 710) nextHover = 'pause';
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

    if (canvasY >= 10 && canvasY <= 44) {
      if (canvasX >= 644 && canvasX <= 674) {
        toggleSound();
      } else if (canvasX >= 680 && canvasX <= 710) {
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

          // Catwalk Milestone Rewards -> Pet Booster Packs
          const milestones = [
            { score: 500, key: 'score_500', tier: 'standard' },
            { score: 1500, key: 'score_1500', tier: 'duo' },
            { score: 3000, key: 'score_3000', tier: 'deluxe' }
          ];
          let claimedList: string[] = [];
          try {
            claimedList = JSON.parse(localStorage.getItem('monroe_catwalk_claimed_milestones') || '[]');
          } catch (e) {}

          milestones.forEach((m) => {
            if (finalScore >= m.score && !claimedList.includes(m.key)) {
              claimedList.push(m.key);
              try {
                localStorage.setItem('monroe_catwalk_claimed_milestones', JSON.stringify(claimedList));
                const currentPacks = Math.max(0, parseInt(localStorage.getItem('monroeDexPacks') || '1', 10));
                localStorage.setItem('monroeDexPacks', String(currentPacks + 1));
              } catch (e) {}

              // Notify parent Arcade Pass to show celebration toast
              if (window.parent && window.parent !== window) {
                try {
                  window.parent.postMessage({
                    type: 'adoptedex:pack_awarded',
                    action: 'pack_awarded',
                    game: 'catwalk',
                    milestone: m.key,
                    tier: m.tier
                  }, '*');
                } catch (e) {}
              }

              // Server-side deduplication claim
              const user = (localStorage.getItem('monroeDexUser') || player).trim().toLowerCase();
              fetch(`/arcade-api/v1/adoptedex/${encodeURIComponent(user)}/rewards/claim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  game_id: 'catwalk',
                  reward_key: m.key
                })
              }).catch(() => {});
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

