/* msg.js
 *
 * iPhone Messages, zoomed so the phone's screen width equals the frame width.
 * Everything is measured in iOS points and converted with one unit (--pt), so
 * the whole thing is a real 393pt screen scaled up rather than an impression
 * of one.
 *
 * The sequence is how a real conversation actually behaves: the indicator
 * appears, it is replaced by a message, the indicator comes back for the
 * second one, then that arrives. Two messages do not land together, and the
 * indicator never sits underneath a message that has already arrived.
 *
 * Arrival is a spring, not an ease. iOS scales a new bubble up from about 0.4
 * with a little overshoot while the thread above it slides up to make room.
 */
(function () {
  'use strict';

  /* ms. Each step is "do this, then wait". */
  var SCRIPT = [
    ['idle',    280, 0],      /* a beat of empty frame, no more */
    ['typing', 1500, 0],
    ['msg1',   1100, 1],
    ['typing', 1200, 1],      /* the first message stays put */
    ['msg2',   1100, 2]       /* the arrival settles by ~590ms and the clear
                                 takes the last 420ms, so the thread is still
                                 and complete for a beat in between */
  ];
  var LOOP = SCRIPT.reduce(function (n, s) { return n + s[1]; }, 0);

  /* One spring, two dampings, and everything on screen runs off it.

     What this replaces: layout moved on a quartic ease-out over 170ms while
     the bubble ran a different curve over 340ms. One event, two clocks and two
     curve families - the thread had finished before the bubble had, which is
     half of what read as clunky.

     The other half was the arrival curve itself. It was two eased moves spliced
     at the overshoot, chosen because it has no corner in it - which is true,
     but it has something worse. Both halves ease, so velocity goes to zero at
     the start, AT THE PEAK, and at the end: measured, it spends 104ms crawling
     below a tenth of its top speed in the middle of a 340ms move, then sets off
     again. Three dead stops in one arrival. A real spring has no stall, because
     its overshoot is momentum rather than a keyframe - it turns around at full
     curvature and keeps going.

     Parameterised the way SwiftUI does it, since that is what the thing being
     imitated actually uses: RESPONSE is the period, damping is the fraction of
     critical. Solved in closed form, so it can be sampled at any time and needs
     no per-frame integration to drift. */
  /* response (s), damping (fraction of critical). An arriving bubble and a
     departing indicator are not the same event and must not share a speed -
     tying them together was a mistake in the first pass at this, and it left
     the dots hanging under a message that had already landed for the better
     part of a second. */
  var ARRIVE  = [0.40, 0.72];   /* the bubble: one gentle overshoot, ~3.8% */
  var LAYOUT  = [0.40, 1.0];    /* the thread making room. Critical: an
                                   overshoot here reads as the whole thread
                                   sagging, which the first version had right */
  var LEAVE   = [0.20, 1.0];    /* the indicator going. A disappearance is not
                                   a settle - it should be brisk and done */
  var CLEAR   = [0.26, 1.0];    /* the thread emptying at the end of the loop.
                                   Quick enough to be properly finished by the
                                   time the reset lands - at 0.34 it was still
                                   0.4% visible, which is a faint ghost of the
                                   whole thread flicking off */

  function spring(t, p) {
    if (t <= 0) return 0;
    var w = 2 * Math.PI / p[0], damping = p[1];
    if (damping >= 1) return 1 - (1 + w * t) * Math.exp(-w * t);
    var wd = w * Math.sqrt(1 - damping * damping);
    return 1 - Math.exp(-damping * w * t) *
               (Math.cos(wd * t) + (damping * w / wd) * Math.sin(wd * t));
  }

  /* The loop used to end on a hard cut: two messages and the sender went from
     fully there to gone between one frame and the next, every time round. The
     thread now clears over the last stretch of the final step instead, so the
     reset is a dissolve and the only frame that changes abruptly is one where
     nothing is on screen. */
  var FADE = 420;          /* ms of clearing at the end of the loop */

  function build(root) {
    var scene = document.createElement('div');
    scene.className = 'msg-scene';
    scene.innerHTML =
      '<div class="msg-thread">' +
        '<p class="msg-sender">Eight Sleep</p>' +

        '<div class="msg-row is-in msg-new" data-msg="1" hidden>' +
          '<div class="msg-bubble"><span class="msg-skin"></span>' +
            '<span class="msg-text">Good morning!<br>Sleep Fitness Score: 89<br>Time slept: 8h 12m</span></div>' +
        '</div>' +

        '<div class="msg-row is-in msg-new" data-msg="2" hidden>' +
          '<div class="msg-bubble"><span class="msg-skin"></span>' +
            '<span class="msg-text">While you had a solid amount of REM sleep last night, you have 2h 18m of sleep debt compared to your typical week.</span></div>' +
        '</div>' +

        '<div class="msg-row is-in msg-typing" hidden>' +
          '<div class="msg-bubble msg-dots"><span class="msg-skin"></span>' +
            '<span class="msg-text"><i></i><i></i><i></i></span></div>' +
        '</div>' +

      '</div>';

    root.appendChild(scene);
    return scene;
  }

  function mount(root) {
    var scene = root.querySelector('.msg-scene') || build(root);
    var thread = scene.querySelector('.msg-thread');
    var sender = scene.querySelector('.msg-sender');
    var typing = scene.querySelector('.msg-typing');
    var msgs = Array.prototype.slice.call(scene.querySelectorAll('.msg-new'));

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
    var lastTailed = null;

    function stateAt(ms) {
      var acc = 0;
      for (var i = 0; i < SCRIPT.length; i++) {
        if (ms < acc + SCRIPT[i][1]) {
          return { name: SCRIPT[i][0], since: ms - acc, shown: SCRIPT[i][2] };
        }
        acc += SCRIPT[i][1];
      }
      return { name: 'msg2', since: 0, shown: 2 };
    }

    /* Natural heights, measured once with everything on screen. Rows open to
       these so the thread above slides up instead of jumping: a row appearing
       at full height shoves everything in one frame. */
    var sizes = new Map();
    function measure() {
      var all = [sender, typing].concat(msgs);
      var was = [];
      all.forEach(function (row) { was.push(row.hidden); row.hidden = false; });
      all.forEach(function (row) {
        var cs = getComputedStyle(row);
        sizes.set(row, { h: row.offsetHeight, m: parseFloat(cs.marginTop) || 0 });
      });
      all.forEach(function (row, i) { row.hidden = was[i]; });
    }

    /* The thread is anchored to the bottom, so adding a row lifts everything
       above it in a single frame. Rather than clip the row open - which would
       cut the tails off, since they hang outside the bubble - the row takes
       its full height immediately and the whole thread is pushed back down by
       what it just gained, then released. Same rise, nothing clipped. */
    function frame(now) {
      if (!sizes.size && scene.clientWidth) measure();

      var ms = (now - t0) % LOOP;
      var s = stateAt(ms);
      var shown = s.shown;
      var t = s.since / 1000;

      /* The indicator fades and scales both ways, and keeps its place in the
         layout while it does, so the handoff to a message is continuous
         instead of two jumps landing in the same frame. */
      var tk = 0;
      if (s.name === 'typing') tk = spring(t, LEAVE);
      else if (s.name === 'msg1' || s.name === 'msg2') tk = 1 - spring(t, LEAVE);

      typing.hidden = tk <= 0.001;
      typing.style.setProperty('--k', tk.toFixed(4));

      var lift = sizes.get(typing) ? (sizes.get(typing).h + sizes.get(typing).m) * (1 - tk) : 0;
      if (tk <= 0.001) lift = 0;

      msgs.forEach(function (row) {
        var n = Number(row.getAttribute('data-msg'));
        var on = n <= shown;
        row.hidden = !on;
        if (!on) return;

        var landing = (n === shown) && (s.name === 'msg1' || s.name === 'msg2');

        /* Bubble: spring, with its bounce. Layout: ease-out, without. */
        row.style.setProperty('--k', spring(landing ? t : 9, ARRIVE).toFixed(4));
        if (landing) {
          var open = spring(t, LAYOUT);
          var n2 = sizes.get(row);
          if (n2) lift += (n2.h + n2.m) * (1 - open);
        }
      });

      /* The sender's name only exists once they have actually said something,
         and it arrives with the first message rather than ahead of it. */
      var nameOn = shown >= 1;
      sender.hidden = !nameOn;
      if (nameOn && s.name === 'msg1') {
        var sn = sizes.get(sender);
        if (sn) lift += (sn.h + sn.m) * (1 - spring(t, LAYOUT));
      }

      thread.style.transform = lift > 0.01 ? 'translateY(' + lift.toFixed(2) + 'px)' : '';

      /* Clearing for the loop. At ms just short of LOOP this is ~1 and the
         thread is invisible; at ms 0 it is 0 again and the thread is empty, so
         the two ends meet with nothing visible changing between them. */
      var gone = ms > LOOP - FADE ? spring((ms - (LOOP - FADE)) / 1000, CLEAR) : 0;
      thread.style.opacity = gone > 0.001 ? (1 - gone).toFixed(4) : '';

      /* The tail belongs to whatever is last in the thread, and nothing else.
         When a second message lands, the first one loses its tail - the run
         becomes one group. */
      /* Whoever ends up last owns the tail, decided by the state being
         entered - not by what is still fading out. Reading it off the live
         DOM meant the outgoing indicator kept the tail for the whole handoff
         and the new bubble grew its own only once the indicator had gone,
         which is the wing arriving late. */
      var last = null;
      if (s.name === 'typing' || s.name === 'idle') {
        last = s.name === 'typing' ? typing : null;
      } else {
        for (var i = msgs.length - 1; i >= 0; i--) if (!msgs[i].hidden) { last = msgs[i]; break; }
      }

      if (last !== lastTailed) {
        [typing].concat(msgs).forEach(function (row) {
          row.querySelector('.msg-bubble').classList.toggle('has-tail', row === last);
        });
        lastTailed = last;
      }

      if (!stopped && !paused) raf = requestAnimationFrame(frame);
    }

    /* Resuming restarts the loop rather than dropping back in wherever the
       wall clock reached. Parked for ten seconds and resumed, the old version
       woke up at an arbitrary point in the script and snapped the whole thread
       into that state in one frame - every switch to this piece, and every
       return to the tab, was a jump. */
    function start() {
      if (!paused || stopped) return;
      paused = false;
      rebase();
      raf = requestAnimationFrame(frame);
    }
    function stop() { if (paused) return; paused = true; cancelAnimationFrame(raf); }

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
  window.Pieces.messages = { mount: mount };
})();
