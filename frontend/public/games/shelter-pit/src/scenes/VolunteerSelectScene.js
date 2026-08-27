class VolunteerSelectScene extends Phaser.Scene {
  constructor() {
    super('VolunteerSelectScene');
  }

  init(data) {
    this.zoneId = data.zoneId || 'stray_alley';
  }

  create() {
    var save = window.__SP_SAVE__ || SP_Save.defaultSave();
    var volList = save.unlockedVolunteers.length ? save.unlockedVolunteers : ['starter'];
    var zoneMeta = SHELTER_CONTENT.zones.find(function (z) { return z.id === this.zoneId; }.bind(this)) || SHELTER_CONTENT.zones[0];

    this.add.rectangle(CFG.WIDTH / 2, CFG.HEIGHT / 2, CFG.WIDTH, CFG.HEIGHT, 0x0b1220, 0.95);
    this.add.text(CFG.WIDTH / 2, 60, 'Pick Your Volunteer', {
      fontFamily: CFG.FONT, fontSize: '36px', color: '#f8fafc',
    }).setOrigin(0.5);
    this.add.text(CFG.WIDTH / 2, 100, zoneMeta.name + ' shift', {
      fontFamily: CFG.FONT, fontSize: '18px', color: '#64748b',
    }).setOrigin(0.5);

    if (!localStorage.getItem('shelter_pit_zone_guide_' + this.zoneId)) {
      this.showZoneGuide(zoneMeta);
    }

    var self = this;
    var startX = CFG.WIDTH / 2 - (volList.length - 1) * 70;
    volList.forEach(function (vid, idx) {
      var v = SHELTER_CONTENT.volunteers.find(function (x) { return x.id === vid; });
      if (!v) return;
      var x = startX + idx * 140;
      var key = 'vol:' + v.id;
      var img = self.add.image(x, 220, self.textures.exists(key) ? key : 'vol:starter').setScale(1.1).setInteractive({ useHandCursor: true });
      self.add.text(x, 300, v.name, { fontFamily: CFG.FONT, fontSize: '14px', color: '#f8fafc', align: 'center', wordWrap: { width: 120 } }).setOrigin(0.5);
      var traitDesc = SP_VolunteerSelect.traitLabel(v.trait);
      self.add.text(x, 340, traitDesc, { fontFamily: CFG.FONT, fontSize: '11px', color: '#93c5fd', align: 'center', wordWrap: { width: 120 } }).setOrigin(0.5);
      var ballKey = SP_TextureRegistry.keyForCareBall(v.startBall, 1);
      if (self.textures.exists(ballKey)) {
        self.add.image(x, 380, ballKey).setScale(0.5);
      }
      img.on('pointerup', function () {
        self.scene.start('RunScene', { zoneId: self.zoneId, volunteerId: v.id });
      });
    });

    this.makeBtn(CFG.WIDTH / 2, 520, 'Back to Menu', function () {
      self.scene.start('MainMenuScene', { zoneId: self.zoneId });
    });
  }

  showZoneGuide(zoneMeta) {
    var mod = [];
    if (zoneMeta.rowSpeedMod) mod.push('Row speed x' + zoneMeta.rowSpeedMod);
    if (zoneMeta.density) mod.push('Stressors ' + Math.round(zoneMeta.density * 100) + '%');
    if (zoneMeta.miniboss) mod.push('Miniboss row at end');
    var txt = mod.length ? mod.join(' · ') : 'Clear rows before they reach the floor!';
    this.add.text(CFG.WIDTH / 2, 420, txt, {
      fontFamily: CFG.FONT, fontSize: '16px', color: '#c4b5fd', align: 'center', wordWrap: { width: 600 },
    }).setOrigin(0.5);
    localStorage.setItem('shelter_pit_zone_guide_' + this.zoneId, '1');
  }

  makeBtn(x, y, label, cb) {
    var btn = this.add.image(x, y, 'ui:btn').setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, { fontFamily: CFG.FONT, fontSize: '16px', color: '#f8fafc' }).setOrigin(0.5);
    btn.on('pointerup', cb, this);
  }
}

var SP_VolunteerSelect = {
  traitLabel(trait) {
    var map = {
      normal: 'Balanced shots',
      rapid_scatter: '2 balls, spread',
      mirror: 'Mirror twin shot',
      lob: 'Gentle lob arc',
      pierce: 'Pierce one hit',
      fast_move: 'Fast movement',
      wide_arc: '3-ball wide arc',
      stealth: 'Pierce + quiet',
    };
    return map[trait] || trait;
  },
};
