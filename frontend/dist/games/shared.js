(function (global) {
	const AudioContextClass = global.AudioContext || global.webkitAudioContext;

	function createAudioSuite() {
		const audioCtx = AudioContextClass ? new AudioContextClass() : null;
		const masterGain = audioCtx ? audioCtx.createGain() : null;
		const sfxGain = audioCtx ? audioCtx.createGain() : null;
		const musicGain = audioCtx ? audioCtx.createGain() : null;

		if (audioCtx && masterGain && sfxGain && musicGain) {
			masterGain.gain.value = 0.8;
			sfxGain.gain.value = 0.8;
			musicGain.gain.value = 0;
			sfxGain.connect(masterGain);
			musicGain.connect(masterGain);
			masterGain.connect(audioCtx.destination);
		}

		let audioReady = false;
		const ensureAudio = () => {
			if (!audioCtx) return;
			if (!audioReady) {
				audioCtx.resume();
				audioReady = true;
			}
		};

		const beep = (freq = 440, dur = 0.1, type = "sine", vol = 0.2) => {
			if (!audioCtx) return;
			const now = audioCtx.currentTime;
			const osc = audioCtx.createOscillator();
			const gain = audioCtx.createGain();
			osc.type = type;
			osc.frequency.setValueAtTime(freq, now);
			gain.gain.setValueAtTime(vol, now);
			gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
			osc.connect(gain).connect(sfxGain || audioCtx.destination);
			osc.start(now);
			osc.stop(now + dur);
		};

		const sfx = {
			start: () => beep(520, 0.14, "triangle", 0.26),
			eat: () => {
				beep(660, 0.08, "sine", 0.22);
				beep(880, 0.08, "triangle", 0.16);
			},
			bonk: () => beep(140, 0.2, "sawtooth", 0.3),
			pause: () => beep(300, 0.08, "square", 0.18),
			resume: () => beep(420, 0.08, "square", 0.18)
		};

		const music = {
			pattern: [0, 3, 7, 5, 2, 7, 5, 3],
			tempo: 112,
			step: 0,
			timer: null,
			playing: false,
			start() {
				if (!audioCtx) return;
				ensureAudio();
				if (this.playing) return;
				this.playing = true;
				this.step = 0;
				this.fadeTo(0.24);
				this.schedule();
			},
			stop() {
				this.playing = false;
				if (this.timer) {
					clearTimeout(this.timer);
					this.timer = null;
				}
				this.fadeTo(0);
			},
			pause() {
				this.fadeTo(0.0001);
			},
			resume() {
				if (this.playing) {
					this.fadeTo(0.22);
				}
			},
			fadeTo(level) {
				if (!audioCtx || !musicGain) return;
				const now = audioCtx.currentTime;
				musicGain.gain.cancelScheduledValues(now);
				musicGain.gain.setTargetAtTime(level, now, 0.08);
			},
			schedule() {
				if (!this.playing || !audioCtx) return;
				const beat = 60 / this.tempo;
				const startAt = audioCtx.currentTime + 0.05;
				for (let i = 0; i < 4; i += 1) {
					const idx = (this.step + i) % this.pattern.length;
					const semi = this.pattern[idx];
					const time = startAt + i * beat;
					this.playNote(time, semi);
				}
				this.step = (this.step + 4) % this.pattern.length;
				this.timer = setTimeout(() => this.schedule(), beat * 4 * 1000 * 0.9);
			},
			playNote(time, semi) {
				if (!audioCtx) return;
				const freq = 196 * Math.pow(2, semi / 12);
				const osc = audioCtx.createOscillator();
				const gain = audioCtx.createGain();
				osc.type = "triangle";
				osc.frequency.setValueAtTime(freq, time);
				gain.gain.setValueAtTime(0.0001, time);
				gain.gain.exponentialRampToValueAtTime(0.18, time + 0.02);
				gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.38);
				osc.connect(gain).connect(musicGain || audioCtx.destination);
				osc.start(time);
				osc.stop(time + 0.6);
			}
		};

		return { ensureAudio, sfx, music };
	}

	const suite = createAudioSuite();

	global.HumaneAudio = {
		getSuite: () => suite
	};
})(window);
