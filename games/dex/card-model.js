/**
 * 🐾 MonroeCardModel — the ONE canonical source for pet card attributes.
 * Used by the album binder, booster pack reveals, meet-the-pet overlays and
 * the games. Rarity / stats / moves computed here must match the server's
 * AdoptedexController::petRarity + draw weights — keep them in sync.
 *
 * Plain-script module: exposes window.MonroeCardModel (no build step).
 */
(function (global) {
	'use strict';

	// ── Species ────────────────────────────────────────────────────────────
	function speciesOf(pet) {
		var t = String((pet && (pet.type || pet.species || pet.species_label)) || '').toLowerCase();
		if (t.indexOf('dog') >= 0) return 'dog';
		if (t.indexOf('cat') >= 0) return 'cat';
		return 'other';
	}

	// ── Age parsing ────────────────────────────────────────────────────────
	// A year component ALWAYS wins over months: "4 years 1 month" is an adult,
	// not a tiny wonder. (Fixes the old indexOf('month') bug.)
	function parseAge(ageStr) {
		var s = String(ageStr || '').toLowerCase();
		var years = null, months = null;
		var my = s.match(/(\d+)\s*year/);
		if (my) years = parseInt(my[1], 10);
		if (years === null) {
			var mm = s.match(/(\d+)\s*month/);
			if (mm) months = parseInt(mm[1], 10);
		}
		var baby = s.indexOf('baby') >= 0 || s.indexOf('kitten') >= 0 || s.indexOf('puppy') >= 0;
		return { years: years, months: months, baby: baby, raw: s };
	}

	// ── Rarity (canonical — mirrors AdoptedexController::petRarity) ────────
	function rarityForPet(pet) {
		if (!pet) return 'common';
		if (pet.archived || pet.archived_at || pet.isArchived) return 'alumni';
		var age = parseAge(pet.age_display || pet.age);
		if (age.years !== null && age.years >= 7) return 'golden_senior';
		if (age.years === null && ((age.months !== null && age.months <= 6) || age.baby)) return 'tiny_wonder';
		if (pet.location === 'Foster Care') return 'longtimer';
		var intake = Date.parse(pet.intake_date || '');
		if (!isNaN(intake) && intake < Date.now() - 274 * 864e5) return 'longtimer'; // ~9 months
		if ((pet.description || '').length > 200) return 'longtimer';
		return 'common';
	}

	var RARITY_META = {
		common:        { foil: 'none',   label: 'Shelter Companion', weight: 1 },
		tiny_wonder:   { foil: 'aurora', label: 'Tiny Wonder',       weight: 2 },
		longtimer:     { foil: 'cosmos', label: 'Shelter Champion',  weight: 3 },
		golden_senior: { foil: 'gold',   label: 'Golden Senior',     weight: 4 },
		alumni:        { foil: 'prism',  label: 'Adopted Alumni',    weight: 5 },
	};

	function foilForRarity(rarity) {
		var meta = RARITY_META[rarity];
		return meta ? meta.foil : 'none';
	}

	// ── Deterministic seed from pet id ─────────────────────────────────────
	function petSeed(id) {
		var h = 0, s = String(id || '0');
		for (var i = 0; i < s.length; i++) {
			h = ((h << 5) - h + s.charCodeAt(i)) | 0;
		}
		return Math.abs(h);
	}

	// ── Stats (canonical — same pet, same stats, everywhere) ──────────────
	function statsForPet(pet, rarity) {
		var seed = petSeed(pet && pet.id);
		var a = seed % 25;
		var age = parseAge(pet && (pet.age_display || pet.age));
		var years = age.years === null ? 0 : age.years;
		var baby = age.years === null && (age.months !== null || age.baby);
		var species = speciesOf(pet);

		var energy = baby ? 92 + (a % 8) : Math.max(35, 88 - years * 6 + (a % 10));
		var cuddle = (pet && pet.location === 'Foster Care') ? 95 : 70 + (a % 25);
		var loyalty = rarity === 'longtimer' ? 100 : (rarity === 'golden_senior' ? 98 : 75 + (a % 20));
		var playful = baby ? 95 : Math.max(40, 85 - years * 4 + (a % 15));
		if (species === 'cat') cuddle = Math.min(100, cuddle + 5);

		function clamp(v) { return Math.min(100, Math.max(20, Math.round(v))); }
		return { energy: clamp(energy), cuddle: clamp(cuddle), playful: clamp(playful), loyalty: clamp(loyalty) };
	}

	// ── Signature moves ────────────────────────────────────────────────────
	function signatureMoveFor(pet, rarity) {
		var isCat = speciesOf(pet) === 'cat';
		switch (rarity) {
			case 'alumni':
				return { icon: 'heart', name: 'Forever Home Glow', effect: 'Fills the room with endless joy and unlocks unforgettable alumni memories.' };
			case 'golden_senior':
				return { icon: 'crown', name: 'Gentle Soul Radiance', effect: 'Bestows a sense of utter peacefulness, granting maximum cuddle priority.' };
			case 'tiny_wonder':
				return isCat
					? { icon: 'paw', name: 'Pounce of Curiosity', effect: 'Darts across the room chasing phantom dust motes with 200% agility.' }
					: { icon: 'sparkle', name: 'Puppy Eyes Beam', effect: 'Instantly disarms all human skepticism, securing extra belly rubs.' };
			case 'longtimer':
				return { icon: 'shield', name: 'Shelter Champion Bond', effect: 'Guarantees unyielding lifelong loyalty and warm welcoming greetings.' };
			default:
				return isCat
					? { icon: 'heart', name: 'Purr Motor Surge', effect: 'Emits a soothing 45 Hz frequency that eases human stress instantly.' }
					: { icon: 'paw', name: 'Tail Wiggle Storm', effect: 'Wags tail at lightning speed, spreading enthusiasm throughout the shelter.' };
		}
	}

	// ── Personality traits + favorite item ─────────────────────────────────
	function traitsFor(pet, rarity) {
		var isCat = speciesOf(pet) === 'cat';
		var traits, item;
		switch (rarity) {
			case 'alumni':
				traits = ['Living the Dream', 'Loved Forever', 'VIP Alum'];
				item = 'Forever Family Couch';
				break;
			case 'golden_senior':
				traits = ['Wise Soul', 'Gentle Giant', 'Lap Enthusiast'];
				item = 'Orthopedic Sunbed';
				break;
			case 'tiny_wonder':
				traits = isCat ? ['Playful Sprite', 'Purr Machine', 'Adventurer'] : ['Bouncy Pup', 'Nap Champion', 'Curious'];
				item = isCat ? 'Crinkle Ball' : 'Squeaky Plush';
				break;
			case 'longtimer':
				traits = ['Staff Favorite', 'Steadfast Friend', 'Super Loyal'];
				item = 'Peanut Butter KONG';
				break;
			default:
				traits = isCat ? ['Sunbeam Lounger', 'Cuddle Bug'] : ['Walk Enthusiast', 'Treat Connoisseur'];
				item = isCat ? 'Feather Teaser' : 'Tennis Ball';
		}
		return { traits: traits, favoriteItem: item };
	}

	// ── Card bio ───────────────────────────────────────────────────────────
	function bioFor(pet, rarity) {
		var name = (pet && pet.name) || 'This friend';
		var breed = (pet && pet.breed) || 'Rescue Companion';
		var isCat = speciesOf(pet) === 'cat';
		switch (rarity) {
			case 'alumni':
				return name + ' found their forever family and lives happily today. Remembered fondly at Monroe Humane Society for bringing joy to everyone they met!';
			case 'golden_senior':
				return 'A wise and gentle companion who has perfected the art of afternoon naps and affectionate greetings. Deserves a warm, loving retirement home!';
			case 'tiny_wonder':
				return isCat
					? 'A curious little explorer who pounces on feather toys and purrs vigorously the moment you pick them up.'
					: 'An energetic bundle of joy with bouncy steps and a tail that never stops wagging!';
			case 'longtimer':
				return 'A loyal shelter champion beloved by all the staff and volunteers. Ready to bring endless unconditional love to their forever human.';
			default:
				return isCat
					? 'A friendly ' + breed + ' with a gentle disposition, perfect for warm sunbeams and quiet evenings.'
					: 'A bright, companionable ' + breed + ' with plenty of spirit, eager for fun outdoor walks and belly rubs.';
		}
	}

	// ── Photo URL normalization ────────────────────────────────────────────
	function photoUrlFor(pet) {
		var url = (pet && (pet.image_url || pet.file || pet.photo || pet.image)) || '';
		return String(url);
	}

	// ── Full card attributes ───────────────────────────────────────────────
	/**
	 * Build the canonical card object. `index` drives the collector dex number
	 * (caller's ordering — usually position in the sorted catalog).
	 */
	function computeCardAttributes(pet, index) {
		pet = pet || {};
		// Server and client share the canonical rarity rule, so a server-provided
		// rarity is safe to keep — otherwise compute it locally.
		var rarity = (pet.rarity && RARITY_META[pet.rarity]) ? pet.rarity : rarityForPet(pet);
		var meta = RARITY_META[rarity];
		var species = speciesOf(pet);
		var age = parseAge(pet.age_display || pet.age);
		var isArchived = !!(pet.archived || pet.archived_at || pet.isArchived);

		return {
			id: String(pet.id || ''),
			dexIndex: (typeof index === 'number' ? index : 0) + 1,
			dexNumber: '#' + String((typeof index === 'number' ? index : 0) + 1).padStart(3, '0'),
			name: pet.name || 'Companion',
			species: species,
			speciesLabel: species === 'dog' ? 'Dog' : (species === 'cat' ? 'Cat' : 'Small Pet'),
			breed: pet.breed || 'Rescue Companion',
			ageDisplay: pet.age_display || pet.age || 'Companion',
			gender: pet.gender || 'Unknown',
			location: pet.location || 'Shelter',
			photoUrl: photoUrlFor(pet),
			rarity: rarity,
			rarityLabel: meta.label,
			foil: meta.foil,
			signatureMove: signatureMoveFor(pet, rarity),
			personalityTraits: traitsFor(pet, rarity).traits,
			favoriteItem: traitsFor(pet, rarity).favoriteItem,
			stats: statsForPet(pet, rarity),
			bio: pet.description && pet.description.length > 12 ? pet.description : bioFor(pet, rarity),
			isAdopted: isArchived,
			adoptionUrl: pet.url || ('/adopt/' + pet.id),
			description: pet.description || bioFor(pet, rarity),
			intakeDate: pet.intake_date ? new Date(pet.intake_date).toLocaleDateString() : 'Recent Rescue',
			shelterStamp: 'HSMC ID #' + pet.id + ' · Monroe Co.',
		};
	}

	global.MonroeCardModel = {
		speciesOf: speciesOf,
		parseAge: parseAge,
		rarityForPet: rarityForPet,
		foilForRarity: foilForRarity,
		RARITY_META: RARITY_META,
		statsForPet: statsForPet,
		signatureMoveFor: signatureMoveFor,
		traitsFor: traitsFor,
		bioFor: bioFor,
		computeCardAttributes: computeCardAttributes,
	};
})(window);
