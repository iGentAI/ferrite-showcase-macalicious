# Page indicator dots (`page-control`)

- **Status:** present (two unrelated renderings: Photo Booth's effects pager and Launchpad's page dots)
- **AppKit:** no standard control in macOS 10.15 (`NSPageController` pages content but draws no indicator; UIKit's `UIPageControl` is the iOS counterpart and is what Catalyst apps would get). Both sightings are app-drawn.
- **HIG:** none for macOS. The Launchpad dots are described under `launchpad`; Dock/Launchpad background: https://web.archive.org/web/20200503160803/https://developer.apple.com/design/human-interface-guidelines/macos/system-capabilities/dock/
- **Appearances shown:** light, dark (Photo Booth changes with the appearance; Launchpad does not)

## Purpose and behaviour
A row of dots, one per page, with the current page's dot emphasised. Clicking a dot goes to that page [I]. Photo Booth adds a previous and a next arrow at either end; they step one page and the pages do not wrap [I]. Launchpad has no arrows: pages are changed by a two-finger swipe, Cmd-Left/Right or by clicking a dot [D, Launchpad Help; not visible].

**Do the two match? No.** Photo Booth uses 12 pt opaque dots at a 36 pt pitch, grey with a blue current dot, flanked by solid triangles, on an opaque bar. Launchpad uses 8 pt dots at a 20 pt pitch, translucent white with a solid white current dot, no arrows, over the blurred desktop [M]. They share only the idea, so they are specified here as two variants of one component.

## Anatomy
```
Photo Booth (variant "pager")                Launchpad (variant "overlay")
   <|     o     (O)     o     |>                    (O)   o
  15.5    12     12     12   15.5                    8    8
      20      24     24     20                         12
```
Back to front: (1) the host surface (bar or blurred desktop; not part of the control); (2) dots, flat circles; (3) optional arrows, flat triangles.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| variant | pager (Photo Booth), overlay (Launchpad) | - | - | both |
| pages | 1..n | - | `NSPageController.arrangedObjects.count` | 3 (Photo Booth), 2 (Launchpad) |
| current | 0..n-1 | 0 | `selectedIndex` | second of three (Photo Booth), first of two (Launchpad) |
| arrows | shown (pager), none (overlay) | - | - | both |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| dot, current | yes | `10-15-Catalina-Light-Photo-Booth.png @ 820,1128,24,24`; `10-15-Catalina-Light-Launchpad.png @ 1650,1828,16,16` |
| dot, other | yes | `10-15-Catalina-Light-Photo-Booth.png @ 748,1128,24,24`; `10-15-Catalina-Light-Launchpad.png @ 1690,1828,16,16` |
| arrow, enabled | yes | `10-15-Catalina-Light-Photo-Booth.png @ 676,1120,32,40` (a previous and a next page both exist) |
| arrow, disabled (first / last page) | no | [I] same triangle at 0.3 opacity |
| dot or arrow, pressed | no | [I] darkens by black 0.2 (light) / lightens by white 0.2 (dark) while the mouse is down |
| hover | no | [I] none |
| inactive window | no | [I] Photo Booth: current dot falls back to the grey of the other dots |
| other accent colours | no | [I] the Photo Booth blue is not the system accent (see Colours), so it is assumed fixed |

## Measurements
Evidence shorthand: `LPB` / `DPB` = `10-15-Catalina-Light-Photo-Booth.png` / `10-15-Catalina-Dark-Photo-Booth.png` (window origin 112, 76; bottom bar y=1080..1199); `LLP` / `DLP` = `10-15-Catalina-Light-Launchpad.png` / `10-15-Catalina-Dark-Launchpad.png` (3360 x 2100 full-screen captures).

### Geometry (pt)
| Property | Pager (Photo Booth) | Overlay (Launchpad) | Tag | Evidence |
|---|---|---|---|---|
| Dot diameter | 12 (24 px) | 8 (16 px) | [M] | `LPB` row y=1140: 748..771, 820..843, 892..915; col x=832: 1128..1151. `LLP` row y=1836: 1650..1665, 1690..1705; col x=1657: 1828..1843 |
| Dot shape | circle | circle | [M] | grids `LPB @ 746,1126,14,14`, `LLP @ 1648,1826,20,20` (symmetric quarter arcs) |
| Dot pitch (centre to centre) | 36 | 20 | [M] | 748 -> 820 -> 892 px; 1650 -> 1690 px |
| Gap between dots | 24 | 12 | [C] | pitch minus diameter |
| Arrow size | 15.5 x 20 (ink 32 x 40 px including one anti-aliased column) | none | [M] | `LPB @ 676,1120,32,40`, `@ 956,1120,32,40`; same boxes in `DPB` |
| Arrow shape | isosceles triangle, sharp corners: left arrow points (15.5, 0), (0, 10), (15.5, 20); right arrow mirrored | - | [M] | `LPB` rows: width 2 px at y=1120 and y=1159, 16 px at y=1130, 24 px at y=1135, full 31 px at y=1139/1140 |
| Gap arrow to first dot | 20 | - | [M] | `LPB` row y=1140: 708..747 and 916..955 |
| Whole group | 155.5 x 20 | 28 x 8 (two pages) | [C] | 676..987 px; 1650..1705 px |
| Horizontal position | centred in the window (middle dot centre x=831.5 = window centre) | centred on the screen within 1.5 pt (group centre x=1677.5, screen centre 1680) | [M] | window 112..1551; screen 0..3359 |
| Vertical position | centred in the 60 pt bottom bar (dots 24 pt from its top and bottom; arrows 20 pt) | dot centre 52 pt above the Dock (see `launchpad`) | [M] | `LPB` col x=832: bar 1080..1199, dot 1128..1151 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Pager dot, other | `#676765` (dithered with `#686866`) | `#b7b7b9` (dithered with `#b6b6b8`) | [M] | `LPB @ 760,1140`, col x=760; `DPB @ 760,1140` |
| Pager dot, current | `#0b4dbf (sRGB #004ac6)` (dithered `#0c4cbf (sRGB #0049c6)`, `#0c4dc0 (sRGB #004ac7)`) | `#4986f6 (sRGB #3784fe)` (dithered `#4a87f5 (sRGB #3885fd)`, `#4987f6 (sRGB #3785fe)`) | [M] | `LPB @ 832,1140`, col x=832; `DPB` col x=832 |
| Pager arrows | `#676765` | `#b7b7b9` | [M] | `LPB @ 690,1140`; `DPB @ 690,1140` |
| Pager bar behind | `#e7e6e5` | `#2b2c2d` | [M] | `LPB @ 700,1100`; `DPB @ 700,1100` |
| Overlay dot, current | `#ffffff` (edge pixels `#fbfbfc`) | `#ffffff` | [M] | `LLP @ 1657,1836`; `DLP @ 1657,1836` |
| Overlay dot, other (composite) | `#49545e (sRGB #47545f)` on `#1d2b39 (sRGB #192b3a)` | `#414955 (sRGB #3f4956)` on `#121c2b (sRGB #101c2c)` | [M] | `LLP @ 1697,1836` and `@ 1675,1836`; `DLP @ 1697,1836` and `@ 1675,1836` |
| Overlay dot, other (recovered) | `rgba(255,255,255,0.2)` | `rgba(255,255,255,0.2)` | [C] | (0x49 - 0x1d) / (0xff - 0x1d) = 0.195; (0x41 - 0x12) / (0xff - 0x12) = 0.198 |
| Disabled arrow | other-dot colour at 0.3 opacity | same | [I] | not shown |

The pager's current-dot blue is darker and less saturated than the stored system accent blue in light (`#0b4dbf (sRGB #004ac6)` against `#397cf5 (sRGB #227afe)`) and close to it in dark (`#4986f6 (sRGB #3784fe)`); it is taken as an app constant, not the accent token [M] for the values, [I] for the conclusion.

### Text and icons
No text. The arrows are the only glyphs:

| Glyph | SVG path (pt, in a 15.5 x 20 box) | Tag |
|---|---|---|
| previous | `M15.5 0 L0 10 L15.5 20 Z` | [M] from the row widths above |
| next | `M0 0 L15.5 10 L0 20 Z` | [M] |

### Shadows and effects
None in either variant [M] (no darker or lighter pixels around the dots: `LPB` col x=832 goes from `#e7e6e5` straight to the 1 px anti-aliased edge `#1653c1 (sRGB #0050c8)`; `LLP` grid shows the backdrop gradient right up to the edge pixels).

## Layout and spacing
- Pager: `<arrow> 20 <dot> 24 <dot> 24 <dot> 20 <arrow>`, all centred on one horizontal line; the group is centred in its container. With n pages the group is `2 x 15.5 + 2 x 20 + 12 n + 24 (n - 1)` pt wide [C].
- Overlay: dots at 20 pt pitch, group centred; width `8 n + 12 (n - 1)` pt [C].
- Suggested hit target: the dot plus half the gap on each side (36 x 20 pt in the pager, 20 x 20 pt in the overlay) [I].

## Keyboard and accessibility
Photo Booth: Cmd-Right / Cmd-Left go to the next / previous page of effects [D, Photo Booth View menu; not visible]. Launchpad: Cmd-Right / Cmd-Left or a swipe [D]. Accessibility: each dot is a button titled "page n of m" with the selected trait on the current one; the arrows are buttons "next page" / "previous page" [I]. ARIA: `role="tablist"` with each dot a `role="tab"` (`aria-selected`), or a group of buttons with `aria-current="true"` on the current dot; arrows are `<button>` elements with `aria-disabled` at the ends; Left/Right arrow keys move between dots.

## Browser notes
Fully reproducible with `border-radius: 50%` circles and an SVG or CSS-`clip-path` triangle. The overlay variant's translucent dots sit on a blurred wallpaper; the dots themselves need no `backdrop-filter`.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Photo-Booth.png` | 676,1120,312,40 | pager: arrows and three dots, second current |
| dark | `10-15-Catalina-Dark-Photo-Booth.png` | 676,1120,312,40 | same, dark |
| light | `10-15-Catalina-Light-Launchpad.png` | 1650,1828,56,16 | overlay: two dots, first current |
| dark | `10-15-Catalina-Dark-Launchpad.png` | 1650,1828,56,16 | same over the night wallpaper |
