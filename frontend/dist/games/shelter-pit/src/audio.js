var SP_Audio = (function () {
  var muted = false;
  var ctx = null;

  function ensureCtx() {
    if (!ctx && typeof AudioContext !== 'undefined') {
      try { ctx = new AudioContext(); } catch (_) { /* ignore */ }
    }
    return ctx;
  }

  function tone(freq, dur, type) {
    var ac = ensureCtx();
    if (!ac || muted) return;
    var osc = ac.createOscillator();
    var gain = ac.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + (dur || 0.08));
    osc.stop(ac.currentTime + (dur || 0.08));
  }

  var sounds = {
    shoot: function () { tone(440, 0.06, 'square'); },
    hit: function () { tone(220, 0.04, 'triangle'); },
    bounce: function () { tone(180, 0.03, 'sine'); },
    clear: function () { tone(523, 0.12, 'square'); tone(659, 0.12, 'square'); },
    pickup: function () { tone(784, 0.08, 'sine'); },
    levelup: function () { tone(392, 0.1); tone(494, 0.1); tone(587, 0.15); },
    enrichment: function () { tone(330, 0.15, 'triangle'); },
  };

  return {
    play(name) {
      if (muted || !sounds[name]) return;
      sounds[name]();
    },
    toggleMute() { muted = !muted; return muted; },
    isMuted() { return muted; },
  };
})();
