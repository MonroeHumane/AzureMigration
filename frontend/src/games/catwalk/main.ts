import { CatwalkAudio } from './audio';
import { CatwalkEngine } from './engine/game';
import { bindInput } from './input';
import { BOARD_HEIGHT, BOARD_WIDTH } from './models/environment';
import { renderGame } from './rendering/renderer';

const root = document.querySelector<HTMLElement>('[data-catwalk-root]');
const canvas = root?.querySelector<HTMLCanvasElement>('[data-game-canvas]');
const context = canvas?.getContext('2d');

if (root && canvas && context) {
  const best = Number(localStorage.getItem('humane-catwalk-best') ?? 0);
  const engine = new CatwalkEngine(Number.isFinite(best) ? best : 0);
  const audio = new CatwalkAudio();
  const overlay = root.querySelector<HTMLElement>('[data-overlay]');
  const overlayTitle = root.querySelector<HTMLElement>('[data-overlay-title]');
  const overlayCopy = root.querySelector<HTMLElement>('[data-overlay-copy]');
  const startButton = root.querySelector<HTMLButtonElement>('[data-start]');
  const soundButton = root.querySelector<HTMLButtonElement>('[data-sound]');
  const soundLabel = root.querySelector<HTMLElement>('[data-sound-label]');
  const pauseButton = root.querySelector<HTMLButtonElement>('[data-pause]');
  const debug = new URLSearchParams(window.location.search).get('debug') === '1';

  let audioEnabled = false;

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
    if (soundLabel) soundLabel.textContent = audioEnabled ? '🔊' : '🔇';
    soundButton?.setAttribute('aria-pressed', String(audioEnabled));
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

  pauseButton?.addEventListener('click', togglePause);
  soundButton?.addEventListener('click', toggleSound);

  // Click on top right sound icon in canvas (X: 670 to 710, Y: 10 to 45)
  canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = BOARD_WIDTH / rect.width;
    const scaleY = BOARD_HEIGHT / rect.height;
    const canvasX = (event.clientX - rect.left) * scaleX;
    const canvasY = (event.clientY - rect.top) * scaleY;

    if (canvasX >= 675 && canvasX <= 710 && canvasY >= 10 && canvasY <= 45) {
      toggleSound();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && engine.state.status === 'playing') {
      engine.pause();
      showOverlay('Patrol paused', 'The neighborhood is holding still. Resume when you are ready.', 'Resume patrol');
    }
  });

  let previousTime = performance.now();
  const frame = (timestamp: number) => {
    const delta = Math.min((timestamp - previousTime) / 1000, 0.04);
    previousTime = timestamp;
    engine.update(delta);

    engine.drainEvents().forEach((event) => {
      audio.play(event);
      if (event === 'defeat') {
        showOverlay('Out of lives', `The dogs ended this patrol at ${engine.state.score} points. Try again for a cleaner sweep.`, 'Try again');
      }
      if (event === 'level') {
        showOverlay('New patrol route', `Route 0${engine.state.level} is live! Speed has increased and fishbone currents are faster.`, 'Keep going');
      }
    });

    if (engine.state.score > engine.state.best) {
      localStorage.setItem('humane-catwalk-best', String(engine.state.best));
    }

    renderGame(context, engine.state, !audioEnabled, debug);
    requestAnimationFrame(frame);
  };

  renderGame(context, engine.state, !audioEnabled, debug);
  requestAnimationFrame(frame);
}
