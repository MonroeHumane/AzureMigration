/* ─── Boot — remastered cat-sheet for menu; silhouette used in-run ────── */

class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.load.on('loaderror', (file) => {
      if (file.key === 'sr-cat') this._loadFailed = true;
    });
    this.load.spritesheet('sr-cat', 'assets/cat-sheet.png', {
      frameWidth: 32, frameHeight: 32,
    });
  }

  create() {
    if (!this._loadFailed && this.textures.exists('sr-cat')) {
      this.textures.get('sr-cat').setFilter(Phaser.Textures.FilterMode.NEAREST);
      srBuildHdCatTexture(this);
      srRegisterCatAnims(this);
    }
    srBuildPixelTexture(this);
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
