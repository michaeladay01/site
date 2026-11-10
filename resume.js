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
}());
