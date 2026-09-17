/*
 * Pet Snake Adventure - affix logic (pure, no DOM).
 *   applyAffixes(keys)        -> resolved per-floor modifier summary
 *   createTreatSpawnHook(opts) -> treat placement bias used by Narrow Halls / Treat Magnet
 *
 * Covered by tools/affix-matrix.mjs against tools/affix-expectations.json.
 */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function applyAffixes(affixes = []) {
	const summary = {
		tickScalar: 1,
		treatScoreBonus: 0,
		treatValue: 1,
		enemyCount: 1,
		treatSpawnChance: 1,
		enemySpeed: 1,
		playerSpeed: 1,
		playerHealth: 1,
		scoreMultiplier: 1,
		initialTreats: 1,
		randomEffects: false,
		noRandomEvents: false,
		bombSpawnRate: 1,
		powerupSpawnRate: 1,
		midFloorVacuum: false,
		vacuumTurnScale: 1,
		donationNight: false,
		dimRoom: false,
		notes: []
	};
	affixes.forEach((key) => {
		if (key === "zoomies") {
			summary.tickScalar *= 0.85;
			summary.treatScoreBonus += 1;
			summary.notes.push("Zoomies: faster base tick, +1 score per snack.");
		} else if (key === "snackShortage") {
			summary.treatScoreBonus += 2;
			summary.notes.push("Snack Shortage: treats rarer but juicier.");
		} else if (key === "narrowHalls") {
			summary.notes.push("Narrow Halls: treats favor the center lanes.");
		} else if (key === "treatStorm") {
			summary.tickScalar *= 0.5;
			summary.notes.push("Treat Storm: Treats spawn twice as fast!");
		} else if (key === "calmWinds") {
			summary.tickScalar *= 2;
			summary.notes.push("Calm Winds: Treats spawn half as fast.");
		} else if (key === "goldenHour") {
			summary.treatValue *= 2;
			summary.notes.push("Golden Hour: Treats are worth double points.");
		} else if (key === "famine") {
			summary.treatValue *= 0.5;
			summary.notes.push("Famine: Treats are worth half points.");
		} else if (key === "predator") {
			summary.enemyCount *= 2;
			summary.notes.push("Predator: A fiercer vacuum (and more bombs without one).");
		} else if (key === "sanctuary") {
			summary.enemyCount *= 0.5;
			summary.notes.push("Sanctuary: A calmer vacuum (and fewer bombs without one).");
		} else if (key === "feast") {
			summary.treatSpawnChance *= 2;
			summary.notes.push("Feast: Treats spawn twice as often.");
		} else if (key === "drought") {
			summary.treatSpawnChance *= 0.5;
			summary.notes.push("Drought: Treats spawn half as often.");
		} else if (key === "frenzy") {
			summary.enemySpeed *= 2;
			summary.notes.push("Frenzy: The vacuum moves much faster.");
		} else if (key === "lethargy") {
			summary.enemySpeed *= 0.5;
			summary.notes.push("Lethargy: The vacuum moves slower.");
		} else if (key === "abundance") {
			summary.initialTreats *= 2;
			summary.notes.push("Abundance: Floor starts with treats already banked.");
		} else if (key === "scarcity") {
			summary.initialTreats *= 0.5;
			summary.notes.push("Scarcity: This floor needs a few extra treats.");
		} else if (key === "haste") {
			summary.playerSpeed *= 2;
			summary.notes.push("Haste: You move twice as fast.");
		} else if (key === "sloth") {
			summary.playerSpeed *= 0.5;
			summary.notes.push("Sloth: You move half as fast.");
		} else if (key === "vitality") {
			summary.playerHealth *= 2;
			summary.notes.push("Vitality: You have twice as much health.");
		} else if (key === "frailty") {
			summary.playerHealth *= 0.5;
			summary.notes.push("Frailty: You have half as much health.");
		} else if (key === "fortune") {
			summary.scoreMultiplier *= 2;
			summary.notes.push("Fortune: Score is doubled.");
		} else if (key === "misfortune") {
			summary.scoreMultiplier *= 0.5;
			summary.notes.push("Misfortune: Score is halved.");
		} else if (key === "chaos") {
			summary.randomEffects = true;
			summary.notes.push("Chaos: Random effects every few seconds.");
		} else if (key === "order") {
			summary.noRandomEvents = true;
			summary.notes.push("Order: No random events.");
		} else if (key === "bombSeason") {
			summary.bombSpawnRate = 2.5;
			summary.notes.push("Bomb Season: Bombs appear much more often!");
		} else if (key === "vacuumWarning") {
			summary.midFloorVacuum = true;
			summary.notes.push("Vacuum Warning: Mid-floor sweeps incoming!");
		} else if (key === "fragileHearts") {
			summary.playerHealth *= 0.67;
			summary.notes.push("Fragile Hearts: Maximum hearts reduced!");
		} else if (key === "hauntedVacuum") {
			summary.midFloorVacuum = true;
			summary.vacuumTurnScale *= 1.8;
			summary.enemySpeed *= 1.15;
			summary.notes.push("Haunted Vacuum: an erratic, restless sweeper appears.");
		} else if (key === "donationNight") {
			summary.donationNight = true;
			summary.notes.push("Donation Night: treats give half score but the shelter earns extra coins.");
		} else if (key === "dimRoom") {
			summary.dimRoom = true;
			summary.notes.push("Dim Room: the lights are low - watch your step.");
		}
	});
	return summary;
}

export const createTreatSpawnHook = ({ centerBias = 0, headBias = 0 } = {}) => {
	const normalizedCenter = clamp(centerBias, 0, 1);
	const normalizedHead = clamp(headBias, 0, 1);
	if (!normalizedCenter && !normalizedHead) return null;
	return ({ candidate, boardSize, snake, occupied, randomEmptyCell }) => {
		let slot = { ...candidate };
		const attempts = 6;
		const head = Array.isArray(snake) && snake.length ? snake[0] : null;
		for (let i = 0; i < attempts; i += 1) {
			let target = { ...slot };
			if (normalizedCenter) {
				const center = (boardSize - 1) / 2;
				target.x = Math.round(target.x * (1 - normalizedCenter) + center * normalizedCenter);
				target.y = Math.round(target.y * (1 - normalizedCenter) + center * normalizedCenter);
			}
			if (normalizedHead && head) {
				target.x = Math.round(target.x * (1 - normalizedHead) + head.x * normalizedHead);
				target.y = Math.round(target.y * (1 - normalizedHead) + head.y * normalizedHead);
			}
			target.x = clamp(target.x, 0, boardSize - 1);
			target.y = clamp(target.y, 0, boardSize - 1);
			if (!occupied(target.x, target.y)) {
				return target;
			}
			slot = randomEmptyCell();
		}
		return slot;
	};
};
