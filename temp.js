/* temp.js
 *
 * The temperature picker from Eight Sleep's onboarding, rebuilt in code and
 * turned on its side: the source is a 4:5 phone screen, this is landscape.
 *
 * Nothing here is a video. The ruler, the handle, the labels and the tint are
 * all DOM and CSS, driven by one number - the position in detents either side
 * of neutral. Everything else is derived from it, so the whole piece is one
 * value moving on a timeline.
 *
 * The timeline is measured off the source clip rather than invented. Sampling
 * the background's red-minus-blue every 100ms gives the shape: it sits at
 * neutral, eases cold and peaks at 2.7s, comes back through neutral at 5.1s,
 * runs warm and peaks at 7.4s, and is home by 9.5s. A 10.3s loop with real
 * holds at each end, which is what stops it feeling like a metronome.
 */
(function () {
  'use strict';

  var LOOP = 6060;           /* ms */
  var MAJOR = 5;             /* every fifth tick is tall */
  var STEP  = MAJOR;         /* labels sit on majors, so they cannot drift */
  var SPAN  = STEP * 2;      /* detents from neutral to either extreme */
  var LABELS = ['Cold', 'Cool', 'Neutral', 'Warm', 'Hot'];

  /* Ease out, extended: cubic-bezier(0.22, 1, 0.36, 1), the standard
     easeOutQuint curve, solved per frame.
     
     It replaces a hand-rolled version that eased the first 18% and ran linear
     after. That looked fine written down but was glitchy: smoothstep reaches
     zero velocity at its end, so the move stalled at 18% and then snapped
     back to full speed. A bezier has no seam to stall at. */
  var BX1 = 0.22, BY1 = 1, BX2 = 0.36, BY2 = 1;

  function bez(a, b, t) {
    var u = 1 - t;
    return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
  }

  function ease(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    /* Find the curve parameter whose x is t, then read its y. Bisection:
       cheap, and dependable where Newton can stall on a flat tangent. */
    var lo = 0, hi = 1, p = t;
    for (var i = 0; i < 18; i++) {
      p = (lo + hi) / 2;
      if (bez(BX1, BX2, p) < t) lo = p; else hi = p;
    }
    return bez(BY1, BY2, p);
  }

  /* [time ms, value]. Value is -1 coldest, +1 hottest. Equal-length moves
     with real holds at each end. */
  var KEYS = [
    [0, 0], [260, 0], [1340, -1], [1820, -1],
    [2900, 0], [3160, 0], [4240, 1], [4720, 1],
    [5800, 0], [6060, 0]
  ];

  function valueAt(ms) {
    for (var i = 0; i < KEYS.length - 1; i++) {
      var a = KEYS[i], b = KEYS[i + 1];
      if (ms >= a[0] && ms <= b[0]) {
        if (a[1] === b[1]) return a[1];
        return a[1] + (b[1] - a[1]) * ease((ms - a[0]) / (b[0] - a[0]));
      }
    }
    return 0;
  }

  function build(root) {
    var scene = document.createElement('div');
    scene.className = 'temp-scene';

    scene.innerHTML =
      '<div class="temp-copy">' +
        '<h2>How do you like your bed when you get in?</h2>' +
        '<p class="temp-chip">' +
          '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 0.5 C6.1 3 7.9 4.8 10.4 4.9 C7.9 5 6.1 6.8 6 9.3 C5.9 6.8 4.1 5 1.6 4.9 C4.1 4.8 5.9 3 6 0.5 Z"/></svg>' +
          '<span>How preferences set benchmarks</span>' +
        '</p>' +
      '</div>' +
      '<div class="temp-grain"></div>' +
      '<div class="temp-rule">' +
        '<div class="temp-ticks"><div class="temp-track"></div></div>' +
        '<div class="temp-well"></div>' +
        '<div class="temp-handle"></div>' +
      '</div>' +
      '<div class="temp-names"><div class="temp-labels"></div></div>';

    /* Ticks run well past the frame on both sides so the ruler never shows an
       end while it travels. Every fifth one is tall, as in the source. */
    var track = scene.querySelector('.temp-track');
    var reach = SPAN * 2 + 24;
    for (var i = -reach; i <= reach; i++) {
      var tick = document.createElement('i');
      if (i % MAJOR === 0) tick.className = 'is-major';
      tick.style.left = 'calc(' + i + ' * var(--detent))';
      track.appendChild(tick);
    }

    var labels = scene.querySelector('.temp-labels');
    LABELS.forEach(function (text, i) {
      var el = document.createElement('span');
      el.textContent = text;
      /* Spread the five names evenly across the travel. */
      el.dataset.at = (i - 2) * STEP;
      el.style.left = 'calc(' + ((i - 2) * STEP) + ' * var(--detent))';
      labels.appendChild(el);
    });

    root.appendChild(scene);
    return scene;
  }

  function mount(root) {
    var scene = root.querySelector('.temp-scene') || build(root);
    var track = scene.querySelector('.temp-track');
    var labels = scene.querySelector('.temp-labels');
    var names = Array.prototype.slice.call(labels.children);

    var raf = 0, stopped = false, paused = false, t0 = performance.now();

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
      var v = valueAt((now - t0) % LOOP);
      var shift = 'translateX(calc(' + (-v * SPAN).toFixed(4) + ' * var(--detent)))';

      track.style.transform = shift;
      labels.style.transform = shift;

      /* The tint is the same number. Cold pulls blue, hot pulls red, and the
         middle is the base black rather than a muddy mix of the two. */
      /* The name under the handle is the reading, so it carries full weight
         and the others fall away with distance. */
      var at = v * SPAN;
      names.forEach(function (el) {
        var d = Math.abs(Number(el.dataset.at) - at) / STEP;
        el.style.opacity = Math.max(0.18, 1 - d * 0.62).toFixed(3);
      });

      scene.style.setProperty('--v', v.toFixed(4));
      scene.style.setProperty('--cold', Math.max(0, -v).toFixed(4));
      scene.style.setProperty('--warm', Math.max(0, v).toFixed(4));

      /* Neutral has its own colour, so it needs its own strength: full in the
         middle, gone by either end. Eased so the purple lingers across the
         middle of the range instead of only existing at exactly zero. */
      var mid = Math.max(0, 1 - Math.abs(v));
      scene.style.setProperty('--mid', (mid * mid * (3 - 2 * mid)).toFixed(4));

      if (!stopped && !paused) raf = requestAnimationFrame(frame);
    }

    function start() { if (!paused || stopped) return; paused = false; raf = requestAnimationFrame(frame); }
    function stop() { if (paused) return; paused = true; cancelAnimationFrame(raf); }

    /* The observer's first callback can land after layout with a stale
       "not intersecting", which parked the loop for good: it arrived after
       the switcher's resize nudge, so nothing ever restarted it. Verify
       against a real measurement before believing a false. */
    function onScreen(entry) {
      if (entry.isIntersecting) return true;
      if (scene.offsetParent === null) return false;
      var r = scene.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
    }

    var io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (e) {
        if (onScreen(e[0]) && !document.hidden) start(); else stop();
      }, { threshold: 0 });
      io.observe(scene);
    }

    function onVisibility() { if (document.hidden) stop(); else if (scene.offsetParent !== null) start(); }
    function onResize() { if (scene.clientWidth) start(); }

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('resize', onResize);
    raf = requestAnimationFrame(frame);

    return function teardown() {
      root.removeEventListener('piece:cue', onCue);
      stopped = true;
      cancelAnimationFrame(raf);
      if (io) io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
    };
  }

  window.Pieces = window.Pieces || {};
  window.Pieces.temperature = { mount: mount };
})();
