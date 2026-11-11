# NEON FAUNA Visual & Performance Policy

## Non-negotiable visual invariants

- Keep `pixelDensity(1)` or higher. Never reduce it to gain FPS.
- Keep antialiasing enabled.
- Keep the existing camera orbit, 4-leg 2-bone IK, 6-chain FABRIK antennae, floor ripples, vent, thermal-field gradient, telemetry deck, and terminal.
- Preserve the creature’s blocky box silhouette. Growth may change proportions but must not replace the boxes with a realistic animal mesh.
- Keep the vent’s heat-to-cold gradient, inorganic chemical-source rings, and microbial marker rings readable against the floor.
- Keep the current palette and fonts:
  - cyan `#19F2FF` / `#33f5f4`
  - pink `#FF2E93`
  - amber `#FFB800`
  - background `#070912`
  - Orbitron, DM Mono, Noto Sans TC
- Keep all assets local. No CDN or Google Fonts.
- Do not remove `backdrop-filter` from any panel that still needs it, and do not reintroduce it without measuring.

## Box-batching rule

Use `beginShape(QUADS)` when batching box faces.

Do **not** replace box faces with `beginShape(TRIANGLES)` just to reduce draw calls. In this project it creates a visible diagonal lighting seam on the body. If a future p5 version fixes that, verify with a fixed-camera pixel comparison before changing the rule.

## Transparency and ordering

- Preserve object draw order for normal alpha blending.
- Additive particles (`blendMode(ADD)`) are order-independent and can be grouped by color/alpha.
- Do not merge transparent meshes across different depth layers without checking overlap.
- Footprints use variable alpha and stroke width; batching them needs either instancing or per-vertex alpha/width handling. Do not approximate them casually.

## Performance policy

- The app is capped at 30 FPS. A performance change may reduce frame time, heat, drops, or input latency without increasing displayed FPS.
- Measure draw calls before and after.
- Prefer per-object batching first. Cross-object merging is a later step.
- Avoid per-frame allocations in hot loops.
- Do not add a new library or a Three.js/regl rewrite for a small optimization.

## Visual comparison checklist

Use the same viewport and state for before/after captures.

- Body: face shading, edge lines, inner amber frame, antenna joints.
- Legs: box edges, knee cubes, footprint placement.
- Vent: rings, steam color/alpha, plume shape, green/cyan microbial rings.
- Thermal field: 9 bands and 6 rings, visible temperature falloff from the vent.
- Eruption: plume density, particle brightness, ring expansion.
- Floor: grid, ripples, shadows.
- Growth: propagule/juvenile/adult body proportions, leg attachment points, antenna length; no detached hips.
- HUD/deck: panel opacity, text, fonts, button states, ecology metrics, growth stage/time, trial conditions/results.
- Terminal: command output, input, history.

A body-face pixel comparison at a fixed `elapsed` value is a useful regression test for `obox()` and `segBox()` changes.

## Smoke-test matrix

| Area | Check |
| --- | --- |
| Loading | `http://127.0.0.1:8770/index.html` and `file://` |
| Console | no errors or warnings caused by the change |
| Terminal | `sonar`, `feed gold`, `blizzard`, `acid`, `erupt`, `reset` |
| Input | mouse tracking, click, long-press, double-click |
| Layout | resize, deck open/close, mobile width, growth HUD inside right readout |
| Ecology | dynamic energy/habitat/symbiont/vital, `DRIVE` reason, growth stage/time |
| Selection | variant choice, trial condition/result record, child traits and mutation |
| Motion | reduced-motion toggle |
| Lifecycle | tab hide/show, offline estimate label, no `loop is not defined` |
