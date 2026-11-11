---
name: Neon Fauna Performance
description: Optimize and verify the p5.js WEBGL NEON FAUNA prototype without lowering visual quality. Use for draw-call/FPS work, batching, renderer changes, and visual regression checks.
---

# NEON FAUNA Performance & Visual Regression

## Scope

Use this skill for performance work in this project:

- `index.html`
- `sketch.js`
- `ecology.js`
- `style.css`
- `vendor/p5.min.js`
- `fonts/`

The app is a p5.js WEBGL prototype. Do not treat it as a generic canvas demo: the creature, telemetry deck, terminal, camera, and environmental state machine are part of the product.

Read `references/visual-policy.md` before changing renderer or batching code.

## Hard constraints

1. Do not lower `pixelDensity` below `1`.
2. Do not disable antialiasing.
3. Do not remove lights, particles, the telemetry deck, terminal, or HUD.
4. Keep the `frameRate(30)` cap unless the user explicitly asks to change it.
5. Keep `setAttributes(...)` before `createCanvas(...)`; calling it after canvas creation detaches the canvas from `#stage`.
6. Keep all assets local: `vendor/p5.min.js` and `fonts/`.
7. Use `QUADS` for box faces. `TRIANGLES` introduced a visible lighting seam on the body.
8. Preserve draw order for transparent objects. Only batch additive particles when order does not affect the result.
9. Do not change layouts, fonts, panel opacity, or terminal behavior as a performance shortcut.
10. If a change creates a visible difference, revert it before trying a lower-risk batch.

## Baseline

Measured on 2026-11-12 with the canvas at `972 × 540`, `pixelDensity(1)`:

- Idle / curious: about **192 WebGL draw calls per frame** with a few footprints and the thermal field visible
- Adult / migrating: about **209 draw calls per frame** with active movement and footprints
- Earlier pre-ecology baseline (2026-11-04, `972 × 440`): **115–184 draw calls** idle and about **302** during an eruption
- Frame cap: 30 FPS

The thermal field adds 9 filled bands plus 6 gradient rings, and the vent adds 2 microbial rings. These are intentional ecology visuals; optimize only if the measured calls rise above the eruption baseline. These are measurements, not targets. Re-measure after every change.

Already batched:

- `ring()` line loops
- `octa()` edges
- creature glow spokes
- box faces and edges in `obox()` / `segBox()`
- vent steam particles by alpha/color bucket

Still expensive:

- eruption spheres and plume
- footprints (`rect()` per layer)
- cross-box geometry merging
- transparent objects that cannot be reordered safely

## Workflow

### 1. Establish a baseline

Run a local server from this directory:

```powershell
python -m http.server 8770 --bind 127.0.0.1
```

Open `http://127.0.0.1:8770/index.html`, then run `scripts/draw-call-counter.js` in the browser console or through the browser tool.

Record:

- draw calls per frame
- JS/frame time
- canvas size
- `pixelDensity()`
- state: idle, feeding, eruption, reduced motion
- browser and renderer if available

Do not change code before recording the baseline.

### 2. Locate the actual hot spot

Use the counter and inspect the call sites. Typical candidates:

- `drawEruptionPlume()` — spheres
- `drawFootprints()` — three `rect()` calls per print
- `drawMats()` — many small spheres
- `drawVent()` — cylinders, rings, particles, microbial marker rings
- `drawThermalField()` — 9 filled bands plus 6 gradient rings
- `drawChain()` / `segBox()` — many small box parts
- `drawCrystals()` — spheres and rings

Prefer a small number of high-confidence batches over a large speculative rewrite.

### 3. Choose the lowest-risk batch

Order of preference:

1. Batch inside one object (same transform, same color, same order).
2. Batch identical primitives that share a transform.
3. Batch additive particles by color/alpha bucket.
4. Only then consider retained `p5.Geometry`, instancing, or cross-object merging.

Never merge transparent objects across depth order unless the blend mode is additive and order is irrelevant.

### 4. Verify visuals

Use a fixed viewport and a fixed state. Compare before/after screenshots around:

- body face shading and edge lines
- leg and antenna segment joints
- vent steam and eruption plume
- footprints and floor rings
- telemetry deck and terminal
- fonts and panel layout

For box faces, verify old vs new shading. Do not rely on “it looks fine” at a different camera angle.

### 5. Smoke test

Test both HTTP and `file://` loading. Check the console is clean. Run:

```text
sonar
feed gold
blizzard
acid
erupt
reset
```

Also verify:

- mouse tracking and camera orbit
- canvas resize and `fitStage()`: canvas backing size matches `#stage` client size
- the ecology HUD is updating (`ENERGY`, `HABITAT`, `SYMBIONT`, `VITAL`, `DRIVE`, `ONTOGENY`)
- `?seed=12345` reproduces the same starting traits and starts at `PROPAGULE`
- the selection trial completes and writes conditions/result to the generation record
- reduced-motion toggle
- terminal input and command history
- no detached canvas or `loop is not defined` errors
- no console errors after resize, trial completion, or offline-return reporting

### 6. Report

Use this shape:

```text
Baseline: X calls/frame, Y ms/frame
After:    X calls/frame, Y ms/frame
Visual:   [what was compared]
Smoke:    [commands and modes tested]
Remaining:[known hot spots]
```

Do not claim an FPS increase when the app is capped at 30 FPS. Describe reduced frame time, fewer drops, lower CPU/GPU submission cost, or lower heat instead.

## Supporting files

- `references/visual-policy.md` — renderer and visual invariants
- `scripts/draw-call-counter.js` — browser-side draw-call counter

Supporting files are not loaded automatically. Read them only when the task needs them.
