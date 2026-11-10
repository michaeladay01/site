/* Live embeds on a written page ---------------------------------------------

   A frame on this site holds something running, not something playing, and
   that makes two problems the rest of the page never has.

   The first is weight. Each of these is a whole application; loading five of
   them on open would cost a reader who never scrolls past the first one. So an
   iframe arrives with its address in data-src and is woken when it comes near
   the viewport.

   The second is the pointer. A frame that takes the cursor the moment it is
   under one turns a scroll into a click inside somebody else's desktop. So the
   frame ignores the pointer until it is asked, by a click on the sheet over
   it; clicking away, or Escape, hands the pointer back.

   No dependencies, no build step — the same as everything else here. */

(function () {
  'use strict';

  var all = [].slice.call(document.querySelectorAll('.embed .holder'));
  if (!all.length) return;
  /* Whittled down by sweep() as each one wakes; `all` keeps the full set. */
  var holders = all.slice();

  /* ---------- waking ---------- */

  function wake(holder) {
    var frame = holder.querySelector('iframe');
    if (!frame || frame.src) return;
    var src = frame.dataset.src;
    if (!src) return;
    frame.src = src;
  }

  /* A rect check on a passive listener, rather than an IntersectionObserver.
     The observer is the tidier tool and it is the one that silently does
     nothing in a few rendering contexts — an embed that never loads is a far
     worse failure than a cheap scroll listener. It stops once every frame is
     awake. */
  function sweep() {
    var margin = 600;
    holders = holders.filter(function (h) {
      var box = h.getBoundingClientRect();
      if (box.top > window.innerHeight + margin || box.bottom < -margin) return true;
      wake(h);
      return false;
    });
    if (!holders.length) {
      window.removeEventListener('scroll', sweep);
      window.removeEventListener('resize', sweep);
    }
  }
  sweep();
  window.addEventListener('scroll', sweep, { passive: true });
  window.addEventListener('resize', sweep, { passive: true });

  /* ---------- the pointer ---------- */

  var live = null;

  function release() {
    if (!live) return;
    live.classList.remove('is-live');
    live = null;
  }

  function take(holder) {
    if (live === holder) return;
    release();
    /* Asking for it is also the surest way to get it: a reader who clicks gets
       the frame whether or not the scroll check has reached it yet. */
    wake(holder);
    holder.classList.add('is-live');
    live = holder;
  }

  all.forEach(function (holder) {
    var sheet = holder.querySelector('.take');
    if (!sheet) return;
    sheet.addEventListener('click', function () { take(holder); });
  });

  /* Clicking anywhere outside hands the pointer back, so the page never ends
     up in a state where a reader cannot tell what their keyboard is talking
     to. Escape does the same, for anyone not using a mouse. */
  document.addEventListener('pointerdown', function (e) {
    if (!live) return;
    if (live.contains(e.target)) return;
    release();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') release();
  });
}());
