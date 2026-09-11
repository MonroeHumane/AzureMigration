/* ─── HD cat (menu) + procedural rear/¾ silhouette runner (in-run) ─────── */

function srBuildHdCatTexture(scene) {
  if (!scene.textures.exists('sr-cat')) return false;
  if (scene.textures.exists(CFG.CAT_TEXTURE_KEY)) return true;
  var mul = CFG.CAT_HD_MUL;
  var frame = CFG.CAT_FRAME_PX;
  var hdFrame = frame * mul;
  var srcImg = scene.textures.get('sr-cat').getSourceImage();
  if (!srcImg || !srcImg.width) return false;
  var canvas = document.createElement('canvas');
  canvas.width = srcImg.width * mul;
  canvas.height = srcImg.height * mul;
  var ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(srcImg, 0, 0, canvas.width, canvas.height);
  scene.textures.addSpriteSheet(CFG.CAT_TEXTURE_KEY, canvas, {
    frameWidth: hdFrame, frameHeight: hdFrame,
  });
  scene.textures.get(CFG.CAT_TEXTURE_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);
  return true;
}

function srRegisterCatAnims(scene) {
  var key = CFG.CAT_TEXTURE_KEY;
  if (!scene.textures.exists(key)) return;
  var a = scene.anims;
  Object.values(ANIMS).forEach(function (def) {
    if (a.exists(def.key)) return;
    a.create({
      key: def.key,
      frames: a.generateFrameNumbers(key, { start: def.start, end: def.end }),
      frameRate: def.frameRate,
      repeat: def.repeat,
    });
  });
}

function srUiText(scene, x, y, content, style) {
  return scene.add.text(x, y, content, Object.assign({
    fontFamily: '"Fredoka", "Segoe UI", system-ui, sans-serif',
    color: '#ffffff',
  }, style || {})).setOrigin(0.5);
}

function srBuildPixelTexture(scene) {
  if (scene.textures.exists('sr-pixel')) return;
  var g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0xffffff);
  g.fillRect(0, 0, 1, 1);
  g.generateTexture('sr-pixel', 1, 1);
  g.destroy();
}

/** Rear/¾ chase silhouette — side cat-sheet fights Temple Run camera. */
function srDrawRunnerSilhouette(g, tint, action, animPhase, scale) {
  g.clear();
  scale = scale || 1;
  var body = tint || 0x4f7285;
  var accent = Phaser.Display.Color.IntegerToColor(body);
  var ear = Phaser.Display.Color.GetColor(
    Math.min(255, accent.red + 30),
    Math.min(255, accent.green + 20),
    Math.min(255, accent.blue + 10)
  );
  var bob = Math.sin(animPhase * 2) * 2;

  if (action === 'sliding') {
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(0, 6, 54 * scale, 12 * scale);
    g.fillStyle(body, 1);
    g.fillRoundedRect(-28 * scale, -14 * scale + bob, 52 * scale, 18 * scale, 8);
    g.fillStyle(ear, 1);
    g.fillCircle(22 * scale, -10 * scale + bob, 10 * scale);
    g.fillTriangle(16 * scale, -18 * scale + bob, 12 * scale, -28 * scale + bob, 22 * scale, -20 * scale + bob);
    g.fillTriangle(26 * scale, -16 * scale + bob, 24 * scale, -26 * scale + bob, 32 * scale, -18 * scale + bob);
  } else {
    var jumpLift = action === 'jumping' ? -6 : 0;
    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(0, 8 + (action === 'jumping' ? 10 : 0), 40 * scale, 12 * scale);
    var leg = Math.sin(animPhase * Math.PI) * (action === 'jumping' ? 4 : 10);
    g.lineStyle(5 * scale, body, 1);
    g.beginPath();
    g.moveTo(-8 * scale, -8 * scale + jumpLift);
    g.lineTo(-10 * scale - leg * 0.3, 10 * scale + jumpLift);
    g.moveTo(8 * scale, -8 * scale + jumpLift);
    g.lineTo(10 * scale + leg * 0.3, 10 * scale + jumpLift);
    g.strokePath();
    g.fillStyle(body, 1);
    g.fillRoundedRect(-16 * scale, -42 * scale + bob + jumpLift, 32 * scale, 38 * scale, 10);
    g.fillCircle(0, -52 * scale + bob + jumpLift, 14 * scale);
    g.fillStyle(ear, 1);
    g.fillTriangle(-12 * scale, -60 * scale + bob + jumpLift, -18 * scale, -74 * scale + bob + jumpLift, -4 * scale, -64 * scale + bob + jumpLift);
    g.fillTriangle(12 * scale, -60 * scale + bob + jumpLift, 18 * scale, -74 * scale + bob + jumpLift, 4 * scale, -64 * scale + bob + jumpLift);
    g.lineStyle(4 * scale, body, 0.85);
    g.beginPath();
    g.moveTo(14 * scale, -20 * scale + jumpLift);
    g.lineTo(26 * scale + Math.sin(animPhase) * 4, -36 * scale + jumpLift);
    g.strokePath();
  }
}
