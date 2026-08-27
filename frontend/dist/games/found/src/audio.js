/* ─── Web Audio SFX + MIDI background music ─────────────────────────────── */

const FoundAudio = {
  ctx: null,
  muted: false,
  musicVolume: 0.32,

  musicBuffer: null,
  musicPlayer: null,
  musicInstrument: null,
  musicGain: null,
  musicReady: false,
  musicLoading: false,
  musicPlaying: false,
  musicActiveNotes: null,
  musicLoop: true,

  init() {
    try {
      this.muted = localStorage.getItem('found_muted') === '1';
    } catch (e) {
      this.muted = false;
    }
    this.musicActiveNotes = new Map();
  },

  isMuted() {
    return this.muted;
  },

  toggleMute() {
    this.muted = !this.muted;
    try {
      localStorage.setItem('found_muted', this.muted ? '1' : '0');
    } catch (e) {
      /* ignore */
    }
    this._applyMusicMute();
    return this.muted;
  },

  _ensureCtx() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) {
        return null;
      }
      this.ctx = new Ctx();
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.muted ? 0 : this.musicVolume;
      this.musicGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  },

  _applyMusicMute() {
    if (this.musicGain) {
      this.musicGain.gain.value = this.muted ? 0 : this.musicVolume;
    }
    if (this.muted && this.musicPlayer && this.musicPlayer.isPlaying()) {
      this.musicPlayer.pause();
      this.musicPlaying = false;
      this._releaseAllMusicNotes();
    } else if (!this.muted && this.musicReady && !this.musicPlaying) {
      this.startMusic();
    }
  },

  _releaseAllMusicNotes() {
    if (!this.musicActiveNotes) {
      return;
    }
    const ctx = this.ctx;
    this.musicActiveNotes.forEach((audio) => {
      if (audio && typeof audio.stop === 'function' && ctx) {
        audio.stop(ctx.currentTime);
      }
    });
    this.musicActiveNotes.clear();
  },

  /**
   * Queue MIDI file from Phaser binary cache (call from BootScene).
   * @param {ArrayBuffer} arrayBuffer
   */
  prepareMusic(arrayBuffer) {
    if (!arrayBuffer || this.musicBuffer === arrayBuffer) {
      return;
    }
    this.musicBuffer = arrayBuffer;
    this.musicReady = false;
  },

  /**
   * Load soundfont + MIDI player (requires user gesture before first play).
   */
  startMusic() {
    if (this.muted || !this.musicBuffer) {
      return;
    }
    if (typeof MidiPlayer === 'undefined' || typeof Soundfont === 'undefined') {
      return;
    }

    const ctx = this._ensureCtx();
    if (!ctx) {
      return;
    }

    if (this.musicPlaying && this.musicPlayer && this.musicPlayer.isPlaying()) {
      return;
    }

    if (this.musicReady && this.musicPlayer) {
      this.musicPlayer.play();
      this.musicPlaying = true;
      return;
    }

    if (this.musicLoading) {
      return;
    }
    this.musicLoading = true;

    Soundfont.instrument(ctx, 'acoustic_grand_piano', { soundfont: 'FluidR3_GM' })
      .then((instrument) => {
        this.musicInstrument = instrument;
        if (instrument.out && this.musicGain) {
          try {
            instrument.out.disconnect();
            instrument.out.connect(this.musicGain);
          } catch (e) {
            /* already routed */
          }
        }

        this.musicPlayer = new MidiPlayer.Player((event) => {
          this._onMidiEvent(event);
        });

        this.musicPlayer.on('endOfFile', () => {
          this.musicPlaying = false;
          this._releaseAllMusicNotes();
          if (this.musicLoop && !this.muted) {
            this.musicPlayer.stop();
            this.musicPlayer.play();
            this.musicPlaying = true;
          }
        });

        this.musicPlayer.loadArrayBuffer(this.musicBuffer);
        this.musicReady = true;
        this.musicLoading = false;

        if (!this.muted) {
          this.musicPlayer.play();
          this.musicPlaying = true;
        }
      })
      .catch(() => {
        this.musicLoading = false;
      });
  },

  stopMusic() {
    if (this.musicPlayer) {
      this.musicPlayer.stop();
    }
    this.musicPlaying = false;
    this._releaseAllMusicNotes();
  },

  _onMidiEvent(event) {
    if (!event || !this.musicInstrument || this.muted) {
      return;
    }
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }

    const noteId = event.noteNumber;
    const isNoteOn = event.name === 'Note on' && event.velocity > 0;
    const isNoteOff = event.name === 'Note off'
      || (event.name === 'Note on' && event.velocity === 0);

    if (isNoteOn && event.noteName) {
      const gain = Math.max(0.05, (event.velocity / 127) * 0.85);
      const audio = this.musicInstrument.play(event.noteName, ctx.currentTime, { gain });
      if (noteId !== undefined) {
        this.musicActiveNotes.set(noteId, audio);
      }
      return;
    }

    if (isNoteOff && noteId !== undefined) {
      const audio = this.musicActiveNotes.get(noteId);
      if (audio && typeof audio.stop === 'function') {
        audio.stop(ctx.currentTime);
      }
      this.musicActiveNotes.delete(noteId);
    }
  },

  _tone(freq, durationSec, type, volume) {
    if (this.muted) {
      return;
    }
    const ctx = this._ensureCtx();
    if (!ctx) {
      return;
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.value = volume || 0.06;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSec);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationSec);
  },

  unlock() {
    this._ensureCtx();
    this.startMusic();
  },

  jump() {
    this._tone(520, 0.07, 'square', 0.045);
  },

  land() {
    this._tone(220, 0.05, 'sine', 0.035);
  },

  collect() {
    this._tone(880, 0.06, 'triangle', 0.04);
    this._tone(1100, 0.08, 'triangle', 0.03);
  },

  win() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => {
      setTimeout(() => this._tone(n, 0.14, 'sine', 0.05), i * 90);
    });
  },

  fall() {
    this._tone(140, 0.12, 'sawtooth', 0.03);
  },
};

FoundAudio.init();
