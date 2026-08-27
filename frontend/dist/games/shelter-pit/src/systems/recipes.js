var SP_Recipes = {
  slug(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  },

  normalizeName(name) {
    return SP_Recipes.slug(name).replace(/_/g, ' ');
  },

  inventoryMap(items) {
    var inv = {};
    (items || []).forEach(function (item) {
      inv[SP_Recipes.slug(item.id || item.name)] = item.level || 0;
    });
    return inv;
  },

  evaluateRequirement(expr, inventory, levelRequirement) {
    var req = levelRequirement || 3;
    if (typeof expr === 'string') {
      var id = SP_Recipes.slug(expr);
      var level = inventory[id] || 0;
      if (level >= req) {
        return { ready: true, upgradesMissing: 0, missingIngredients: 0, satisfiedLeaves: [expr] };
      }
      return {
        ready: false,
        upgradesMissing: req - level,
        missingIngredients: level > 0 ? 0 : 1,
        satisfiedLeaves: [],
      };
    }
    if (expr.any) {
      var options = expr.any.map(function (part) {
        return SP_Recipes.evaluateRequirement(part, inventory, req);
      });
      var readyOption = options.find(function (c) {
        return c.ready;
      });
      if (readyOption) {
        return {
          ready: true,
          upgradesMissing: 0,
          missingIngredients: 0,
          satisfiedLeaves: readyOption.satisfiedLeaves,
        };
      }
      return {
        ready: false,
        upgradesMissing: Math.min.apply(null, options.map(function (c) {
          return c.upgradesMissing;
        })),
        missingIngredients: Math.min.apply(null, options.map(function (c) {
          return c.missingIngredients;
        })),
        satisfiedLeaves: [],
      };
    }
    if (expr.all) {
      var checks = expr.all.map(function (part) {
        return SP_Recipes.evaluateRequirement(part, inventory, req);
      });
      var allReady = checks.every(function (c) {
        return c.ready;
      });
      return {
        ready: allReady,
        upgradesMissing: checks.reduce(function (s, c) {
          return s + c.upgradesMissing;
        }, 0),
        missingIngredients: checks.reduce(function (s, c) {
          return s + c.missingIngredients;
        }, 0),
        satisfiedLeaves: checks.reduce(function (acc, c) {
          return acc.concat(c.satisfiedLeaves || []);
        }, []),
      };
    }
    return { ready: false, upgradesMissing: 999, missingIngredients: 999, satisfiedLeaves: [] };
  },

  fusionStates(inventory) {
    return SHELTER_CONTENT.recipes.map(function (recipe) {
      var inv = SP_Recipes.inventoryMap(inventory);
      var check = SP_Recipes.evaluateRequirement(recipe.requires, inv, 3);
      var state = 'blocked';
      if (check.ready) state = 'ready';
      else if (check.upgradesMissing === 1 && check.missingIngredients === 0) state = 'one_upgrade_away';
      return {
        result: recipe.result,
        resultId: SP_Recipes.slug(recipe.result),
        type: recipe.type,
        tier: recipe.tier || 1,
        state: state,
        upgradesMissing: check.upgradesMissing,
        satisfiedLeaves: check.satisfiedLeaves,
      };
    });
  },

  getEvolutionsReady(inventory) {
    return SP_Recipes.fusionStates(inventory).filter(function (s) {
      return s.state === 'ready';
    });
  },

  canEvolveRecipe(recipe, inventory) {
    var inv = SP_Recipes.inventoryMap(inventory);
    return SP_Recipes.evaluateRequirement(recipe.requires, inv, 3).ready;
  },

  getUnfusedLevel3Balls(inventory) {
    return (inventory || []).filter(function (item) {
      return item.kind === 'ball' && item.level >= 3 && !item.fused;
    });
  },
};
