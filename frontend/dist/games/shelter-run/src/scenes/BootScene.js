/* ─── BootScene - preload the shared cat sprite sheet, build HD texture ──── */

class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.load.on('loaderror', (file) => {
      if (file.key === 'sr-cat') {
        this._loadFailed = true;
      }
    });

    this.load.spritesheet('sr-cat', 'assets/cat-sheet.png', {
      frameWidth: 32,
      frameHeight: 32,
    });
  }

  create() {
    if (this._loadFailed || !this.textures.exists('sr-cat')) {
      this._showLoadError();
      return;
    }

    this.textures.get('sr-cat').setFilter(Phaser.Textures.FilterMode.NEAREST);
    srBuildHdCatTexture(this);
    srRegisterCatAnims(this);
    srBuildPixelTexture(this);

    this.cameras.main.setRoundPixels(true);

    // Kick off the pet-photo fetch in the background so it's usually ready
    // by the time the player reaches GameScene, without blocking startup.
    if (typeof ShelterRunPets !== 'undefined') {
      ShelterRunPets.fetchPets();
    }

    const startMain = () => this.scene.start('MainMenu');
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(startMain).catch(startMain);
    } else {
      startMain();
    }
  }

  _showLoadError() {
    this.cameras.main.setBackgroundColor('#1a1a2e');
    this.add.text(this.scale.width / 2, this.scale.height / 2,
      'Could not load game assets.\n\nMake sure assets/cat-sheet.png exists\nand you are running from a local web server\n(not opening the HTML file directly).', {
        fontSize: '14px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 8,
      }).setOrigin(0.5);
  }
}
