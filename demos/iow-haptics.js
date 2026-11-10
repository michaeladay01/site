/**
 * The app's haptics, as close as a browser gets.
 *
 * On iPhone the app plays Core Haptics patterns: every moment is a little
 * score of taps and hums with their own intensity and sharpness. The web has
 * nothing like that. All it offers is:
 *
 *   • navigator.vibrate(pattern) — Android only, and duration is the ONLY
 *     thing you can control. No intensity, no sharpness.
 *   • iOS Safari — no vibration API at all. A <label> wrapping a checkbox
 *     with the `switch` attribute makes the system play one light tick when
 *     it is toggled, which is the only haptic a web page can ask for there,
 *     and it is always the same tick.
 *
 * So this is a translation, not a copy. The timing of each pattern is exactly
 * the app's — the same taps at the same moments — and intensity is carried
 * the only way each platform allows: as buzz length on Android, and on iPhone
 * by the rhythm alone, one tick per tap. A hum becomes a longer buzz on
 * Android and is dropped on iPhone, which cannot sustain anything.
 *
 * Patterns transcribed from ios/InOtherWords/Feel/HapticPatterns.swift.
 * Each entry is a list of events: [time, intensity] for a tap, or
 * [time, intensity, duration] for a hum, in seconds.
 */
(function () {
  /** @type {Record<string, number[][]>} */
  var P = {
    select: [[0, 0.28]],
    flip: [[0, 0.32], [0.045, 0.26]],
    stamp: [[0, 0.42]],
    // A crisp break, then two specks of the pieces.
    erase: [[0, 0.5], [0.04, 0.16], [0.08, 0.1]],
    // One soft, round tap: the tile let go.
    delete: [[0, 0.4]],
    // A rising double-tap: the word clicking into place.
    solved: [[0, 0.4], [0.08, 0.9]],
    // A gentle wobble, each tap smaller than the last.
    wrong: [[0, 0.42], [0.07, 0.28], [0.14, 0.16]],
    clean: [[0, 0.5], [0.01, 0.2, 0.14]],
    // The shimmer swells, then lands on the tap.
    hint: [[0, 0.28, 0.2], [0.2, 0.5]],
    seal: [[0, 1], [0.01, 0.6, 0.16]],
    crack: [[0, 1], [0.03, 0.6], [0.03, 0.45, 0.09]],
    unfold: [[0, 0.3, 0.35]],
    finish: [[0, 0.4], [0.09, 0.55], [0.18, 0.7], [0.27, 0.85], [0.27, 0.4, 0.45]],
  };

  // The riffle and the cascade are generated in the app, so they are
  // generated here too, from the same expressions.
  P.riffle = [];
  for (var i = 0; i < 12; i++) P.riffle.push([0.75 * Math.pow(i / 12, 0.8), 0.32]);
  P.cascade = [];
  for (var at = 0; at < 2.4; at += 0.045 + 0.07 * Math.pow(at / 2.4, 2)) {
    P.cascade.push([at, 0.26 * (1 - at / 2.8)]);
  }

  /** Intensity becomes length: the only dial Android gives us. 3ms to 26ms. */
  function ms(intensity) {
    return Math.max(3, Math.round(3 + intensity * 23));
  }

  /**
   * The app's events, flattened into vibrate()'s [buzz, gap, buzz, …].
   *
   * A hum is the awkward one. Core Haptics holds a note and fades it; a
   * vibration motor can only be on or off, and a long flat buzz feels
   * nothing like a hum that dies away. So a hum over 120ms becomes a short
   * train of pulses that shorten as they go — the closest a motor gets to
   * something decaying.
   */
  function spans(e) {
    if (e.length < 3) return [[e[0] * 1000, ms(e[1])]];
    var start = e[0] * 1000;
    var dur = e[2] * 1000;
    if (dur <= 120) return [[start, Math.round(dur)]];
    var n = Math.min(5, Math.round(dur / 70));
    var step = dur / n;
    var out = [];
    for (var i = 0; i < n; i++) {
      // Each pulse fills less of its slot than the one before it.
      var fill = 0.75 * (1 - i / n);
      out.push([start + i * step, Math.max(4, Math.round(step * fill))]);
    }
    return out;
  }

  function toVibrate(events) {
    var flat = [];
    for (var k = 0; k < events.length; k++) flat = flat.concat(spans(events[k]));
    flat.sort(function (a, b) { return a[0] - b[0]; });

    var out = [];
    var at = 0;
    for (var i = 0; i < flat.length; i++) {
      var start = flat[i][0], len = flat[i][1];
      var gap = Math.max(0, Math.round(start - at));
      if (out.length) out.push(gap);
      else if (gap > 0) out.push(0, gap);
      out.push(len);
      at = start + len;
    }
    return out.length ? out : [8];
  }

  // One hidden switch, toggled to borrow the system tick on iPhone.
  var sw = null;
  function tickSwitch() {
    if (!sw) {
      var label = document.createElement('label');
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      label.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none';
      label.appendChild(input);
      document.body.appendChild(label);
      sw = label;
    }
    try { sw.click(); } catch (e) {}
  }

  var canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  var pending = [];

  /**
   * Play a moment. Unknown names fall back to a plain tap, so a demo can
   * ask for anything without having to check first.
   */
  function haptic(name) {
    var events = P[name] || P.select;

    if (canVibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) {
      try {
        navigator.vibrate(toVibrate(events));
        return;
      } catch (e) {}
    }

    // iPhone: one tick per tap, on the app's own timing. A hum has no tick
    // of its own — there is nothing here that can hold a note.
    while (pending.length) clearTimeout(pending.pop());
    var taps = events.filter(function (e) { return e.length < 3; }).slice(0, 8);
    for (var k = 0; k < taps.length; k++) {
      var t = taps[k][0] * 1000;
      if (t === 0) tickSwitch();
      else pending.push(setTimeout(tickSwitch, t));
    }
  }

  haptic.patterns = P;
  window.iowHaptic = haptic;
})();
