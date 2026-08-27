class HarvestScene extends Phaser.Scene {
  constructor() {
    super('HarvestScene');
  }

  create() {
    this.add.image(CFG.WIDTH / 2, CFG.HEIGHT / 2, 'bg:stray_alley');
    this.add.text(CFG.WIDTH / 2, 50, 'Harvest Run', {
      fontFamily: CFG.FONT, fontSize: '32px', color: '#f8fafc',
    }).setOrigin(0.5);

    this.physics.world.setBounds(0, 0, CFG.WIDTH, CFG.HEIGHT);

    var resTypes = ['kibble', 'towel', 'supply'];
    this.tiles = [];
    for (var i = 0; i < 8; i++) {
      var res = resTypes[i % 3];
      var t = this.add.image(160 + i * 120, 200 + (i % 2) * 100, 'tile:res:' + res);
      t.resourceType = res;
      this.physics.add.existing(t, true);
      this.tiles.push(t);
    }

    this.worker = this.add.image(100, CFG.HEIGHT - 100, 'vol:starter');
    this.physics.add.existing(this.worker);
    this.worker.body.setVelocity(280, -200);
    this.worker.body.setBounce(1, 1);
    this.worker.body.setCollideWorldBounds(true);

    this.timeLeft = 15;
    this.collected = { kibble: 0, towel: 0, supply: 0 };
    this.label = this.add.text(CFG.WIDTH / 2, 100, '', {
      fontFamily: CFG.FONT, fontSize: '20px', color: '#93c5fd',
    }).setOrigin(0.5);

    var self = this;
    this.physics.add.overlap(this.worker, this.tiles, function (_w, tile) {
      if (!tile.active) return;
      var rt = tile.resourceType || 'supply';
      self.collected[rt] = (self.collected[rt] || 0) + 1;
      tile.destroy();
    });

    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: function () {
        self.timeLeft -= 1;
        var c = self.collected;
        self.label.setText('Time ' + self.timeLeft + 's  ·  K:' + c.kibble + ' T:' + c.towel + ' S:' + c.supply);
        if (self.timeLeft <= 0) self.finish();
      },
    });

    this.makeBtn(CFG.WIDTH / 2, CFG.HEIGHT - 50, 'End Early', function () {
      self.finish();
    });
  }

  finish() {
    var save = window.__SP_SAVE__ || SP_Save.defaultSave();
    save.supplies = save.supplies || { kibble: 0, towel: 0, supply: 0 };
    save.supplies.kibble = (save.supplies.kibble || 0) + (this.collected.kibble || 0);
    save.supplies.towel = (save.supplies.towel || 0) + (this.collected.towel || 0);
    save.supplies.supply = (save.supplies.supply || 0) + (this.collected.supply || 0);
    save.harvestTotal = (save.harvestTotal || 0) + Object.values(this.collected).reduce(function (a, b) { return a + b; }, 0);
    SP_Save.persist(MonroeApi.getMonroeSlug(), save);
    this.scene.start('CampusScene');
  }

  makeBtn(x, y, label, cb) {
    var btn = this.add.image(x, y, 'ui:btn').setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, { fontFamily: CFG.FONT, fontSize: '16px', color: '#f8fafc' }).setOrigin(0.5);
    btn.on('pointerup', cb, this);
  }
}
