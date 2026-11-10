/* Thermostat — the Eight Sleep temperature card, recut horizontal.

   The source is Animation_4_Web: a 4K render of a phone standing on the Pod,
   7.033s, looping clean. This is the card out of the phone and laid across a
   16:9 ground. No device frame, no bed, no composite — the card was always the
   only thing moving in that shot.

   What the recut changes. In the original the three detents (Now / Night /
   Dawn) are a cramped row across a 393px screen and the reading sits under
   them. Here the detents run the full width along the bottom, which is the one
   element of the card that was already horizontal and was only ever short of
   room, and the reading takes the open field above them. Nothing is scaled up
   from the phone layout; it is re-set for the measure.

   One clock. Everything on screen is a function of `n`, the target in detents,
   and `n` is a function of time. The tint, the detent, the target line and
   the digits all read the same number, so there is nothing to keep in sync.

   The timeline is measured, not invented. Sampling the big number every 250ms
   across the clip gives 28 readings:

     0 +1 +1 +2 +3 +4 +4 | +3 +3 +2 +1 0 0 | -1 -2 -2 -3 -4 -5 -5 -5 | -4 -3 -2 -1 -1 0 0

   which is a counter running at a steady ~300ms a step with real holds at each
   end. This does not run flat: every leg is eased on the page's --ease-in-out,
   which spends 625ms on the first step of a four step leg and 285ms on the
   last. That costs time - the legs are half as long again as the source's and
   the loop runs 10.55s against 7.03s - because on the original leg lengths an
   extended curve has nowhere to put the easing but the middle, and squeezes
   the middle steps to under 100ms. The 28 readings above are the record of
   what the original did, not of what this does.

   There is no drifting highlight. An earlier pass had one, read off the phone
   render; the only white ellipse in the SVG is at cy=582, which is below this
   card and belongs to the alarms block. The pool easing between its three
   measured states is the whole of the light.

   The palette is sampled off the same file rather than picked, at the warm
   peak (1.5s), the rest state (0.0s / 6.9s) and the cool peak (4.6s), three
   bands down the card each time. Those nine values are the --therm-* tokens.  */

(function () {
  'use strict';

  var LOOP = 10550;     /* ms */
  var COLD = -5;        /* the two ends of the dial, as measured */
  var WARM = 4;

  /* ms the leaving digit takes to go, matching .therm-digit.is-out in the
     stylesheet - only used to know when the node can be dropped. The two
     halves of a change are not symmetric: the old digit leaves in 70ms and
     the new one arrives over 100ms behind a 60ms delay, so they are never both
     legible at once. 160ms in all, inside the 180ms tightest step. */
  var SWAP = 70;

  /* [time ms, value in detents]. Eased between, flat where equal.

     The legs are longer than the source's. They have to be: a leg holds only
     four or five steps, and the more a curve is extended the more of its span
     goes to the ends, so on the source's 1500ms legs an extended curve put the
     middle steps 70-95ms apart - the burst that made an earlier pass read as
     frantic. Easing is bought with time or not at all. At 2000ms for a four
     step leg and 2350ms for a five, --ease-in-out leaves no step shorter than
     180ms while still giving 625ms to the first and 285ms to the last.

     The holds are the source's, scaled by the same factor. The loop is 10.55s
     against the original's 7.03s, which is the whole price of the easing. */
  var KEYS = [
    [0, 0], [2000, WARM], [2200, WARM], [4200, 0], [4550, 0],
    [6900, COLD], [7600, COLD], [9950, 0], [10550, 0]
  ];

  /* The still frame for prefers-reduced-motion. The cool peak: it is the most
     characteristic moment in the clip and the only one where every element is
     at an extreme, so the piece still says what it is. */
  var STILL = 7200;

  /* The page's own --ease-in-out, cubic-bezier(0.65, 0, 0.35, 1), as a
     function. Named on :root already, so the count and every transition in the
     stylesheet are provably one curve and the piece adds no curve of its own.

     Two earlier passes got this wrong in opposite directions, both worth
     keeping on the record. --ease-out is extended but one-sided: it opens at
     6.25x its average rate, putting the first two digits of a leg 32 and 74ms
     apart against 234 for the last, which reads as a burst and a stall. The
     correction overshot - a near-symmetric S at 0.4,0.1,0.6,0.9 held the leg
     to a 1.3:1 spread, so even that it read as a mechanism rather than a
     movement. This sits between them at 3.5:1, eased hard at both ends and
     brisk in the middle, which is what an extended ease is supposed to feel
     like.

     CSS cannot drive the count: a transition would restart on every digit, and
     what has to be eased is the leg as a whole. Solved by bisection - cheap,
     and dependable where Newton can stall on a flat tangent. */
  var BX1 = 0.65, BY1 = 0, BX2 = 0.35, BY2 = 1;

  function bez(a, b, p) {
    var u = 1 - p;
    return 3 * u * u * p * a + 3 * u * p * p * b + p * p * p;
  }

  function ease(x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    var lo = 0, hi = 1, p = x;
    for (var i = 0; i < 18; i++) {
      p = (lo + hi) / 2;
      if (bez(BX1, BX2, p) < x) lo = p; else hi = p;
    }
    return bez(BY1, BY2, p);
  }

  /* The ground is a shader, not CSS gradients, for the same reason the star
     field is one: a ramp this wide and this dark bands in 8-bit sRGB, and a
     noise overlay only disguises the rings. Three things here that CSS cannot
     do - mix in linear light at float precision, run a falloff with no stop
     list in it to band on, and dither one step before the framebuffer
     quantises.

     It also removes a seam rather than hiding it. The CSS version ended its
     ramp on `transparent`, and where that met the card there was a tonal step
     from #1d1a20 down to #0a0a0a - the grey line. Here the falloff lands on
     the card's own colour exactly, with a zero tangent, so there is no edge to
     see at any bit depth. */
  var VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }';

  var FRAG = [
    'precision highp float;',
    'uniform vec2 uRes;',
    'uniform float uV;',      /* -1 cold .. +1 warm */

    /* The nine measured values, plus the card. sRGB, converted below. */
    'const vec3 CARD = vec3(0.0392,0.0392,0.0392);',
    'const vec3 RG = vec3(0.5216,0.4039,0.6706), RM = vec3(0.3451,0.2706,0.4392), RT = vec3(0.1137,0.1020,0.1255);',
    'const vec3 WG = vec3(0.6824,0.2000,0.2824), WM = vec3(0.4431,0.1333,0.1843), WT = vec3(0.1255,0.0863,0.0941);',
    'const vec3 CG = vec3(0.1686,0.3373,0.7843), CM = vec3(0.1059,0.2196,0.5059), CT = vec3(0.0824,0.0980,0.1333);',

    /* Mixing in linear light is what kills the muddy hump that makes dark
       ramps band in the first place. */
    'vec3 toLinear(vec3 c){ return mix(c/12.92, pow((c+0.055)/1.055, vec3(2.4)), step(0.04045,c)); }',
    'vec3 toSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4))-0.055, step(0.0031308,c)); }',

    /* Interleaved gradient noise (Jimenez) - better distributed than a hash,
       no clumping and no visible texture at 1/255. */
    'float ign(vec2 p){ return fract(52.9829189*fract(dot(p, vec2(0.06711056,0.00583715)))); }',

    'float smoothk(float x){ x = clamp(x,0.0,1.0); return x*x*(3.0-2.0*x); }',

    /* Cubic Bezier through the four colours. A curve, not a stop list: there
       is no knot anywhere in it for a ring to form on, and at e=1 it arrives
       on CARD with a zero tangent because the smoothstep feeding it flattens
       there. That is the seam, gone by construction. */
    'vec3 ramp(vec3 a, vec3 b, vec3 c, vec3 d, float e){',
    '  float u = 1.0-e;',
    '  return u*u*u*a + 3.0*u*u*e*b + 3.0*u*e*e*c + e*e*e*d;',
    '}',

    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / uRes;',
    '  uv.y = 1.0 - uv.y;',                 /* CSS orientation: y down */

    /* The same ellipse the CSS had: 82% x 64%, centred at 50% / 106%. */
    '  float d = length((uv - vec2(0.5,1.06)) / vec2(0.82,0.64));',
    '  float e = smoothk(d/0.94);',

    '  float w = smoothk(uV), c = smoothk(-uV);',
    '  vec3 g = mix(mix(toLinear(RG), toLinear(WG), w), toLinear(CG), c);',
    '  vec3 m = mix(mix(toLinear(RM), toLinear(WM), w), toLinear(CM), c);',
    '  vec3 tp= mix(mix(toLinear(RT), toLinear(WT), w), toLinear(CT), c);',

    '  vec3 col = toSRGB(ramp(g, m, tp, toLinear(CARD), e));',

    /* Dither to 1 LSB BEFORE the framebuffer quantises. This is the step a
       CSS gradient can never take, and the reason the rings go rather than
       get covered up. */
    '  col += (ign(gl_FragCoord.xy) - 0.5) / 255.0;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* Returns a draw(v), or null if WebGL is missing - in which case the CSS
     gradients underneath stay visible and the piece simply bands a little. */
  function field(canvas) {
    var gl = canvas.getContext('webgl', {
      alpha: false, antialias: false, depth: false, stencil: false,
      powerPreference: 'low-power', preserveDrawingBuffer: false
    });
    if (!gl) return null;

    function compile(type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return sh;
      console.error(gl.getShaderInfoLog(sh));
      return null;
    }

    var vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;

    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(prog));
      return null;
    }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var uRes = gl.getUniformLocation(prog, 'uRes');
    var uV = gl.getUniformLocation(prog, 'uV');

    /* Capped at 2: past that it costs fill rate and looks the same. */
    return function draw(v) {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.round(canvas.clientWidth * dpr);
      var h = Math.round(canvas.clientHeight * dpr);
      if (!w || !h) return;                 /* hidden: keep the buffer we have */
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uV, v);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
  }

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  /* Smoothstep. Used on the colour only, so the purple sits across the middle
     of the range instead of existing at exactly zero. */
  function smooth(t) { return t * t * (3 - 2 * t); }

  function targetAt(ms) {
    for (var i = 0; i < KEYS.length - 1; i++) {
      var a = KEYS[i], b = KEYS[i + 1];
      if (ms >= a[0] && ms <= b[0]) {
        if (a[1] === b[1]) return a[1];
        return a[1] + (b[1] - a[1]) * ease((ms - a[0]) / (b[0] - a[0]));
      }
    }
    return 0;
  }

  /* The value the current leg is heading for: the far end of the ramp being
     travelled, or the held value when the clock is sitting in a hold. */
  function legEndAt(ms) {
    for (var i = 0; i < KEYS.length - 1; i++) {
      var a = KEYS[i], b = KEYS[i + 1];
      if (ms >= a[0] && ms <= b[0]) return b[1];
    }
    return 0;
  }

  function sign(n) { return n > 0 ? '+' + n : String(n); }

  function build(frame) {
    frame.innerHTML =
      '<div class="therm-ground" aria-hidden="true">' +
        '<canvas class="therm-field"></canvas>' +
        '<i class="therm-rest"></i><i class="therm-warm"></i><i class="therm-cool"></i>' +
      '</div>' +

      '<p class="therm-eyebrow" aria-hidden="true">Temperature' +
        '<svg viewBox="0 0 8 12"><path d="M1.5 1 L6.5 6 L1.5 11" fill="none" ' +
          'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" ' +
          'stroke-linejoin="round"/></svg>' +
      '</p>' +

      '<div class="therm-read" aria-hidden="true">' +
        '<p class="therm-state">Currently at</p>' +
        '<div class="therm-dial">' +
          '<i class="therm-key"></i>' +
          '<div class="therm-value"></div>' +
          '<i class="therm-key is-plus"></i>' +
        '</div>' +
        '<p class="therm-target"></p>' +
      '</div>' +

      '<div class="therm-tabs" aria-hidden="true">' +
        '<div class="therm-tab is-live"><b></b><s></s><em>Now</em></div>' +
        '<div class="therm-tab"><b class="is-cool">-4</b><s></s><em>Night</em></div>' +
        '<div class="therm-tab"><b class="is-warm">+4</b><s></s><em>Dawn</em></div>' +
      '</div>';
  }

  function mount(frame) {
    /* The piece tags its own root, so it does not care whether it was handed a
       reel-frame piece on the site or a lab frame on the scratch page. */
    frame.classList.add('therm-frame');
    build(frame);

    var value  = frame.querySelector('.therm-value');
    var target = frame.querySelector('.therm-target');
    var live   = frame.querySelector('.therm-tab.is-live b');

    var raf = 0, running = false, t0 = 0;

    /* The reel says where to join this piece, so a shot can start part way
       into the animation instead of wherever the clock happened to be. Both
       this and start() rebase, because they can arrive in either order. */
    var cueAt = null;
    function rebase() { t0 = performance.now() - (cueAt || 0); }
    function onCue(e) {
      cueAt = (e && e.detail && typeof e.detail.at === 'number') ? e.detail.at : 0;
      rebase();
    }
    frame.addEventListener('piece:cue', onCue);
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    /* A digit change is a handover with a little vertical drift, as in the
       source - the old number leaves the way the new one arrives, so a run of
       steps reads as one continuous travel rather than a flicker per step.

       Both places a number changes get one of these: the reading and the Now
       detent, which in the clip count in lockstep. Sampling the two at 4fps
       across the loop gives the same curve, so they are one value shown twice
       and there is no second thing to keep in step. */
    function swapper(host, cls) {
      var shown = null;

      function set(n, animate) {
        if (n === shown) return;

        var el = document.createElement('span');
        el.textContent = sign(n);
        el.className = cls + (animate ? ' is-in' : '');
        /* Direction of travel, so counting down drifts down. */
        if (animate && shown !== null) el.dataset.dir = n < shown ? 'down' : 'up';

        /* Every digit already in the cell leaves, not just one. Taking
           firstChild here was a bug worth naming: at the top of a leg the
           steps land closer together than a fade lasts, so the cell can hold
           three, and firstChild is the oldest of them - the digit actually on
           screen kept its full opacity and sat behind the new one while an
           invisible one was faded out instead. */
        var outgoing = Array.prototype.slice.call(host.children);
        host.appendChild(el);

        if (animate) {
          /* Next frame, or the element has no start state to transition from. */
          requestAnimationFrame(function () { el.classList.remove('is-in'); });
        }

        outgoing.forEach(function (o) {
          if (!animate) { o.remove(); return; }
          o.dataset.dir = el.dataset.dir;
          o.classList.remove('is-in');
          o.classList.add('is-out');
          setTimeout(function () { o.remove(); }, SWAP);
        });

        shown = n;
      }

      set.started = function () { return shown !== null; };
      set.reset = function () { shown = null; };
      return set;
    }

    var reading = swapper(value, 'therm-digit');
    var detent = swapper(live, 'therm-tabnum');

    /* The shader paints from this piece's own clock rather than running a loop
       of its own, so there is still one clock and the ground cannot drift out
       of step with the number driving it. */
    var paint = field(frame.querySelector('.therm-field'));
    if (paint) frame.classList.add('is-shaded');

    function render(ms) {
      var t = targetAt(ms);
      var n = Math.round(t);               /* -2.5 rounds to -2, as the clip does */

      var to = legEndAt(ms);
      var animate = reading.started();

      reading(n, animate);
      /* Now carries the reading, not the setpoint. An earlier pass had it show
         the leg's destination, on the strength of the SVG - where Now is -8
         while the bed is at -7. That is one still frame of a card mid-change;
         across the clip the detent counts with the number, and pinning it to
         the destination meant it jumped to the far end and sat there for the
         rest of the leg with nothing to show. */
      detent(n, animate);

      /* Tint. Warm and cool are opacities on two measured gradients; the rest
         state underneath is what shows through at neutral, so the middle of
         the range is the card's own purple rather than a muddy mix. */
      var v = t / (t < 0 ? -COLD : WARM);  /* -1..+1, each end normalised */
      frame.style.setProperty('--v', v.toFixed(4));
      frame.style.setProperty('--warm', smooth(clamp01(v)).toFixed(4));
      frame.style.setProperty('--cool', smooth(clamp01(-v)).toFixed(4));
      /* The live detent's colour is a mix of the two ends rather than a switch
         between them: in the clip its zero is plainly purple, not white and
         not either end. 0 is all cool, 1 all warm, so 0.5 is the blend. */
      frame.style.setProperty('--mix', ((v + 1) / 2).toFixed(4));

      if (paint) paint(v);

      /* The line under the number names where the bed is going, not where it
         is: in the SVG CURRENTLY AT sits above the reading and COOLING TO -8
         below it, so the big number is the bed's temperature and this is its
         destination. It settles on the far end of the leg as soon as the leg
         starts, which is what puts the two values an interval apart. */
      target.textContent =
        (to < n ? 'Cooling to ' : to > n ? 'Warming to ' : 'Holding at ') + sign(to);
    }

    function frameLoop(now) {
      render((now - t0) % LOOP);
      if (running) raf = requestAnimationFrame(frameLoop);
    }

    function start() {
      if (running || reduced.matches) return;
      running = true;
      rebase();
      raf = requestAnimationFrame(frameLoop);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    function apply() {
      stop();
      reading.reset();
      detent.reset();
      /* Paint one frame synchronously before anything is allowed to park the
         loop. Mounted off screen, the observer's first callback lands before
         the first animation frame does, so without this the dial sits empty
         until it is scrolled to - and then fills in, which is worse than
         either state on its own. */
      render(reduced.matches ? STILL : 0);
      if (!reduced.matches) start();
    }

    /* The observer's first callback carries the record it took at observe
       time, and it can be delivered after the page has already scrolled. Taken
       at face value that stale "not intersecting" parks the loop for good:
       nothing changes afterwards, so nothing fires again to restart it. Same
       trap temp.js hit. Only a false needs checking - a true cannot be wrong
       in the direction that matters. */
    function onScreen(entry) {
      if (entry.isIntersecting) return true;
      if (frame.offsetParent === null) return false;
      var r = frame.getBoundingClientRect();
      return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;
    }

    var observer = null;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (reduced.matches) return;
          if (onScreen(e) && !document.hidden) start(); else stop();
        });
      }, { threshold: 0.05 });
      observer.observe(frame);
    }

    function onVisibility() {
      if (document.hidden) stop();
      else if (frame.offsetParent !== null && !reduced.matches) start();
    }

    /* The switcher fires a resize after it un-hides a piece. A piece built
       while hidden has never been able to measure itself - and this one has a
       canvas, which means it is still at the default buffer size - so this is
       what gets it going on the first switch. The observer alone is not
       enough: it may have nothing new to report. */
    function onResizeNudge() {
      if (!frame.clientWidth || reduced.matches) return;
      start();
    }

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('resize', onResizeNudge);
    (reduced.addEventListener ? reduced.addEventListener('change', apply)
                              : reduced.addListener(apply));
    apply();

    /* The site mounts pieces through a registry and keeps them alive, so mount
       has to hand back everything it started. */
    return function teardown() {
      frame.removeEventListener('piece:cue', onCue);
      stop();
      if (observer) observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResizeNudge);
      (reduced.removeEventListener ? reduced.removeEventListener('change', apply)
                                   : reduced.removeListener(apply));
    };
  }

  /* The site mounts pieces through this registry and keeps them alive. The
     scratch page has no registry and just auto-mounts anything marked up for
     it. */
  window.Pieces = window.Pieces || {};
  window.Pieces.thermostat = { mount: mount };

  function init() {
    Array.prototype.forEach.call(
      document.querySelectorAll('[data-thermostat]'), mount
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
