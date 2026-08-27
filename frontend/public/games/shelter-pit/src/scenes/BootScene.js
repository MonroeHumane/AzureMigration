class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    this.load.on('loaderror', function () { /* procedural-only fallback */ });
    this.load.json('sp_care_balls', 'content/care-balls.json');
    this.load.json('sp_perks', 'content/perks.json');
    this.load.json('sp_volunteers', 'content/volunteers.json');
    this.load.json('sp_zones', 'content/zones.json');
    this.load.json('sp_stressors', 'content/stressors.json');
    this.load.json('sp_recipes', 'content/recipes.json');
  }

  async create() {
    SP_ContentLoader.mergeFromCache(this.cache.json);

    try {
      SP_TextureRegistry.bakeAll(this);
    } catch (err) {
      console.error(err);
      this.add.text(CFG.WIDTH / 2, CFG.HEIGHT / 2, 'Texture bake failed', {
        fontFamily: CFG.FONT,
        fontSize: '24px',
        color: '#f87171',
      }).setOrigin(0.5);
      return;
    }

    var slug = MonroeApi.getMonroeSlug();
    if (!slug && MonroeApi.isLauncherEmbed()) {
      MonroeApi.notifyLauncherNeedDex();
    }

    await ShelterPets.fetchPets(false);

    if (slug) {
      await SP_Save.load(slug);
    } else {
      window.__SP_SAVE__ = SP_Save.defaultSave();
    }

    this.scene.start('MainMenuScene');
  }
}
