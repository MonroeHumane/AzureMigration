/**
 * Assigns pseudo-random tile quadrants to cells once during board creation.
 * Uses prime number multiplication for distribution without visible patterns.
 */
export function assignTileQuadrants(cells, seed = 42) {
	const quadrants = ['tl', 'tr', 'bl', 'br'];
	// Prime multipliers chosen for good distribution:
	// 7, 13, 17 are small primes that create varied patterns when combined
	const PRIME_A = 7;
	const PRIME_B = 13;
	const PRIME_C = 17;
	
	cells.forEach((cell, index) => {
		// Pseudo-random hash using prime multiplication
		// XOR and multiply create pseudo-random distribution
		const rawHash = ((index * PRIME_A) ^ (index * PRIME_B)) + (index * PRIME_C) + seed;
		// Ensure positive result in range [0, 3] with proper modulo handling
		const hash = ((rawHash % 4) + 4) % 4;
		cell.dataset.quadrant = quadrants[hash];
	});
}

export default assignTileQuadrants;
