/* inview.js
 *
 * A project page carries up to six clips. Letting all of them autoplay means
 * six decoders running at once — on arrival that competes with the view
 * transition for the same frames, which is what the morph catches on.
 *
 * So: the clip you landed on plays immediately, and the rest wait until they
 * are on screen and park again when they leave. Same discipline the coded
 * pieces already use.
 */
(function () {
  'use strict';

  var vids = Array.prototype.slice.call(document.querySelectorAll('video'));
  if (!vids.length) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* The one the transition lands on keeps running whatever happens. */
  var hero = document.querySelector('[data-vt] video') ||
             (document.querySelector('[data-vt]') &&
              document.querySelector('[data-vt]').matches('video')
                ? document.querySelector('[data-vt]') : null);

  if (!('IntersectionObserver' in window) || reduced) return;

  vids.forEach(function (v) {
    if (v === hero) return;
    v.pause();
    v.autoplay = false;
  });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var v = entry.target;
      if (entry.isIntersecting) {
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
      } else if (!v.paused) {
        v.pause();
      }
    });
  }, { rootMargin: '15% 0px', threshold: 0.01 });

  vids.forEach(function (v) { if (v !== hero) io.observe(v); });

  /* Anything already on screen starts after the transition has finished, not
     during it. */
  function start() {
    vids.forEach(function (v) {
      if (v === hero) return;
      var r = v.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) {
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
      }
    });
  }
  if (document.documentElement.classList.contains('is-arriving')) {
    setTimeout(start, 620);
  } else {
    start();
  }
}());
