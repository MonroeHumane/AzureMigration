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
  const pauseButton = root.querySelector<HTMLButtonElement>('[data-pause]');
  const debug = new URLSearchParams(window.location.search).get('debug') === '1';
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = BOARD_WIDTH * pixelRatio;
  canvas.height = BOARD_HEIGHT * pixelRatio;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const setText = (selector: string, value: string) => {
    const element = root.querySelector<HTMLElement>(selector);
    if (element) element.textContent = value;
  };
  const syncHud = () => {
    setText('[data-score]', String(engine.state.score).padStart(5, '0'));
    setText('[data-best]', String(engine.state.best).padStart(5, '0'));
    setText('[data-level]', String(engine.state.level).padStart(2, '0'));
    setText('[data-lives]', '|'.repeat(engine.state.lives) || '0');
    localStorage.setItem('humane-catwalk-best', String(engine.state.best));
  };
  const showOverlay = (title: string, copy: string, action: string) => {
    if (overlayTitle) overlayTitle.textContent = title;
    if (overlayCopy) overlayCopy.textContent = copy;
    if (startButton) startButton.textContent = action;
    overlay?.removeAttribute('hidden');
  };
  const hideOverlay = () => overlay?.setAttribute('hidden', '');

  const togglePause = () => {
    engine.togglePause();
    if (engine.state.status === 'paused') showOverlay('Patrol paused', 'The neighborhood is holding still.', 'Resume patrol');
    else if (engine.state.status === 'playing') hideOverlay();
  };

  bindInput({ root, surface: canvas, onMove: (direction) => engine.move(direction), onPause: togglePause });
  startButton?.addEventListener('click', () => {
    if (engine.state.status === 'paused') engine.resume();
    else engine.start();
    hideOverlay();
  });
  pauseButton?.addEventListener('click', togglePause);
  soundButton?.addEventListener('click', async () => {
    const enabled = await audio.toggle();
    soundButton.textContent = enabled ? 'Sound on' : 'Sound off';
    soundButton.setAttribute('aria-pressed', String(enabled));
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && engine.state.status === 'playing') {
      engine.pause();
      showOverlay('Patrol paused', 'The neighborhood is holding still.', 'Resume patrol');
    }
  });

  let previousTime = performance.now();
  const frame = (timestamp: number) => {
    const delta = Math.min((timestamp - previousTime) / 1000, 0.04);
    previousTime = timestamp;
    engine.update(delta);
    engine.drainEvents().forEach((event) => {
      audio.play(event);
      if (event === 'defeat') showOverlay('Out of lives', `The dogs ended this patrol at ${engine.state.score} points.`, 'Try again');
    });
    syncHud();
    renderGame(context, engine.state, debug);
    requestAnimationFrame(frame);
  };

  syncHud();
  requestAnimationFrame(frame);
}