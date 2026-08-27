/* ─── BootScene - preload assets, generate shared textures ───────────────── */
const FOUND_PLATFORM_TILE_ASSETS = [];
[
  ['green', 'Green'],
  ['brown', 'Brown'],
  ['blue', 'Blue'],
  ['yellow', 'Yellow'],
].forEach(([lower, upper]) => {
  for (let i = 1; i <= 12; i++) {
    const num = String(i).padStart(2, '0');
    FOUND_PLATFORM_TILE_ASSETS.push([
      `found-platform-${lower}-${num}`,
      `assets/platforms/tile${upper}_${num}.png`,
    ]);
  }
});

const FOUND_IMAGE_ASSETS = [
  // Clouds
  ['found-bg-cloud-1', 'assets/bg/cloud1.png'],
  ['found-bg-cloud-2', 'assets/bg/cloud2.png'],
  ['found-bg-cloud-3', 'assets/bg/cloud3.png'],
  ['found-bg-cloud-4', 'assets/bg/cloud4.png'],
  ['found-bg-cloud-5', 'assets/bg/cloud5.png'],
  ['found-bg-cloud-6', 'assets/bg/cloud6.png'],
  ['found-bg-cloud-7', 'assets/bg/cloud7.png'],
  ['found-bg-cloud-8', 'assets/bg/cloud8.png'],
  // Mountains / hills (far parallax layer)
  ['found-bg-mountain-a', 'assets/bg/mountainA.png'],
  ['found-bg-mountain-b', 'assets/bg/mountainB.png'],
  ['found-bg-mountain-c', 'assets/bg/mountainC.png'],
  ['found-bg-hills', 'assets/bg/hills.png'],
  ['found-bg-hills-large', 'assets/bg/hillsLarge.png'],
  // Houses / buildings
  ['found-bg-house-1', 'assets/bg/house1.png'],
  ['found-bg-house-2', 'assets/bg/house2.png'],
  ['found-bg-house-alt-1', 'assets/bg/houseAlt1.png'],
  ['found-bg-house-alt-2', 'assets/bg/houseAlt2.png'],
  ['found-bg-house-small-1', 'assets/bg/houseSmall1.png'],
  ['found-bg-house-small-2', 'assets/bg/houseSmall2.png'],
  ['found-bg-house-small-alt-1', 'assets/bg/houseSmallAlt1.png'],
  ['found-bg-house-small-alt-2', 'assets/bg/houseSmallAlt2.png'],
  ['found-bg-tower', 'assets/bg/tower.png'],
  ['found-bg-tower-small', 'assets/bg/towerSmall.png'],
  ['found-bg-suburb-building-a', 'assets/bg/suburbBuildingA.png'],
  ['found-bg-suburb-building-b', 'assets/bg/suburbBuildingB.png'],
  ['found-bg-suburb-building-c', 'assets/bg/suburbBuildingC.png'],
  ['found-bg-suburb-building-d', 'assets/bg/suburbBuildingD.png'],
  ['found-bg-suburb-building-e', 'assets/bg/suburbBuildingE.png'],
  // Trees (mid-ground + near-ground)
  ['found-bg-tree', 'assets/bg/tree.png'],
  ['found-bg-tree-long', 'assets/bg/treeLong.png'],
  ['found-bg-tree-orange', 'assets/bg/treeOrange.png'],
  ['found-bg-tree-dead', 'assets/bg/treeDead.png'],
  ['found-bg-tree-small-1', 'assets/bg/treeSmall1.png'],
  ['found-bg-tree-small-3', 'assets/bg/treeSmall3.png'],
  ['found-bg-tree-small-green-1', 'assets/bg/treeSmallGreen1.png'],
  ['found-bg-tree-small-green-2', 'assets/bg/treeSmallGreen2.png'],
  ['found-bg-tree-small-green-3', 'assets/bg/treeSmallGreen3.png'],
  ['found-bg-tree-small-green-alt-1', 'assets/bg/treeSmallGreenAlt1.png'],
  ['found-bg-tree-small-green-alt-2', 'assets/bg/treeSmallGreenAlt2.png'],
  ['found-bg-tree-pine', 'assets/bg/treePine.png'],
  ['found-bg-suburb-tree-large', 'assets/bg/suburbTreeLarge.png'],
  // Bushes
  ['found-bg-bush-1', 'assets/bg/bush1.png'],
  ['found-bg-bush-2', 'assets/bg/bush2.png'],
  ['found-bg-bush-3', 'assets/bg/bush3.png'],
  ['found-bg-bush-4', 'assets/bg/bush4.png'],
  ['found-bg-bush-alt-2', 'assets/bg/bushAlt2.png'],
  ['found-bg-bush-alt-3', 'assets/bg/bushAlt3.png'],
  ['found-bg-bush-alt-4', 'assets/bg/bushAlt4.png'],
  // Foliage pack (near-ground fill)
  ['found-bg-foliage-1', 'assets/bg/foliage1.png'],
  ['found-bg-foliage-2', 'assets/bg/foliage2.png'],
  ['found-bg-foliage-3', 'assets/bg/foliage3.png'],
  ['found-bg-foliage-4', 'assets/bg/foliage4.png'],
  ['found-bg-foliage-5', 'assets/bg/foliage5.png'],
  ['found-bg-foliage-6', 'assets/bg/foliage6.png'],
  // Fences
  ['found-bg-fence', 'assets/bg/fence.png'],
  ['found-bg-fence-iron', 'assets/bg/fenceIron.png'],
  ['found-ui-audio-on', 'assets/ui/audioOn.png'],
  ['found-ui-audio-off', 'assets/ui/audioOff.png'],
  ['found-ui-locked', 'assets/ui/locked.png'],
  ['found-ui-target', 'assets/ui/target.png'],
  ['found-platform-green', 'assets/platforms/platformGreen.png'],
  ['found-platform-brown', 'assets/platforms/platformBrown.png'],
  ...FOUND_PLATFORM_TILE_ASSETS,
  // Proper tiling surface tiles for later acts
  ['found-platform-surface-grass',        'assets/platforms/surfaceGrass.png'],
  ['found-platform-surface-brick-brown',   'assets/platforms/surfaceBrickBrown.png'],
  ['found-platform-surface-brick-grey',    'assets/platforms/surfaceBrickGrey.png'],
  ['found-platform-surface-rock',          'assets/platforms/surfaceRock.png'],
  ['found-platform-surface-snow',          'assets/platforms/surfaceSnow.png'],
  ['found-platform-surface-grass-purple',  'assets/platforms/surfaceGrassPurple.png'],
  ['found-item-shield', 'assets/items/powerShield.png'],
  ['found-item-speed', 'assets/items/powerSpeed.png'],
  ['found-item-jump', 'assets/items/powerJump.png'],
  ['found-item-treat-coin', 'assets/items/treatCoin.png'],
  // Hidden power-up blocks
  ['found-item-block-question',        'assets/items/blockQuestion.png'],
  ['found-item-block-question-active', 'assets/items/blockQuestionActive.png'],
  ['found-item-block-empty',           'assets/items/blockEmpty.png'],
  ['found-enemy-walking', 'assets/enemies/enemyWalking.png'],
  ['found-enemy-flying', 'assets/enemies/enemyFlying.png'],
  ['found-enemy-spikey', 'assets/enemies/enemySpikey.png'],
  ['found-ui-menu-start', 'assets/ui/menuStart.png'],
  ['found-ui-menu-daily', 'assets/ui/menuDaily.png'],
  ['found-ui-menu-replay', 'assets/ui/menuReplay.png'],
  ['found-ui-menu-next', 'assets/ui/menuNext.png'],
  ['found-ui-menu-share', 'assets/ui/menuShare.png'],
  ['found-ui-menu-home', 'assets/ui/menuHome.png'],
  ['found-ui-menu-warning', 'assets/ui/menuWarning.png'],
  ['found-ui-menu-check', 'assets/ui/menuCheck.png'],
];

class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.load.on('loaderror', (file) => {
      if (file.key === 'cat') {
        this._loadFailed = true;
      }
    });

    this.load.spritesheet('cat', 'assets/cat-sheet.png', {
      frameWidth:  32,
      frameHeight: 32,
    });

    this.load.binary('bgm', 'assets/music/9seconds.mid');

    FOUND_IMAGE_ASSETS.forEach(([key, path]) => {
      this.load.image(key, path);
    });
  }

  create() {
    if (this._loadFailed || !this.textures.exists('cat')) {
      this._showLoadError();
      return;
    }

    this.textures.get('cat').setFilter(Phaser.Textures.FilterMode.NEAREST);

    FOUND_IMAGE_ASSETS.forEach(([key]) => {
      if (this.textures.exists(key)) {
        this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    });

    if (typeof foundBuildHdCatTextures === 'function') {
      foundBuildHdCatTextures(this);
    }
    if (typeof foundRegisterCatAnims === 'function') {
      foundRegisterCatAnims(this, typeof foundGetCatTextureKey === 'function' ? foundGetCatTextureKey() : 'cat-hd');
    }

    if (!this.textures.exists('pixel')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff);
      g.fillRect(0, 0, 1, 1);
      g.generateTexture('pixel', 1, 1);
      g.destroy();
    }
    if (this.textures.exists('pixel')) {
      this.textures.get('pixel').setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    if (typeof FoundAudio !== 'undefined' && typeof FoundAudio.prepareMusic === 'function') {
      const bgm = this.cache.binary.get('bgm');
      if (bgm) {
        FoundAudio.prepareMusic(bgm);
      }
    }

    this.cameras.main.setRoundPixels(true);
    const startMain = () => this.scene.start('MainMenu');
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(startMain).catch(startMain);
    } else {
      startMain();
    }
  }

  _showLoadError() {
    const W = CFG.WIDTH;
    const H = CFG.HEIGHT;
    this.cameras.main.setBackgroundColor('#1a1a2e');
    this.add.text(W / 2, H / 2,
      'Could not load game assets.\n\nMake sure assets/cat-sheet.png exists\nand you are running from a local web server\n(not opening the HTML file directly).', {
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      align: 'center',
      lineSpacing: 8,
    }).setOrigin(0.5);
  }
}
