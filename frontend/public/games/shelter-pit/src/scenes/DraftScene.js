class DraftScene extends Phaser.Scene {
  constructor() {
    super('DraftScene');
  }

  init(data) {
    this.runState = data.runState;
    this.parentScene = data.parentScene || 'RunScene';
    this.options = SP_RunState.getDraftOptions(this.runState);
  }

  create() {
    this.add.rectangle(CFG.WIDTH / 2, CFG.HEIGHT / 2, CFG.WIDTH, CFG.HEIGHT, 0x000000, 0.65);

    this.add.text(CFG.WIDTH / 2, 100, 'Level up! Pick a care item', {
      fontFamily: CFG.FONT, fontSize: '32px', color: '#f8fafc',
    }).setOrigin(0.5);

    var startX = CFG.WIDTH / 2 - 200;
    var self = this;
    this.options.forEach(function (opt, i) {
      var x = startX + i * 200;
      var y = CFG.HEIGHT / 2;
      var card = self.add.image(x, y, 'ui:card').setInteractive({ useHandCursor: true });
      var tex = opt.kind === 'ball' ? SP_TextureRegistry.keyForCareBall(opt.id, 1) : 'perk:' + opt.id;
      if (self.textures.exists(tex)) {
        self.add.image(x, y - 20, tex).setScale(1.2);
      }
      self.add.text(x, y + 40, opt.name, {
        fontFamily: CFG.FONT, fontSize: '14px', color: '#e2e8f0', align: 'center', wordWrap: { width: 100 },
      }).setOrigin(0.5);
      card.on('pointerup', function () {
        SP_RunState.applyDraftChoice(self.runState, opt);
        self.close();
      });
    });
  }

  close() {
    var parent = this.scene.get(this.parentScene);
    if (parent && parent.resumeFromOverlay) parent.resumeFromOverlay();
    this.scene.stop();
  }
}
