class EnrichmentScene extends Phaser.Scene {
  constructor() {
    super('EnrichmentScene');
  }

  init(data) {
    this.runState = data.runState;
    this.parentScene = data.parentScene || 'RunScene';
    this.blendPick = null;
  }

  create() {
    if (typeof SP_Audio !== 'undefined') SP_Audio.play('enrichment');
    this.add.rectangle(CFG.WIDTH / 2, CFG.HEIGHT / 2, CFG.WIDTH, CFG.HEIGHT, 0x000000, 0.7);
    this.add.image(CFG.WIDTH / 2, 160, 'ui:enrichment').setScale(2);

    this.add.text(CFG.WIDTH / 2, 80, 'Enrichment Station!', {
      fontFamily: CFG.FONT, fontSize: '36px', color: '#c4b5fd',
    }).setOrigin(0.5);

    var self = this;

    this.makeChoice(280, 'Boost', 'Upgrade 1–5 random items', function () {
      SP_Enrichment.applyBoost(self.runState);
      self.close();
    });

    var candidates = SP_Enrichment.getBlendCandidates(this.runState.inventory);
    var canBlend = candidates.length >= 2;
    this.makeChoice(CFG.WIDTH / 2, 'Blend', canBlend ? 'Pick two L3 care balls' : 'Need 2 L3 balls', function () {
      if (!canBlend) return;
      self.showBlendPicker(candidates);
    }, !canBlend);

    var evoReady = SP_Enrichment.getReadyEvolutions(this.runState);
    this.makeChoice(CFG.WIDTH - 280, 'Evolve', evoReady.length ? 'Craft ' + evoReady[0].result : 'No recipe ready', function () {
      if (evoReady.length) {
        SP_Enrichment.applyEvolve(self.runState, evoReady[0].result);
      }
      self.close();
    }, !evoReady.length);
  }

  showBlendPicker(candidates) {
    var self = this;
    this.children.list.slice().forEach(function (c) { if (c.depth >= 10) c.destroy(); });
    this.add.rectangle(CFG.WIDTH / 2, CFG.HEIGHT / 2, CFG.WIDTH, CFG.HEIGHT, 0x000000, 0.85).setDepth(10);
    this.add.text(CFG.WIDTH / 2, 120, 'Pick two balls to blend', {
      fontFamily: CFG.FONT, fontSize: '24px', color: '#f8fafc',
    }).setOrigin(0.5).setDepth(11);

    var picked = [];
    candidates.forEach(function (c, idx) {
      var x = 200 + idx * 140;
      var key = SP_TextureRegistry.keyForCareBall(c.id, 3);
      var btn = self.add.image(x, 300, self.textures.exists(key) ? key : 'ball:tennis').setDepth(11).setInteractive({ useHandCursor: true });
      self.add.text(x, 360, c.name || c.id, { fontFamily: CFG.FONT, fontSize: '12px', color: '#94a3b8' }).setOrigin(0.5).setDepth(11);
      btn.on('pointerup', function () {
        if (picked.indexOf(c.id) >= 0) return;
        picked.push(c.id);
        btn.setTint(0x86efac);
        if (picked.length === 2) {
          if (SP_Enrichment.canBlend(picked[0], picked[1])) {
            var hybrid = SP_Enrichment.applyBlend(self.runState, picked[0], picked[1]);
            if (hybrid) {
              self.add.text(CFG.WIDTH / 2, 420, 'Created: ' + hybrid.name, {
                fontFamily: CFG.FONT, fontSize: '18px', color: '#c4b5fd',
              }).setOrigin(0.5).setDepth(11);
              self.time.delayedCall(800, function () { self.close(); });
              return;
            }
          }
          self.add.text(CFG.WIDTH / 2, 420, 'Named evolution blocks blend - try Evolve!', {
            fontFamily: CFG.FONT, fontSize: '16px', color: '#f87171',
          }).setOrigin(0.5).setDepth(11);
          self.time.delayedCall(1200, function () { self.close(); });
        }
      });
    });
  }

  makeChoice(x, title, desc, cb, disabled) {
    var btn = this.add.image(x, 380, 'ui:btn').setInteractive({ useHandCursor: !disabled });
    if (disabled) btn.setAlpha(0.45);
    this.add.text(x, 340, title, { fontFamily: CFG.FONT, fontSize: '22px', color: '#f8fafc' }).setOrigin(0.5);
    this.add.text(x, 420, desc, {
      fontFamily: CFG.FONT, fontSize: '14px', color: '#94a3b8', align: 'center', wordWrap: { width: 200 },
    }).setOrigin(0.5);
    if (!disabled) btn.on('pointerup', cb, this);
  }

  close() {
    this.runState.pendingEnrichment = false;
    var parent = this.scene.get(this.parentScene);
    if (parent && parent.resumeFromOverlay) parent.resumeFromOverlay();
    this.scene.stop();
  }
}
