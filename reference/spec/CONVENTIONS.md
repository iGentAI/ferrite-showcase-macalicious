# Conventions used by the Catalina specification

These rules apply to every file under `reference/spec/`. They exist so a component thread can build
from a spec without opening a screenshot, and so every number can be traced back to the pixels it
came from.

## Units and coordinates

- The reference screenshots are 2x. **Every dimension in a spec is in points (pt)**; 1 pt = 1 CSS px =
  2 image px. Half-point values (0.5 pt = one device pixel) are real and must be kept: most Catalina
  hairlines are 0.5 pt (`1px` at 2x). On a 1x display the library rounds them up to 1 CSS px.
- **Evidence coordinates are in image pixels** of the original PNG, written
  `filename.png @ x,y,w,h` (left, top, width, height) for a rectangle or `filename.png @ x,y` for a
  single pixel. The common prefix `10-15-Catalina-` is always written in full so the path can be
  pasted.
- Colours are 8-bit hex (`#rrggbb`), with alpha written `#rrggbb @ 0.25` or `rgba()`.
  **Colour space matters.** Every screenshot embeds the capturing MacBook Pro's "Display" ICC
  profile (Display P3 primaries, sRGB-like tone curve), so the numbers stored in the PNG are
  panel values, not sRGB. Neutral greys (r = g = b) are the same in both spaces; saturated colours
  are not (the stored accent blue `#397cf5` is sRGB `#227afe`). The rule throughout the spec:
  - evidence is always the **stored** value, so that `measure.py at` reproduces it;
  - wherever the stored and sRGB values differ, the sRGB value is written next to it as
    `#397cf5 (sRGB #227afe)`, and **the sRGB value is the one to put in CSS**;
  - `tokens.json` carries both (`stored` and `srgb`) for every colour token.
  See "Colour management" in `README.md` for how the conversion was done and what it means for
  visual comparison against the screenshots.
- Gradients are written top to bottom (or leading to trailing) as `position% colour` stops, where the
  position is measured inside the fill, excluding the border.

## Provenance tags

Every measured or stated value carries exactly one tag:

| Tag | Meaning |
|---|---|
| **[M]** | Measured from reference pixels by this project. Followed by, or grouped under, the evidence location. |
| **[D]** | Taken from Apple documentation (HIG, AppKit reference, AppKit headers, Apple design resources). The source is cited. |
| **[I]** | Inferred: not visible in any screenshot and not documented. The reasoning is stated (for example "pressed state is never captured; derived from the disabled-to-normal relationship"). |
| **[C]** | Computed from measured values (for example a font size derived from a measured cap height, or an alpha recovered from two composites). The inputs are [M]. |

**Adopted values.** Where the library adopts a CSS value that differs from the value measured here
(by an engineering comparison or a product decision), the token row gives the adopted value tagged
[I], says in its note that it is an implementation choice, and repeats the measured value with its
own tag and evidence. The component spec keeps the measurement unchanged. An adopted value is never
retagged [M] or [C].

A value without a tag is a defect in the spec. When a state or variant is not shown in any
screenshot, the spec says so explicitly in its States table rather than leaving it out.

## Measuring rules

- Use `tools/measure.py` (`row`, `col`, `grid`, `at`, `palette`) for numbers, and `tools/corner_fit.py`
  for corner radii. Looking at a crop is for
  orientation only; never read a dimension or colour off a picture by eye.
- Sizes are the distance between outer edges of the visible shape, counted in pixels on a
  run-length row or column, then halved.
- Anti-aliased edges: a run of one or two blended pixels between two flat colours is an edge, not a
  border. A border is reported only when there is a flat or clearly distinct line.
- Corner radius: fit it with `tools/corner_fit.py`, which renders the corner at each candidate radius
  and reports the rms difference from the stored pixels. Quote the best radius with the rms at its
  neighbours, say which line's outer edge the radius belongs to, and tag the value **[C]**. A `grid`
  dump of the corner is for orientation and for finding the ring colours, not for the radius: most
  radii fitted in the first two rounds differed from their grid reading (sixteen of twenty, by 0.25 to 1.75 pt),
  because the last blended pixel of an arc is easy to mistake for the straight edge. For a corner on
  the transparent shadow of a window-only capture, fit the alpha channel (`--alpha 1`). A radius in the spec that is tagged [M]
  and carries no rms figures is still a grid reading (the number of rows from the outer edge to the
  first row whose edge pixel sits at the full straight-edge position, halved); treat it as good to
  about 1 pt until it has been fitted.
- Text colour: the darkest (light appearance) or lightest (dark appearance) pixel in the vertical
  stems of several glyphs. Catalina renders text with greyscale anti-aliasing, so stems reach the
  true colour; thin strokes at small sizes may not, so sample at least three glyphs.
- Font size from cap height: measure the pixel height of a flat-topped capital (H, E, T, I, L) or a
  digit, then use the table below. SF Pro Text is used below 20 pt and SF Pro Display at 20 pt and
  above. The weight is judged from stem width.

| Font size (pt) | Cap height (px at 2x) | x-height (px) | Regular stem (px) | Typical use |
|---|---|---|---|---|
| 9 | 12.7 -> 13 | 9 | ~1.6 | mini controls, labels under toolbar icons (small) |
| 10 | 14.1 -> 14 | 10 | ~1.8 | small labels, menu bar extras text |
| 11 | 15.5 -> 15-16 | 11-12 | ~2 | small controls, sidebar headers, status bar, table headers |
| 12 | 16.9 -> 17 | 12-13 | ~2.2 | label-size text, tooltips |
| 13 | 18.3 -> 18 | 13-14 | ~2.4 | the system font size: controls, body, title bar, menus (menus are 14) |
| 14 | 19.7 -> 20 | 14-15 | ~2.6 | menu items, menu bar titles |
| 15 | 21.2 -> 21 | 15-16 | ~2.8 | large titles in some panes |
| 17 | 24 | 17-18 | ~3 | headline in Catalyst-style apps |
| 22 | 31 | 22-23 | ~3.5 | large display text |

  (cap height = 0.705 em, x-height = 0.52 em for San Francisco; the pixel value is rounded by the
  rasteriser, so a 1 px difference is within tolerance; use baseline-to-baseline distances in lists
  as a second check.) Font sizes derived this way are tagged **[C]**.
- Vibrant materials (sidebars, menus, Dock, Notification Center, popovers, sheets in dark mode) are
  composites of a blurred backdrop and a tint, so their pixels vary with whatever is behind them.
  Report the observed range over at least two backdrops, the recommended opaque fallback colour, and
  a recipe (`backdrop-filter` blur and saturation plus tint colour and alpha) tagged [M] for the
  observed composites and [I] or [C] for the recovered tint.
- Window captures (transparent background) include the window's drop shadow in the alpha channel.
  Shadows are reported as the measured alpha falloff (offsets and alpha at several distances) plus a
  fitted CSS `box-shadow` tagged [C].

## Component spec template

One file per component: `components/<id>.md`, where `<id>` is the identifier in `inventory.json`.

```markdown
# <Apple name> (`<id>`)

- **Status:** present | not seen in the screenshots
- **AppKit:** class, style or property names (for example `NSButton`, `bezelStyle = .rounded`)
- **HIG:** archived Catalina-era page URL(s)
- **Appearances shown:** light, dark

## Purpose and behaviour
What it is for and how it behaves, from the HIG (paraphrased, cited).

## Anatomy
The parts, named, in drawing order (back to front), with a small ASCII diagram where it helps.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |

## States
| State | Shown? | Evidence or basis |
(normal, hover where macOS has one, pressed, selected/on, mixed, disabled, focused,
 key window vs inactive window, each accent colour where it matters)

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
### Text and icons
| Property | Light | Dark | Tag | Evidence |
### Shadows and effects

## Layout and spacing
Standard spacing to neighbours, alignment (baseline, leading edge), minimum sizes, growth rules.

## Keyboard and accessibility
Keys, focus behaviour (full keyboard access), the accessibility role AppKit exposes and the ARIA
pattern that matches it.

## Browser notes
Anything that cannot be reproduced exactly with HTML and CSS, with the closest approach.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
(at least one clean example per appearance where one exists, then other sightings)
```

## App blueprint template

One file per app or system surface: `apps/<slug>.md`.

```markdown
# <App name>
- **Screenshots:** light and dark filenames
- **Window:** frame size in pt (from the opaque frame, not the image), style (unified toolbar, etc.)
## Layout
Regions top to bottom and leading to trailing, each with measured size in pt and background colour
in light and dark, as a table; an ASCII diagram of the arrangement.
## Components used
Inventory ids, with what each is used for in this app.
## App-specific elements
Anything not covered by a library component (custom cells, keypads, artwork), with measurements.
## Content in the screenshot
The exact visible strings and data needed to rebuild the screen (titles, row text, column widths).
## Not reproducible / assets needed
Icons, photos, maps or artwork that the demo needs as image assets or must replace.
```
