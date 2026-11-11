/* NEON FAUNA / ecology layer
 *
 * Adds a small, readable survival model on top of the original p5 sketch:
 * seeded morphology, energy / habitat / symbiosis metrics, environment-driven
 * exploration / clustering / migration, a 28 second ontogeny demo, a single
 * selection trial, an individual file and an offline-time estimate.
 *
 * The renderer, character silhouette and interactions remain in sketch.js.
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'neon-fauna-eco-v3';
  const BASE = {
    body: { hx: 76, hy: 21, hz: 35, h: 86 },
    l1: 48,
    l2: 54,
    walk: 80
  };
  const GROWTH_SECONDS = 28;
  const SEASON_SECONDS = 48;
  const TRIAL_SECONDS = 20;
  const TRIAL_RADIUS = 68;

  const VARIANTS = {
    legs: {
      label: 'LONG LEGS / 長足',
      note: '腿長 +7%、移動 +6%、耐熱上限 +2°C；身體略窄。適合快速穿越熱梯度。'
    },
    hull: {
      label: 'BROAD HULL / 寬甲',
      note: '體寬 +6%、耐寒與耐熱範圍擴大；移動速度略降。適合停留與保溫。'
    },
    antennae: {
      label: 'DENSE ANTENNA / 密觸角',
      note: '觸角 +8%、感測 +8%、化能親和 +7%；速度略降。適合尋找化學源。'
    }
  };

  const S = {
    initialized: false,
    specimen: null,
    records: [],
    growth: 0.05,
    seasonT: 0,
    seasonPhase: 0,
    seasonPulse: 0,
    exploreT: 0,
    exploreTarget: null,
    challenge: null,
    pendingVariant: 'legs',
    offline: null,
    lastSave: 0,
    lastPanel: 0,
    saved: null,
    baseBody: null,
    baseL1: BASE.l1,
    baseL2: BASE.l2,
    behaviorRng: null,
    ui: {}
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sm = (dt, rate) => 1 - Math.exp(-dt * rate);
  const $ = id => document.getElementById(id);

  function rngFrom(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashSeed() {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < arguments.length; i++) {
      h ^= Number(arguments[i]) | 0;
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function fmtTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }

  function fmtSeed(seed) {
    return '0x' + (seed >>> 0).toString(16).toUpperCase().padStart(8, '0');
  }

  function rounded(v, d = 0) {
    return Number(v).toFixed(d);
  }

  function makeTraits(rng) {
    const bodyScale = 0.90 + rng() * 0.20;
    const antRoll = rng();
    return {
      body: {
        hx: BASE.body.hx * bodyScale,
        hy: BASE.body.hy * (0.90 + rng() * 0.20),
        hz: BASE.body.hz * (0.90 + rng() * 0.20),
        h: BASE.body.h * (0.93 + rng() * 0.14)
      },
      legScale: 0.86 + rng() * 0.28,
      antennaScale: 0.90 + rng() * 0.20,
      antennaDelta: antRoll < 0.28 ? -1 : antRoll < 0.64 ? 0 : 1,
      speed: 0.86 + rng() * 0.28,
      metabolism: 0.90 + rng() * 0.20,
      chemAffinity: 0.85 + rng() * 0.30,
      sensor: 0.90 + rng() * 0.20,
      temp: [-2 + rng() * 10, 36 + rng() * 12],
      ph: [3.2 + rng() * 1.7, 8.4 + rng() * 2.0]
    };
  }

  function makeSpecimen(seed) {
    const rng = rngFrom(seed);
    return {
      id: 'NF-' + (seed >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(-6),
      seed: seed >>> 0,
      generation: 1,
      parent: null,
      parentSeed: null,
      traits: makeTraits(rng),
      createdAt: Date.now()
    };
  }

  function isValidSpecimen(spec) {
    return !!(spec && spec.traits && spec.traits.body && spec.seed != null);
  }

  function clampTraits(t) {
    t.body.hx = clamp(t.body.hx, 58, 94);
    t.body.hy = clamp(t.body.hy, 16, 27);
    t.body.hz = clamp(t.body.hz, 27, 47);
    t.body.h = clamp(t.body.h, 70, 104);
    t.legScale = clamp(t.legScale, 0.70, 1.38);
    t.antennaScale = clamp(t.antennaScale, 0.72, 1.38);
    t.antennaDelta = clamp(Math.round(t.antennaDelta), -1, 1);
    t.speed = clamp(t.speed, 0.68, 1.34);
    t.metabolism = clamp(t.metabolism, 0.72, 1.30);
    t.chemAffinity = clamp(t.chemAffinity, 0.68, 1.40);
    t.sensor = clamp(t.sensor, 0.72, 1.38);
    t.temp[0] = clamp(t.temp[0], -10, 16);
    t.temp[1] = clamp(t.temp[1], 30, 56);
    t.ph[0] = clamp(t.ph[0], 2.4, 6.2);
    t.ph[1] = clamp(t.ph[1], 7.8, 11.6);
    return t;
  }

  function makeChild(parent, variant, score) {
    const v = VARIANTS[variant] ? variant : 'legs';
    const seed = hashSeed(parent.seed, parent.generation, v.charCodeAt(0), Math.round(score * 11), S.records.length);
    const rng = rngFrom(seed);
    const t = JSON.parse(JSON.stringify(parent.traits));

    if (v === 'legs') {
      t.legScale *= 1.07;
      t.speed *= 1.06;
      t.body.hx *= 0.98;
      t.body.hz *= 0.98;
      t.temp[1] += 2;
    } else if (v === 'hull') {
      t.body.hx *= 1.06;
      t.body.hz *= 1.08;
      t.legScale *= 0.98;
      t.speed *= 0.97;
      t.temp[0] -= 2;
      t.temp[1] += 3;
      t.metabolism *= 0.97;
    } else {
      t.antennaScale *= 1.08;
      t.antennaDelta = Math.min(1, t.antennaDelta + 1);
      t.sensor *= 1.08;
      t.chemAffinity *= 1.07;
      t.speed *= 0.98;
    }

    const jitter = (v0, amount = 0.035) => v0 * (1 + (rng() * 2 - 1) * amount);
    t.body.hx = jitter(t.body.hx);
    t.body.hy = jitter(t.body.hy);
    t.body.hz = jitter(t.body.hz);
    t.body.h = jitter(t.body.h);
    t.legScale = jitter(t.legScale);
    t.antennaScale = jitter(t.antennaScale);
    t.speed = jitter(t.speed);
    t.metabolism = jitter(t.metabolism);
    t.chemAffinity = jitter(t.chemAffinity);
    t.sensor = jitter(t.sensor);
    t.temp[0] = jitter(t.temp[0], 0.06);
    t.temp[1] = jitter(t.temp[1], 0.04);
    t.ph[0] = jitter(t.ph[0], 0.05);
    t.ph[1] = jitter(t.ph[1], 0.04);
    clampTraits(t);

    return {
      id: 'NF-' + (seed >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(-6),
      seed: seed >>> 0,
      generation: parent.generation + 1,
      parent: parent.id,
      parentSeed: parent.seed,
      traits: t,
      variant: v,
      lastScore: Math.round(score),
      createdAt: Date.now()
    };
  }

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && typeof data === 'object' ? data : null;
    } catch (err) {
      return null;
    }
  }

  function saveState() {
    if (!S.initialized || !window.localStorage || typeof cr === 'undefined' || !cr) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        specimen: S.specimen,
        growth: S.growth,
        energy: cr.energy,
        habitat: cr.habitat,
        symbiosis: cr.symbiosis,
        records: S.records.slice(0, 8),
        seasonPhase: S.seasonPhase,
        pendingVariant: S.pendingVariant,
        lastSeen: Date.now()
      }));
      S.lastSave = Date.now();
    } catch (err) {
      /* storage is optional; simulation continues without it */
    }
  }

  function applySpecimen(spec, growth) {
    if (!isValidSpecimen(spec)) return;
    S.specimen = spec;
    const t = spec.traits;
    S.baseBody = { ...t.body };
    S.baseL1 = BASE.l1 * t.legScale;
    S.baseL2 = BASE.l2 * t.legScale;
    S.behaviorRng = rngFrom((spec.seed ^ 0x9E3779B9) >>> 0);

    if (typeof BODY !== 'undefined') {
      BODY.hx = t.body.hx;
      BODY.hy = t.body.hy;
      BODY.hz = t.body.hz;
      BODY.h = t.body.h;
    }
    if (typeof L1 !== 'undefined') L1 = S.baseL1;
    if (typeof L2 !== 'undefined') L2 = S.baseL2;
    if (typeof CFG !== 'undefined') CFG.walk = BASE.walk * t.speed;

    if (typeof cr !== 'undefined' && cr) {
      cr.tempMin = t.temp[0];
      cr.tempMax = t.temp[1];
      cr.phMin = t.ph[0];
      cr.phMax = t.ph[1];
      cr.growth = growth;
    }

    if (typeof chains !== 'undefined' && chains) {
      for (const c of chains) {
        if (!c.base0) c.base0 = c.base.slice();
        if (!c.segBase0) c.segBase0 = c.seg.slice();
        c.adultBase = c.base0.map((value, index) => {
          const scale = index === 0 ? t.body.hx / BASE.body.hx
            : index === 1 ? t.body.h / BASE.body.h
              : index === 2 ? t.body.hz / BASE.body.hz
                : 1;
          return value * scale;
        });
        let seg = c.segBase0.map(value => value * t.antennaScale);
        if (t.antennaDelta > 0) seg.push(seg[seg.length - 1] * 0.70);
        else if (t.antennaDelta < 0 && seg.length > 2) seg.pop();
        c.segBase = seg;
        c.seg = seg.slice();
        c.total = seg.reduce((a, b) => a + b, 0);
        c.pts = null;
        c.tip = null;
      }
    }
    S.growth = clamp(growth, 0, 1);
    applyGrowth();
  }

  function applyGrowth() {
    if (!S.specimen || !S.baseBody) return;
    const e = S.growth * S.growth * (3 - 2 * S.growth);
    const scale = 0.58 + 0.42 * e;
    if (typeof BODY !== 'undefined') {
      BODY.hx = S.baseBody.hx * scale;
      BODY.hy = S.baseBody.hy * scale;
      BODY.hz = S.baseBody.hz * scale;
      BODY.h = S.baseBody.h * scale;
    }
    if (typeof L1 !== 'undefined') L1 = S.baseL1 * (0.62 + 0.38 * e);
    if (typeof L2 !== 'undefined') L2 = S.baseL2 * (0.62 + 0.38 * e);
    if (typeof legs !== 'undefined' && legs) {
      for (const L of legs) {
        if (L.f0 == null) {
          L.f0 = L.f / BASE.body.hx;
          L.s0 = L.s / (BASE.body.hz - 4);
        }
        L.f = L.f0 * BODY.hx;
        L.s = L.s0 * (BODY.hz - 4);
      }
    }
    if (typeof chains !== 'undefined' && chains) {
      for (const c of chains) {
        if (!c.adultBase || !c.segBase) continue;
        c.base = c.adultBase.map(value => value * scale);
        c.seg = c.segBase.map(value => value * (0.56 + 0.44 * e));
        c.total = c.seg.reduce((a, b) => a + b, 0);
      }
    }
  }

  function rangeFit(value, min, max, fade) {
    if (value >= min && value <= max) return 1;
    const dist = value < min ? min - value : value - max;
    return clamp(1 - dist / Math.max(0.001, fade), 0, 1);
  }

  function nearestFood() {
    let best = null;
    let bestD = Infinity;
    if (typeof crystals !== 'undefined') {
      for (const c of crystals) {
        const d = Math.hypot(c.x - cr.x, c.z - cr.z);
        if (d < bestD) { bestD = d; best = { x: c.x, z: c.z, kind: 'crystal' }; }
      }
    }
    if (typeof mats !== 'undefined') {
      for (const m of mats) {
        const d = Math.hypot(m.x - cr.x, m.z - cr.z);
        if (d < bestD) { bestD = d; best = { x: m.x, z: m.z, kind: 'mat' }; }
      }
    }
    return best;
  }

  function ventPoint(radius) {
    const a = Math.atan2(cr.z - vent.z, cr.x - vent.x) || 0;
    return {
      x: clamp(vent.x + Math.cos(a) * radius, -CFG.arena + 50, CFG.arena - 50),
      z: clamp(vent.z + Math.sin(a) * radius, -CFG.arena + 50, CFG.arena - 50)
    };
  }

  function comfortTarget() {
    const t = S.specimen.traits;
    const wanted = clamp((t.temp[0] + t.temp[1]) / 2, ENV.AIR_TEMP + 3, 55);
    const radius = clamp(620 * (1 - (wanted - ENV.AIR_TEMP) / 44), CFG.ventR + 42, CFG.arena - 80);
    return ventPoint(radius);
  }

  function thermalRefuge() {
    const t = S.specimen.traits;
    if (cr.localTemp < t.temp[0]) return comfortTarget();
    const a = Math.atan2(cr.z - vent.z, cr.x - vent.x) || 0;
    return {
      x: clamp(vent.x + Math.cos(a) * (CFG.arena - 80), -CFG.arena + 50, CFG.arena - 50),
      z: clamp(vent.z + Math.sin(a) * (CFG.arena - 80), -CFG.arena + 50, CFG.arena - 50)
    };
  }

  function seasonTarget() {
    const rng = S.behaviorRng;
    const side = S.seasonPhase % 2 ? 1 : -1;
    return {
      x: clamp(side * (260 + rng() * 180), -CFG.arena + 60, CFG.arena - 60),
      z: clamp((rng() * 2 - 1) * 300, -CFG.arena + 60, CFG.arena - 60)
    };
  }

  function exploreTarget() {
    const rng = S.behaviorRng;
    S.exploreT = 4 + rng() * 4;
    if (rng() < 0.35) return ventPoint(180 + rng() * 170);
    return {
      x: (rng() * 2 - 1) * (CFG.arena - 80),
      z: (rng() * 2 - 1) * (CFG.arena - 80)
    };
  }

  function updateMetrics(dt) {
    if (!S.specimen || typeof cr === 'undefined' || !cr) return;
    const t = S.specimen.traits;
    const ventD = Math.hypot(cr.x - vent.x, cr.z - vent.z);
    const localTemp = ENV.AIR_TEMP + Math.max(0, 1 - ventD / 620) * 44 + (cr.heatStress || 0) * 4;
    cr.localTemp = localTemp;

    const tempFit = rangeFit(localTemp, t.temp[0], t.temp[1], 9);
    const phFit = rangeFit(ENV.PH_LEVEL, t.ph[0], t.ph[1], 1.4);
    const hazard = (ENV.eruptT > 0 && ventD < 700) || (ENV.GEYSER_PSI > 700 && ventD < 400) ? 0.35 : 1;
    const targetHabitat = clamp((tempFit * 0.60 + phFit * 0.40) * 100 * hazard, 0, 100);
    cr.habitat = lerp(cr.habitat == null ? targetHabitat : cr.habitat, targetHabitat, sm(dt, 1.4));

    const moving = Math.abs(cr.v || 0) / Math.max(1, CFG.walk);
    const stress = 1 - cr.habitat / 100;
    let drain = (0.15 + moving * 0.12 + stress * 0.20) * t.metabolism;
    if (cr.state === 'dormant') drain *= 0.42;
    if (cr.state === 'defensive') drain *= 0.72;
    cr.energy = clamp((cr.energy == null ? 66 : cr.energy) - dt * drain, 0, 100);

    if (ventD < 230) {
      const uptake = dt * (0.42 + (cr.symbiosis || 0) / 100 * 0.72) * t.chemAffinity;
      cr.energy = clamp(cr.energy + uptake, 0, 100);
      cr.symbiosis = clamp((cr.symbiosis || 0) + dt * 0.03, 0, 100);
    } else {
      cr.symbiosis = clamp((cr.symbiosis || 0) - dt * 0.025, 0, 100);
    }

    cr.vitality = clamp(cr.energy * 0.45 + cr.habitat * 0.35 + cr.symbiosis * 0.20, 0, 100);
  }

  function chooseSurvival(dt) {
    if (!S.specimen || typeof cr === 'undefined' || !cr) return;
    if (S.challenge && S.challenge.active) {
      cr.survival = { mode: 'challenge', target: S.challenge.target, urgent: true, reason: 'TRIAL' };
      return;
    }

    const t = S.specimen.traits;
    const food = nearestFood();
    let mode = 'explore';
    let target = S.exploreTarget;
    let urgent = false;
    let reason = 'EXPLORE';

    if (cr.localTemp < t.temp[0] - 1 || cr.localTemp > t.temp[1] + 1) {
      mode = 'migrate';
      target = thermalRefuge();
      urgent = true;
      reason = 'THERMAL STRESS';
    } else if ((cr.energy || 0) < 55 || (cr.symbiosis || 0) < 22) {
      mode = 'cluster';
      target = food ? { x: food.x, z: food.z } : ventPoint(200);
      urgent = (cr.energy || 0) < 34;
      reason = (cr.energy || 0) < 55 ? 'LOW ENERGY' : 'LOW SYMBIONT';
    } else if (S.seasonPulse > 0) {
      mode = 'migrate';
      target = seasonTarget();
      urgent = true;
      reason = 'SEASONAL MIGRATION';
    } else {
      S.exploreT -= dt;
      if (!S.exploreTarget || S.exploreT <= 0 || Math.hypot(S.exploreTarget.x - cr.x, S.exploreTarget.z - cr.z) < 55) {
        S.exploreTarget = exploreTarget();
      }
      target = S.exploreTarget;
    }

    cr.survival = { mode, target, urgent, reason };
  }

  function updateSeason(dt) {
    S.seasonT += dt;
    if (S.seasonT >= SEASON_SECONDS) {
      S.seasonT = 0;
      S.seasonPhase = (S.seasonPhase + 1) % 2;
      S.seasonPulse = 9;
      if (typeof logTerminal === 'function') {
        logTerminal(`SEASON SHIFT // 季節訊號切換至 0${S.seasonPhase + 1}；遷徙傾向升高 9 秒。`, 'warn');
      }
    }
    S.seasonPulse = Math.max(0, S.seasonPulse - dt);
  }

  function updateChallenge(dt) {
    if (!S.challenge || !S.challenge.active) return;
    const ch = S.challenge;
    ch.t += dt;
    const d = Math.hypot(cr.x - ch.target.x, cr.z - ch.target.z);
    if (d <= TRIAL_RADIUS) {
      finishTrial(true);
      return;
    }
    if (ch.t >= TRIAL_SECONDS || cr.energy <= 0.01) {
      finishTrial(false);
      return;
    }
    updateTrialText();
  }

  function startTrial() {
    if (S.challenge && S.challenge.active) return;
    if (!S.specimen) return;
    const a = Math.atan2(cr.z - vent.z, cr.x - vent.x) || 0;
    const startR = Math.min(CFG.arena - 90, 490);
    const sx = clamp(vent.x + Math.cos(a) * startR, -CFG.arena + 50, CFG.arena - 50);
    const sz = clamp(vent.z + Math.sin(a) * startR, -CFG.arena + 50, CFG.arena - 50);
    const target = {
      x: clamp(vent.x + Math.cos(a) * CFG.ventComfort, -CFG.arena + 50, CFG.arena - 50),
      z: clamp(vent.z + Math.sin(a) * CFG.ventComfort, -CFG.arena + 50, CFG.arena - 50)
    };

    S.challenge = {
      active: true,
      t: 0,
      duration: TRIAL_SECONDS,
      target,
      conditions: { airTemp: -6, ph: 4.8, duration: TRIAL_SECONDS, targetRadius: CFG.ventComfort },
      env: { AIR_TEMP: ENV.AIR_TEMP, PH_LEVEL: ENV.PH_LEVEL, GEYSER_PSI: ENV.GEYSER_PSI },
      energyStart: cr.energy
    };
    cr.x = sx;
    cr.z = sz;
    cr.a = Math.atan2(target.z - sz, target.x - sx);
    cr.v = 0;
    cr.startle = 0;
    cr.defensive = 0;
    cr.satisfied = 0;
    cr.dormant = false;
    cr.feedPoint = null;
    cr.energy = 70;
    if (typeof mats !== 'undefined') mats.length = 0;
    if (typeof crystals !== 'undefined') crystals.length = 0;
    ENV.eruptT = 0;
    ENV.GEYSER_PSI = 120;
    ENV.AIR_TEMP = -6;
    ENV.PH_LEVEL = 4.8;
    if (typeof syncEnvControls === 'function') syncEnvControls(true);
    S.growth = Math.max(S.growth, 0.72);
    applyGrowth();
    if (typeof logTerminal === 'function') {
      logTerminal('TRIAL // 熱梯度考驗開始：20 秒內抵達熱泉化學源；耐溫與腿長會影響表現。', 'warn');
    }
    updatePanels();
    updateTrialText();
  }

  function finishTrial(success) {
    if (!S.challenge || !S.challenge.active) return;
    const ch = S.challenge;
    ch.active = false;
    const elapsed = ch.t;
    const energy = clamp(cr.energy, 0, 100);
    const habitat = clamp(cr.habitat || 0, 0, 100);
    const timeScore = success ? clamp(100 - elapsed * 3.2, 0, 100) : 0;
    const score = Math.round(success
      ? clamp(timeScore * 0.55 + energy * 0.25 + habitat * 0.20, 0, 100)
      : clamp(energy * 0.35 + habitat * 0.15, 0, 55));

    const parent = S.specimen;
    const variant = S.pendingVariant;
    const child = makeChild(parent, variant, score);
    const variantLabel = VARIANTS[variant] ? VARIANTS[variant].label : VARIANTS.legs.label;
    const record = {
      generation: child.generation,
      parent: parent.id,
      childId: child.id,
      childSeed: child.seed,
      variant,
      variantLabel,
      success,
      score,
      elapsed: Number(elapsed.toFixed(1)),
      energy: Math.round(energy),
      conditions: ch.conditions || { airTemp: -6, ph: 4.8, duration: TRIAL_SECONDS, targetRadius: CFG.ventComfort },
      result: success ? 'PASS' : 'FAIL',
      at: Date.now()
    };
    S.records.unshift(record);
    S.records = S.records.slice(0, 8);

    S.specimen = child;
    S.growth = 0.32;
    S.exploreTarget = null;
    S.exploreT = 0;
    applySpecimen(child, S.growth);
    cr.x = 0;
    cr.z = 0;
    cr.a = 0;
    cr.v = 0;
    cr.energy = 72;
    cr.symbiosis = clamp(40 + score * 0.12, 0, 100);
    cr.habitat = 72;
    cr.satisfied = 1.2;

    if (ch.env) Object.assign(ENV, ch.env);
    if (typeof syncEnvControls === 'function') syncEnvControls(true);
    S.challenge = null;
    S.offline = null;
    chooseSurvival(0);

    if (typeof logTerminal === 'function') {
      logTerminal(`TRIAL ${success ? 'PASS' : 'FAIL'} // ${variantLabel} · SCORE ${score} · ${elapsed.toFixed(1)}s；子代 GEN ${String(child.generation).padStart(2, '0')} 已建立（選擇實驗）。`, success ? 'ok' : 'warn');
    }
    updatePanels();
    updateTrialText();
    saveState();
  }

  function onFeed(kind) {
    if (!S.specimen || typeof cr === 'undefined' || !cr) return;
    const t = S.specimen.traits;
    if (kind === 'mat') {
      cr.energy = clamp((cr.energy || 0) + 26 * t.chemAffinity, 0, 100);
      cr.symbiosis = clamp((cr.symbiosis || 0) + 22, 0, 100);
    } else {
      cr.energy = clamp((cr.energy || 0) + 18 * t.chemAffinity, 0, 100);
      cr.symbiosis = clamp((cr.symbiosis || 0) + 5, 0, 100);
    }
    cr.vitality = clamp((cr.energy || 0) * 0.45 + (cr.habitat || 0) * 0.35 + (cr.symbiosis || 0) * 0.20, 0, 100);
    updatePanels();
  }

  function reportOffline() {
    const saved = S.saved;
    if (!saved || !saved.lastSeen) return;
    const seconds = (Date.now() - saved.lastSeen) / 1000;
    if (seconds < 15) return;
    const before = cr.energy == null ? 66 : cr.energy;
    const drain = Math.min(45, seconds * 0.018);
    cr.energy = clamp(before - drain, 0, 100);
    cr.symbiosis = clamp((cr.symbiosis || 0) - Math.min(20, seconds * 0.002), 0, 100);
    S.offline = { seconds, before: Math.round(before), after: Math.round(cr.energy) };
    if (typeof logTerminal === 'function') {
      logTerminal(`OFFLINE // 離開 ${fmtTime(seconds)}；以時間差推算能量 ${S.offline.before}→${S.offline.after}%（模擬估計，非逐秒模擬）。`, 'sys');
    }
  }

  function updateVariantUi() {
    const grid = S.ui.variantGrid;
    if (!grid) return;
    grid.querySelectorAll('.variant-btn').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.variant === S.pendingVariant);
      btn.setAttribute('aria-pressed', String(btn.dataset.variant === S.pendingVariant));
    });
    if (S.ui.variantNote) S.ui.variantNote.textContent = VARIANTS[S.pendingVariant].note;
  }

  function updateTrialText() {
    const u = S.ui.trialStatus;
    if (!u) return;
    if (S.challenge && S.challenge.active) {
      const d = Math.hypot(cr.x - S.challenge.target.x, cr.z - S.challenge.target.z);
      u.textContent = `RUNNING // ${Math.max(0, TRIAL_SECONDS - S.challenge.t).toFixed(1)}s · 距離 ${Math.round(d)}u`;
      u.dataset.mode = 'active';
      if (S.ui.trialBtn) S.ui.trialBtn.disabled = true;
    } else {
      const last = S.records[0];
      u.textContent = last
        ? `LAST // GEN ${String(last.generation).padStart(2, '0')} ${last.result} · SCORE ${last.score} · ${last.elapsed}s`
        : 'READY // 20 秒內抵達熱泉化學源';
      u.dataset.mode = last ? (last.success ? 'pass' : 'fail') : 'ready';
      if (S.ui.trialBtn) S.ui.trialBtn.disabled = false;
    }
  }

  function updatePanels() {
    if (!S.specimen || !S.ui) return;
    const u = S.ui;
    const t = S.specimen.traits;
    if (u.specimenId) u.specimenId.textContent = S.specimen.id;
    if (u.specimenGeneration) u.specimenGeneration.textContent = 'GEN ' + String(S.specimen.generation).padStart(2, '0');
    if (u.specimenSeed) u.specimenSeed.textContent = fmtSeed(S.specimen.seed);
    if (u.specimenParent) u.specimenParent.textContent = S.specimen.parent || 'FOUNDER';
    if (u.traitBody) u.traitBody.textContent = `${rounded(t.body.hx)} × ${rounded(t.body.hy)} × ${rounded(t.body.hz)}`;
    if (u.traitLegs) u.traitLegs.textContent = `${rounded(t.legScale * 100)}%`;
    if (u.traitAntenna) {
      const segCount = (typeof chains !== 'undefined' && chains && chains[0] && chains[0].seg) ? chains[0].seg.length : (3 + Math.max(0, t.antennaDelta));
      u.traitAntenna.textContent = `${segCount} 節 · ${rounded(t.antennaScale * 100)}%`;
    }
    if (u.traitSpeed) u.traitSpeed.textContent = `${rounded(t.speed * 100)}%`;
    if (u.traitTemp) u.traitTemp.textContent = `${rounded(t.temp[0])}–${rounded(t.temp[1])}°C`;
    if (u.traitPh) u.traitPh.textContent = `${rounded(t.ph[0], 1)}–${rounded(t.ph[1], 1)}`;
    if (u.traitChem) u.traitChem.textContent = `${rounded(t.chemAffinity * 100)}%`;

    if (u.vitalValue) u.vitalValue.textContent = String(Math.round(cr.vitality || 0)).padStart(2, '0');
    if (u.vitalEnergy) u.vitalEnergy.textContent = String(Math.round(cr.energy || 0)).padStart(2, '0');
    if (u.vitalHabitat) u.vitalHabitat.textContent = String(Math.round(cr.habitat || 0)).padStart(2, '0');
    if (u.vitalSym) u.vitalSym.textContent = String(Math.round(cr.symbiosis || 0)).padStart(2, '0');
    if (u.vitalState) {
      const v = cr.vitality || 0;
      const mode = v > 68 ? 'ok' : v > 38 ? 'warn' : 'danger';
      u.vitalState.textContent = mode === 'ok' ? '穩定' : mode === 'warn' ? '警戒' : '危急';
      u.vitalState.dataset.mode = mode;
    }
    if (u.vitalBars) {
      const lit = Math.max(1, Math.ceil((cr.vitality || 0) / 20));
      [...u.vitalBars.querySelectorAll('b')].forEach((b, i) => { b.style.opacity = i < lit ? '1' : '.22'; });
    }
    if (u.energyBar) u.energyBar.style.width = clamp(cr.energy || 0, 0, 100) + '%';
    if (u.thermalTemp) u.thermalTemp.textContent = rounded(cr.localTemp == null ? ENV.AIR_TEMP : cr.localTemp, 1);
    if (u.drive) u.drive.textContent = cr.survival?.reason || 'EXPLORE';

    const progress = clamp(S.growth, 0, 1);
    if (u.growthStage) u.growthStage.textContent = progress < 0.28 ? 'PROPAGULE' : progress < 0.72 ? 'JUVENILE' : 'ADULT';
    if (u.growthBar) u.growthBar.style.width = (progress * 100).toFixed(1) + '%';
    if (u.growthTime) u.growthTime.textContent = progress >= 1 ? 'T+00:28 / 00:28 · 100%' : `T+${fmtTime(progress * GROWTH_SECONDS)} / 00:28 · ${Math.round(progress * 100)}%`;
    if (u.seasonBadge) u.seasonBadge.textContent = `SEASON 0${S.seasonPhase + 1}`;

    if (u.offlineReport) {
      u.offlineReport.textContent = S.offline
        ? `OFFLINE // 離開 ${fmtTime(S.offline.seconds)}；能量 ${S.offline.before}→${S.offline.after}%（時間差推算，模擬估計）`
        : 'OFFLINE // 尚無離線紀錄；關閉頁面後以時間差推算。';
    }

    if (u.lastChallenge) {
      const last = S.records[0];
      u.lastChallenge.textContent = last
        ? `CHALLENGE // ${last.conditions?.airTemp ?? -6}°C · pH ${last.conditions?.ph ?? 4.8} · ${last.result} · ${last.elapsed}s · SCORE ${last.score}`
        : 'CHALLENGE // 尚未進行熱梯度考驗';
    }

    if (u.generationLog) {
      const logKey = S.records.map(r => `${r.at || 0}:${r.generation}:${r.score}:${r.result}`).join('|');
      if (u._logKey !== logKey) {
        u._logKey = logKey;
        if (!S.records.length) {
          u.generationLog.innerHTML = '<div class="gen-empty">NO TRIAL YET // 尚無考驗紀錄</div>';
        } else {
          u.generationLog.innerHTML = S.records.slice(0, 5).map(r =>
            `<div class="gen-row ${r.success ? 'is-pass' : 'is-fail'}"><b>GEN ${String(r.generation).padStart(2, '0')} · ${r.result}</b><span>${r.variantLabel} · SCORE ${r.score} · ${r.elapsed}s</span><em>${r.conditions?.airTemp ?? -6}°C / pH ${r.conditions?.ph ?? 4.8} · 親代 ${r.parent} → 子代 ${r.childId}</em></div>`
          ).join('');
        }
      }
    }
    updateTrialText();
    updateVariantUi();
  }

  function initUi() {
    S.ui = {
      specimenId: $('specimenId'),
      specimenGeneration: $('specimenGeneration'),
      specimenSeed: $('specimenSeed'),
      specimenParent: $('specimenParent'),
      traitBody: $('traitBody'),
      traitLegs: $('traitLegs'),
      traitAntenna: $('traitAntenna'),
      traitSpeed: $('traitSpeed'),
      traitTemp: $('traitTemp'),
      traitPh: $('traitPh'),
      traitChem: $('traitChem'),
      variantGrid: $('variantGrid'),
      variantNote: $('variantNote'),
      trialBtn: $('trialBtn'),
      trialStatus: $('trialStatus'),
      generationLog: $('generationLog'),
      lastChallenge: $('lastChallenge'),
      offlineReport: $('offlineReport'),
      growthStage: $('growthStage'),
      growthBar: $('growthBar'),
      growthTime: $('growthTime'),
      seasonBadge: $('seasonBadge'),
      vitalValue: $('vitalValue'),
      vitalEnergy: $('vitalEnergy'),
      vitalHabitat: $('vitalHabitat'),
      vitalSym: $('vitalSym'),
      vitalState: $('vitalState'),
      vitalBars: $('vitalBars'),
      energyBar: $('energyBar'),
      thermalTemp: $('thermalTemp'),
      drive: $('drive')
    };

    S.ui.variantGrid?.querySelectorAll('.variant-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        S.pendingVariant = VARIANTS[btn.dataset.variant] ? btn.dataset.variant : 'legs';
        updateVariantUi();
        if (window.NF_AUDIO) window.NF_AUDIO.event('tick');
      });
    });
    S.ui.trialBtn?.addEventListener('click', () => {
      if (window.NF_AUDIO) window.NF_AUDIO.event('ui');
      startTrial();
    });
    $('replayGrowthBtn')?.addEventListener('click', () => {
      S.growth = 0.05;
      applyGrowth();
      updatePanels();
      saveState();
      if (typeof logTerminal === 'function') logTerminal('ONTOGENY // 重新播放 28 秒生長展示（繁殖體 → 幼體 → 成體）。', 'sys');
    });
    $('reseedBtn')?.addEventListener('click', () => {
      const seed = (Date.now() ^ Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0;
      S.specimen = makeSpecimen(seed);
      S.records = [];
      S.offline = null;
      S.growth = 0.05;
      S.seasonT = 0;
      S.seasonPhase = 0;
      S.seasonPulse = 0;
      S.exploreTarget = null;
      S.challenge = null;
      cr.energy = 66;
      cr.habitat = 70;
      cr.symbiosis = 30;
      cr.x = 0;
      cr.z = 0;
      cr.v = 0;
      cr.a = 0;
      cr.startle = 0;
      cr.defensive = 0;
      cr.satisfied = 0;
      cr.dormant = false;
      cr.feedPoint = null;
      applySpecimen(S.specimen, S.growth);
      chooseSurvival(0);
      updatePanels();
      saveState();
      if (typeof logTerminal === 'function') logTerminal(`RESEED // 新種子 ${fmtSeed(seed)}；個體檔案與世代紀錄已重置。`, 'ok');
    });
  }

  function init() {
    if (S.initialized) return;
    const saved = loadSaved();
    S.saved = saved;
    const params = new URLSearchParams(window.location.search);
    const urlSeed = parseInt(params.get('seed'), 10);
    const useUrlSeed = Number.isFinite(urlSeed) && urlSeed > 0;
    let spec;
    if (useUrlSeed) spec = makeSpecimen(urlSeed >>> 0);
    else if (saved && isValidSpecimen(saved.specimen)) spec = saved.specimen;
    else spec = makeSpecimen((Date.now() ^ Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0);

    const useSaved = !!(saved && !useUrlSeed);
    S.specimen = spec;
    S.records = useSaved && Array.isArray(saved.records) ? saved.records.slice(0, 8) : [];
    S.growth = useSaved ? clamp(Number(saved.growth ?? 0.05), 0, 1) : 0.05;
    if (useSaved && Number.isFinite(saved.seasonPhase)) S.seasonPhase = Math.abs(saved.seasonPhase) % 2;
    S.pendingVariant = VARIANTS[saved?.pendingVariant] ? saved.pendingVariant : 'legs';
    S.baseBody = { ...spec.traits.body };

    cr.energy = useSaved && Number.isFinite(saved.energy) ? clamp(saved.energy, 0, 100) : 66;
    cr.habitat = useSaved && Number.isFinite(saved.habitat) ? clamp(saved.habitat, 0, 100) : 70;
    cr.symbiosis = useSaved && Number.isFinite(saved.symbiosis) ? clamp(saved.symbiosis, 0, 100) : 30;
    cr.vitality = clamp(cr.energy * 0.45 + cr.habitat * 0.35 + cr.symbiosis * 0.20, 0, 100);
    cr.growth = S.growth;

    initUi();
    applySpecimen(spec, S.growth);
    S.initialized = true;
    if (saved && !useUrlSeed) reportOffline();
    updatePanels();
    saveState();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        saveState();
      } else {
        const latest = loadSaved();
        if (latest) {
          S.saved = latest;
          reportOffline();
          updatePanels();
        }
      }
    });
    window.addEventListener('pagehide', saveState);
    window.addEventListener('beforeunload', saveState);
  }

  function tick(dt) {
    if (!S.initialized || typeof cr === 'undefined' || !cr) return;
    if (S.growth < 1) S.growth = clamp(S.growth + dt / GROWTH_SECONDS, 0, 1);
    cr.growth = S.growth;
    applyGrowth();
    updateMetrics(dt);
    updateSeason(dt);
    updateChallenge(dt);
    chooseSurvival(dt);
    if (Date.now() - S.lastSave > 9000) saveState();
    if (Date.now() - S.lastPanel > 220) {
      S.lastPanel = Date.now();
      updatePanels();
    }
  }

  window.NF_ECO = {
    init,
    tick,
    onFeed,
    startTrial,
    saveState,
    get state() { return S; }
  };
})();
