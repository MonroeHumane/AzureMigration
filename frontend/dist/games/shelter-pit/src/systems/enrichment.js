var SP_Enrichment = {
  collectInventory(runState) {
    return runState.inventory.concat(runState.perks);
  },

  applyBoost(runState) {
    var inv = SP_Enrichment.collectInventory(runState);
    var upgradable = inv.filter(function (i) { return (i.level || 1) < 3; });
    if (!upgradable.length) {
      runState.shiftSupplies = (runState.shiftSupplies || 0) + 75;
      return { type: 'gold', amount: 75 };
    }
    var count = Math.min(5, upgradable.length);
    for (var n = 0; n < count; n++) {
      var pick = upgradable[Math.floor(Math.random() * upgradable.length)];
      pick.level = Math.min(3, (pick.level || 1) + 1);
    }
    return { type: 'boost', count: count };
  },

  getBlendCandidates(inventory) {
    return (inventory || []).filter(function (i) {
      return i.kind === 'ball' && i.level >= 3 && !i.fused;
    });
  },

  findBlockingEvolution(idA, idB) {
    var slugA = SP_Recipes.slug(idA);
    var slugB = SP_Recipes.slug(idB);
    return SHELTER_CONTENT.recipes.find(function (recipe) {
      if (recipe.type === 'perk') return false;
      var leaves = SP_Enrichment._leafSlugs(recipe.requires);
      return leaves.indexOf(slugA) >= 0 && leaves.indexOf(slugB) >= 0;
    });
  },

  _leafSlugs(expr) {
    if (typeof expr === 'string') return [SP_Recipes.slug(expr)];
    if (expr.all) return expr.all.flatMap(function (p) { return SP_Enrichment._leafSlugs(p); });
    if (expr.any) return expr.any.flatMap(function (p) { return SP_Enrichment._leafSlugs(p); });
    return [];
  },

  canBlend(idA, idB) {
    return !SP_Enrichment.findBlockingEvolution(idA, idB);
  },

  applyBlend(runState, idA, idB) {
    if (!SP_Enrichment.canBlend(idA, idB)) return null;
    var inv = runState.inventory;
    var a = inv.find(function (i) { return i.id === idA && i.level >= 3 && !i.fused; });
    var b = inv.find(function (i) { return i.id === idB && i.level >= 3 && !i.fused; });
    if (!a || !b) return null;
    a.fused = true;
    b.fused = true;
    var metaA = SHELTER_CONTENT.careBalls.find(function (x) { return x.id === idA; });
    var metaB = SHELTER_CONTENT.careBalls.find(function (x) { return x.id === idB; });
    var name = (metaA ? metaA.name : idA) + ' x ' + (metaB ? metaB.name : idB);
    var hybrid = {
      id: idA + '_x_' + idB,
      name: name,
      kind: 'ball',
      level: 3,
      fused: true,
    };
    inv.push(hybrid);
    return hybrid;
  },

  getReadyEvolutions(runState) {
    var inv = SP_Enrichment.collectInventory(runState);
    return SP_Recipes.fusionStates(inv).filter(function (s) { return s.state === 'ready'; });
  },

  applyEvolve(runState, recipeResult) {
    var recipe = SHELTER_CONTENT.recipes.find(function (r) { return r.result === recipeResult; });
    if (!recipe) return null;
    var inv = SP_Enrichment.collectInventory(runState);
    if (!SP_Recipes.canEvolveRecipe(recipe, inv)) return null;

    SP_Enrichment._consumeRecipe(runState, recipe.requires);
    var slug = SP_Recipes.slug(recipe.result);
    var entry = {
      id: slug,
      name: recipe.result,
      kind: recipe.type === 'perk' ? 'perk' : 'ball',
      level: 3,
      fused: false,
    };
    if (entry.kind === 'perk') runState.perks.push(entry);
    else runState.inventory.push(entry);
    runState.discoveredThisRun.push(recipe.result);
    return entry;
  },

  _consumeRecipe(runState, expr) {
    if (typeof expr === 'string') {
      SP_Enrichment._consumeOne(runState, SP_Recipes.slug(expr));
      return;
    }
    if (expr.all) {
      expr.all.forEach(function (p) { SP_Enrichment._consumeRecipe(runState, p); });
      return;
    }
    if (expr.any) {
      for (var i = 0; i < expr.any.length; i++) {
        if (SP_Enrichment._tryConsumeBranch(runState, expr.any[i])) return;
      }
    }
  },

  _tryConsumeBranch(runState, expr) {
    var inv = SP_Enrichment.collectInventory(runState);
    var check = SP_Recipes.evaluateRequirement(expr, SP_Recipes.inventoryMap(inv), 3);
    if (!check.ready) return false;
    SP_Enrichment._consumeRecipe(runState, expr);
    return true;
  },

  _consumeOne(runState, slugId) {
    var pools = [runState.inventory, runState.perks];
    for (var p = 0; p < pools.length; p++) {
      var idx = pools[p].findIndex(function (i) {
        return SP_Recipes.slug(i.id) === slugId || SP_Recipes.slug(i.name) === slugId;
      });
      if (idx >= 0) {
        var item = pools[p][idx];
        if (item.level > 3) item.level -= 3;
        else pools[p].splice(idx, 1);
        return;
      }
    }
    var byResult = runState.inventory.findIndex(function (i) {
      return SP_Recipes.slug(i.name) === slugId && i.level >= 3;
    });
    if (byResult >= 0) runState.inventory.splice(byResult, 1);
  },
};
