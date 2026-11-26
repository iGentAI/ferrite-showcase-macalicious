#!/usr/bin/env python3
"""Pixel measurement helper used to produce reference/spec.

All coordinates are IMAGE PIXELS of the 2x reference screenshots (2 px = 1 pt).
FILE is a filename inside reference/screenshots/ (or any path).

  measure.py info FILE                     size, alpha bbox, opaque window frame, shadow extents
  measure.py preview FILE [--max 1568]     1x (half-scale) opaque JPEG preview, capped at --max px on the long side
  measure.py previews                      previews of every screenshot (skips existing)
  measure.py crop FILE x,y,w,h [--zoom N]  nearest-neighbour zoomed crop (for looking at detail)
  measure.py at FILE x,y [x,y ...]         exact pixel values
  measure.py row FILE y [x0 x1] [--tol N]  run-length encoded row: startX:colour x count
  measure.py col FILE x [y0 y1] [--tol N]  run-length encoded column
                                           --tol N merges neighbours whose channels differ by <= N from the
                                           run's first pixel (prints first>last colour when they differ)
  measure.py grid FILE x,y,w,h             hex matrix of a small region (corner radii, glyphs)
  measure.py palette FILE x,y,w,h [--top N] most frequent colours in a region
  measure.py alpha-row FILE y [x0 x1]      run-length encoded alpha (shadow falloff)
  measure.py alpha-col FILE x [y0 y1]
  measure.py srgb FILE '#rrggbb' ...       convert stored colours to sRGB through FILE's embedded profile

Colour management: every screenshot embeds the capturing Mac's "Display" ICC profile (Display P3
primaries, sRGB-like tone curve). The numeric commands report the STORED pixel value by default.
Add --srgb to any numeric command to report the value converted to sRGB (relative colorimetric),
which is the value to use in CSS. Neutral greys are identical in both; saturated colours are not.

Window captures are flattened onto mid grey (#808080) for previews and crops only; the numeric
commands always report the original pixel, with alpha as @a when it is not opaque.

Previews and crops are written under $MEASURE_OUT (default: reference/spec/.scratch, which is
git-ignored) and the path is printed; they are scratch output, not part of the specification.
"""
import os
import sys
from collections import Counter

from PIL import Image, ImageCms

SRGB = False
_transforms = {}


def srgb_transform(icc):
    if icc not in _transforms:
        import io

        src = ImageCms.ImageCmsProfile(io.BytesIO(icc))
        _transforms[icc] = ImageCms.buildTransform(
            src, ImageCms.createProfile("sRGB"), "RGB", "RGB", renderingIntent=ImageCms.Intent.RELATIVE_COLORIMETRIC
        )
    return _transforms[icc]


def to_srgb(im):
    """Convert an RGBA image from its embedded profile to sRGB, leaving alpha untouched."""
    icc = im.info.get("icc_profile")
    if not icc:
        return im
    rgb = ImageCms.applyTransform(im.convert("RGB"), srgb_transform(icc))
    out = rgb.convert("RGBA")
    out.putalpha(im.getchannel("A"))
    return out

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.normpath(os.path.join(HERE, "..", "..", "screenshots"))
OUT = os.environ.get("MEASURE_OUT") or os.path.normpath(os.path.join(HERE, "..", ".scratch"))


def resolve(name):
    if os.path.exists(name):
        return name
    p = os.path.join(SHOTS, name)
    if os.path.exists(p):
        return p
    if os.path.exists(p + ".png"):
        return p + ".png"
    sys.exit(f"not found: {name}")


def load(name):
    src = Image.open(resolve(name))
    im = src.convert("RGBA")
    im.info["icc_profile"] = src.info.get("icc_profile")
    return to_srgb(im) if SRGB else im


def hx(p):
    r, g, b, a = p
    s = f"#{r:02x}{g:02x}{b:02x}"
    if a < 255:
        s += f"@{a / 255:.3f}"
    return s


def close(a, b, tol):
    if a == b:
        return True
    if tol <= 0 or isinstance(a, int):
        return False
    return all(abs(x - y) <= tol for x, y in zip(a, b))


def rle(values, start, fmt, tol=0):
    out = []
    first = None
    last = None
    n = 0
    pos = start
    run_start = start

    def emit():
        label = fmt(first) if first == last else f"{fmt(first)}>{fmt(last)}"
        out.append(f"{run_start}:{label}x{n}")

    for v in values:
        if first is not None and close(first, v, tol):
            n += 1
            last = v
        else:
            if first is not None:
                emit()
            first = last = v
            n = 1
            run_start = pos
        pos += 1
    if first is not None:
        emit()
    return out


def nums(s):
    return [int(round(float(v))) for v in s.split(",")]


def opt(args, flag, default):
    if flag in args:
        i = args.index(flag)
        v = args[i + 1]
        del args[i : i + 2]
        return v
    return default


def ensure_out(d):
    """Create the scratch output folder and keep it out of version control."""
    os.makedirs(d, exist_ok=True)
    ignore = os.path.join(OUT, ".gitignore")
    if not os.path.exists(ignore):
        with open(ignore, "w") as f:
            f.write("*\n")


def outpath(name, suffix):
    d = os.path.join(OUT, "crops")
    ensure_out(d)
    base = os.path.splitext(os.path.basename(name))[0]
    return os.path.join(d, f"{base}{suffix}")


def cmd_info(args):
    im = load(args[0])
    w, h = im.size
    a = im.getchannel("A")
    print(f"size {w}x{h} px = {w / 2:g}x{h / 2:g} pt")
    lo, hi = a.getextrema()
    if lo == 255:
        print("opaque image (no alpha): full-screen or region capture")
        return
    print(f"alpha bbox (incl. shadow): {a.getbbox()}")
    # Opaque frame: bbox of pixels with alpha == 255.
    solid = a.point(lambda v: 255 if v == 255 else 0)
    bb = solid.getbbox()
    if bb:
        x0, y0, x1, y1 = bb
        print(f"opaque frame bbox: x {x0}..{x1 - 1}, y {y0}..{y1 - 1}  -> {x1 - x0}x{y1 - y0} px = {(x1 - x0) / 2:g}x{(y1 - y0) / 2:g} pt")
        print(f"shadow margins px: left {x0}, top {y0}, right {w - x1}, bottom {h - y1}")


def flatten(im, bg=(128, 128, 128)):
    base = Image.new("RGBA", im.size, bg + (255,))
    base.alpha_composite(im)
    return base.convert("RGB")


def preview_path(name):
    d = os.path.join(OUT, "previews")
    ensure_out(d)
    return os.path.join(d, os.path.splitext(os.path.basename(name))[0] + ".jpg")


def cmd_preview(args, quiet_if_exists=False):
    mx = int(opt(args, "--max", "1568"))
    p = preview_path(args[0])
    if quiet_if_exists and os.path.exists(p):
        return
    im = flatten(load(args[0]))
    w, h = im.size
    s = min(0.5, mx / max(w, h))
    im = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    im.save(p, quality=90)
    print(f"{p}  (scale {s:.4f}; multiply preview coords by {1 / s:.3f} to get image px)")


def cmd_previews(args):
    for f in sorted(os.listdir(SHOTS)):
        if f.endswith(".png"):
            cmd_preview([f], quiet_if_exists=True)


def cmd_crop(args):
    zoom = int(opt(args, "--zoom", "1"))
    x, y, w, h = nums(args[1])
    im = flatten(load(args[0]).crop((x, y, x + w, y + h)))
    # Image viewers used with this tool reject images over 2000 px; keep crops well under that.
    while zoom > 1 and max(w, h) * zoom > 1600:
        zoom -= 1
    if zoom != 1:
        im = im.resize((w * zoom, h * zoom), Image.NEAREST)
    if max(im.size) > 1600:
        s = 1600 / max(im.size)
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
        print(f"note: crop downscaled by {s:.3f} to stay under 1600 px")
    p = outpath(args[0], f"-crop-{x}-{y}-{w}x{h}@{zoom}.png")
    im.save(p)
    print(p)


def cmd_at(args):
    im = load(args[0])
    for s in args[1:]:
        x, y = nums(s)
        print(f"({x},{y}) {hx(im.getpixel((x, y)))}")


def line(args, horizontal, alpha=False):
    im = load(args[0])
    w, h = im.size
    k = int(args[1])
    lim = w if horizontal else h
    tol = int(opt(args, "--tol", "0"))
    a = int(args[2]) if len(args) > 2 else 0
    b = int(args[3]) if len(args) > 3 else lim - 1
    b = min(b, lim - 1)
    px = im.load()
    vals = [px[i, k] if horizontal else px[k, i] for i in range(a, b + 1)]
    if alpha:
        vals = [v[3] for v in vals]
        print(" ".join(rle(vals, a, str)))
    else:
        print(" ".join(rle(vals, a, hx, tol)))


def cmd_grid(args):
    im = load(args[0])
    x, y, w, h = nums(args[1])
    px = im.load()
    for j in range(y, y + h):
        print(f"{j:5d} " + " ".join(hx(px[i, j])[1:] for i in range(x, x + w)))


def cmd_palette(args):
    top = int(opt(args, "--top", "12"))
    im = load(args[0])
    x, y, w, h = nums(args[1])
    c = Counter(im.crop((x, y, x + w, y + h)).getdata())
    total = w * h
    for p, n in c.most_common(top):
        print(f"{hx(p)}  {n}  {100 * n / total:.1f}%")


def cmd_srgb(args):
    icc = Image.open(resolve(args[0])).info.get("icc_profile")
    t = srgb_transform(icc)
    for s in args[1:]:
        h = s.lstrip("#")
        c = tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))
        o = ImageCms.applyTransform(Image.new("RGB", (1, 1), c), t).getpixel((0, 0))
        print(f"#{h.lower()} stored -> #{o[0]:02x}{o[1]:02x}{o[2]:02x} sRGB")


def main():
    global SRGB
    if "--srgb" in sys.argv:
        sys.argv.remove("--srgb")
        SRGB = True
    if len(sys.argv) < 2 or (len(sys.argv) < 3 and sys.argv[1] != "previews"):
        sys.exit(__doc__)
    cmd, args = sys.argv[1], sys.argv[2:]
    {
        "info": cmd_info,
        "previews": cmd_previews,
        "preview": cmd_preview,
        "crop": cmd_crop,
        "at": cmd_at,
        "row": lambda a: line(a, True),
        "col": lambda a: line(a, False),
        "alpha-row": lambda a: line(a, True, True),
        "alpha-col": lambda a: line(a, False, True),
        "grid": cmd_grid,
        "palette": cmd_palette,
        "srgb": cmd_srgb,
    }.get(cmd, lambda a: sys.exit(__doc__))(args)


if __name__ == "__main__":
    main()
