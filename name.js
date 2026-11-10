/* name.js
 *
 * Hovering a name sends a swell of weight through it: the letters under the
 * cursor thicken and relax behind it.
 *
 * Each letter is genuinely redrawn at every step off the font's weight axis
 * rather than synthetically emboldened - a faux bold smears the stems and is
 * obvious at this size. The system stack carries a real axis here, which is
 * what lets the masthead name be set in the same face as everything else
 * around it and still animate; measured, it moves 9px of width across the
 * range at 17px.
 *
 * The one thing that matters and is easy to lose: the letters must not move.
 * Weight changes a glyph's advance, so every letter is measured once at the
 * base weight and pinned to that width. Without the pin the name reflows under
 * the cursor and the whole thing reads as broken rather than as alive.
 *
 * Every name on the page gets this, not one. It used to take the first match
 * only, which was fine while the masthead name was the page's one <h1> - then
 * the markup changed to a <p class="wordmark"> so the project title could be
 * the only <h1>, the selector stopped matching, and the masthead name quietly
 * lost its animation altogether.
 *
 * No dependencies.
 */
(function () {
  'use strict';

  var LIFT = 120;          /* how far over its base weight a letter swells */
  var REACH = 0.9;         /* of one letter's width, either side */
  var CHASE = 150;         /* ms for a letter to reach its target weight */

  var calm = window.matchMedia &&
             window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var noHover = window.matchMedia &&
                window.matchMedia('(hover: none)').matches;

  function enhance(h1) {
    /* The name is wrapped in a link wherever it is the way home. The split
       empties its host, so the host has to be the link itself — emptying the
       element would throw the anchor away with the text. */
    var host = h1.querySelector('a') || h1;

    var BASE = parseInt(window.getComputedStyle(h1).fontWeight, 10) || 400;
    var PEAK = BASE + LIFT;

    var word = host.textContent.replace(/\s+/g, ' ').trim();
    if (!word) return;

    var letters = [];

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

    var raf = 0, pointerX = null, lastT = 0, reach = 24;

    function measure() {
      letters.forEach(function (l) {
        l.el.style.width = '';
        l.el.style.fontVariationSettings = "'wght' " + BASE;
        l.el.style.fontWeight = BASE;
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
         letter's own width instead made the falloff depend on how wide the
         glyph is, so an i sat in a trough between its neighbours and the wave
         came out notched rather than smooth. */
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
        /* Both, because which one a family answers to depends on whether it
           exposes a variable axis or a set of discrete weights. */
        l.el.style.fontVariationSettings = "'wght' " + Math.round(l.w);
        l.el.style.fontWeight = Math.round(l.w);
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

    /* On a phone there is no cursor to carry the swell, so the scroll does it —
     * and only for the big name at the foot of the index, which is the one you
     * arrive at by scrolling. The small one in the masthead is already at the
     * top of the page before any scrolling happens, so there is no gesture
     * there to drive it with.
     *
     * Tilt was the other way to do this, and it is worse: iOS will not report
     * orientation without a permission prompt raised from a tap, so the effect
     * would sit invisible behind a gesture nobody knows to make. Scroll needs
     * no permission and no discovery.
     */
    if (noHover && !calm && h1.classList.contains('hero-name')) {
      var ticking = false;

      var fromScroll = function () {
        ticking = false;
        var box = host.getBoundingClientRect();

        /* The sweep has to happen WHILE the name is on screen.
         *
         * Two mappings were wrong before this one. Against the name's trip up
         * the viewport it never finished, because the name sits at the foot of
         * the page and you hit the bottom of the scroll with it halfway up -
         * measured, the progress only moved between 0.49 and 0.53. Against the
         * document's whole scroll range it finished too early: by the time you
         * had scrolled far enough to SEE the name, the swell had already left
         * past its last letter, so arriving at the bottom of the page showed
         * nothing happening at all.
         *
         * So the range is the scroll between the name first peeking over the
         * bottom edge and the end of the page. That is exactly the stretch
         * during which it is in front of you, and the swell crosses the word
         * across it.
         */
        var max = document.documentElement.scrollHeight - window.innerHeight;
        if (max <= 0) { pointerX = null; wake(); return; }

        var y = window.pageYOffset;
        var appears = y + box.top - window.innerHeight;
        var span = max - appears;
        var p = span > 0 ? (y - appears) / span : 1;
        if (p < 0) p = 0;
        if (p > 1) p = 1;
        /* Overshoot a little at both ends so the swell arrives from off the
           first letter and leaves past the last, instead of starting and
           stopping inside the word. */
        pointerX = (p * 1.4 - 0.2) * box.width;
        wake();
      };

      window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(fromScroll);
      }, { passive: true });

      fromScroll();
    }

    measure();
    window.addEventListener('resize', measure);
  }

  var names = document.querySelectorAll('.hero-name, .wordmark');
  for (var n = 0; n < names.length; n++) enhance(names[n]);
}());
