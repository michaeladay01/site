/* name.js
 *
 * Hovering the name sends a swell of weight through it: the letters under the
 * cursor thicken and relax behind it.
 *
 * Inter's weight axis is a real axis, so each letter is genuinely redrawn at
 * every step rather than synthetically emboldened - a faux bold smears the
 * stems and is obvious at this size.
 *
 * The one thing that matters and is easy to lose: the letters must not move.
 * Weight changes a glyph's advance, so every letter is measured once at the
 * base weight and pinned to that width. Without the pin the name reflows under
 * the cursor and the whole thing reads as broken rather than as alive.
 *
 * No dependencies.
 */
(function () {
  'use strict';

  var h1El = document.querySelector('.masthead h1, .hero-name');
  var BASE = h1El && h1El.classList.contains('hero-name') ? 700 : 450;
  var PEAK = 820;
  var REACH = 0.9;         /* of one letter's width, either side */
  var CHASE = 150;         /* ms for a letter to reach its target weight */

  /* The masthead name on inner pages, or the big sign-off on the home page. */
  var h1 = document.querySelector('.masthead h1, .hero-name');
  if (!h1) return;

  /* On an inner page the name is the way back, so it is wrapped in a link.
     The split empties its host, so the host has to be the link itself —
     emptying the h1 would throw the anchor away with the text. */
  var host = h1.querySelector('a') || h1;

  var word = host.textContent.replace(/\s+/g, ' ').trim();
  var letters = [];

  (function split() {
    host.textContent = '';
    for (var i = 0; i < word.length; i++) {
      var ch = word[i];
      var el = document.createElement('span');
      el.className = 'ltr';
      /* A real space would collapse against an inline-block, and the name has
         to keep its one space. */
      el.textContent = ch === ' ' ? ' ' : ch;
      host.appendChild(el);
      letters.push({ el: el, w: BASE, want: BASE, mid: 0 });
    }
  })();

  var raf = 0, pointerX = null, lastT = 0, reach = 24;

  function measure() {
    letters.forEach(function (l) {
      l.el.style.width = '';
      l.el.style.fontVariationSettings = "'wght' " + BASE;
    });
    /* Read every width before writing any of them back, or each write
       invalidates the layout the next read needs. */
    var box = host.getBoundingClientRect();
    var rects = letters.map(function (l) { return l.el.getBoundingClientRect(); });
    var total = 0;
    letters.forEach(function (l, i) {
      l.el.style.width = rects[i].width + 'px';
      l.mid = rects[i].left + rects[i].width / 2 - box.left;
      total += rects[i].width;
    });
    /* One reach for the whole name, off the average letter. Dividing by each
       letter's own width instead made the falloff depend on how wide the glyph
       is, so an i sat in a trough between its neighbours and the wave came out
       notched rather than smooth. */
    reach = Math.max(8, total / letters.length * REACH * 2.2);
  }

  function wave(now) {
    var dt = lastT ? Math.min(64, now - lastT) : 16;
    lastT = now;
    var k = Math.min(1, dt / CHASE);
    var moving = false;

    letters.forEach(function (l) {
      if (pointerX === null) l.want = BASE;
      else {
        var d = Math.abs(pointerX - l.mid) / reach;
        l.want = BASE + (PEAK - BASE) * Math.exp(-d * d);
      }
      l.w += (l.want - l.w) * k;
      if (Math.abs(l.want - l.w) > 0.5) moving = true;
      l.el.style.fontVariationSettings = "'wght' " + Math.round(l.w);
    });

    if (moving || pointerX !== null) raf = requestAnimationFrame(wave);
    else { raf = 0; lastT = 0; }
  }

  function wake() { if (!raf) raf = requestAnimationFrame(wave); }

  h1.addEventListener('pointermove', function (e) {
    pointerX = e.clientX - host.getBoundingClientRect().left;
    wake();
  });

  h1.addEventListener('pointerleave', function () {
    pointerX = null;
    wake();
  });

  /* On a phone there is no cursor to carry the swell, so the scroll does it.
   *
   * The name sits at the foot of the index, which means you arrive at it by
   * scrolling - and that scroll is already a gesture with a position in it.
   * Mapping how far the name has travelled up the viewport onto the same
   * pointerX the cursor would have set sweeps the swell across the letters as
   * the name comes into view, using the effect that is already written rather
   * than a second one beside it.
   *
   * Tilt was the other way to do this, and it is worse: iOS will not report
   * orientation without a permission prompt raised from a tap, so the effect
   * would sit invisible behind a gesture nobody knows to make. Scroll needs
   * no permission and no discovery.
   *
   * Only where there is no hover, so the cursor keeps the desktop behaviour
   * untouched, and never against the reduced-motion preference.
   */
  var noHover = window.matchMedia && window.matchMedia('(hover: none)').matches;
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (noHover && !calm) {
    var ticking = false;

    function fromScroll() {
      ticking = false;
      var box = host.getBoundingClientRect();

      /* Progress through the DOCUMENT, not through the viewport.
         The obvious mapping - how far the name has risen up the screen - does
         not work for this name, because it sits at the very foot of the page:
         you reach the bottom of the scroll with it still only halfway up, so
         it never completes the journey and the swell travelled about four
         percent of the word and stopped. Measured: p only ever moved between
         0.49 and 0.53. Against the document's own scroll range the sweep is
         always complete, and it ends exactly where the name does. */
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 0) { pointerX = null; wake(); return; }
      var p = window.pageYOffset / max;
      if (p < 0) p = 0;
      if (p > 1) p = 1;
      /* Overshoot a little at both ends so the swell arrives from off the
         first letter and leaves past the last, instead of starting and
         stopping inside the word. */
      pointerX = (p * 1.4 - 0.2) * box.width;
      wake();
    }

    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(fromScroll);
    }, { passive: true });

    fromScroll();
  }

  measure();
  window.addEventListener('resize', measure);
})();
