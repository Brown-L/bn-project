/**
 * NEON FAUNA draw-call counter.
 *
 * Usage:
 *   1. Open index.html in a browser.
 *   2. Paste this file into the console.
 *   3. It defines window.__neonFaunaMeasure(frames) and runs it once.
 *
 * The counter wraps WebGL draw calls for a manual frame burst. It measures
 * JavaScript + draw-call submission time, not full GPU time, so treat
 * msPerFrame as a relative comparison, not an FPS guarantee.
 */
(() => {
  window.__neonFaunaMeasure = function (frames = 5) {
    const canvas = document.querySelector('#stage canvas') || document.querySelector('canvas');
    if (!canvas) throw new Error('NEON FAUNA canvas not found');

    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) throw new Error('WebGL context not found');

    if (typeof draw !== 'function') throw new Error('p5 draw() not found');
    if (!Number.isInteger(frames) || frames < 1) frames = 5;

    const names = [
      'drawArrays',
      'drawElements',
      'drawArraysInstanced',
      'drawElementsInstanced',
    ];
    const originals = {};
    let calls = 0;

    for (const name of names) {
      if (typeof gl[name] !== 'function') continue;
      originals[name] = gl[name];
      gl[name] = function (...args) {
        calls++;
        return originals[name].apply(this, args);
      };
    }

    const wasLooping = typeof isLooping === 'function' ? isLooping() : false;
    if (typeof noLoop === 'function') noLoop();

    // Warm up shader compilation and particle buffers before measuring.
    for (let i = 0; i < 3; i++) draw();

    let result;
    try {
      const t0 = performance.now();
      for (let i = 0; i < frames; i++) draw();
      const elapsed = performance.now() - t0;

      result = {
        callsPerFrame: +(calls / frames).toFixed(1),
        msPerFrame: +(elapsed / frames).toFixed(2),
        frames,
        cssSize: `${typeof width === 'number' ? width : canvas.clientWidth} x ${typeof height === 'number' ? height : canvas.clientHeight}`,
        bufferSize: `${canvas.width} x ${canvas.height}`,
        pixelDensity: typeof pixelDensity === 'function' ? pixelDensity() : null,
      };
      console.table(result);
    } finally {
      for (const name of Object.keys(originals)) gl[name] = originals[name];
      if (wasLooping && typeof loop === 'function') loop();
    }

    return result;
  };

  return window.__neonFaunaMeasure();
})();
