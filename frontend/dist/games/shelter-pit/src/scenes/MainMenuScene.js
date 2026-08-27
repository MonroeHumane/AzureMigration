class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');
  }

  init(data) {
    this.menuZoneId = data && data.zoneId ? data.zoneId : null;
    this.menuVolunteerId = data && data.volunteerId ? data.volunteerId : null;
  }

  create() {
    var save = window.__SP_SAVE__ || SP_Save.defaultSave();
    var zoneId = this.menuZoneId || save.unlockedZones[save.unlockedZones.length - 1] || 'stray_alley';
    if (save.unlockedZones.indexOf(zoneId) === -1) zoneId = save.unlockedZones[0];
    var zoneMeta = SHELTER_CONTENT.zones.find(function (z) { return z.id === zoneId; }) || SHELTER_CONTENT.zones[0];
    var volList = save.unlockedVolunteers.length ? save.unlockedVolunteers : ['starter'];
    var volunteerId = this.menuVolunteerId || volList[volList.length - 1];
    if (volList.indexOf(volunteerId) === -1) volunteerId = volList[0];

    this.add.image(CFG.WIDTH / 2, CFG.HEIGHT / 2, 'bg:' + zoneId);

    this.add.text(CFG.WIDTH / 2, 80, 'Shelter Pit', {
      fontFamily: CFG.FONT,
      fontSize: '56px',
      color: '#f8fafc',
      stroke: '#0f172a',
      strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(CFG.WIDTH / 2, 140, 'Monroe Humane Society', {
      fontFamily: CFG.FONT,
      fontSize: '22px',
      color: '#94a3b8',
    }).setOrigin(0.5);

    var name = MonroeApi.getMonroeDisplayName();
    this.add.text(CFG.WIDTH / 2, 175, 'Player: ' + name, {
      fontFamily: CFG.FONT,
      fontSize: '18px',
      color: '#93c5fd',
    }).setOrigin(0.5);

    this.add.text(CFG.WIDTH / 2, 210, 'Zone: ' + zoneMeta.name, {
      fontFamily: CFG.FONT,
      fontSize: '16px',
      color: '#64748b',
    }).setOrigin(0.5);

    var volMeta = SHELTER_CONTENT.volunteers.find(function (v) { return v.id === volunteerId; });
    this.add.text(CFG.WIDTH / 2, 235, 'Volunteer: ' + (volMeta ? volMeta.name : volunteerId), {
      fontFamily: CFG.FONT,
      fontSize: '15px',
      color: '#64748b',
    }).setOrigin(0.5);

    var self = this;
    this.makeButton(CFG.WIDTH / 2 - 180, 280, '◀ Zone', function () {
      var idx = save.unlockedZones.indexOf(zoneId);
      var next = save.unlockedZones[(idx - 1 + save.unlockedZones.length) % save.unlockedZones.length];
      self.scene.restart({ zoneId: next, volunteerId: volunteerId });
    });
    this.makeButton(CFG.WIDTH / 2, 280, 'Start Shift', function () {
      self.scene.start('VolunteerSelectScene', { zoneId: zoneId });
    });
    this.makeButton(CFG.WIDTH / 2 + 180, 280, 'Zone ▶', function () {
      var idx = save.unlockedZones.indexOf(zoneId);
      var next = save.unlockedZones[(idx + 1) % save.unlockedZones.length];
      self.scene.restart({ zoneId: next, volunteerId: volunteerId });
    });

    this.makeButton(CFG.WIDTH / 2 - 120, 340, '◀ Vol', function () {
      var vIdx = volList.indexOf(volunteerId);
      var next = volList[(vIdx - 1 + volList.length) % volList.length];
      self.scene.restart({ zoneId: zoneId, volunteerId: next });
    });
    this.makeButton(CFG.WIDTH / 2 + 120, 340, 'Vol ▶', function () {
      var vIdx = volList.indexOf(volunteerId);
      var next = volList[(vIdx + 1) % volList.length];
      self.scene.restart({ zoneId: zoneId, volunteerId: next });
    });

    if (SP_Save.isCampusUnlocked()) {
      this.makeButton(CFG.WIDTH / 2 - 140, 420, 'Shelter Campus', function () {
        self.scene.start('CampusScene');
      });
      this.makeButton(CFG.WIDTH / 2 + 140, 420, 'Harvest Run', function () {
        self.scene.start('HarvestScene');
      });
    } else {
      this.add.text(CFG.WIDTH / 2, 400, 'Complete 2 shifts to unlock campus', {
        fontFamily: CFG.FONT,
        fontSize: '16px',
        color: '#64748b',
      }).setOrigin(0.5);
    }

    this.add.text(CFG.WIDTH / 2, CFG.HEIGHT - 40, 'Shifts completed: ' + (save.shiftsCompleted || 0), {
      fontFamily: CFG.FONT,
      fontSize: '16px',
      color: '#64748b',
    }).setOrigin(0.5);
  }

  makeButton(x, y, label, cb) {
    var btn = this.add.image(x, y, 'ui:btn').setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, {
      fontFamily: CFG.FONT,
      fontSize: '16px',
      color: '#f8fafc',
    }).setOrigin(0.5);
    btn.on('pointerup', cb, this);
  }
}
