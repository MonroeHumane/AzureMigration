/* ─── Enemy planning + scaffolded spawn helpers ──────────────────────────── */

const FOUND_ENEMY_DEFS = {
  walker: { key: 'found-enemy-walking', label: 'Walker' },
  flyer: { key: 'found-enemy-flying', label: 'Flyer' },
  floater: { key: 'found-enemy-flying', label: 'Floater' },
  spikey: { key: 'found-enemy-spikey', label: 'Spikey' },
};

function foundGetEnemyPlan(levelNum) {
  return (CFG.ENEMY_RULES && CFG.ENEMY_RULES[levelNum]) || { budget: 0, types: [] };
}

function foundSpawnEnemies(scene, platforms, seed, levelNum) {
  const group   = scene.physics.add.group();
  const walkers = [];
  const flyers  = [];
  const plan    = foundGetEnemyPlan(levelNum);

  if (!plan || !plan.budget || !Array.isArray(plan.types) || plan.types.length === 0) {
    return { group, total: 0, walkers, flyers };
  }

  const rng = typeof createSeededRng === 'function'
    ? createSeededRng(hashSeed(seed, 0xd34d))
    : Math.random;

  const candidates = (platforms || []).filter(p => p.type === 'normal' && p.width >= 144);
  const used = new Set();
  let total = 0;

  for (let i = 0; i < plan.budget && candidates.length > used.size; i++) {
    let idx, tries = 0;
    do { idx = Math.floor(rng() * candidates.length); tries++; }
    while (used.has(idx) && tries < 20);
    if (used.has(idx)) break;
    used.add(idx);

    const plat = candidates[idx];
    const type = plan.types[Math.floor(rng() * plan.types.length)];
    const def  = FOUND_ENEMY_DEFS[type];
    if (!def || !scene.textures.exists(def.key)) continue;

    if (type === 'spikey') {
      const x = plat.x + 24 + rng() * Math.max(0, plat.width - 48);
      const enemy = group.create(x, plat.y - 18, def.key);
      enemy.setDisplaySize(28, 32).setImmovable(true);
      enemy.body.allowGravity = false;
      enemy.setData('type', 'spikey');
      enemy.refreshBody();
      total++;

    } else if (type === 'walker') {
      const x   = plat.x + 40 + rng() * Math.max(0, plat.width - 80);
      const dir = rng() < 0.5 ? 1 : -1;
      const enemy = group.create(x, plat.y - 18, def.key);
      enemy.setDisplaySize(28, 32);
      enemy.body.allowGravity = true;
      enemy.body.setVelocityX(70 * dir);
      enemy.setFlipX(dir < 0);
      enemy.setData('type',      'walker');
      enemy.setData('dir',       dir);
      enemy.setData('platLeft',  plat.x + 12);
      enemy.setData('platRight', plat.x + plat.width - 12);
      walkers.push(enemy);
      total++;

    } else { // flyer / floater
      const x     = plat.x + plat.width / 2;
      const y     = plat.y - 55 - rng() * 40;
      const dir   = rng() < 0.5 ? 1 : -1;
      const speed = type === 'floater' ? 32 : 60;
      const range = 70 + Math.floor(rng() * 60);
      const enemy = group.create(x, y, def.key);
      enemy.setDisplaySize(36, 26);
      enemy.body.allowGravity = false;
      enemy.body.setVelocityX(speed * dir);
      enemy.setFlipX(dir < 0);
      enemy.setData('type',       type);
      enemy.setData('dir',        dir);
      enemy.setData('startX',     x);
      enemy.setData('startY',     y);
      enemy.setData('speed',      speed);
      enemy.setData('range',      range);
      enemy.setData('sineOffset', rng() * Math.PI * 2);
      flyers.push(enemy);
      total++;
    }
  }

  return { group, total, walkers, flyers };
}
