# Drop-in icons and logos

Save a PNG here with one of these exact names and the app uses it instead of the
drawn version. No code change needed — reload the page.

    msn.png          MSN Messenger
    ie.png           Internet Explorer
    limewire.png     LimeWire
    ebay.png         eBay (desktop icon and the site header)
    google.png       Google wordmark on the About page
    minesweeper.png  Minesweeper
    recyclebin.png   Recycle Bin
    paint.png        Paint

Icons are scaled to fit a square; the wordmarks (ebay, google) are given their
own width and height. If a file is absent the app falls back to the drawing in
src/components/Icons.tsx or to styled text.

To strip a white or checkerboard background from an image first:

    python3 scripts/strip-background.py source.png public/logos/name.png

Any company logos you put here stay their owners' property, so keep them out of
anything you publish.

## apple.png

The Apple mark for the Store page's tab bar. Drop a transparent PNG here and
it replaces the drawn SVG automatically.

## penguin.png

