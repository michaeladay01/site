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

  measure();
  window.addEventListener('resize', measure);
})();
