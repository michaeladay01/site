/* resume.js
 *
 * The index hands the clip's position over when you click a card; this picks
 * it up so the frame you land on is the frame you left. Without it the hero
 * restarts at zero while the morph is still travelling, which reads as the
 * picture jumping inside the box.
 *
 * Runs as early as it can and again on loadedmetadata, because currentTime
 * cannot be set before the browser knows the duration.
 */
(function () {
  'use strict';

  var host = document.querySelector('[data-vt]');
  if (!host) return;

  var key = 'md-at:' + host.getAttribute('data-vt');
  var at = null;
  try { at = parseFloat(sessionStorage.getItem(key)); } catch (e) {}
  try { sessionStorage.removeItem(key); } catch (e) {}
  if (at === null || isNaN(at) || at <= 0) return;

  var vid = host.matches('video') ? host : host.querySelector('video');
  if (!vid) return;

  function seek() {
    if (!isFinite(vid.duration) || vid.duration <= 0) return;
    /* The clips loop, so a time past the end still maps onto a real frame. */
    try { vid.currentTime = at % vid.duration; } catch (e) {}
  }

  /* As early as possible, before the page has painted — so the first frame
     anyone sees is already the right one. Seeking after the morph lands is
     what caused the blink: the decoder throws away the frame it is showing
     and the box flashes while the new one arrives. Until the seek resolves
     the poster covers the box, and the poster is a real frame of the clip. */
  if (vid.readyState >= 1) seek();
  else vid.addEventListener('loadedmetadata', seek, { once: true });

  /* And hold that frame until the move has landed.
   *
   * What travels across the screen is a STILL of the hero, captured before
   * the transition starts. The real video carries on playing underneath it
   * for the whole move, so by the time the browser swaps the still for the
   * live element the clip is half a second further on - and you see it cut.
   * Pausing for the duration means the frame you land on is the frame that
   * flew there.
   *
   * Released on whichever comes first, because a clip left paused is far
   * worse than a small cut: the transition finishing, a bfcache restore, or
   * a timeout for the cases where no transition runs at all.
   */
  var held = false;

  function hold() {
    if (!vid.paused) { vid.pause(); held = true; }
  }

  function release() {
    if (!held) return;
    held = false;
    var playing = vid.play();
    if (playing && playing.catch) playing.catch(function () {});
  }

  hold();
  setTimeout(release, 900);
  window.addEventListener('pageshow', release);
  window.addEventListener('pagereveal', function (e) {
    if (!e.viewTransition) { release(); return; }
    e.viewTransition.finished.catch(function () {}).then(release);
  });
}());
