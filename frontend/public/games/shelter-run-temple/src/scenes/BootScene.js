/* ─── Boot — remastered cat-sheet for menu; silhouette used in-run ────── */

class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.load.on('loaderror', (file) => {
      if (file.key === 'sr-cat') this._loadFailed = true;
      // Kenney rocks are optional — miss quietly
      if (file.key && String(file.key).indexOf('sr-rock') === 0) {
        this._rockMiss = this._rockMiss || {};
        this._rockMiss[file.key] = true;
      }
    });
    this.load.spritesheet('sr-cat', 'assets/cat-sheet.png', {
      frameWidth: 32, frameHeight: 32,
    });
    // Kenney Tappy Plane CC0 rocks — visual only; collisions stay procedural.
    this.load.image('sr-rock', 'assets/kenney/rock.png');
    this.load.image('sr-rock-grass', 'assets/kenney/rockGrass.png');
    this.load.image('sr-rock-ice', 'assets/kenney/rockIce.png');
    this.load.image('sr-rock-snow', 'assets/kenney/rockSnow.png');
  }

  create() {
    if (!this._loadFailed && this.textures.exists('sr-cat')) {
      this.textures.get('sr-cat').setFilter(Phaser.Textures.FilterMode.NEAREST);
      srBuildHdCatTexture(this);
      srRegisterCatAnims(this);
    }
    srBuildPixelTexture(this);
    ['sr-rock', 'sr-rock-grass', 'sr-rock-ice', 'sr-rock-snow'].forEach((k) => {
      if (this.textures.exists(k)) {
        this.textures.get(k).setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
    });
    this.cameras.main.setRoundPixels(true);
    if (typeof ShelterRunPets !== 'undefined') ShelterRunPets.fetchPets();

    const go = () => this.scene.start('MainMenu');
    let started = false;
    const once = () => { if (started) return; started = true; go(); };
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(once).catch(once);
      this.time.delayedCall(1200, once);
    } else {
      once();
    }
  }
}
