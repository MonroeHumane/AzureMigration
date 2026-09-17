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

/**
 * Rear/¾ chase silhouette with run-cycle legs, ear bob, jump squash/stretch,
 * and slide dust. opts: { squashY, stretchX, landFlash, dustPhase }
 */
function srDrawRunnerSilhouette(g, tint, action, animPhase, scale, opts) {
  g.clear();
  scale = scale || 1;
  opts = opts || {};
  var squashY = opts.squashY != null ? opts.squashY : 1;
  var stretchX = opts.stretchX != null ? opts.stretchX : 1;
  var body = tint || 0x4f7285;
  var accent = Phaser.Display.Color.IntegerToColor(body);
  var ear = Phaser.Display.Color.GetColor(
    Math.min(255, accent.red + 30),
    Math.min(255, accent.green + 20),
    Math.min(255, accent.blue + 10)
  );
  var belly = Phaser.Display.Color.GetColor(
    Math.min(255, accent.red + 45),
    Math.min(255, accent.green + 35),
    Math.min(255, accent.blue + 25)
  );
  var sx = scale * stretchX;
  var sy = scale * squashY;
  var bob = Math.sin(animPhase * 2) * 2.4;
  var earBob = Math.sin(animPhase * 2.4 + 0.6) * 2.2;

  if (action === 'sliding') {
    // Slide dust puffs
    var dustA = 0.18 + 0.12 * Math.abs(Math.sin((opts.dustPhase || animPhase) * 3));
    g.fillStyle(0xd4c4a0, dustA);
    g.fillEllipse(-18 * sx, 10 * sy, 22 * sx, 8 * sy);
    g.fillEllipse(8 * sx, 12 * sy, 16 * sx, 6 * sy);
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(0, 6 * sy, 54 * sx, 12 * sy);
    g.fillStyle(body, 1);
    g.fillRoundedRect(-28 * sx, -14 * sy + bob, 52 * sx, 18 * sy, 8);
    g.fillStyle(belly, 0.55);
    g.fillRoundedRect(-18 * sx, -8 * sy + bob, 28 * sx, 10 * sy, 5);
    g.fillStyle(ear, 1);
    g.fillCircle(22 * sx, -10 * sy + bob, 10 * sx);
    g.fillTriangle(16 * sx, -18 * sy + bob + earBob, 12 * sx, -28 * sy + bob + earBob, 22 * sx, -20 * sy + bob);
    g.fillTriangle(26 * sx, -16 * sy + bob + earBob, 24 * sx, -26 * sy + bob + earBob, 32 * sx, -18 * sy + bob);
    // Tail flick
    g.lineStyle(3.5 * scale, body, 0.9);
    g.beginPath();
    g.moveTo(-24 * sx, -6 * sy + bob);
    g.lineTo(-34 * sx + Math.sin(animPhase * 2) * 3, -18 * sy + bob);
    g.strokePath();
  } else {
    var jumping = action === 'jumping';
    var jumpLift = jumping ? -6 : 0;
    var stretch = jumping ? 1.08 : 1;
    // Shadow
    g.fillStyle(0x000000, jumping ? 0.16 : 0.28);
    g.fillEllipse(0, 8 + (jumping ? 14 : 0), (jumping ? 28 : 40) * sx, (jumping ? 8 : 12) * sy);

    // Four-leg run cycle (rear view: left/right pairs)
    var gait = animPhase * Math.PI;
    var legAmp = jumping ? 3 : 11;
    var legL = Math.sin(gait) * legAmp;
    var legR = Math.sin(gait + Math.PI) * legAmp;
    var legL2 = Math.sin(gait + 0.5) * legAmp * 0.85;
    var legR2 = Math.sin(gait + Math.PI + 0.5) * legAmp * 0.85;
    var thick = Math.max(3.5, 5 * scale);
    g.lineStyle(thick, body, 1);
    g.beginPath();
    // Back legs
    g.moveTo(-7 * sx, -6 * sy + jumpLift);
    g.lineTo(-11 * sx - legL * 0.35, 12 * sy + jumpLift + Math.abs(legL) * 0.15);
    g.moveTo(7 * sx, -6 * sy + jumpLift);
    g.lineTo(11 * sx + legR * 0.35, 12 * sy + jumpLift + Math.abs(legR) * 0.15);
    // Front legs (slightly forward)
    g.moveTo(-5 * sx, -14 * sy + jumpLift);
    g.lineTo(-8 * sx - legL2 * 0.25, 6 * sy + jumpLift);
    g.moveTo(5 * sx, -14 * sy + jumpLift);
    g.lineTo(8 * sx + legR2 * 0.25, 6 * sy + jumpLift);
    g.strokePath();

    // Body (stretch on jump apex)
    var bodyH = 38 * sy * stretch;
    var bodyW = 32 * sx / (jumping ? 1.05 : 1);
    g.fillStyle(body, 1);
    g.fillRoundedRect(-bodyW / 2, -42 * sy + bob + jumpLift, bodyW, bodyH, 10);
    g.fillStyle(belly, 0.4);
    g.fillRoundedRect(-bodyW * 0.28, -28 * sy + bob + jumpLift, bodyW * 0.55, bodyH * 0.45, 6);

    // Head + ears with independent bob
    var headY = -52 * sy + bob + jumpLift + earBob * 0.3;
    g.fillStyle(body, 1);
    g.fillCircle(0, headY, 14 * sx);
    g.fillStyle(ear, 1);
    g.fillTriangle(
      -12 * sx, headY - 8 * sy + earBob,
      -18 * sx, headY - 22 * sy + earBob,
      -4 * sx, headY - 12 * sy
    );
    g.fillTriangle(
      12 * sx, headY - 8 * sy + earBob,
      18 * sx, headY - 22 * sy + earBob,
      4 * sx, headY - 12 * sy
    );
    // Inner ear
    g.fillStyle(0xffb0a0, 0.55);
    g.fillTriangle(
      -11 * sx, headY - 10 * sy + earBob * 0.8,
      -15 * sx, headY - 18 * sy + earBob * 0.8,
      -7 * sx, headY - 12 * sy
    );

    // Tail
    g.lineStyle(4 * scale, body, 0.85);
    g.beginPath();
    g.moveTo(14 * sx, -20 * sy + jumpLift);
    g.lineTo(26 * sx + Math.sin(animPhase * 1.3) * 5, -36 * sy + jumpLift + Math.cos(animPhase) * 3);
    g.strokePath();

    // Land flash sparkles drawn by caller particles; optional body flash
    if (opts.landFlash && opts.landFlash > 0) {
      g.fillStyle(0xfff6c2, opts.landFlash * 0.45);
      g.fillCircle(0, 4 * sy, 18 * sx);
    }
  }
}
