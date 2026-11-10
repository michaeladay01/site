Symbols for the chrome piece.

Drop SVGs in here and list them in the SVGS array at the top of chrome.js.
They replace the six drawn symbols. Anything with a viewBox works; every
path, circle, rect, ellipse, polygon and polyline in the file is taken,
scaled to fit and centred.

Only the silhouette survives. The piece is a solid sheet of metal in that
shape, so fills, strokes, gradients and colours in the file are ignored -
a mark that depends on two colours will come out as one shape.

Two things to watch:

  - Holes must be wound the opposite way to their outside. The fill is
    even-odd, which is how a normal SVG is authored, but a counter drawn in
    the same direction as its outline will come out solid.
  - Hairlines vanish. The edge roll is about a fiftieth of the symbol's
    width, so anything thinner than that is all roll and no face, and reads
    as a wire rather than as a cut shape. Outline your strokes first.

Use marks you have the right to use.
