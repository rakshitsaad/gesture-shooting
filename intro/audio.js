// Intro and menu sound. Runs on the game's own audio context and volume chain,
// so the mute button and the volume settings apply here too.
const LOOP_FADE = 0.8;

export class IntroAudio {
  constructor(gameAudio, buffers) {
    this.game = gameAudio;
    this.buffers = buffers;
    this.loops = {};
    this.oneShots = new Set();
  }

  get ctx() { return this.game.ctx; }

  // Needs a user click first: browsers won't start audio without one
  unlock() {
    this.game.init();
    if (!this.sfx) {
      this.sfx = this.ctx.createGain();
      this.sfx.connect(this.game.sfxVolume);
      this.music = this.ctx.createGain();
      this.music.connect(this.game.musicVolume);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      // A big soft hall for shots and impacts between the buildings
      this.reverb = this.ctx.createConvolver();
      this.reverb.buffer = this.makeImpulse(2.8);
      const wet = this.ctx.createGain();
      wet.gain.value = 0.55;
      this.reverb.connect(wet);
      wet.connect(this.sfx);
    }
  }

  makeImpulse(seconds) {
    const sr = this.ctx.sampleRate, len = Math.floor(sr * seconds);
    const buf = this.ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    return buf;
  }

  noise(seconds) {
    if (this.noiseBuf) return this.noiseBuf;
    const len = Math.floor(this.ctx.sampleRate * seconds);
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return this.noiseBuf;
  }

  play(name, { gain = 1, rate = 1, delay = 0, offset = 0, duration, wet = false, lowpass, highpass, pan = 0, fadeOut = 0 } = {}) {
    const buffer = this.buffers[name];
    if (!buffer || !this.sfx) return null;
    const ctx = this.ctx, at = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, at);
    let out = src;
    for (const [type, f] of [['lowpass', lowpass], ['highpass', highpass]]) {
      if (!f) continue;
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = f;
      out.connect(filter);
      out = filter;
    }
    out.connect(g);
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      p.connect(this.sfx);
      if (wet) p.connect(this.reverb);
    } else {
      g.connect(this.sfx);
      if (wet) g.connect(this.reverb);
    }
    src.start(at, offset, duration);
    if (duration && fadeOut) {
      g.gain.setValueAtTime(gain, at + duration / rate - fadeOut);
      g.gain.linearRampToValueAtTime(0.0001, at + duration / rate);
    }
    const handle = { src, g };
    this.oneShots.add(handle);
    src.onended = () => this.oneShots.delete(handle);
    return handle;
  }

  loop(key, name, { gain = 1, fadeIn = 1, lowpass, rate = 1, bus } = {}) {
    if (this.loops[key] || !this.sfx || !this.buffers[name]) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.buffers[name];
    src.loop = true;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gain, now + fadeIn);
    let out = src;
    if (lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      out.connect(f);
      out = f;
    }
    out.connect(g);
    g.connect(bus || this.sfx);
    src.start(now, Math.random() * src.buffer.duration);
    this.loops[key] = { src, g, nodes: [] };
  }

  // Wind: filtered noise, its pitch and level wandering slowly
  wind(gain = 0.2) {
    if (this.loops.wind || !this.sfx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise(6);
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 420;
    f.Q.value = 0.7;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const depth = ctx.createGain();
    depth.gain.value = 240;
    lfo.connect(depth);
    depth.connect(f.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gain, now + 2);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    src.start(now);
    lfo.start(now);
    this.loops.wind = { src, g, nodes: [lfo] };
  }

  // A low, uneasy drone under the intro and menu, on the music volume
  drone(gain = 0.26) {
    if (this.loops.drone || !this.music) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gain, now + 3);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 240;
    f.Q.value = 2;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const depth = ctx.createGain();
    depth.gain.value = 90;
    lfo.connect(depth);
    depth.connect(f.frequency);
    lfo.start(now);
    const nodes = [lfo];
    for (const [freq, type, level, detune] of [[41.2, 'sawtooth', 0.5, -6], [41.2, 'sawtooth', 0.5, 7], [61.74, 'triangle', 0.35, 0], [65.4, 'sine', 0.22, 0]]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = detune;
      const v = ctx.createGain();
      v.gain.value = level;
      o.connect(v);
      v.connect(f);
      o.start(now);
      nodes.push(o);
    }
    f.connect(g);
    g.connect(this.music);
    this.loops.drone = { src: nodes.pop(), g, nodes };
  }

  stopLoop(key, fade = LOOP_FADE) {
    const l = this.loops[key];
    if (!l) return;
    delete this.loops[key];
    const now = this.ctx.currentTime;
    l.g.gain.cancelScheduledValues(now);
    l.g.gain.setValueAtTime(l.g.gain.value, now);
    l.g.gain.linearRampToValueAtTime(0.0001, now + fade);
    for (const n of [l.src, ...l.nodes]) n.stop(now + fade + 0.05);
  }

  stopOneShots(fade = 0.12) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const h of this.oneShots) {
      h.g.gain.cancelScheduledValues(now);
      h.g.gain.setTargetAtTime(0, now, fade / 3);
      h.src.stop(now + fade + 0.05);
    }
    this.oneShots.clear();
  }

  // The radio voice, squeezed through a small speaker and broken up by static
  radioCall() {
    const ctx = this.ctx;
    if (!this.buffers.radioVoice || !this.sfx) return;
    const src = ctx.createBufferSource();
    src.buffer = this.buffers.radioVoice;
    const high = ctx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 480;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 2600;
    const drive = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 5.5) * 0.7; }
    drive.curve = curve;
    const g = ctx.createGain();
    g.gain.value = 0.9;
    src.connect(high);
    high.connect(low);
    low.connect(drive);
    drive.connect(g);
    g.connect(this.sfx);
    g.connect(this.analyser);
    const handle = { src, g };
    this.oneShots.add(handle);
    src.onended = () => this.oneShots.delete(handle);
    src.start(ctx.currentTime + 0.25);
    const stat = this.play('radioStatic', { gain: 0.3, highpass: 900, duration: 3.8, fadeOut: 0.8 });
    if (stat) stat.g.connect(this.analyser);
  }

  // Footsteps speed up as the run begins
  footsteps() {
    this.play('footsteps', { gain: 0.35, rate: 0.85, duration: 0.9, fadeOut: 0.15, lowpass: 2400, wet: true });
    this.play('footsteps', { gain: 0.55, rate: 1.3, delay: 0.75, offset: 1, duration: 1.25, fadeOut: 0.2, lowpass: 3200, wet: true });
  }

  menuAmbience() {
    this.loop('fire', 'fire', { gain: 0.3, fadeIn: 1.5 });
    this.wind(0.16);
    this.loop('crowd', 'crowd', { gain: 0.14, fadeIn: 2, lowpass: 1000 });
    this.drone();
  }

  stopAll(fade) {
    Object.keys(this.loops).forEach((k) => this.stopLoop(k, fade));
    this.stopOneShots();
  }
}
