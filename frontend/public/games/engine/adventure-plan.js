/*
 * Pet Snake Adventure - static plan data.
 * Floor structure, the upgrade catalog, the active affix pool, and the
 * balance-impact table used when drawing affixes. Pure data, no DOM.
 */

export const DEFAULT_PLAN = {
	runStructure: { floorsPerRun: 15 },
	heartsAndFailure: { baseHearts: 3 },
	floorAffixes: [
		{ key: "narrowHalls", effect: "Treats skew toward center lanes" },
		{ key: "zoomies", effect: "Snake speed up, +1 score per snack" },
		{ key: "snackShortage", effect: "Longer spawn timers, +2 base score" },
		{ key: "treatStorm", effect: "Faster spawns, -1 score per snack" },
		{ key: "calmWinds", effect: "Slower base tick for a breather" },
		{ key: "bombSeason", effect: "Bombs show up more often" },
		{ key: "vacuumWarning", effect: "Mini vacuum sweeps mid-floor" },
		{ key: "fragileHearts", effect: "Temporarily reduce max hearts" },
		{ key: "goldenHour", effect: "Treats worth double points" },
		{ key: "famine", effect: "Treats worth half points" },
		{ key: "predator", effect: "A fiercer vacuum / more bombs" },
		{ key: "sanctuary", effect: "A calmer vacuum / fewer bombs" },
		{ key: "feast", effect: "Treats spawn twice as often" },
		{ key: "drought", effect: "Treats spawn half as often" },
		{ key: "frenzy", effect: "The vacuum moves much faster" },
		{ key: "lethargy", effect: "The vacuum moves slower" },
		{ key: "abundance", effect: "Floor starts with banked treats" },
		{ key: "scarcity", effect: "Floor needs a few extra treats" },
		{ key: "haste", effect: "You move twice as fast" },
		{ key: "sloth", effect: "You move half as fast" },
		{ key: "vitality", effect: "Twice as much health" },
		{ key: "frailty", effect: "Half as much health" },
		{ key: "fortune", effect: "Score is doubled" },
		{ key: "misfortune", effect: "Score is halved" },
		{ key: "chaos", effect: "Random effects every few seconds" },
		{ key: "order", effect: "No random events" },
		{ key: "hauntedVacuum", effect: "An erratic, restless sweeper" },
		{ key: "donationNight", effect: "Half treat score, extra shelter coins" },
		{ key: "dimRoom", effect: "Low-light board overlay" }
	],
	upgrades: {
		collars: [
			{ name: "Safety Collar", effect: "+1 max heart; heal now" },
			{ name: "Zoomie Collar", effect: "-10% base tick; +1 score during speed" },
			{ name: "Therapy Collar", effect: "Heal 1 heart every 8 treats if below max" },
			{ name: "Lucky Collar", effect: "20% chance to negate bomb damage" },
			{ name: "Iron Collar", effect: "Start each floor with 1 temp shield" },
			{ name: "Awareness Collar", effect: "Bombs flash warning when you're nearby" }
		],
		toys: [
			{ name: "Vacuum Toy", effect: "Vacuum steals may spawn bonuses" },
			{ name: "Bomb Plushie", effect: "Shielded bombs grant +3 score" },
			{ name: "Feather Wand", effect: "One ghost-step per floor" },
			{ name: "Catnip Mouse", effect: "Eat 3 treats in 4s for 2s speed boost" },
			{ name: "Scratching Post", effect: "Once per floor, auto-deflect a bomb" },
			{ name: "Cozy Blanket", effect: "Floor start grace period +50%" }
		],
		treatPerks: [
			{ name: "Gourmet Palate", effect: "Steak +4 score; biscuit +2" },
			{ name: "Snack Streaks", effect: "Combo multiplier while collision-free" },
			{ name: "Treat Magnet", effect: "Treats spawn closer to head" },
			{ name: "Scavenger", effect: "20% chance eating treat drops coin" },
			{ name: "Second Helping", effect: "15% chance treat spawns another" },
			{ name: "Efficient Digestion", effect: "Every 6th treat heals 1 heart" }
		]
	}
};

export const ACTIVE_AFFIX_POOL = [
	"narrowHalls",
	"zoomies",
	"snackShortage",
	"treatStorm",
	"calmWinds",
	"bombSeason",
	"vacuumWarning",
	"fragileHearts",
	"goldenHour",
	"famine",
	"predator",
	"sanctuary",
	"feast",
	"drought",
	"frenzy",
	"lethargy",
	"abundance",
	"scarcity",
	"haste",
	"sloth",
	"vitality",
	"frailty",
	"fortune",
	"misfortune",
	"chaos",
	"order",
	"hauntedVacuum",
	"donationNight",
	"dimRoom"
];

// Affix impact values for balance (-1 to +1 scale)
export const AFFIX_IMPACTS = {
	// Minor affixes (impact ±0.2-0.3)
	goldenHour: 0.25, famine: -0.25,
	feast: 0.2, drought: -0.2,
	abundance: 0.2, scarcity: -0.2,
	fortune: 0.3, misfortune: -0.3,
	// Major affixes (impact ±0.4-0.6)
	treatStorm: 0.5, calmWinds: -0.5,
	haste: 0.5, sloth: -0.5,
	vitality: 0.6, frailty: -0.6,
	predator: -0.5, sanctuary: 0.5,
	frenzy: -0.4, lethargy: 0.4,
	// Legacy affixes
	zoomies: 0.3, snackShortage: 0.2, narrowHalls: -0.2,
	bombSeason: -0.4, vacuumWarning: -0.3, fragileHearts: -0.5,
	// GDD affixes
	hauntedVacuum: -0.4, donationNight: -0.1, dimRoom: -0.2
};
