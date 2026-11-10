/* back.js
 *
 * Two jobs, both about leaving a project page.
 *
 * 1. Going back should GO BACK. "← All work" is an ordinary link, so clicking
 *    it is a forward navigation to a fresh copy of the index — which loads at
 *    the top, while the page you are leaving is scrolled half way down. The
 *    cross-fade then has to reconcile two completely different images, and
 *    that is the jump. Traversing history instead restores the index exactly
 *    as you left it, scroll included, usually straight from the back/forward
 *    cache.
 *
 * 2. The morph only makes sense going in. Coming back out the card it would
 *    fly to is often off screen, so the hero gives up its name and the pages
 *    simply cross-fade.
 */
(function () {
  'use strict';

  var hero = document.querySelector('[data-vt]');

  function release() {
    if (hero) hero.style.viewTransitionName = 'none';
    /* The pseudo-element tree for a cross-document transition lives in the
       INCOMING document, so only it can style the animation — it has to be
       told which direction we came from. */
    try { sessionStorage.setItem('md-back', '1'); } catch (e) {}
  }

  /* Did we arrive here from the page this link points at? Only then is going
     back in history the same thing as following the link. */
  function cameFrom(href) {
    if (!document.referrer) return false;
    try {
      var ref = new URL(document.referrer);
      if (ref.origin !== location.origin) return false;
      /* Served from a domain root, michaela.day/ has the pathname "/", whose
         last segment is empty — it is still index.html, and without this the
         comparison fails on the live site and every "back" becomes a forward
         navigation to a fresh copy of the index. */
      var was = ref.pathname.split('/').pop() || 'index.html';
      return was === (href.split('#')[0].split('?')[0] || 'index.html');
    } catch (e) { return false; }
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;

    var href = a.getAttribute('href') || '';
    if (href.indexOf('index.html') !== 0 && href.indexOf('explorations.html') !== 0) return;

    release();

    if (history.length > 1 && cameFrom(href)) {
      e.preventDefault();
      history.back();
    }
  }, true);

  /* The browser's own back button never reaches the click handler, and
     popstate fires AFTER the outgoing snapshot has been taken — too late to
     release the name or set the flag. pagehide fires before it, for every way
     of leaving this page, so the flag is always there to be read. The index
     only honours it when it is itself the page being arrived at. */
  /* pageswap is the one event specified to run in the OUTGOING document before
     its snapshot is taken, for every kind of navigation including the browser's
     own back button — which never reaches the click handler, and whose popstate
     fires too late. Releasing the name here is what actually stops the ghost:
     a pair needs the same name at both ends, so breaking this end is enough,
     whatever the incoming document manages to work out about direction. */
  window.addEventListener('pageswap', release);
  window.addEventListener('pagehide', release);
}());
