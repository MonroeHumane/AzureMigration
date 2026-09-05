const root = document.querySelector<HTMLElement>('[data-catwalk-root]');
const canvas = root?.querySelector<HTMLCanvasElement>('[data-game-canvas]');
const context = canvas?.getContext('2d');

if (canvas && context) {
  context.fillStyle = '#07100c';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#b8ff81';
  context.lineWidth = 2;
  context.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);
}