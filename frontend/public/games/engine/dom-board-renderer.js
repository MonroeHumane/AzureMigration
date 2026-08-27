/*
 * DOM Board Renderer
 * Handles translating engine state into DOM updates using the existing
 * cat-snake grid markup. Keeps track of previous cells to minimize repainting.
 */

const CAT_PAW_GLYPH = "\u{1F43E}";
const DEFAULT_HEAD_GLYPH = "\u{1F63A}";

const defaultPet = {
	head: DEFAULT_HEAD_GLYPH,
	body: CAT_PAW_GLYPH,
	headClass: "pet-cat-head",
	bodyClass: "pet-cat-body"
};

export class DomBoardRenderer {
	constructor({ cells = [], size = 19, pets = {}, petKey = "cat" } = {}) {
		this.cells = cells;
		this.size = size;
		this.pets = pets;
		this.petKey = petKey;
		this.lastSnakeCells = [];
		this.lastTreatCell = null;
		this.lastPowerCell = null;
		this.lastBombCell = null;
		this.lastVacuumCell = null;
		this.lastVacuumTailCells = [];
		this.lastObstacleCells = [];
	}

	setCells(cells) {
		this.cells = cells;
	}

	setSize(size) {
		this.size = size;
	}

	setPets(pets) {
		this.pets = pets;
	}

	setPet(key) {
		this.petKey = key;
	}

	clearCaches() {
		this.lastSnakeCells = [];
		this.lastTreatCell = null;
		this.lastPowerCell = null;
		this.lastBombCell = null;
		this.lastVacuumCell = null;
		this.lastVacuumTailCells = [];
		this.lastObstacleCells = [];
	}

	idx(x, y) {
		return y * this.size + x;
	}

	clearCell(index) {
		const cell = this.cells[index];
		if (!cell) return;
		const quadrant = cell.getAttribute("data-quadrant");
		cell.className = "cat-snake__cell";
		if (quadrant) cell.setAttribute("data-quadrant", quadrant);
		cell.replaceChildren();
		cell.removeAttribute("style");
	}

	stripVacuumTailClasses(cell) {
		if (!cell) return;
		cell.classList.remove("is-vacuum-tail", "is-vacuum-tail-tip");
	}

	resolveBodyGlyph(petMeta = {}) {
		if (petMeta.body) return petMeta.body;
		const bodyClass = petMeta.bodyClass || defaultPet.bodyClass;
		if (bodyClass === "pet-cat-body") return CAT_PAW_GLYPH;
		if (bodyClass === "pet-dog-body") return "\u25CF";
		return defaultPet.body;
	}

	appendBodyGlyph(cell, glyph) {
		if (!cell || !glyph) return;
		const span = document.createElement("span");
		span.className = "snake-body-glyph";
		span.setAttribute("aria-hidden", "true");
		span.textContent = glyph;
		cell.appendChild(span);
	}

	render(state = {}) {
		if (!this.cells.length) return;
		this.lastSnakeCells.forEach((index) => this.clearCell(index));
		if (this.lastTreatCell !== null) this.clearCell(this.lastTreatCell);
		if (this.lastPowerCell !== null) this.clearCell(this.lastPowerCell);
		if (this.lastBombCell !== null) this.clearCell(this.lastBombCell);
		if (this.lastVacuumCell !== null) this.clearCell(this.lastVacuumCell);
		this.lastVacuumTailCells.forEach((index) => this.clearCell(index));
		this.lastObstacleCells.forEach((index) => this.clearCell(index));
		this.clearCaches();

		const { snake = [], treat, powerup, bomb, vacuum, vacuumTail = [], obstacles = [], activeEffects = {}, direction = { x: 1, y: 0 } } = state;

		if (treat) {
			const treatIndex = this.idx(treat.x, treat.y);
			const cell = this.cells[treatIndex];
			if (cell) {
				this.stripVacuumTailClasses(cell);
				cell.classList.add("is-treat", `treat-${treat.key}`);
				cell.textContent = treat.icon;
				this.lastTreatCell = treatIndex;
			}
		}

		if (powerup) {
			const powerIndex = this.idx(powerup.x, powerup.y);
			const cell = this.cells[powerIndex];
			if (cell) {
				this.stripVacuumTailClasses(cell);
				cell.classList.add("is-power", `fx-${powerup.key}`);
				cell.textContent = powerup.icon;
				this.lastPowerCell = powerIndex;
			}
		}

		if (bomb) {
			const bombIndex = this.idx(bomb.x, bomb.y);
			const cell = this.cells[bombIndex];
			if (cell) {
				this.stripVacuumTailClasses(cell);
				cell.classList.add("is-bomb");
				cell.textContent = "💣";
				this.lastBombCell = bombIndex;
			}
		}

		if (obstacles.length) {
			// Variety of obstacle emojis for visual interest
			const obstacleEmojis = ["🐍", "🛑", "🌳", "🪨", "🚧", "⛔", "🌲", "🪵"];
			obstacles.forEach((obstacle, idx) => {
				const obstacleIndex = this.idx(obstacle.x, obstacle.y);
				const cell = this.cells[obstacleIndex];
				if (!cell) return;
				this.stripVacuumTailClasses(cell);
				cell.classList.add("is-obstacle");
				// Use obstacle's emoji if specified, otherwise cycle through variety
				const emoji = obstacle.emoji || obstacleEmojis[idx % obstacleEmojis.length];
				cell.textContent = emoji;
				this.lastObstacleCells.push(obstacleIndex);
			});
		}

		const reservedIndices = new Set();
		const reserveCell = (entity) => {
			if (!entity || entity.x === undefined || entity.y === undefined) return;
			reservedIndices.add(this.idx(entity.x, entity.y));
		};
		snake.forEach((segment) => reserveCell(segment));
		reserveCell(treat);
		reserveCell(powerup);
		reserveCell(bomb);
		reserveCell(vacuum);
		obstacles.forEach((obstacle) => reserveCell(obstacle));

		if (vacuumTail.length) {
			vacuumTail.forEach((segment, idx) => {
				const tailIndex = this.idx(segment.x, segment.y);
				if (reservedIndices.has(tailIndex)) return;
				const cell = this.cells[tailIndex];
				if (!cell) return;
				cell.classList.add("is-vacuum-tail");
				if (idx === 0) cell.classList.add("is-vacuum-tail-tip");
				this.lastVacuumTailCells.push(tailIndex);
			});
		}

		if (vacuum) {
			const vacIndex = this.idx(vacuum.x, vacuum.y);
			const cell = this.cells[vacIndex];
			if (cell) {
				cell.classList.add("is-vacuum");
				this.lastVacuumCell = vacIndex;
			}
		}

		const petMeta = this.pets[this.petKey] || defaultPet;
		const hasSpeed = Boolean(activeEffects.speed);
		const hasScore = Boolean(activeEffects.score);
		const hasShield = Boolean(activeEffects.shield);
		snake.forEach((segment, index) => {
			const cellIndex = this.idx(segment.x, segment.y);
			const cell = this.cells[cellIndex];
			if (!cell) return;
			this.stripVacuumTailClasses(cell);
			if (index === 0) {
				cell.classList.add("is-head", petMeta.headClass || defaultPet.headClass);
				// Add shield visual effect to head
				if (hasShield) {
					cell.classList.add("has-shield");
				}
				if (petMeta.useImage) {
					// Use img element for head with rotation based on direction
					const img = document.createElement("img");
					img.src = "cathead.png";
					img.style.width = "100%";
					img.style.height = "100%";
					img.style.objectFit = "contain";
					img.style.display = "block";

					// Calculate rotation based on direction
					// Image faces left by default
					let transform = "";
					if (direction && direction.x === 1 && direction.y === 0) {
						// Right - flip horizontally
						transform = "scaleX(-1)";
					} else if (direction && direction.x === -1 && direction.y === 0) {
						// Left - no transform
						transform = "scaleX(1)";
					} else if (direction && direction.x === 0 && direction.y === 1) {
						// Down - rotate -90 degrees
						transform = "rotate(-90deg)";
					} else if (direction && direction.x === 0 && direction.y === -1) {
						// Up - rotate 90 degrees
						transform = "rotate(90deg)";
					} else {
						// Default - face left
						transform = "scaleX(1)";
					}

					img.style.transform = transform;
					img.style.transition = "transform 0.1s ease";
					cell.appendChild(img);
				} else {
					cell.textContent = petMeta.head;
				}
			} else {
				cell.classList.add("is-body", petMeta.bodyClass || defaultPet.bodyClass);
				this.appendBodyGlyph(cell, this.resolveBodyGlyph(petMeta));
			}
			if (hasSpeed) cell.classList.add("fx-speed-active");
			if (hasScore) cell.classList.add("fx-score-active");
			if (hasShield) cell.classList.add("fx-shield-active");
			this.lastSnakeCells.push(cellIndex);
		});
	}
}
