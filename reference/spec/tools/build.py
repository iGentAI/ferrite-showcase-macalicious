#!/usr/bin/env python3
"""Assemble and check the specification. Run from anywhere; paths are relative to this file.

  build.py inventory   coverage/*.json + components/*.md + inventory-meta.json -> inventory.json, inventory.md
                       (each row also names what implements it: src/components/<id>/ when that
                       folder exists, else the "implementation" paths of inventory-meta.json)
  build.py check       structural checks: every manifest screenshot covered and viewed, crops in
                       bounds, every inventoried component has a spec file, every spec has the
                       required sections, every table value row carries a provenance tag, every
                       row is implemented and every component folder has a row
  build.py verify      re-sample cited pixels: for every line citing `file.png @ x,y` (a single
                       pixel) next to hex colours, check the pixel matches one of them (+-TOL)
  build.py annotate    add `(sRGB #rrggbb)` after every chromatic stored colour on measured lines
                       (idempotent); neutral greys are identical in both spaces and are left alone
  build.py audit [-v]  broad audit of every citation on lines that state colours (pixels and rectangles),
                       plus bounds of every citation
  build.py audit-shorthand [-v] [--progress FILE]  the same for citations written without a full
                       filename, where the file can be resolved from an abbreviated name or an earlier
                       name on the line; --progress makes the run resumable, one spec file at a time
  build.py sources     sources-data.json + citations in the specs -> sources.md
  build.py tokens      tokens-core.txt + tokens-intro.md + handoff/*.md -> tokens.json, tokens.md
"""
import glob
import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SPEC = os.path.normpath(os.path.join(HERE, ".."))
REF = os.path.normpath(os.path.join(SPEC, ".."))
REPO = os.path.normpath(os.path.join(REF, ".."))
COMPONENTS = os.path.join(REPO, "src", "components")
SHOTS = os.path.join(REF, "screenshots")
TOL = 3

REQUIRED_SECTIONS = [
    "## Purpose and behaviour",
    "## Variants and parameters",
    "## States",
    "## Measurements",
    "## Layout and spacing",
    "## Keyboard and accessibility",
    "## Evidence",
]


def manifest():
    with open(os.path.join(REF, "manifest.json")) as f:
        return json.load(f)["screenshots"]


def coverage():
    """filename -> coverage entry (with group)."""
    out = {}
    for p in sorted(glob.glob(os.path.join(SPEC, "coverage", "*.json"))):
        with open(p) as f:
            d = json.load(f)
        for s in d["screenshots"]:
            s["group"] = d["group"]
            if s["filename"] in out:
                raise SystemExit(f"{s['filename']} covered twice")
            out[s["filename"]] = s
    return out


def spec_header(path):
    with open(path) as f:
        text = f.read()
    m = re.match(r"# (.+?) \(`([^`]+)`\)", text)
    name = m.group(1).strip() if m else text.splitlines()[0].lstrip("# ").strip()

    def field(label):
        mm = re.search(r"^- \*\*%s:?\*\*:?\s*(.+)$" % label, text, re.M)
        return mm.group(1).strip() if mm else None

    status = (field("Status") or "").lower()
    return {
        "name": name,
        "status": "not seen" if status.startswith("not seen") else "present",
        "status_text": field("Status"),
        "appkit": field("AppKit"),
        "hig": re.findall(r"https://web\.archive\.org/\S+?/(?=[\s;,)]|$)", field("HIG") or ""),
        "appearances": field("Appearances shown"),
        "text": text,
    }


def implementation(cid, m):
    """What implements an inventory row, as repository paths: the component folder named after
    the row when it exists, else the paths the row names in inventory-meta.json (token files and
    the guide, for a row that specifies token behaviour). An empty list is an open row."""
    if os.path.isdir(os.path.join(COMPONENTS, cid)):
        return [f"src/components/{cid}/"]
    return list(m.get("implementation") or [])


def cmd_inventory():
    with open(os.path.join(SPEC, "inventory-meta.json")) as f:
        meta = json.load(f)
    man = {s["filename"]: s for s in manifest()}
    cov = coverage()
    sightings = {}
    for fn, entry in cov.items():
        for c in entry["components"]:
            cid = meta["aliases"].get(c["id"], c["id"])
            sightings.setdefault(cid, []).append(
                {
                    "screenshot": fn,
                    "appearance": man[fn]["appearance"],
                    "crop": c.get("crop"),
                    "clean": bool(c.get("clean")) and c.get("crop") is not None,
                    "note": c.get("note"),
                }
            )
    # Sightings added by the lead after cross-checking specs against coverage (each names its basis).
    for e in meta.get("extra_sightings", []):
        sightings.setdefault(e["id"], []).append(
            {"screenshot": e["screenshot"], "appearance": man[e["screenshot"]]["appearance"], "crop": e["crop"],
             "clean": True, "note": e.get("note")}
        )
        cov[e["screenshot"]]["components"].append({"id": e["id"]})
    components = []
    unknown = sorted(set(sightings) - set(meta["components"]))
    if unknown:
        raise SystemExit("coverage ids missing from inventory-meta.json: " + ", ".join(unknown))
    for cid, m in meta["components"].items():
        path = os.path.join(SPEC, "components", cid + ".md")
        head = spec_header(path) if os.path.exists(path) else None
        seen = sightings.get(cid, [])
        by_app = {"light": [], "dark": []}
        for s in seen:
            by_app[s["appearance"]].append(s)
        examples = {}
        for app, lst in by_app.items():
            clean = [s for s in lst if s["clean"]]
            # Prefer single-window captures (nothing overlaps the component) over full-screen ones.
            clean.sort(key=lambda s: 0 if man[s["screenshot"]]["capture"] == "window" else 1)
            examples[app] = clean[0] if clean else None
        # The spec's own Evidence table names the canonical clean example; use it when it parses.
        if head:
            ev = head["text"].split("## Evidence", 1)[1] if "## Evidence" in head["text"] else ""
            for row in ev.splitlines():
                cells = [c.strip() for c in row.strip().strip("|").split("|")]
                if len(cells) < 3 or cells[0].lower() not in ("light", "dark"):
                    continue
                fm = re.search(r"(10-15-Catalina-[A-Za-z0-9-]+)(?:\.png)?", cells[1])
                cm = re.match(r"`?(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)`?$", cells[2])
                fn = fm.group(1) + ".png" if fm else None
                if not (fn in man and cm) or man[fn]["appearance"] != cells[0].lower() or examples[cells[0].lower()] is None:
                    continue
                x, y, w, h = map(int, cm.groups())
                if x + w > man[fn]["width"] or y + h > man[fn]["height"]:
                    continue
                key = cells[0].lower()
                if not examples[key].get("from_spec"):
                    examples[key] = {"screenshot": fn, "crop": [x, y, w, h], "note": cells[3] if len(cells) > 3 else None, "from_spec": True}
        status = "present" if seen else "not seen"
        if head and head["status"] == "not seen" and not seen:
            status = "not seen"
        components.append(
            {
                "id": cid,
                "name": m["name"],
                "category": m["category"],
                "appkit": m.get("appkit") or (head or {}).get("appkit"),
                "hig": (head or {}).get("hig") or [],
                "status": m.get("status_override") or status,
                "status_note": m.get("status_note"),
                "spec": f"components/{cid}.md" if head else m.get("spec"),
                "batch": m.get("batch"),
                "implementation": implementation(cid, m),
                "screenshot_count": {a: len({s["screenshot"] for s in l}) for a, l in by_app.items()},
                "clean_example": {
                    a: ({"screenshot": e["screenshot"], "crop": e["crop"], "note": e["note"]} if e else None)
                    for a, e in examples.items()
                },
                "sightings": seen,
            }
        )
    out = {
        "generated_by": "reference/spec/tools/build.py inventory",
        "units": "crop rectangles are [x, y, w, h] in image pixels of the 2x screenshot",
        "screenshots_total": len(man),
        "screenshots_viewed": sum(1 for s in cov.values() if s.get("viewed")),
        "components_total": len(components),
        "components_present": sum(1 for c in components if c["status"] == "present"),
        "components_not_seen": sum(1 for c in components if c["status"] != "present"),
        "components_implemented": sum(1 for c in components if c["implementation"]),
        "components": components,
        "screenshots": [
            {
                "filename": fn,
                "appearance": man[fn]["appearance"],
                "app": man[fn]["app"],
                "reviewed_by_group": cov[fn]["group"],
                "summary": cov[fn].get("summary"),
                "components": sorted({meta["aliases"].get(c["id"], c["id"]) for c in cov[fn]["components"]}),
            }
            for fn in sorted(cov)
        ],
    }
    with open(os.path.join(SPEC, "inventory.json"), "w") as f:
        json.dump(out, f, indent=1)
        f.write("\n")

    def ex(e):
        if not e:
            return "none"
        x, y, w, h = e["crop"]
        return f"`{e['screenshot'][len('10-15-Catalina-'):]}` @ {x},{y},{w},{h}"

    def impl(c):
        # Paths are relative to the repository root; the links are relative to this file.
        return ", ".join(f"[`{p}`](../../{p})" for p in c["implementation"]) or "**open**"

    open_rows = [c["id"] for c in components if not c["implementation"]]

    lines = [
        "# Catalina component inventory",
        "",
        "Generated by `tools/build.py inventory` from `coverage/*.json`, `components/*.md` and",
        "`inventory-meta.json`. Do not edit by hand. The machine-readable form, with every sighting of",
        "every component (screenshot, crop rectangle, note), is `inventory.json`.",
        "",
        f"- Screenshots in the manifest: {out['screenshots_total']}; reviewed: {out['screenshots_viewed']}.",
        f"- Components and patterns inventoried: {out['components_total']} "
        f"({out['components_present']} present, {out['components_not_seen']} not seen in the screenshots).",
        "- Crop rectangles are `x,y,w,h` in image pixels; filenames omit the common `10-15-Catalina-` prefix.",
        "- \"Shots\" is the number of screenshots in which the component was recorded (light / dark).",
        "- \"Implemented by\" is what builds the row in this repository: the component folder with the",
        "  row's id, or, for a row that specifies token behaviour, the token files and the guide.",
        f"  Implemented: {out['components_implemented']} of {out['components_total']}; open: "
        + (", ".join(f"`{i}`" for i in open_rows) if open_rows else "none") + ".",
        "",
    ]
    for cat in meta["categories"]:
        rows = [c for c in components if c["category"] == cat["id"]]
        if not rows:
            continue
        lines += [f"## {cat['title']}", "", "| Component | AppKit | Status | Shots L/D | Clean example, light | Clean example, dark | Batch | Implemented by |", "|---|---|---|---|---|---|---|---|"]
        for c in rows:
            link = f"[{c['name']}]({c['spec']})" if c["spec"] else c["name"]
            status = c["status"] + (f" ({c['status_note']})" if c["status_note"] else "")
            appkit = (c["appkit"] or "").replace("|", "/")
            if len(appkit) > 90:
                appkit = appkit[:87] + "..."
            lines.append(
                f"| {link} `{c['id']}` | {appkit} | {status} | {c['screenshot_count']['light']} / {c['screenshot_count']['dark']} "
                f"| {ex(c['clean_example']['light'])} | {ex(c['clean_example']['dark'])} | {c['batch'] or ''} | {impl(c)} |"
            )
        lines.append("")
    with open(os.path.join(SPEC, "inventory.md"), "w") as f:
        f.write("\n".join(lines))
    print(f"inventory: {out['components_total']} components ({out['components_present']} present, "
          f"{out['components_not_seen']} not seen; {out['components_implemented']} implemented); "
          f"{out['screenshots_viewed']}/{out['screenshots_total']} screenshots")


def cmd_check():
    problems = []
    man = {s["filename"]: s for s in manifest()}
    cov = coverage()
    for fn in man:
        if fn not in cov:
            problems.append(f"not covered: {fn}")
        elif not cov[fn].get("viewed"):
            problems.append(f"not viewed: {fn}")
        elif not cov[fn]["components"]:
            problems.append(f"no components listed: {fn}")
    for fn in cov:
        if fn not in man:
            problems.append(f"coverage names unknown file: {fn}")
            continue
        w, h = man[fn]["width"], man[fn]["height"]
        if cov[fn].get("appearance") != man[fn]["appearance"]:
            problems.append(f"appearance mismatch: {fn}")
        for c in cov[fn]["components"]:
            crop = c.get("crop")
            if c.get("clean") and not crop:
                problems.append(f"clean without crop: {fn} {c['id']}")
            if crop:
                x, y, cw, ch = crop
                if x < 0 or y < 0 or cw <= 0 or ch <= 0 or x + cw > w or y + ch > h:
                    problems.append(f"crop out of bounds: {fn} {c['id']} {crop} in {w}x{h}")
    meta_path = os.path.join(SPEC, "inventory-meta.json")
    if os.path.exists(meta_path):
        with open(meta_path) as f:
            meta = json.load(f)
        for cid, m in meta["components"].items():
            if not m.get("spec") and not os.path.exists(os.path.join(SPEC, "components", cid + ".md")):
                problems.append(f"no spec file: {cid}")
            elif m.get("spec") and not os.path.exists(os.path.normpath(os.path.join(SPEC, m["spec"]))):
                problems.append(f"spec of {cid} does not exist: {m['spec']}")
            paths = implementation(cid, m)
            if not paths:
                problems.append(f"open row, nothing implements it: {cid}")
            for path in paths:
                if not os.path.exists(os.path.join(REPO, path)):
                    problems.append(f"implementation of {cid} does not exist: {path}")
        if os.path.isdir(COMPONENTS):
            for name in sorted(os.listdir(COMPONENTS)):
                if os.path.isdir(os.path.join(COMPONENTS, name)) and name not in meta["components"]:
                    problems.append(f"component folder without an inventory row: src/components/{name}/")
        for p in glob.glob(os.path.join(SPEC, "components", "*.md")):
            cid = os.path.basename(p)[:-3]
            if cid not in meta["components"]:
                problems.append(f"spec file not in inventory-meta: {cid}")
    untagged = 0
    for p in sorted(glob.glob(os.path.join(SPEC, "components", "*.md"))):
        text = open(p).read()
        for sec in REQUIRED_SECTIONS:
            if sec.lower() not in text.lower():
                problems.append(f"{os.path.basename(p)}: missing section {sec}")
        in_meas = False
        lines = text.splitlines()
        table_tagged = False
        for idx, line in enumerate(lines):
            if line.startswith("## "):
                in_meas = line.lower().startswith("## measurements")
            is_row = line.startswith("|")
            if is_row and (idx == 0 or not lines[idx - 1].startswith("|")):
                # First row of a table: a matrix may carry one tag for all of its cells, stated in
                # its header row or in the paragraph that introduces it (up to 8 lines above).
                intro = " ".join(lines[max(0, idx - 8) : idx + 1])
                table_tagged = bool(re.search(r"\[(M|D|I|C)[\]:; ]", intro))
                continue
            if in_meas and is_row and not re.match(r"\|\s*:?-", line):
                if re.search(r"#[0-9a-fA-F]{6}|\d", line) and not table_tagged and not re.search(r"\[(M|D|I|C)[\]:; ]", line):
                    untagged += 1
                    problems.append(f"{os.path.basename(p)}: untagged measurement row: {line[:90]}")
    print(f"{len(problems)} problem(s); {untagged} untagged measurement rows")
    for p in problems:
        print(" -", p)
    return 1 if problems else 0


CITE = re.compile(r"(10-15-Catalina-[A-Za-z0-9-]+?)(?:\.png)?`?\s*@\s*(\d+)\s*,\s*(\d+)\b(?!\s*,\s*\d)")
CITE_ANY = re.compile(r"(10-15-Catalina-[A-Za-z0-9-]+?)(?:\.png)?`?\s*@\s*`?(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d+)\s*,\s*(\d+))?")


def cmd_audit():
    """Broad audit: every citation (pixel or rectangle) on a line that also states hex colours.

    A pixel citation passes when the pixel matches one of the line's colours; a rectangle passes when
    at least one of the line's colours occurs inside it. Lines whose colours belong to other
    citations can fail without being wrong, so failures are listed for review, not auto-fixed.
    Rectangles and pixels outside the image are always errors.
    """
    from PIL import Image

    cache = {}

    def img(fn):
        if fn not in cache:
            if len(cache) > 4:
                cache.pop(next(iter(cache)))
            cache[fn] = Image.open(os.path.join(SHOTS, fn)).convert("RGBA")
        return cache[fn]

    files = sorted(glob.glob(os.path.join(SPEC, "components", "*.md")) + glob.glob(os.path.join(SPEC, "apps", "*.md")))
    jobs = []
    for p in files:
        for n, line in enumerate(open(p), 1):
            clean = re.sub(r"\(sRGB #[0-9a-f]{6}\)", "", line)
            hexes = [tuple(int(h[i : i + 2], 16) for i in (0, 2, 4)) for h in HEX.findall(clean)]
            for stem, x, y, w, h in CITE_ANY.findall(clean):
                jobs.append((stem + ".png", int(x), int(y), int(w) if w else None, int(h) if h else None, hexes, os.path.relpath(p, SPEC), n))
    jobs.sort(key=lambda j: j[0])
    stats = {"citations": 0, "out_of_bounds": 0, "missing_file": 0, "pixel_checked": 0, "pixel_ok": 0, "rect_checked": 0, "rect_ok": 0}
    bad = []
    for fn, x, y, w, h, hexes, rel, n in jobs:
        stats["citations"] += 1
        if not os.path.exists(os.path.join(SHOTS, fn)):
            stats["missing_file"] += 1
            bad.append(f"{rel}:{n} missing file {fn}")
            continue
        im = img(fn)
        if x >= im.width or y >= im.height or (w and (x + w > im.width or y + h > im.height)):
            stats["out_of_bounds"] += 1
            bad.append(f"{rel}:{n} {fn} @ {x},{y}{',%d,%d' % (w, h) if w else ''} outside {im.width}x{im.height}")
            continue
        if not hexes:
            continue
        if w is None:
            stats["pixel_checked"] += 1
            got = im.getpixel((x, y))[:3]
            if any(all(abs(a - b) <= TOL for a, b in zip(got, hx_)) for hx_ in hexes):
                stats["pixel_ok"] += 1
            elif "-v" in sys.argv:
                bad.append(f"{rel}:{n} {fn} @ {x},{y} is #%02x%02x%02x" % got)
        elif w * h <= 400000:
            stats["rect_checked"] += 1
            px = set(c[:3] for c in im.crop((x, y, x + w, y + h)).get_flattened_data())
            if any(any(all(abs(a - b) <= TOL for a, b in zip(c, hx_)) for c in px) for hx_ in hexes):
                stats["rect_ok"] += 1
            elif "-v" in sys.argv:
                bad.append(f"{rel}:{n} {fn} @ {x},{y},{w},{h}: none of the line's colours occur")
    print(json.dumps(stats))
    for b in bad:
        print(" -", b)
HEX = re.compile(r"#([0-9a-fA-F]{6})\b")


def cmd_verify():
    from PIL import Image

    cache = {}

    def px(fn, x, y):
        if fn not in cache:
            if len(cache) > 6:
                cache.pop(next(iter(cache)))
            cache[fn] = Image.open(os.path.join(SHOTS, fn)).convert("RGBA")
        im = cache[fn]
        if x >= im.width or y >= im.height:
            return None
        return im.getpixel((x, y))

    files = sorted(glob.glob(os.path.join(SPEC, "components", "*.md")) + glob.glob(os.path.join(SPEC, "apps", "*.md")))
    if len(sys.argv) > 2:
        files = [f for f in files if any(a in f for a in sys.argv[2:])]
    total = ok = missing = 0
    bad = []
    jobs = []
    for p in files:
        for n, line in enumerate(open(p), 1):
            hexes = [tuple(int(h[i : i + 2], 16) for i in (0, 2, 4)) for h in HEX.findall(re.sub(r"\(sRGB #[0-9a-f]{6}\)", "", line))]
            cites = CITE.findall(line)
            if not hexes or not cites:
                continue
            # Only unambiguous lines: one single-pixel citation on the line.
            if len(cites) != 1:
                continue
            stem, x, y = cites[0]
            jobs.append((stem + ".png", int(x), int(y), hexes, os.path.relpath(p, SPEC), n))
    jobs.sort()
    for fn, x, y, hexes, rel, n in jobs:
        if not os.path.exists(os.path.join(SHOTS, fn)):
            missing += 1
            bad.append(f"{rel}:{n} cites missing file {fn}")
            continue
        total += 1
        got = px(fn, x, y)
        if got is None:
            bad.append(f"{rel}:{n} {fn} @ {x},{y} is outside the image")
            continue
        if any(all(abs(a - b) <= TOL for a, b in zip(got[:3], h)) for h in hexes):
            ok += 1
        else:
            want = " ".join("#%02x%02x%02x" % h for h in hexes[:4])
            bad.append(f"{rel}:{n} {fn} @ {x},{y} is #%02x%02x%02x a=%d, line says {want}" % got)
    print(f"single-pixel citations checked: {total}; reproduce within +-{TOL}: {ok}; mismatched: {total - ok}; missing files: {missing}")
    for b in bad:
        print(" -", b)


def cmd_annotate():
    from PIL import Image, ImageCms

    icc = Image.open(os.path.join(SHOTS, "10-15-Catalina-Light-System-Preferences-General.png")).info["icc_profile"]
    t = ImageCms.buildTransform(
        ImageCms.ImageCmsProfile(io.BytesIO(icc)), ImageCms.createProfile("sRGB"), "RGB", "RGB",
        renderingIntent=ImageCms.Intent.RELATIVE_COLORIMETRIC,
    )
    memo = {}

    def conv(h):
        h = h.lower()
        if h not in memo:
            c = tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))
            o = ImageCms.applyTransform(Image.new("RGB", (1, 1), c), t).getpixel((0, 0))
            memo[h] = "%02x%02x%02x" % o
        return memo[h]

    pat = re.compile(r"(?<!sRGB )#([0-9a-fA-F]{6})\b(?!\s*\(sRGB)(?![0-9a-fA-F])")
    changed = 0
    count = 0
    targets = sorted(
        glob.glob(os.path.join(SPEC, "components", "*.md"))
        + glob.glob(os.path.join(SPEC, "apps", "*.md"))
        + glob.glob(os.path.join(SPEC, "handoff", "*.md"))
    )
    for p in targets:
        out = []
        dirty = False
        fence = False
        for line in open(p):
            if line.lstrip().startswith("```"):
                fence = not fence
            # Documented-only values (Apple's published sRGB numbers) are not stored-pixel values.
            documented_only = "[D]" in line and "[M]" not in line and "[C]" not in line
            already_srgb = "sRGB value" in line or "already sRGB" in line
            if fence or documented_only or already_srgb:
                out.append(line)
                continue

            def sub(m):
                nonlocal dirty, count
                h = m.group(1)
                c = [int(h[i : i + 2], 16) for i in (0, 2, 4)]
                if max(c) - min(c) <= 2:
                    return m.group(0)
                s = conv(h)
                if s == h.lower():
                    return m.group(0)
                dirty = True
                count += 1
                return f"#{h} (sRGB #{s})"

            out.append(pat.sub(sub, line))
        if dirty:
            with open(p, "w") as f:
                f.writelines(out)
            changed += 1
    print(f"annotated {count} colours in {changed} files")


def _srgb_converter():
    from PIL import Image, ImageCms

    icc = Image.open(os.path.join(SHOTS, "10-15-Catalina-Light-System-Preferences-General.png")).info["icc_profile"]
    t = ImageCms.buildTransform(
        ImageCms.ImageCmsProfile(io.BytesIO(icc)), ImageCms.createProfile("sRGB"), "RGB", "RGB",
        renderingIntent=ImageCms.Intent.RELATIVE_COLORIMETRIC,
    )
    memo = {}

    def rgb(c):
        c = tuple(c)
        if max(c) - min(c) <= 2:
            return c
        if c not in memo:
            memo[c] = ImageCms.applyTransform(Image.new("RGB", (1, 1), c), t).getpixel((0, 0))
        return memo[c]

    def text(s):
        """Convert every #rrggbb and rgb()/rgba() colour in a value string from stored to sRGB."""
        s = re.sub(
            r"#([0-9a-fA-F]{6})\b",
            lambda m: "#%02x%02x%02x" % rgb(int(m.group(1)[i : i + 2], 16) for i in (0, 2, 4)),
            s,
        )
        return re.sub(
            r"rgba?\((\d+),\s*(\d+),\s*(\d+)",
            lambda m: m.group(0).split("(")[0] + "(%d,%d,%d" % rgb(int(m.group(i)) for i in (1, 2, 3)),
            s,
        )

    return text


def handoff_token_rows():
    rows = []
    for p in sorted(glob.glob(os.path.join(SPEC, "handoff", "*.md"))):
        group = os.path.basename(p)[:-3]
        sec = None
        hdr = None
        for line in open(p):
            if line.startswith("#"):
                sec = line.strip("# \n")
                hdr = None
                continue
            if not line.startswith("|"):
                hdr = None
                continue
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if hdr is None:
                hdr = [c.lower() for c in cells]
                continue
            if re.match(r":?-+", cells[0]) or "token" not in hdr[0] or len(cells) < 5:
                continue
            # Earlier annotation passes add "(sRGB #...)" notes; strip them to get stored values back.
            clean = [re.sub(r"\s*\(sRGB #[0-9a-f]{6}\)", "", c).replace("`", "") for c in cells]
            rows.append({"family": group, "section": sec, "token": clean[0], "light": clean[1], "dark": clean[2],
                         "tag": clean[3], "evidence": " | ".join(clean[4:])})
    return rows


ACCENTS = ["blue", "purple", "pink", "red", "orange", "yellow", "green", "graphite"]


def token_srgb(light, dark, tag, conv):
    """The sRGB values of one tokens-core.txt row, as (light, dark).

    Stored pixels are converted with conv. Documented values are published sRGB numbers, never
    stored pixels, and are kept as written. A tag may say so for one appearance only:
    "[D] light, [M] dark" converts the dark value and keeps the light one."""
    doc_light = tag == "[D]" or tag.startswith("[D] light")
    doc_dark = tag == "[D]" or tag.endswith("[D] dark")
    return (light if doc_light else conv(light), dark if doc_dark else conv(dark))


def cmd_tokens():
    conv = _srgb_converter()
    scaffold = ""
    for p in glob.glob(os.path.join(REF, "..", "src", "styles", "tokens", "*.css")):
        scaffold += open(p).read()
    sections = []
    cur = None
    for raw in open(os.path.join(SPEC, "tokens-core.txt")):
        line = raw.rstrip("\n")
        if line.startswith("## "):
            f, title = [x.strip() for x in line[3:].split("|", 1)]
            cur = {"file": f, "title": title, "tokens": []}
            sections.append(cur)
            continue
        if not line.strip() or line.startswith("#"):
            continue
        cells = [c.strip() for c in line.split(" | ")]
        cells += [""] * (6 - len(cells))
        name, light, dark, tag, evidence, note = cells[:6]
        if dark == "=":
            dark = light
        base = re.sub(r"\[.*\]$", "", name)
        light_srgb, dark_srgb = token_srgb(light, dark, tag, conv)
        cur["tokens"].append({
            "name": name,
            "in_scaffold": (base + ":") in scaffold,
            "light": {"stored": light, "srgb": light_srgb},
            "dark": {"stored": dark, "srgb": dark_srgb},
            "tag": tag,
            "evidence": evidence,
            "note": note,
        })
    rows = handoff_token_rows()
    accent = {}
    family = []
    for r in rows:
        m = re.match(r"accent\.(%s)\.(.+)$" % "|".join(ACCENTS), r["token"])
        if m and r["section"] and r["section"].startswith("Per-accent"):
            e = accent.setdefault(m.group(2), {}).setdefault(m.group(1), {})
            for app in ("light", "dark"):
                v = r[app]
                e[app] = None if v in ("-", "") else {"stored": v, "srgb": conv(v)}
            e["evidence"] = r["evidence"]
        else:
            r = dict(r)
            r["light_srgb"] = conv(r["light"])
            r["dark_srgb"] = conv(r["dark"])
            family.append(r)
    out = {
        "generated_by": "reference/spec/tools/build.py tokens (from tokens-core.txt and handoff/*.md)",
        "colour_space": "`stored` is the pixel value in the reference PNG (Display P3-like 'Display' profile); `srgb` is "
                        "that value converted through the embedded profile, relative colorimetric, and is the value for CSS. "
                        "Neutral greys are identical in both.",
        "units": "px in token values are CSS px = AppKit points",
        "core": sections,
        "accent_matrix": {"accents": ACCENTS, "keys": accent,
                          "evidence_note": "a bare x,y is that pixel in 10-15-Catalina-Theme-Light-<Accent>.png (light) and "
                                           "10-15-Catalina-Theme-Dark-<Accent>.png (dark); L/D/Mo/Ev prefixes select the Light, Dark, "
                                           "Morning or Evening file"},
        "family": family,
    }
    with open(os.path.join(SPEC, "tokens.json"), "w") as f:
        json.dump(out, f, indent=1)
        f.write("\n")

    def cell(v):
        return v.replace("|", "\\|")

    md = [open(os.path.join(SPEC, "tokens-intro.md")).read().rstrip(), ""]
    n_core = n_new = 0
    for s in sections:
        md += [f"### `{s['file']}`: {s['title']}", "", "| Token | Light (CSS, sRGB) | Dark (CSS, sRGB) | Tag | In scaffold | Evidence | Note |", "|---|---|---|---|---|---|---|"]
        for t in s["tokens"]:
            n_core += 1
            n_new += not t["in_scaffold"]

            def show(v):
                if v["stored"] == v["srgb"]:
                    return f"`{cell(v['srgb'])}`"
                return f"`{cell(v['srgb'])}` (stored `{cell(v['stored'])}`)"

            md.append(f"| `{t['name']}` | {show(t['light'])} | {show(t['dark'])} | {t['tag']} | {'yes' if t['in_scaffold'] else 'new'} | {cell(t['evidence'])} | {cell(t['note'])} |")
        md.append("")
    md += ["## Accent matrix", "",
           "Every accent-tinted value for the eight accents, measured on the 32 accent screenshots. Values are "
           "sRGB (CSS-ready); the stored pixel values and the pixel coordinates are in `tokens.json` "
           "(`accent_matrix`) and in `components/accent-colors.md`. All values [M]. A dash means the element has "
           "no such part in that appearance.", "",
           "Key meanings: `swatch` the pure accent (picker dot; use as `--mac-accent-light/-dark`); `swatch.ring` the "
           "dot's 1 pt border; `selection-ring` the Appearance thumbnail ring; `control.fill` checkbox and radio on "
           "fill (flat in light, the 50% row of the gradient in dark); `control.top-line` light 0.5 pt edge / dark top "
           "highlight row; `control.gradient.start/end` dark gradient first and last rows; `cap.*` pop-up button cap "
           "(the same gradient as the default button and the selected tab): top line, stops at 0/25/50/75/100%, "
           "bottom and right edges; `glyph.*` arrows, radio dot, checkmark and the 0.5 pt shadow under light glyphs; "
           "`menu.selection` and `menubar.selection` the highlighted menu item and open menu title over the Day "
           "wallpaper (light) and the Dark wallpaper; `.morning` / `.evening` the same over those wallpapers; "
           "`highlight` the selected-text background preset and `highlight.border` its chip border.", ""]
    for app in ("light", "dark"):
        md += [f"### {app.capitalize()} appearance", "", "| Key | " + " | ".join(a.capitalize() for a in ACCENTS) + " |", "|---|" + "---|" * len(ACCENTS)]
        for key, per in accent.items():
            vals = [(per.get(a, {}).get(app) or {}).get("srgb") for a in ACCENTS]
            if not any(vals):
                continue
            md.append(f"| `{key}` | " + " | ".join(f"`{v}`" if v else "-" for v in vals) + " |")
        md.append("")
    md += ["## Family token tables", "",
           f"The {len(family)} token-candidate rows of the seven family reports (measured and computed values, "
           "with the inferred and adopted ones tagged [I] in their rows; control-level "
           "metrics, colours, gradients and recipes) are kept with their pixel evidence in `handoff/<family>.md` "
           "under \"Token candidates\", and machine-readable, with stored and sRGB values, in `tokens.json` "
           "(`family`). They are component-level values: build them into the component styles (or into "
           "`controls.css` if several components share them) rather than into the global colour tokens.", "",
           "| Family report | Rows | Covers |", "|---|---|---|"]
    covers = {
        "sysA": "rounded bezel, default button, help, gradient, bevel, disclosure, lock, pop-up, pull-down, combo box, segmented control, accent swatches, System Preferences shell",
        "sysB": "checkbox, radio, switch, slider, stepper, text and search fields, token, type styles, focus ring, tab view, box, separator, date picker, wells, progress, level indicator, bordered list",
        "chrome": "window, shadows, title bar and toolbar variants, window controls, toolbar controls, tab bars, Safari bars, scope bar, path bar, bottom bars",
        "views": "sidebar, tables, headers, outline, lists, column, icon and gallery views, split dividers, scrollers, text view, ruler, tags",
        "system": "menu bar, menus, Dock, stacks, desktop, Spotlight, Notification Center, Launchpad, Mission Control, app switcher, Siri, dictation, login, Time Machine, materials",
        "dialogs": "dialogs, alerts, sheets, preferences toolbar, notifications, inspector, open and print panels, selection, accent picker (the per-accent rows are the matrix above)",
        "apps": "HUD, media app chrome, Catalyst chrome, cards, pill button, Calculator, Stickies, Home, Stocks, Voice Memos",
    }
    from collections import Counter

    counts = Counter(r["family"] for r in family)
    for fam in sorted(counts):
        md.append(f"| [`handoff/{fam}.md`](handoff/{fam}.md) | {counts[fam]} | {covers.get(fam, '')} |")
    md.append("")
    with open(os.path.join(SPEC, "tokens.md"), "w") as f:
        f.write("\n".join(md))
    print(f"tokens: {n_core} core ({n_new} proposed new names), {len(accent)} accent keys x {len(ACCENTS)} accents, {len(family)} family rows")


def cmd_sources():
    with open(os.path.join(SPEC, "sources-data.json")) as f:
        data = json.load(f)
    specs = {}
    for p in sorted(glob.glob(os.path.join(SPEC, "components", "*.md")) + glob.glob(os.path.join(SPEC, "apps", "*.md"))):
        specs[os.path.relpath(p, SPEC)[:-3]] = open(p).read()

    def users(test, limit=14):
        ids = [k.split("/", 1)[1] for k, t in specs.items() if k.startswith("components/") and test(t)]
        more = len(ids) - limit
        return ", ".join(f"`{i}`" for i in ids[:limit]) + (f" and {more} more" if more > 0 else "") if ids else "not cited by a component spec"

    L = [
        "# Sources",
        "",
        "Generated by `tools/build.py sources` from `sources-data.json` and the citations inside the specs.",
        "",
        "## Visual source of truth",
        "",
        "- 512 Pixels, Aqua Screenshot Library, macOS 10.15 Catalina (screenshots by Stephen Hackett):",
        "  <https://512pixels.net/projects/aqua-screenshot-library/macos-10-15-catalina/>. All 294 original",
        "  images are in `reference/screenshots/` and catalogued in `reference/manifest.json`. Every measured",
        "  value in this specification comes from those pixels.",
        "",
        "## Apple Human Interface Guidelines, macOS, as of Catalina",
        "",
        "Apple replaced the macOS HIG with the macOS 11 design in June 2020 and later merged all platforms into",
        "one guide, so the live pages no longer describe Catalina. This specification uses the Internet",
        "Archive snapshots of 3 and 4 May 2020 (macOS 10.15.4 was current). Each row gives the exact snapshot",
        "that was read. Component specs cite either that URL or the same page under the timestamp",
        "`20200503145009`, which the archive redirects to the snapshot listed here.",
        "",
        "| HIG section | Page | Archived snapshot read | Cited by |",
        "|---|---|---|---|",
    ]
    for h in sorted(data["hig"], key=lambda h: (h["section"], h["page"])):
        needle = f"/macos/{h['section']}/{h['page']}/"
        L.append(f"| {h['section']} | {h['title']} | <{h['url']}> | {users(lambda t: needle in t)} |")
    L += [
        "",
        "The HIG pages contain no dimensions or colour values for controls apart from the system colour table",
        "(used for the `--mac-color-system-*` tokens); they are the source for names, purpose, behaviour and",
        "usage rules. The Siri window is not covered by the macOS HIG and has no citation.",
        "",
        "## AppKit and related framework reference",
        "",
        "Class, style and property names in the specs are AppKit's public API names. The pages below are the",
        "current Apple developer documentation for each symbol named in a component spec's `AppKit:` line. They",
        "were confirmed to exist, and their macOS availability read, through the documentation site's data",
        "endpoint; they were used for names and availability only (the pages are not version-specific, so no",
        "archived copy is needed, and nothing introduced after 10.15 is used as a Catalina API).",
        "",
        "| Symbol | Documentation | macOS availability reported | Named in |",
        "|---|---|---|---|",
    ]
    for sym, a in sorted(data["appkit"].items()):
        avail = a["introduced"] + "+" if a.get("introduced") else "not stated on the page (predates availability annotations)"
        if a.get("deprecated"):
            avail += f", deprecated {a['deprecated']}"
        if a.get("introduced") and a["introduced"].split(".")[0].isdigit() and int(a["introduced"].split(".")[0]) >= 11:
            avail += " (later than Catalina: mentioned only to say it is not used)"
        L.append(f"| `{sym}` | <{a['url']}> | {avail} | {users(lambda t: re.search(r'AppKit:\*\*.*' + re.escape(sym) + r'\b', t) is not None, 8)} |")
    L += [
        "",
        "Symbols named in specs that have no documentation page of their own (enum cases, image names or",
        "private classes, for example `NSBezelStyle` cases, `NSImage.Name` constants such as `NSAddTemplate`",
        "and `NSStatusAvailable`, and the private `NSTitlebarView`) are documented on their parent type's page.",
        "",
        "## Values taken from memory of Apple material rather than a retrieved page",
        "",
        "- SF Pro Text tracking values per point size (`--mac-tracking-*`): Apple published these in its design",
        "  resources and in older HIG typography pages. The table could not be found in the archived May 2020,",
        "  June 2019 or July 2018 snapshots of the iOS typography page, so the three values used are tagged [D]",
        "  but are unverified here; they only matter when the fallback font is in use.",
        "- San Francisco cap height (0.705 em) and x-height (0.52 em), used to compute font sizes from measured",
        "  cap heights: font metrics of SF Pro, stated from memory and checked for consistency against text whose",
        "  size is documented (13 pt system font, 11 pt small system font).",
        "- AppKit catalog colour values quoted for comparison in `tokens.md` (for example `#007aff`): from the",
        "  HIG system colour table where it lists them, otherwise from memory and marked as such.",
        "",
    ]
    with open(os.path.join(SPEC, "sources.md"), "w") as f:
        f.write("\n".join(L))
    print(f"sources: {len(data['hig'])} HIG pages, {len(data['appkit'])} API pages")


SHORT = re.compile(r"@\s*`?(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d+)\s*,\s*(\d+))?")
NAME = re.compile(r"((?:10-15-Catalina-)?(?:Light|Dark|Theme)-[A-Za-z0-9-]+?)(?:\.png)?(?=[`\s@,;:)|/]|$)")


def _audit_shorthand(files):
    """Audit the shorthand citations of the given spec files; returns (stats, context stats, messages).

    The file is resolved from (a) an abbreviated name directly before the `@` (for example
    `Light-Mail @ 250,600`), or (b) the nearest screenshot name earlier on the same line. A citation
    whose file cannot be resolved this way is counted as unresolved and not checked. Resolved citations
    get the same checks as `audit`: bounds always; on lines that state colours, a pixel must match one of
    them and a rectangle must contain one of them (same caveat: a line's colours may belong to another
    citation on that line).
    """
    from PIL import Image

    man = manifest()
    stems = {s["filename"][:-4] for s in man}
    counterpart = {s["filename"][:-4]: (s.get("counterpart") or "")[:-4] for s in man}
    appearance = {s["filename"][:-4]: s["appearance"] for s in man}

    def resolve(name):
        if name in stems:
            return name
        full = "10-15-Catalina-" + name
        if full in stems:
            return full
        return None

    cache = {}

    def img(fn):
        if fn not in cache:
            if len(cache) > 4:
                cache.pop(next(iter(cache)))
            cache[fn] = Image.open(os.path.join(SHOTS, fn + ".png")).convert("RGBA")
        return cache[fn]

    jobs = []
    context_jobs = []
    file_names = {}
    for p in files:
        found = {resolve(m.group(1)) for m in NAME.finditer(open(p).read())}
        found.discard(None)
        found |= {counterpart[s] for s in list(found) if counterpart.get(s)}
        file_names[p] = sorted(found)
    stats = {"shorthand": 0, "unresolved": 0, "resolved": 0, "out_of_bounds": 0, "pixel_checked": 0, "pixel_ok": 0,
             "rect_checked": 0, "rect_ok": 0}
    for p in files:
        for n, line in enumerate(open(p), 1):
            clean = re.sub(r"\(sRGB #[0-9a-f]{6}\)", "", line)
            full_spans = [m.span() for m in CITE_ANY.finditer(clean)]
            names = [(m.end(), resolve(m.group(1))) for m in NAME.finditer(clean)]
            names = [(e, s) for e, s in names if s]
            hexes = [tuple(int(h[i : i + 2], 16) for i in (0, 2, 4)) for h in HEX.findall(clean)]
            for m in SHORT.finditer(clean):
                if any(a <= m.start() < b for a, b in full_spans):
                    continue
                stats["shorthand"] += 1
                before = [s for e, s in names if e <= m.start()]
                x, y, w, h = m.groups()
                geom = (int(x), int(y), int(w) if w else None, int(h) if h else None)
                if not before:
                    # No name on the line: the file is named elsewhere in the spec (a table caption, a
                    # section header). Candidates are every screenshot named in this spec file.
                    context_jobs.append((file_names[p], geom, hexes, os.path.relpath(p, SPEC), n))
                    continue
                fn = before[-1]
                # "Dark @ ..." / "D @ ..." after a light file name means that file's dark counterpart.
                word = re.search(r"([A-Za-z]+)[\s`:(]*$", clean[: m.start()])
                word = word.group(1).lower() if word else ""
                want = {"dark": "dark", "d": "dark", "light": "light", "l": "light"}.get(word)
                if want and appearance.get(fn) != want and counterpart.get(fn):
                    fn = counterpart[fn]
                jobs.append((fn,) + geom + (hexes, os.path.relpath(p, SPEC), n))
    jobs.sort(key=lambda j: j[0])
    bad = []
    for fn, x, y, w, h, hexes, rel, n in jobs:
        stats["resolved"] += 1
        im = img(fn)
        if x >= im.width or y >= im.height or (w and (x + w > im.width or y + h > im.height)):
            stats["out_of_bounds"] += 1
            bad.append(f"{rel}:{n} {fn} @ {x},{y}{',%d,%d' % (w, h) if w else ''} outside {im.width}x{im.height}")
            continue
        if not hexes:
            continue
        if w is None:
            stats["pixel_checked"] += 1
            got = im.getpixel((x, y))[:3]
            if any(all(abs(a - b) <= TOL for a, b in zip(got, hx_)) for hx_ in hexes):
                stats["pixel_ok"] += 1
            elif "-v" in sys.argv:
                bad.append(f"{rel}:{n} {fn} @ {x},{y} is #%02x%02x%02x" % got)
        elif w * h <= 400000:
            stats["rect_checked"] += 1
            px = set(c[:3] for c in im.crop((x, y, x + w, y + h)).get_flattened_data())
            if any(any(all(abs(a - b) <= TOL for a, b in zip(c, hx_)) for c in px) for hx_ in hexes):
                stats["rect_ok"] += 1
            elif "-v" in sys.argv:
                bad.append(f"{rel}:{n} {fn} @ {x},{y},{w},{h}: none of the line's colours occur")
    # Context-resolved citations: confirmed when at least one screenshot named in the same spec file
    # contains the stated colour at that pixel or inside that rectangle.
    ctx = {"context": len(context_jobs), "no_candidate_file": 0, "no_colour_on_line": 0, "in_bounds_of_a_candidate": 0,
           "colour_checked": 0, "colour_confirmed": 0}
    for cands, (x, y, w, h), hexes, rel, n in context_jobs:
        if not cands:
            ctx["no_candidate_file"] += 1
            continue
        fits = []
        for fn in cands:
            im = img(fn)
            if x < im.width and y < im.height and (not w or (x + w <= im.width and y + h <= im.height)):
                fits.append(fn)
        if fits:
            ctx["in_bounds_of_a_candidate"] += 1
        else:
            bad.append(f"{rel}:{n} @ {x},{y}{',%d,%d' % (w, h) if w else ''} fits none of the {len(cands)} screenshots named in the file")
            continue
        if not hexes or (w and w * h > 400000):
            ctx["no_colour_on_line"] += 1
            continue
        ctx["colour_checked"] += 1
        ok = False
        for fn in fits:
            im = img(fn)
            if w is None:
                got = im.getpixel((x, y))[:3]
                ok = any(all(abs(a - b) <= TOL for a, b in zip(got, hx_)) for hx_ in hexes)
            else:
                px = set(c[:3] for c in im.crop((x, y, x + w, y + h)).get_flattened_data())
                ok = any(any(all(abs(a - b) <= TOL for a, b in zip(c, hx_)) for c in px) for hx_ in hexes)
            if ok:
                break
        if ok:
            ctx["colour_confirmed"] += 1
        elif "-v" in sys.argv:
            bad.append(f"{rel}:{n} @ {x},{y}{',%d,%d' % (w, h) if w else ''}: stated colour not found in any screenshot named in the file")
    stats["unresolved"] = 0
    return stats, ctx, bad


def cmd_audit_shorthand():
    """Audit citations written without a full filename, one spec file at a time.

    `--progress FILE` makes the run resumable: the result of each spec file is appended to FILE as one
    JSON line as soon as that file is done, and a later run takes a file's result from FILE instead of
    re-sampling it when nothing it depends on has changed: the spec file's SHA-256, the `-v` setting,
    this script, the manifest and the content of every screenshot (the SHA-256 of each file in the
    screenshots folder, read on every run) must all be the same. A line
    cut off by an interrupted run is ignored, and the next record starts on a new line. Keep FILE in
    the workspace, not in a temporary directory.
    """
    import hashlib

    files = sorted(glob.glob(os.path.join(SPEC, "components", "*.md")) + glob.glob(os.path.join(SPEC, "apps", "*.md")))
    verbose = "-v" in sys.argv
    progress = None
    if "--progress" in sys.argv:
        following = sys.argv[sys.argv.index("--progress") + 1 :]
        if not following or following[0].startswith("-"):
            sys.exit("build.py audit-shorthand: --progress needs a file name, as in --progress FILE")
        progress = following[0]
    inputs = hashlib.sha256()
    for dependency in (os.path.abspath(__file__), os.path.join(REF, "manifest.json")):
        inputs.update(open(dependency, "rb").read())
    if progress:
        # The cached result of a spec file is only valid for the pixels it sampled, so the key covers
        # the screenshots as they are on disk, not as the manifest says they should be.
        for name in sorted(os.listdir(SHOTS)):
            if not os.path.isfile(os.path.join(SHOTS, name)):
                continue
            shot = hashlib.sha256()
            with open(os.path.join(SHOTS, name), "rb") as f:
                for block in iter(lambda: f.read(1 << 20), b""):
                    shot.update(block)
            inputs.update(f"{name}\0{shot.hexdigest()}\n".encode())
    inputs = inputs.hexdigest()
    done = {}
    if progress and os.path.exists(progress):
        for line in open(progress):
            try:
                entry = json.loads(line)
                done[entry["file"]] = entry
            except (ValueError, KeyError, TypeError):
                continue
        with open(progress, "rb+") as f:
            f.seek(0, os.SEEK_END)
            if f.tell():
                f.seek(-1, os.SEEK_END)
                if f.read(1) != b"\n":
                    f.write(b"\n")
    stats, ctx, bad, reused = {}, {}, [], 0
    for p in files:
        rel = os.path.relpath(p, SPEC)
        digest = hashlib.sha256(open(p, "rb").read()).hexdigest()
        entry = done.get(rel)
        if entry and entry.get("sha256") == digest and entry.get("verbose") == verbose and entry.get("inputs") == inputs:
            reused += 1
        else:
            file_stats, file_ctx, file_bad = _audit_shorthand([p])
            entry = {"file": rel, "sha256": digest, "verbose": verbose, "inputs": inputs, "stats": file_stats, "ctx": file_ctx, "bad": file_bad}
            if progress:
                with open(progress, "a") as f:
                    f.write(json.dumps(entry) + "\n")
                    f.flush()
                    os.fsync(f.fileno())
        for key, value in entry["stats"].items():
            stats[key] = stats.get(key, 0) + value
        for key, value in entry["ctx"].items():
            ctx[key] = ctx.get(key, 0) + value
        bad += entry["bad"]
    print(json.dumps(stats))
    print(json.dumps(ctx))
    for b_ in bad:
        print(" -", b_)
    if progress:
        print(f"progress: {reused} of {len(files)} spec files taken from {progress}, {len(files) - reused} sampled now", file=sys.stderr)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    fn = {"inventory": cmd_inventory, "check": cmd_check, "verify": cmd_verify, "annotate": cmd_annotate, "tokens": cmd_tokens, "audit": cmd_audit, "audit-shorthand": cmd_audit_shorthand, "sources": cmd_sources}.get(cmd)
    if not fn:
        sys.exit(__doc__)
    sys.exit(fn() or 0)
