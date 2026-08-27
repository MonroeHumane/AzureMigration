class ShiftCompleteScene extends Phaser.Scene {
  constructor() {
    super('ShiftCompleteScene');
  }

  init(data) {
    this.runState = data.runState;
    this.won = data.won;
    this.pet = data.pet;
    this.zoneId = data.zoneId;
  }

  create() {
    this.add.rectangle(CFG.WIDTH / 2, CFG.HEIGHT / 2, CFG.WIDTH, CFG.HEIGHT, 0x0b1220, 0.92);

    var title = this.won ? 'Shift Complete!' : 'Shift Over - pets still safe';
    this.add.text(CFG.WIDTH / 2, 80, title, {
      fontFamily: CFG.FONT, fontSize: '40px', color: this.won ? '#4ade80' : '#94a3b8',
    }).setOrigin(0.5);

    var bonus = this.runState.buildingBonuses || {};
    var save = window.__SP_SAVE__ || SP_Save.defaultSave();
    var supplies = save.supplies || {};
    this.add.text(CFG.WIDTH / 2, 130, 'Level ' + this.runState.level + '  ·  Rows ' + this.runState.rowsCleared, {
      fontFamily: CFG.FONT, fontSize: '18px', color: '#cbd5e1',
    }).setOrigin(0.5);
    this.add.text(CFG.WIDTH / 2, 155, 'Campus bonus: +' + (bonus.damage || 0) + ' dmg  ·  Supplies k/t/s: ' + (supplies.kibble || 0) + '/' + (supplies.towel || 0) + '/' + (supplies.supply || 0), {
      fontFamily: CFG.FONT, fontSize: '14px', color: '#4ade80',
    }).setOrigin(0.5);

    if (this.pet) {
      this.add.text(CFG.WIDTH / 2, 175, 'You helped cheer up:', {
        fontFamily: CFG.FONT, fontSize: '22px', color: '#f472b6',
      }).setOrigin(0.5);
      this.add.text(CFG.WIDTH / 2, 210, this.pet.name, {
        fontFamily: CFG.FONT, fontSize: '28px', color: '#f8fafc',
      }).setOrigin(0.5);

      if (this.pet.photo && ShelterPets.isRealPhoto(this.pet.photo)) {
        var frame = this.add.rectangle(CFG.WIDTH / 2, 360, 200, 200, 0x334155).setStrokeStyle(3, 0xf472b6);
        var container = document.getElementById('game-container');
        if (container) {
          var img = document.createElement('img');
          img.src = this.pet.photo;
          img.alt = this.pet.alt || this.pet.name;
          img.style.cssText = 'position:absolute;left:50%;top:360px;width:190px;height:190px;object-fit:cover;border-radius:12px;transform:translate(-50%,-50%);pointer-events:none;z-index:5;border:3px solid #f472b6';
          img.id = 'sp-shift-pet-photo';
          container.appendChild(img);
          this.events.once('shutdown', function () {
            var el = document.getElementById('sp-shift-pet-photo');
            if (el) el.remove();
          });
        }
      } else {
        this.add.text(CFG.WIDTH / 2, 360, '🐾', { fontSize: '64px' }).setOrigin(0.5);
      }

      if (this.pet.link) {
        var self = this;
        this.makeBtn(CFG.WIDTH / 2, 480, 'Meet ' + this.pet.name + ' - Adopt!', function () {
          window.open(self.pet.link, '_blank', 'noopener');
        });
      }
    }

    var slug = MonroeApi.getMonroeSlug();
    var self = this;
    SP_Save.recordShiftComplete(slug, {
      won: this.won,
      zoneId: this.zoneId,
      discovered: this.runState.discoveredThisRun,
      petsHelped: this.runState.petsHelpedThisRun,
    }).then(function () {
      if (slug && self.pet && self.pet.id) {
        MonroeApi.discoverPet(slug, self.pet.id, 'shelter_pit');
      }
    });

    this.makeBtn(CFG.WIDTH / 2 - 140, 560, 'Menu', function () {
      self.scene.start('MainMenuScene');
    });
    this.makeBtn(CFG.WIDTH / 2 + 140, 560, 'Again', function () {
      self.scene.start('RunScene', {
        zoneId: self.zoneId,
        volunteerId: self.runState.volunteerId,
      });
    });
  }

  makeBtn(x, y, label, cb) {
    var btn = this.add.image(x, y, 'ui:btn').setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, { fontFamily: CFG.FONT, fontSize: '16px', color: '#f8fafc' }).setOrigin(0.5);
    btn.on('pointerup', cb, this);
  }
}
