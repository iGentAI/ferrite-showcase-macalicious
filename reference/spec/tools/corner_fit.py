#!/usr/bin/env python3
"""Fit a corner radius to the pixels of one corner of a rounded rectangle.

The corner is modelled as concentric rings (border lines) around a flat fill on a flat
background, rendered with 8x8 supersampling, and compared with the stored pixels of the
screenshot for every candidate radius. The radius is that of the OUTER edge of the first ring.
The result is a computed value ([C]) from measured pixels ([M]); quote the rms figures with it.

  corner_fit.py <screenshot> <x,y> <tl|tr|bl|br> --bg HEX --ring W:HEX[:HEX] [--ring ...] --fill HEX
                [--size N] [--rmin PX] [--rmax PX] [--step PX] [--alpha 1]

  <x,y>     the corner pixel of the shape's bounding box in image pixels (for tl the left-most
            column and top-most row that the shape touches; for br the right-most and bottom-most)
  --bg      background colour outside the shape
  --ring    one border line, outermost first: width in image px, the colour on the horizontal
            edge and, when it differs, the colour on the vertical edge (blended round the arc)
  --fill    colour inside the last ring
  --size    side of the compared square in image px, measured inwards from the corner (default 14);
            two more pixels of background are included outside it
  --alpha   1 to fit the alpha channel instead of the colour (default 0). For window-only captures,
            where the corner lies on the transparent shadow: opacity is then linear in coverage, the
            colour is not. Give --bg, --ring and --fill as greys of the alpha value (ff = opaque).
            The transparency may be an alpha band or PNG transparency metadata (a palette or a
            single transparent colour); an image with neither is refused
  radii are in image px (2 px = 1 pt); the default search is 2..14 px in steps of 0.25 px. A best
  radius that is an end of the searched range is followed by a warning: widen the range and fit again

Colours are the stored pixel values (as `measure.py at` prints them), not sRGB.
The model assumes pixel-aligned straight edges, which holds for the 2x captures.
"""
import math
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.normpath(os.path.join(HERE, "..", "..", "screenshots"))
SS = 8  # supersampling per axis
MARGIN = 2  # background pixels kept outside the corner


def rgb(h):
    h = h.lstrip("#")
    if len(h) != 6:
        raise ValueError(h)
    return np.array([int(h[i : i + 2], 16) for i in (0, 2, 4)], dtype=float)


def load_corner(name, x, y, corner, size, alpha=False):
    """Return the corner as an array oriented like a top-left corner, with MARGIN px of background."""
    if not name.endswith(".png"):
        name += ".png"
    im = Image.open(os.path.join(SHOTS, name))
    if alpha:
        # Transparency is either an alpha band or PNG metadata (tRNS: per-entry alpha of a palette,
        # or one transparent colour of a grey or RGB image). Converting to RGBA resolves both.
        if "A" not in im.getbands() and "transparency" not in im.info:
            sys.exit(f"corner_fit: {name} has no alpha channel and no transparency information")
        im = im.convert("RGBA")
        im = Image.merge("RGB", [im.getchannel("A")] * 3)
    else:
        im = im.convert("RGB")
    n = size + MARGIN
    left = x - MARGIN if corner in ("tl", "bl") else x - size + 1
    top = y - MARGIN if corner in ("tl", "tr") else y - size + 1
    if left < 0 or top < 0 or left + n > im.width or top + n > im.height:
        sys.exit(f"corner_fit: the {n} px square at {left},{top} is not inside the {im.width} x {im.height} image")
    a = np.asarray(im.crop((left, top, left + n, top + n)), dtype=float)
    if corner in ("tr", "br"):
        a = a[:, ::-1]
    if corner in ("bl", "br"):
        a = a[::-1]
    return a


def render(n, radius, bg, rings, fill):
    """Render an n x n top-left corner whose bounding box starts MARGIN px in from each side."""
    c = (np.arange(n * SS) + 0.5) / SS - MARGIN
    px, py = np.meshgrid(c, c)
    in_arc = (px < radius) & (py < radius)
    depth = np.where(in_arc, radius - np.hypot(radius - px, radius - py), np.minimum(px, py))
    # 1 on the horizontal edge, 0 on the vertical edge, by angle round the arc
    towards_top = np.where(
        in_arc,
        np.arctan2(np.maximum(radius - py, 0), np.maximum(radius - px, 1e-9)) / (math.pi / 2),
        (py < px).astype(float),
    )
    out = np.empty(px.shape + (3,))
    out[:] = fill
    edge = sum(w for w, _, _ in rings)
    for w, top, side in reversed(rings):
        edge -= w
        band = (depth >= edge) & (depth < edge + w)
        mix = towards_top[..., None] * top + (1 - towards_top[..., None]) * side
        out[band] = mix[band]
    out[depth < 0] = bg
    return out.reshape(n, SS, n, SS, 3).mean(axis=(1, 3))


def fit(target, bg, rings, fill, rmin, rmax, step):
    """Compare `target` (a corner oriented as top-left, MARGIN px of background included) with the
    model at every candidate radius. Returns a list of (rms in levels, radius in px)."""
    results = []
    count = int(math.floor((rmax - rmin) / step + 1e-9)) + 1
    for i in range(count):
        r = rmin + i * step
        diff = render(target.shape[0], r, bg, rings, fill) - target
        results.append((math.sqrt(float((diff**2).mean())), r))
    return results


def at_search_boundary(best_radius, rmin, last_radius):
    """True when the best radius is an end of the searched range (either end, 0 included), so it is not
    established as an unconstrained optimum."""
    return abs(best_radius - last_radius) < 1e-9 or abs(best_radius - rmin) < 1e-9


def main(argv):
    if len(argv) < 4:
        sys.exit(__doc__)
    name, xy, corner = argv[1:4]
    if corner not in ("tl", "tr", "bl", "br"):
        sys.exit(__doc__)
    try:
        x, y = (int(v) for v in xy.split(","))
    except ValueError:
        sys.exit(f"corner_fit: {xy} is not a corner pixel; give two integers as x,y\n" + __doc__)
    opts = {"--size": "14", "--rmin": "2", "--rmax": "14", "--step": "0.25", "--alpha": "0"}
    rings = []
    rest = argv[4:]
    if len(rest) % 2:
        sys.exit(f"corner_fit: {rest[-1]} needs a value")
    try:
        for flag, value in zip(rest[::2], rest[1::2]):
            if flag == "--ring":
                parts = value.split(":")
                top = rgb(parts[1])
                rings.append((float(parts[0]), top, rgb(parts[2]) if len(parts) > 2 else top))
            elif flag in opts or flag in ("--bg", "--fill"):
                opts[flag] = value
            else:
                sys.exit(f"corner_fit: unknown option {flag}")
        size = int(opts["--size"])
        rmin, rmax, step = (float(opts[k]) for k in ("--rmin", "--rmax", "--step"))
        if opts["--alpha"] not in ("0", "1"):
            raise ValueError(opts["--alpha"])
        bg = rgb(opts["--bg"]) if "--bg" in opts else None
        fill = rgb(opts["--fill"]) if "--fill" in opts else None
    except (ValueError, IndexError):
        sys.exit("corner_fit: a value could not be read\n" + __doc__)
    if not rings or bg is None or fill is None:
        sys.exit(__doc__)
    if not (math.isfinite(step) and step > 0 and math.isfinite(rmin) and math.isfinite(rmax) and 0 <= rmin <= rmax):
        sys.exit("corner_fit: --step must be positive and 0 <= --rmin <= --rmax")
    if size < 2 or not all(math.isfinite(w) and w > 0 for w, _, _ in rings):
        sys.exit("corner_fit: --size must be at least 2 and ring widths finite and positive")
    target = load_corner(name, x, y, corner, size, opts["--alpha"] == "1")
    results = fit(target, bg, rings, fill, rmin, rmax, step)
    best = min(results)
    print(f"{name} {corner} @ {x},{y}, {size} px square{' (alpha)' if opts['--alpha'] == '1' else ''}: best radius {best[1]:.2f} px = {best[1] / 2:.3f} pt, rms {best[0]:.2f} levels")
    shown = sorted({best[1]} | {v for _, v in results if abs(v * 2 - round(v * 2)) < 1e-9 and abs(v - best[1]) <= 3})
    by_radius = {v: e for e, v in results}
    print("  " + "  ".join(f"{v / 2:g} pt: {by_radius[v]:.2f}" for v in shown))
    if at_search_boundary(best[1], rmin, results[-1][1]):
        print(
            f"  WARNING: the best radius is an end of the searched range ({rmin:g}..{results[-1][1]:g} px), so it is"
            " not established as an unconstrained optimum: the rms may still be falling outside the range."
            " Widen --rmin/--rmax and fit again before quoting a radius (a best of 0 cannot be widened"
            " below: quote it as a square corner only together with the rms at the next candidates)."
        )


if __name__ == "__main__":
    main(sys.argv)
