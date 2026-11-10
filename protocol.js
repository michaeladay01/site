/* Protocol — a checklist that works through itself.

   After an Eight Sleep piece that ran 4:5 for social. This is the horizontal
   recut, trimmed to the middle four steps: the column is set to a landscape
   measure and anchored a third of the way down the frame instead of centred.
   At four steps the list fits the frame and the travel mostly falls away —
   the clamp centres it rather than scrolling a list that has nowhere to go.

   Three things move and they are deliberately out of phase:

     the ring     draws clockwise from twelve over the item's whole beat
     the words    come up to full ink one at a time across the same beat,
                  slightly ahead of the ring so the line finishes reading
                  before it is ticked
     the column   slides so the active row keeps its anchor, easing on its own
                  curve so the scroll never lands on the tick

   Nothing is stored as a keyframe. Every value is a function of one clock, so
   the piece can be scrubbed, reversed or paused on any frame.

   DOM rather than canvas on purpose: this is type, and the browser sets type
   better than we can. The ring is the only drawn thing and it is one SVG
   circle with a dash offset.  */

(function () {
  'use strict';

  /* Four of the source's nine. The clip opens on the flight-data line and
     closes on the three that spell out the finished schedule, and both ends
     are scene setting — the middle four are the ones that read as the thing
     actually working. Trimmed rather than sped up: the beat is measured off
     the source and is the one thing here worth keeping exactly. */
  var STEPS = [
    'Mapping timezones so we can anticipate your shift',
    'Syncing your body clock with your travel schedule',
    'Calibrating your rhythm to smooth out the transition',
    'Fine-tuning your wake window for easier adjustment'
  ];

  var BEAT = 1500;        /* ms per step, measured off the source cut */
  var SETTLE = 1400;      /* ms the finished list holds before it loops */
  var WORDS_LEAD = 0.82;  /* words finish at this fraction of the beat */
  /* The connector is a wipe, not a fade: sampling the source down a one pixel
     column, the segment holds a flat value the whole time its length grows, so
     it is drawn rather than brought up. 0.45s of the 1.5s beat. */
  var LINK_DRAW = 0.3;
  var LINK_GAP = 6;       /* px of air between a bullet's EDGE and its segment */
  var HORIZON = 1.5;      /* steps ahead over which a row comes up from nothing */
  var WORDS_FALL = 0.22;  /* fraction of a beat a ticked line takes to dim */
  /* The column holds still and then moves, rather than easing the whole beat.
     Tracking the source frame by frame, it sits dead still for about two
     seconds and then travels in roughly 100ms on a hard ease out — the steps
     measured 7, 7, 5, 4, 1, 1 px. Spreading that move across the beat is what
     made this feel like it was dragging: the list was never once at rest. */
  var SCROLL_MOVE = 0.28;    /* 420ms, but 83% of it inside the first 125ms */
  /* The seam. Everything in this piece runs off one clock, so when that clock
     wraps the whole thing resets on a single frame — the column jumps back the
     height of the list and all nine rings empty at once. Measured, that was a
     495px jump. So the last of the settle takes the list out and the first of
     the opening step brings it back, and the reset happens while there is
     nothing on screen to see it happen to. */
  var VEIL_OUT = 620;
  var VEIL_IN = 520;
  var R = 11;             /* ring radius, px — the rest of the row sizes off it */
  var C = 2 * Math.PI * R;

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  /* Writing a style property costs whether or not the value changed, and most
     of what this piece draws is at rest on any given frame — rows past the
     horizon, words on lines that are not the active one, and the column
     itself for most of each beat. So every write goes through here, which
     quantises to the smallest step that is visible and then skips the write
     if nothing moved. */
  function putOpacity(el, value, cache, key) {
    var v = Math.round(value * 1000) / 1000;
    if (cache[key] === v) return;
    cache[key] = v;
    el.style.opacity = String(v);
  }

  /* The site's ease-out as a function. Keeping it here rather than handing the
     work to CSS transitions is what lets one clock drive all three channels. */
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }          /* 0.16,1,0.3,1 */
  /* The travel curve. Quintic rather than cubic, over a window three times as
     long: the move still lands most of its distance in the first eighth of a
     second, so it keeps the attack the source has, but the last few pixels
     take the rest of the window to arrive. The tail is the point — the column
     is still settling under the tick rather than having parked before it. */
  function easeOutLong(t) { return 1 - Math.pow(1 - t, 5); }

  var SVG = 'http://www.w3.org/2000/svg';

  function ring() {
    var s = document.createElementNS(SVG, 'svg');
    s.setAttribute('class', 'protocol-mark');
    s.setAttribute('viewBox', '0 0 32 32');
    s.setAttribute('aria-hidden', 'true');

    /* The track is the unfilled part of the ring. It never animates; the arc
       rides over it. */
    var track = document.createElementNS(SVG, 'circle');
    track.setAttribute('class', 'protocol-track');
    track.setAttribute('cx', '16'); track.setAttribute('cy', '16');
    track.setAttribute('r', String(R));

    var disc = document.createElementNS(SVG, 'circle');
    disc.setAttribute('class', 'protocol-disc');
    disc.setAttribute('cx', '16'); disc.setAttribute('cy', '16');
    disc.setAttribute('r', String(R + 3));

    var arc = document.createElementNS(SVG, 'circle');
    arc.setAttribute('class', 'protocol-arc');
    arc.setAttribute('cx', '16'); arc.setAttribute('cy', '16');
    arc.setAttribute('r', String(R));
    arc.setAttribute('stroke-dasharray', C + ' ' + C);
    arc.setAttribute('stroke-dashoffset', String(C));

    var tick = document.createElementNS(SVG, 'path');
    tick.setAttribute('class', 'protocol-tick');
    tick.setAttribute('d', 'M10.5 16.2 14.3 20 21.5 12.6');

    s.appendChild(track); s.appendChild(disc); s.appendChild(arc); s.appendChild(tick);
    return { svg: s, arc: arc };
  }

  function mount(frame) {
    /* The piece tags its own root, so it does not care whether it was handed
       a reel-frame piece on the site or a lab frame on the scratch page. */
    frame.classList.add('protocol-frame');

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    var col = document.createElement('div');
    col.className = 'protocol-col';

    /* One live region for the whole list. Reading nine rows of changing state
       to a screen reader is noise; the current step is the only news. */
    var live = document.createElement('p');
    live.className = 'protocol-live';
    live.setAttribute('aria-live', 'polite');

    var rows = STEPS.map(function (text) {
      var row = document.createElement('div');
      row.className = 'protocol-row';

      /* The segment belongs to the row it leaves, not to the gap it sits in:
         that is what makes it lead to the next bullet rather than just fill
         space between two of them. */
      var link = document.createElement('i');
      link.className = 'protocol-link';
      row.appendChild(link);

      var mark = ring();
      row.appendChild(mark.svg);

      var p = document.createElement('p');
      p.className = 'protocol-text';
      var words = text.split(' ').map(function (w, i, all) {
        var span = document.createElement('span');
        span.textContent = i === all.length - 1 ? w : w + ' ';
        p.appendChild(span);
        return span;
      });
      row.appendChild(p);
      col.appendChild(row);

      return { el: row, arc: mark.arc, link: link, words: words,
               top: 0, mid: 0, seen: {} };
    });

    frame.appendChild(col);
    frame.appendChild(live);

    /* Row geometry is whatever the browser decided — rows are one or two lines
       depending on the measure, so the scroll reads it back rather than
       assuming a fixed step. Re-read on resize, and on the font load that
       follows first paint. */
    var colH = 0, frameH = 0, anchorPx = 0;
    var lastY = null, lastVeil = null;

    function measure() {
      /* Measure with the transform off. Every rect below is read from the
         live layout, and the anchor in particular is meant to be where CSS
         puts the column, not where the clock has currently dragged it — read
         through a transform it folds the scroll back into itself and drifts
         further on every re-measure. The site dispatches a resize on each
         piece switch, so that drift was compounding. */
      var held = col.style.transform;
      col.style.transform = 'none';

      var cb = col.getBoundingClientRect();
      var fb = frame.getBoundingClientRect();
      frameH = fb.height;
      anchorPx = cb.top - fb.top;   /* where the CSS anchor put the column */

      rows.forEach(function (r) {
        var b = r.el.getBoundingClientRect();
        var m = r.el.querySelector('.protocol-mark').getBoundingClientRect();
        r.top = b.top - cb.top;
        r.height = b.height;
        /* The row anchors on its bullet, not its box: rows are one or two
           lines deep, and a two line row centred on its box would sit the
           bullet off the rail. */
        r.mid = (m.top - cb.top) + m.height / 2;
        /* Relative to the row, which is what the segment is positioned
           against — not to the column, which carries padding in the still
           layout and would throw the line off the bullets there. */
        r.markX = (m.left - b.left) + m.width / 2 - 0.5;
        /* Clearance is the bullet's own radius plus a little air. Taking it
           from the measured bullet rather than a constant is what keeps the
           line out of the circle once the bullet scales with the type. */
        r.clear = m.height / 2 + LINK_GAP;
      });
      colH = rows[rows.length - 1].top + rows[rows.length - 1].height;

      /* The scrims exist to fade a list that runs past the top and bottom of
         the frame. Trimmed to four steps the list fits inside the reel well
         and nothing crosses an edge, so they would just be veiling the first
         and last step for nothing — at 20% a side that was 40% of the frame.
         Full bleed on the scratch page it still overflows and they come back. */
      frame.classList.toggle('is-contained', colH <= frameH);

      /* Each segment runs from its own bullet down to the next one, less a
         little air at both ends. Measured rather than expressed in CSS because
         the row pitch depends on how the copy wrapped. */
      rows.forEach(function (r, i) {
        var next = rows[i + 1];
        if (!next) { r.link.style.display = 'none'; return; }
        r.link.style.left = r.markX + 'px';
        r.link.style.top = (r.mid - r.top + r.clear) + 'px';
        r.link.style.height = Math.max(0, (next.mid - r.mid) - r.clear - next.clear) + 'px';
      });

      col.style.transform = held;
      lastY = null;         /* the next draw must rewrite it, not match cache */
    }

    var total = STEPS.length * BEAT + SETTLE;
    var said = -1;

    function draw(ms) {
      var t = ms / BEAT;
      var active = Math.floor(t);
      var local = clamp01(t - active);

      rows.forEach(function (r, i) {
        var done = i < active;
        var on = i === active;

        /* Ring. Done rows hold a full arc under the disc; the arc only reads as
           motion on the active row. */
        var dash = done ? 0 : on ? C * (1 - easeOut(local)) : C;
        if (r.seen.dash !== (dash = Math.round(dash * 100) / 100)) {
          r.seen.dash = dash;
          r.arc.setAttribute('stroke-dashoffset', String(dash));
        }

        /* Words. Each one crosses from dim to full over a slice of the beat,
           and the slices overlap so the line reads as a wipe rather than a
           row of separate switches. */
        var n = r.words.length;
        /* A line that has just been ticked releases its ink over the start of
           the next beat instead of dropping on one frame. Snapping it back was
           the loudest thing in the loop — a flash down the whole line every
           time a step landed. */
        var fade = i === active - 1 ? 1 - easeOut(clamp01(local / WORDS_FALL)) : 0;
        for (var w = 0; w < n; w++) {
          var lit;
          if (on) {
            var span = WORDS_LEAD / n;
            lit = clamp01((local - (w / n) * WORDS_LEAD) / (span * 1.9));
          } else {
            lit = fade;                /* dim, or on its way there */
          }
          putOpacity(r.words[w], 0.34 + 0.66 * lit, r.seen, 'w' + w);
        }

        /* Connector. It grows downward out of this row's bullet and lands on
           the next one, at full value the whole way — a wipe, so the eye is
           led rather than told. */
        var grown = Math.round(easeOut(done ? 1 : on ? clamp01(local / LINK_DRAW) : 0) * 1000) / 1000;
        if (r.seen.link !== grown) {
          r.seen.link = grown;
          r.link.style.transform = 'scaleY(' + grown + ')';
        }

        r.el.classList.toggle('is-done', done);
        r.el.classList.toggle('is-active', on);
        /* Rows ahead fall away towards a horizon, so the list does not end in
           a hard edge. Distance is measured against the continuous clock, not
           the step index: on whole steps every row changes tier on the same
           frame and the whole column blinks at once. Measured this way each
           row comes up on its own, over the three beats before its turn. */
        var ahead = Math.max(0, i - (active + local));
        var near = clamp01(1 - ahead / HORIZON);
        putOpacity(r.el, near * near * (3 - 2 * near), r.seen, 'row');
      });

      /* Scroll. The column eases between the row it is leaving and the row it
         is on, on its own curve, so it is still settling as the tick lands. */
      var from = rows[Math.max(0, Math.min(active, rows.length - 1))];
      var to = rows[Math.max(0, Math.min(active + 1, rows.length - 1))];
      var y = from.mid + (to.mid - from.mid) * easeOutLong(clamp01(local / SCROLL_MOVE));

      /* Then held so the list cannot pull away from either end of the frame.
         Without this the first steps leave the bottom half empty and the last
         ones leave the top half empty, which is the void rather than the
         piece. Larger y means more scrolled, so the floor is the opening
         position and the ceiling is the last row sitting on the bottom edge.
         A list shorter than the frame has nowhere to go and simply centres —
         which is the case at four steps in the reel well, so there the piece
         ticks in place rather than scrolling a list that already fits. */
      var lo = rows[0].mid;                /* first step at the anchor */
      var hi = anchorPx + colH - frameH;   /* last step on the bottom edge */
      y = colH > frameH ? Math.max(lo, Math.min(hi, y))
                        : anchorPx + colH / 2 - frameH / 2;

      if (lastY !== (y = Math.round(y * 100) / 100)) {
        lastY = y;
        col.style.transform = 'translate3d(0, ' + (-y) + 'px, 0)';
      }

      /* Out at the end of the settle, back in over the opening step. */
      var veil = 1;
      if (ms > total - VEIL_OUT) veil = (total - ms) / VEIL_OUT;
      else if (ms < VEIL_IN) veil = ms / VEIL_IN;
      veil = easeOut(clamp01(veil));
      if (lastVeil !== (veil = Math.round(veil * 1000) / 1000)) {
        lastVeil = veil;
        col.style.opacity = String(veil);
      }

      if (active !== said && active >= 0 && active < STEPS.length) {
        said = active;
        live.textContent = STEPS[active];
      }
    }

    function still() {
      /* Reduced motion gets the end of the story, not a frozen middle of it:
         every step ticked, the whole list legible, no transform. The still
         layout goes on first, because it moves the column out of the anchored
         position the connectors would otherwise be measured against. */
      col.classList.add('is-still');
      frame.classList.add('is-still');
      measure();
      rows.forEach(function (r) {
        r.seen = {};
        r.arc.setAttribute('stroke-dashoffset', '0');
        r.link.style.transform = 'scaleY(1)';
        r.words.forEach(function (s) { s.style.opacity = '1'; });
        r.el.classList.add('is-done');
        r.el.classList.remove('is-active');
        r.el.style.opacity = '1';
      });
      col.style.transform = 'none';
      col.style.opacity = '1';
      lastY = null;
      lastVeil = null;
      live.textContent = STEPS[STEPS.length - 1];
    }

    /* One elapsed figure rather than a start stamp, so pausing and resuming
       picks the loop up where it stopped instead of snapping to the top. */
    var raf = 0, elapsed = 0, last = 0;

    /* The reel says where to join this piece, so a shot can start part way
       into the animation instead of wherever the clock happened to be. Both
       this and start() rebase, because they can arrive in either order. */
    var cueAt = null;
    function rebase() { elapsed = (cueAt || 0); }
    function onCue(e) {
      cueAt = (e && e.detail && typeof e.detail.at === 'number') ? e.detail.at : 0;
      rebase();
      /* This clock accumulates rather than reading an absolute stamp, so the
         gap between start() and the cue would be added on top of the in point
         by the very next tick - which is the jump. Re-stamp it here. */
      last = performance.now();
      /* And land on the in point as a cut. The disc and the ticks carry CSS
         transitions, so without this they travel to the new state and the
         first half second of the shot is the piece catching up with itself. */
      frame.classList.add('is-cut');
      draw(elapsed);
      requestAnimationFrame(function () { frame.classList.remove('is-cut'); });
    }
    frame.addEventListener('piece:cue', onCue);
    function tick(now) {
      /* A frame timestamp can predate the moment start() stamped the clock,
         which would run elapsed negative — and a negative modulo stays
         negative in JS, which lands on step -1 and draws a frame with nothing
         active at all. Every resume was flashing one of those. */
      var dt = now - last;
      elapsed = (elapsed + (dt > 0 ? dt : 0)) % total;
      last = now;
      draw(elapsed);
      raf = requestAnimationFrame(tick);
    }

    function start() {
      if (raf) return;
      measure();
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
    function stop() {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }
    function rewind() { elapsed = 0; }

    function apply() {
      stop();
      rewind();
      col.classList.remove('is-still');
      frame.classList.remove('is-still');
      if (reduced.matches) still(); else start();
    }

    /* Off-screen the piece is not worth a frame budget. On the site a hidden
       piece is display:none and so never intersects, which parks it for free
       when another piece is showing. */
    var io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (reduced.matches) return;
          if (e.isIntersecting) start(); else stop();
        });
      }, { threshold: 0.05 });
      io.observe(frame);
    }

    window.addEventListener('resize', measure);
    document.fonts && document.fonts.ready.then(measure);
    (reduced.addEventListener ? reduced.addEventListener('change', apply)
                              : reduced.addListener(apply));

    apply();

    return function teardown() {
      frame.removeEventListener('piece:cue', onCue);
      stop();
      if (io) io.disconnect();
      window.removeEventListener('resize', measure);
      (reduced.removeEventListener ? reduced.removeEventListener('change', apply)
                                   : reduced.removeListener(apply));
      col.remove();
      live.remove();
    };
  }

  /* The site mounts pieces through this registry and keeps them alive, so
     mount has to hand back everything it started. The scratch page has no
     registry and just auto-mounts anything marked up for it. */
  window.Pieces = window.Pieces || {};
  window.Pieces.protocol = { mount: mount };

  function init() {
    var frames = document.querySelectorAll('[data-protocol]');
    Array.prototype.forEach.call(frames, mount);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
