class CampusScene extends Phaser.Scene {
  constructor() {
    super('CampusScene');
  }

  create() {
    var save = window.__SP_SAVE__ || SP_Save.defaultSave();
    SP_Campus.tickResources(save);
    save.supplies = save.supplies || { kibble: 0, towel: 0, supply: 0 };

    this.add.rectangle(CFG.WIDTH / 2, CFG.HEIGHT / 2, CFG.WIDTH, CFG.HEIGHT, SP_PALETTE.bgDark);
    this.add.text(CFG.WIDTH / 2, 40, 'Shelter Campus', {
      fontFamily: CFG.FONT, fontSize: '36px', color: '#f8fafc',
    }).setOrigin(0.5);

    this.add.text(CFG.WIDTH / 2, 72, 'Supplies: kibble ' + (save.supplies.kibble || 0) + ' · towel ' + (save.supplies.towel || 0) + ' · supply ' + (save.supplies.supply || 0), {
      fontFamily: CFG.FONT, fontSize: '14px', color: '#93c5fd',
    }).setOrigin(0.5);

    var campus = save.campus || SP_Campus.defaultGrid();
    var tilePx = CFG.CAMPUS.tilePx;
    var offsetX = (CFG.WIDTH - CFG.CAMPUS.gridW * tilePx) / 2;
    var offsetY = 100;
    this.selectedBuilding = 'pantry';
    var self = this;

    for (var y = 0; y < CFG.CAMPUS.gridH; y++) {
      for (var x = 0; x < CFG.CAMPUS.gridW; x++) {
        var cell = campus.tiles[y][x];
        var px = offsetX + x * tilePx + tilePx / 2;
        var py = offsetY + y * tilePx + tilePx / 2;
        var floor = this.add.image(px, py, 'tile:floor').setDisplaySize(tilePx, tilePx);
        if (cell.resource) {
          this.add.image(px, py, 'tile:res:' + cell.resource).setScale(0.85);
          this.add.text(px, py + 18, cell.amount + '/' + cell.max, {
            fontFamily: CFG.FONT, fontSize: '11px', color: '#f8fafc',
          }).setOrigin(0.5);
        }
        if (cell.building) {
          this.add.image(px, py, 'bld:' + cell.building).setScale(0.6);
        }
        (function (gx, gy, hit) {
          hit.setInteractive({ useHandCursor: true });
          hit.on('pointerup', function () {
            if (cell.building) return;
            var result = SP_CampusPlacement.tryPlace(save, gx, gy, self.selectedBuilding);
            if (result.ok) {
              SP_Save.persist(MonroeApi.getMonroeSlug(), save);
              self.scene.restart();
            }
          });
        })(x, y, floor);
      }
    }

    var bx = 120;
    SP_CampusPlacement.BUILDINGS.forEach(function (b) {
      self.makeBtn(bx, CFG.HEIGHT - 120, b.label, function () {
        self.selectedBuilding = b.id;
      });
      bx += 160;
    });

    this.add.text(CFG.WIDTH / 2, CFG.HEIGHT - 150, 'Click a tile to place selected building', {
      fontFamily: CFG.FONT, fontSize: '14px', color: '#64748b',
    }).setOrigin(0.5);

    this.makeBtn(CFG.WIDTH / 2 - 180, CFG.HEIGHT - 60, 'Harvest Run', function () {
      self.scene.start('HarvestScene');
    });
    this.makeBtn(CFG.WIDTH / 2 + 180, CFG.HEIGHT - 60, 'Menu', function () {
      self.scene.start('MainMenuScene');
    });

    var bonuses = SP_Campus.computeRunBonuses(save);
    this.add.text(CFG.WIDTH / 2, CFG.HEIGHT - 180, 'Run bonuses: +' + bonuses.damage + ' dmg, +' + bonuses.extraBall + ' ball, +' + bonuses.timerGrace + 's', {
      fontFamily: CFG.FONT, fontSize: '13px', color: '#4ade80',
    }).setOrigin(0.5);
  }

  makeBtn(x, y, label, cb) {
    var btn = this.add.image(x, y, 'ui:btn').setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, { fontFamily: CFG.FONT, fontSize: '14px', color: '#f8fafc' }).setOrigin(0.5);
    btn.on('pointerup', cb, this);
  }
}
