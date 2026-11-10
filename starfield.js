/* starfield.js
 *
 * The spinning star that sits in the reel frame until the reel exists.
 * Rebuilt from Animation_5_Web.mov (Eight Sleep, 2026): a four point star
 * turning on its vertical axis over a drifting blue field.
 *
 * The field is a WebGL shader rather than CSS gradients on purpose. Colour is
 * mixed in linear light at float precision and dithered one step before the
 * framebuffer quantises it, which is the only way a ramp this wide and this
 * dark comes out without rings. A CSS gradient bands, and a noise overlay only
 * disguises it.
 *
 * No dependencies. If WebGL is missing the CSS fallback shows and the star
 * still turns.
 */
(function () {
  'use strict';

  var VERT = `
    attribute vec2 p;
    void main() { gl_Position = vec4(p, 0.0, 1.0); }
  `;

  var FRAG = `
    precision highp float;
    uniform vec2  uRes;
    uniform float uTime;

    // Everything in the field drifts off one clock, so a single multiplier
    // speeds the whole thing up without breaking the relationships between
    // the blobs. At 4.0 the slowest cycle is about 5s and the fastest under
    // 2s, so a 2 second look still reads as movement.
    const float SPEED = 4.0;

    // sRGB <-> linear. Mixing colour in linear light is what kills the
    // muddy hump that makes dark-blue sRGB ramps band.
    vec3 toLinear(vec3 c) {
      return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
    }
    vec3 toSRGB(vec3 c) {
      return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
    }

    // Interleaved gradient noise (Jimenez). Cheaper and far better distributed
    // than hash white noise - no clumping, no visible texture at 1/255.
    float ign(vec2 p) {
      return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
    }

    // Smooth, infinitely differentiable blob. No stop list, so no stop to band on.
    float blob(vec2 uv, vec2 c, vec2 r, float soft) {
      float d = length((uv - c) / r);
      return exp(-d * d * soft);
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / uRes;
      vec2 a  = vec2(uRes.x / uRes.y, 1.0);   // aspect-corrected space
      vec2 p  = uv * a;

      float t = uTime * SPEED;

      // base wash: dark top-right opening into bottom-left, as measured
      vec3 dark = toLinear(vec3(0.004, 0.024, 0.051));
      vec3 deep = toLinear(vec3(0.016, 0.133, 0.282));
      float diag = clamp((p.x / a.x) * 0.62 + (1.0 - uv.y) * 0.72 - 0.16, 0.0, 1.0);
      float wash = pow(1.0 - diag, 1.35);
      wash *= 0.62 + 0.38 * sin(t * 0.3927);        // 4s breath at SPEED 4
      vec3 col = mix(dark, deep, wash);

      // three drifting blobs, each on its own clock, added in linear light
      vec3 c1 = toLinear(vec3(0.051, 0.235, 0.494));
      vec3 c2 = toLinear(vec3(0.035, 0.188, 0.424));
      vec3 c3 = toLinear(vec3(0.086, 0.220, 0.463));

      vec2 b1 = vec2(0.18 + 0.20 * sin(t * 0.698), 0.26 + 0.14 * cos(t * 0.483));
      vec2 b2 = vec2(0.62 + 0.22 * cos(t * 0.483), 0.14 + 0.16 * sin(t * 0.322));
      vec2 b3 = vec2(0.46 + 0.18 * sin(t * 0.897), 0.72 + 0.15 * cos(t * 0.571));

      float s1 = 0.55 + 0.45 * sin(t * 0.698 + 1.1);
      float s2 = 0.50 + 0.50 * cos(t * 0.483 + 0.4);
      float s3 = 0.45 + 0.55 * sin(t * 0.897 + 2.3);

      col += c1 * blob(p, b1 * a, vec2(0.62, 0.52), 2.1) * 0.78 * s1;
      col += c2 * blob(p, b2 * a, vec2(0.74, 0.44), 2.4) * 0.60 * s2;
      col += c3 * blob(p, b3 * a, vec2(0.52, 0.48), 2.8) * 0.42 * s3;

      // hard ceiling: the field can never out-brighten the star (#335bb0).
      // Measured from the source: its brightest background pixel is #2e4e8c.
      vec3 ceil = toLinear(vec3(0.180, 0.306, 0.549));
      col = min(col, ceil);

      col = toSRGB(col);

      // Dither to 1 LSB BEFORE the framebuffer quantises. This is the step a
      // CSS gradient can never do, and the reason rings disappear instead of
      // being covered up by a noise overlay.
      float d = ign(gl_FragCoord.xy) - 0.5;
      col += d / 255.0;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function mount(root) {
    const canvas = root.querySelector('.starfield-canvas');
    if (!canvas) return function () {};

    var gl = canvas.getContext('webgl', {
      alpha: false, antialias: false, depth: false, stencil: false,
      powerPreference: 'low-power', preserveDrawingBuffer: false
    });
    if (!gl) return function () {};        /* CSS fallback stays visible */

    function compile(type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    }

    var vs = compile(gl.VERTEX_SHADER, VERT);
    var fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return function () {};

    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(prog));
      return function () {};
    }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var uRes = gl.getUniformLocation(prog, 'uRes');
    var uTime = gl.getUniformLocation(prog, 'uTime');

    /* Capped at 2. Past that it costs fill rate and looks the same. */
    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.round(canvas.clientWidth * dpr);
      var h = Math.round(canvas.clientHeight * dpr);
      if (!w || !h) return;                /* hidden: keep the buffer we have */
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, canvas.width, canvas.height);
    }

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    var running = true;
    var raf = 0;
    var stopped = false;
    var t0 = performance.now();

    /* The reel says where to join this piece, so a shot can start part way
       into the animation instead of wherever the clock happened to be. Both
       this and start() rebase, because they can arrive in either order. */
    var cueAt = null;
    function rebase() { t0 = performance.now() - (cueAt || 0); }
    function onCue(e) {
      cueAt = (e && e.detail && typeof e.detail.at === 'number') ? e.detail.at : 0;
      rebase();
    }
    root.addEventListener('piece:cue', onCue);

    function frame(now) {
      resize();
      gl.uniform1f(uTime, reduced.matches ? 6.0 : (now - t0) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (reduced.matches) { running = false; return; }   /* one still frame */
      if (!stopped) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    /* Stop painting when it is not on screen. */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        var visible = entries[0].isIntersecting;
        if (visible && !running && !reduced.matches) {
          running = true;
          raf = requestAnimationFrame(frame);
        } else if (!visible && running) {
          running = false;
          cancelAnimationFrame(raf);
        }
      }, { threshold: 0 }).observe(canvas);
    }

    /* See globe.js: the switcher fires a resize after showing a piece. */
    function onResizeNudge() {
      if (!canvas.clientWidth || !canvas.clientHeight) return;
      if (!running && !stopped && !reduced.matches) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    }
    window.addEventListener('resize', onResizeNudge);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running && !reduced.matches && !stopped) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    });

    return function stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      // NOTE: do not call loseContext() here. A lost context cannot be
      // reused, so remounting this piece would give a dead canvas. Stopping
      // the frame loop is enough - an idle context costs nothing.
    };
  }

  window.Pieces = window.Pieces || {};
  window.Pieces.star = { mount: mount };
})();
