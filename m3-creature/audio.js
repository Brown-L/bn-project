/* NEON FAUNA / procedural audio
 * All sound is synthesized with Web Audio. No audio files, no network.
 * The engine starts on the first pointer/touch/key gesture, then stays idle
 * until the simulation calls event() or update().
 */
(() => {
  'use strict';

  const AC = window.AudioContext || window.webkitAudioContext;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const getCreature = () => (typeof cr !== 'undefined' ? cr : null);
  const getEnv = () => (typeof ENV !== 'undefined' ? ENV : null);
  const getVent = () => (typeof vent !== 'undefined' ? vent : null);
  const getConfig = () => (typeof CFG !== 'undefined' ? CFG : null);

  let ctx = null;
  let started = false;
  let muted = false;
  let failed = false;
  let installed = false;
  let lastStep = -1;
  let lastTick = -1;
  let lastEvent = '';

  let master = null;
  let toneLP = null;
  let compressor = null;
  let sfx = null;
  let delaySend = null;
  let delay = null;
  let delayFb = null;
  let delayLP = null;
  let delayWet = null;
  let noiseBuffer = null;

  let droneGain = null;
  let droneFilter = null;
  let drone1 = null;
  let drone2 = null;
  let drone3 = null;
  let drone4 = null;
  let ventGain = null;
  let lowGain = null;
  let windGain = null;
  let acidGain = null;
  let servoGain = null;
  let servoOsc = null;
  let servoFilter = null;

  const ambientNodes = [];
  const now = () => (ctx ? ctx.currentTime : 0);
  const smoothParam = (param, value, time = 0.08) => {
    if (param) param.setTargetAtTime(value, now(), time);
  };
  const cleanup = (...nodes) => {
    for (const node of nodes) {
      if (!node) continue;
      try { node.disconnect(); } catch (_) {}
    }
  };

  function panFor(x) {
    const creature = getCreature();
    const base = creature && Number.isFinite(creature.x) ? creature.x : 0;
    const px = Number.isFinite(x) ? x : base;
    return clamp((px - base) / 520, -1, 1);
  }

  function makeNoiseBuffer() {
    const length = Math.floor(ctx.sampleRate * 2);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function route(node, x, sendDelay = false) {
    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = panFor(x);
      node.connect(panner);
      panner.connect(sfx);
      if (sendDelay) panner.connect(delaySend);
    } else {
      node.connect(sfx);
      if (sendDelay) node.connect(delaySend);
    }
    return panner;
  }

  function noiseLayer(type, frequency, q) {
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;

    const gain = ctx.createGain();
    gain.gain.value = 0.0001;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
    ambientNodes.push(source, filter, gain);
    return gain;
  }

  function build() {
    if (!ctx || started) return;

    noiseBuffer = makeNoiseBuffer();

    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;

    toneLP = ctx.createBiquadFilter();
    toneLP.type = 'lowpass';
    toneLP.frequency.value = 9000;
    toneLP.Q.value = 0.2;

    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    master.connect(toneLP);
    toneLP.connect(compressor);
    compressor.connect(ctx.destination);

    sfx = ctx.createGain();
    sfx.gain.value = 0.9;
    sfx.connect(master);

    delaySend = ctx.createGain();
    delaySend.gain.value = 0.6;

    delay = ctx.createDelay(1);
    delay.delayTime.value = 0.32;

    delayFb = ctx.createGain();
    delayFb.gain.value = 0.34;

    delayLP = ctx.createBiquadFilter();
    delayLP.type = 'lowpass';
    delayLP.frequency.value = 2200;

    delayWet = ctx.createGain();
    delayWet.gain.value = 0.42;

    delaySend.connect(delay);
    delay.connect(delayLP);
    delayLP.connect(delayFb);
    delayFb.connect(delay);
    delayLP.connect(delayWet);
    delayWet.connect(master);

    /* Low geothermal bed. */
    droneGain = ctx.createGain();
    droneGain.gain.value = 0.0001;
    droneGain.connect(master);

    droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 320;
    droneFilter.Q.value = 0.7;
    droneFilter.connect(droneGain);

    drone1 = ctx.createOscillator();
    drone1.type = 'sine';
    drone1.frequency.value = 55;
    drone1.connect(droneFilter);

    drone2 = ctx.createOscillator();
    drone2.type = 'sine';
    drone2.frequency.value = 82.4;
    drone2.detune.value = 4;
    drone2.connect(droneFilter);

    drone3 = ctx.createOscillator();
    drone3.type = 'triangle';
    drone3.frequency.value = 41.2;
    drone3.detune.value = -6;
    drone3.connect(droneFilter);

    /* A2 octave of the 55 Hz bed: keeps the drone audible on laptop speakers. */
    drone4 = ctx.createOscillator();
    drone4.type = 'sine';
    drone4.frequency.value = 110;
    drone4.detune.value = -3;
    const drone4Gain = ctx.createGain();
    drone4Gain.gain.value = 0.55;
    drone4.connect(drone4Gain);
    drone4Gain.connect(droneFilter);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.006;
    lfo.connect(lfoGain);
    lfoGain.connect(droneGain.gain);

    drone1.start();
    drone2.start();
    drone3.start();
    drone4.start();
    lfo.start();
    ambientNodes.push(drone1, drone2, drone3, drone4, drone4Gain, lfo, lfoGain, droneFilter, droneGain);

    /* Filtered noise layers: vent hiss, low rumble, cold wind, acid sizzle. */
    ventGain = noiseLayer('bandpass', 1100, 0.7);
    lowGain = noiseLayer('lowpass', 90, 0.8);
    windGain = noiseLayer('highpass', 700, 0.6);
    acidGain = noiseLayer('highpass', 2800, 0.7);

    /* Very quiet servo whine tied to movement and defensive tension. */
    servoGain = ctx.createGain();
    servoGain.gain.value = 0.0001;
    servoGain.connect(master);

    servoFilter = ctx.createBiquadFilter();
    servoFilter.type = 'lowpass';
    servoFilter.frequency.value = 1100;
    servoFilter.Q.value = 2;
    servoFilter.connect(servoGain);

    servoOsc = ctx.createOscillator();
    servoOsc.type = 'triangle';
    servoOsc.frequency.value = 180;
    servoOsc.connect(servoFilter);
    servoOsc.start();
    ambientNodes.push(servoOsc, servoFilter, servoGain);

    started = true;
  }

  function init() {
    if (!AC || failed) return;
    try {
      if (!ctx) ctx = new AC();
      if (!started) build();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch (_) {
      failed = true;
    }
  }

  function ready() {
    return started && ctx && ctx.state === 'running' && !muted;
  }

  function tone(freq, opts = {}) {
    if (!ready()) return;
    const t = ctx.currentTime;
    const duration = opts.dur ?? 0.35;
    const attack = Math.max(0.002, opts.attack ?? 0.01);
    const peak = Math.max(0.0002, opts.gain ?? 0.05);

    const osc = ctx.createOscillator();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(Math.max(20, freq), t);
    if (opts.endFreq) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, opts.endFreq),
        t + (opts.glide ?? duration * 0.65)
      );
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(gain);
    const panner = route(gain, opts.x, !!opts.delay);
    osc.start(t);
    osc.stop(t + duration + 0.05);
    osc.onended = () => cleanup(osc, gain, panner);
  }

  function noiseBurst(opts = {}) {
    if (!ready()) return;
    const t = ctx.currentTime;
    const duration = opts.dur ?? 0.2;
    const attack = Math.max(0.002, opts.attack ?? 0.008);
    const peak = Math.max(0.0002, opts.gain ?? 0.05);

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = opts.type || 'bandpass';
    filter.frequency.setValueAtTime(opts.freq ?? 800, t);
    filter.Q.value = opts.q ?? 0.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    source.connect(filter);
    filter.connect(gain);
    const panner = route(gain, opts.x, !!opts.delay);
    source.start(t);
    source.stop(t + duration + 0.05);
    source.onended = () => cleanup(source, filter, gain, panner);
  }

  function event(name, opts = {}) {
    if (!ready()) return;
    lastEvent = name;
    const x = opts.x;
    const creature = getCreature();

    switch (name) {
      case 'sonar': {
        tone(1250, { endFreq: 640, dur: 0.9, gain: 0.09, attack: 0.006, x, delay: true });
        tone(625, { endFreq: 320, dur: 1.1, gain: 0.035, attack: 0.01, x, delay: true, type: 'triangle' });
        break;
      }
      case 'eruption': {
        const vx = getVent()?.x ?? (creature?.x ?? 0);
        tone(58, { endFreq: 28, dur: 2.4, gain: 0.18, attack: 0.02, x: vx, type: 'sine' });
        noiseBurst({ dur: 2.6, type: 'lowpass', freq: 180, gain: 0.14, x: vx, attack: 0.03 });
        noiseBurst({ dur: 1.2, type: 'bandpass', freq: 700, q: 0.6, gain: 0.085, x: vx, delay: true });
        break;
      }
      case 'step': {
        if (ctx.currentTime - lastStep < 0.09) return;
        lastStep = ctx.currentTime;
        const jitter = 0.92 + Math.random() * 0.16;
        noiseBurst({ dur: 0.06, type: 'bandpass', freq: 520 * jitter, q: 1.1, gain: 0.035, x, attack: 0.002 });
        tone(105 * jitter, { endFreq: 75 * jitter, dur: 0.1, gain: 0.022, attack: 0.002, x, type: 'sine' });
        break;
      }
      case 'feed': {
        tone(660, { dur: 0.3, gain: 0.04, attack: 0.01, x, type: 'sine' });
        setTimeout(() => tone(990, { dur: 0.4, gain: 0.03, attack: 0.01, x, type: 'sine' }), 90);
        break;
      }
      case 'absorb': {
        tone(440, { endFreq: 880, dur: 0.55, gain: 0.04, x, type: 'sine' });
        setTimeout(() => tone(660, { endFreq: 1320, dur: 0.5, gain: 0.03, x, type: 'sine' }), 70);
        break;
      }
      case 'defense': {
        const cx = creature?.x ?? 0;
        noiseBurst({ dur: 0.25, type: 'bandpass', freq: 1500, q: 0.8, gain: 0.07, x: cx, attack: 0.003 });
        tone(130, { endFreq: 55, dur: 0.45, gain: 0.06, attack: 0.005, x: cx, type: 'triangle' });
        break;
      }
      case 'ui': {
        tone(1150, { dur: 0.045, gain: 0.018, attack: 0.003, type: 'sine' });
        break;
      }
      case 'tick': {
        if (ctx.currentTime - lastTick < 0.045) return;
        lastTick = ctx.currentTime;
        tone(1600, { dur: 0.018, gain: 0.01, attack: 0.001, type: 'triangle' });
        noiseBurst({ dur: 0.012, type: 'highpass', freq: 2600, gain: 0.006, attack: 0.001 });
        break;
      }
      case 'reset': {
        tone(220, { endFreq: 440, dur: 0.35, gain: 0.025, attack: 0.01, type: 'sine' });
        break;
      }
    }
  }

  function update() {
    if (!started || !ctx || document.hidden) return;
    const env = getEnv();
    const creature = getCreature();
    const config = getConfig();
    const vent = getVent();
    if (!env) return;

    const pressure = clamp((env.GEYSER_PSI || 0) / 1000, 0, 1);
    const ventX = vent?.x ?? -268;
    const ventZ = vent?.z ?? -168;
    const cx = creature?.x ?? 0;
    const cz = creature?.z ?? 0;
    const ventD = Math.hypot(cx - ventX, cz - ventZ);
    const proximity = clamp(1 - ventD / 900, 0, 1);
    const temperature = Number.isFinite(env.AIR_TEMP) ? env.AIR_TEMP : 15;
    const cold = clamp(-temperature / 30, 0, 1);
    const heat = clamp((temperature - 35) / 25, 0, 1);
    const ph = Number.isFinite(env.PH_LEVEL) ? env.PH_LEVEL : 7;
    const acid = clamp((3 - ph) / 2, 0, 1);
    const walk = config?.walk || 80;
    const speed = clamp(Math.abs(creature?.v || 0) / walk, 0, 1);
    const erupt = env.eruptT > 0 ? clamp(env.eruptT / (env.eruptTotal || 4.8), 0, 1) : 0;
    const tension = creature?.defensive > 0 ? 1 : 0;
    const dormant = creature?.state === 'dormant' ? 1 : 0;
    const response = 0.12;

    smoothParam(droneGain.gain, (0.022 + pressure * 0.018 + proximity * 0.01 + heat * 0.008) * (dormant ? 0.55 : 1), response);
    smoothParam(ventGain.gain, (0.003 + pressure * 0.016 + proximity * 0.007) * (1 - dormant * 0.4), response);
    smoothParam(lowGain.gain, 0.005 + pressure * 0.018 + erupt * 0.035, response);
    smoothParam(windGain.gain, cold * 0.03, response);
    smoothParam(acidGain.gain, acid * 0.016, response);
    smoothParam(servoGain.gain, (speed * 0.006 + tension * 0.006) * (dormant ? 0.4 : 1), response);
    smoothParam(servoOsc.frequency, 170 + speed * 120 + tension * 40, response);
    smoothParam(servoFilter.frequency, 900 + speed * 400, 0.2);
    smoothParam(drone1.frequency, 55 + pressure * 8, 0.5);
    smoothParam(drone2.frequency, 82.4 + pressure * 10, 0.5);
    smoothParam(drone3.frequency, 41.2 + pressure * 5, 0.5);
    smoothParam(drone4.frequency, 110 + pressure * 6, 0.5);
    smoothParam(master.gain, muted ? 0 : 0.55, muted ? 0.02 : 0.1);
  }

  function toggleMute() {
    if (!AC || failed) return;
    init();
    if (!ctx || !master) return;
    muted = !muted;
    smoothParam(master.gain, muted ? 0 : 0.55, muted ? 0.02 : 0.08);
    if (!muted && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function onKey(e) {
    const target = e.target;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) {
      init();
      return;
    }
    if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      toggleMute();
      return;
    }
    init();
  }

  function install() {
    if (installed) return;
    installed = true;
    window.addEventListener('pointerdown', init, { passive: true });
    window.addEventListener('touchstart', init, { passive: true });
    window.addEventListener('keydown', onKey, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) {
        ctx.suspend().catch(() => {});
      } else if (started && !muted) {
        ctx.resume().catch(() => {});
      }
    });
    window.addEventListener('pagehide', () => {
      if (ctx) ctx.suspend().catch(() => {});
    });
  }

  function state() {
    return {
      supported: !!AC,
      started,
      muted,
      context: ctx ? ctx.state : 'none',
      lastEvent,
      gain: master ? master.gain.value : 0,
    };
  }

  window.NF_AUDIO = { install, update, event, toggleMute, state };
})();
