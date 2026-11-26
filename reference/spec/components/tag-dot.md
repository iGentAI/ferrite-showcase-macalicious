# Finder tag colour dots (`tag-dot`)

- **Status:** present (blue, orange, grey, green, red, colourless, "All Tags"; yellow and purple are not shown)
- **AppKit:** custom Finder drawing; tag colours correspond to `NSWorkspace.shared.fileLabelColors` / `URLResourceValues.tagNames`; in app UIs usually an `NSImage` drawn per colour
- **HIG:** https://web.archive.org/web/20200503170015/https://developer.apple.com/design/human-interface-guidelines/macos/system-capabilities/finder/
- **Appearances shown:** light, dark

## Purpose and behaviour
A small coloured disc that identifies a Finder tag. It appears as the row icon in the Finder sidebar's Tags section (and in Open/Save panel sidebars), in front of file names that carry a tag in icon/list/column views, in the Tags toolbar pop-over and in the contextual menu's tag row. Tags without a colour show a hollow grey ring. Clicking a sidebar tag shows all items with that tag [D] (Finder; the HIG Finder page asks apps to support tagging).

## Anatomy
Disc = 1 pt ring in a darker shade + lighter fill of the same hue (sidebar size). The small in-label dot is a flat fill with no ring. "All Tags..." is two overlapping colourless rings.

## Variants and parameters
| Parameter | Values | Shown |
|---|---|---|
| Colour | red, orange, yellow, green, blue, purple, grey, none | red, orange, green, blue, grey, none |
| Size | sidebar 12 pt; in-label 10 pt; menu row 12 pt [I] | 12, 10 |
| Multiple tags on one item | up to 3 dots overlapping by half, most recent in front [I] | no |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| Normal | yes | Finder sidebars, light and dark |
| On a selected sidebar row | no | unchanged disc [I] |
| On an emphasized (blue) list row | no | disc gains a 1 pt white ring [I] |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Sidebar dot diameter | 12 (24 px) | [M] | 10-15-Catalina-Light-Applications.png @ 154,953,24,1 and bbox 154,942,24,24 |
| Ring width | 1 (2 px, the outer px anti-aliased) | [M] | 10-15-Catalina-Light-Applications.png @ 154,953,3,1 (#3278ed (sRGB #1476f5), #2973ec (sRGB #0071f4), then fill) |
| Position in the sidebar row | disc centred in the 18 pt icon box: left edge 21 pt from the window edge (x=154), vertically centred on the row | [M] | same; row centres y=953.5, 1005.5, ... (26 pt pitch) |
| "All Tags..." glyph | two 12 pt rings, the second offset 3 pt to the right (x=152..175 and 158..181), drawn back to front | [M] | 10-15-Catalina-Light-Applications.png @ 150,1317,34,1 |
| In-label dot (icon view) | 10 diameter, flat, 6 pt before the label text | [M] | 10-15-Catalina-Light-Finder-Home.png @ 929,652,20,20 and row @ 929,663,34,1 |

### Colours and fills (stored values)
| Tag | Light ring | Light fill | Dark ring | Dark fill | Tag | Evidence (row through the dot centre) |
|---|---|---|---|---|---|---|
| Blue | `#2973ec (sRGB #0071f4)` | `#548ff0 (sRGB #438ef8)` | `#3e8ff7 (sRGB #168eff)` | `#62a5f8 (sRGB #4da5ff)` (pixels dither #62a4f8 (sRGB #4ea4ff)..#64a5f8 (sRGB #50a5ff)) | [M] | Light-Applications @ 155,953 / 165,953; Dark-Applications @ 155,1005 / 165,1005 |
| Orange | `#e88f34 (sRGB #f68b00)` | `#eba55b (sRGB #f6a24a)` | `#f3ab40 (sRGB #ffa912)` | `#f6bc65 (sRGB #ffba52)` | [M] | Light-Applications @ 155,1057 / 165,1057; Dark-Applications @ 155,1109 / 165,1109 |
| Gray | `#848488` | `#9b9ba0` | `#a3a2a7` | `#b4b3b7` | [M] | Light-Applications @ 155,1109 / 165,1109; Dark-Applications @ 155,1161 / 165,1161 |
| Green | `#5dbf4e (sRGB #21c338)` | `#7bcb6f (sRGB #5ccf62)` | `#80fa6e (sRGB #3cff55)` | `#99fb8a (sRGB #72ff7a)` | [M] | Light-Applications @ 155,1161 / 165,1161; Dark-Applications @ 155,1213 / 165,1213 |
| Red | `#e34535 (sRGB #f63126)` | `#e8685b (sRGB #f95e54)` | `#ec5d4e (sRGB #ff5044)` | `#f07b6f (sRGB #ff7369)` | [M] | Light-Applications @ 155,1265 / 165,1265; Dark-Applications @ 155,1317 / 165,1317 |
| No colour ("Work", "Home") | `#a2a3a3` | `#dbdcdc` | `#707173` | `#3b3c3e` (centre `#38393b`) | [M] | Light-Applications @ 155,1005 / 165,1005; Dark-Applications @ 155,1057 / 165,1057 |
| All Tags rings | `#9fa0a0` | `#d2d3d3` | `#737476` | `#414244` | [M] | Light-Applications @ 153,1317 / 160,1317; Dark-Applications @ 153,1369 / 160,1369 |
| Yellow | `#e5c02d (sRGB #ebc000)` | `#ecd063 (sRGB #f1d04b)` | `#f8d84a (sRGB #fdd806)` | `#fae17a (sRGB #fee167)` | [I] | not shown; derived by applying the measured orange/green ring-to-fill relationship to the system yellow |
| Purple | `#a260d0 (sRGB #ae57d7)` | `#b884dc (sRGB #c27fe2)` | `#c183f1 (sRGB #cd7cf8)` | `#d0a2f5 (sRGB #d99dfb)` | [I] | not shown; same derivation from system purple |
| In-label green dot (flat) | `#7ad373 (sRGB #54d766)` | - | `#80db7c (sRGB #5adf70)` | - | [M] | 10-15-Catalina-Light-Finder-Home.png @ 938,662; 10-15-Catalina-Dark-Finder-Home.png @ 1063,662 |

### Text and icons
The tag name beside the dot is a normal sidebar row label (see `sidebar`).

### Shadows and effects
None.

## Layout and spacing
Sidebar: the dot replaces the 18 pt icon; label at the standard 40.5 pt. In file labels the dot precedes the name and is centred on the x-height.

## Keyboard and accessibility
Decorative; the tag name carries the meaning. ARIA: `aria-hidden` on the dot, or `role="img"` with `aria-label="Blue tag"` when shown without text.

## Browser notes
`border-radius: 50%` with a 1 px inner border; no gradients.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Applications.png | 140,930,230,410 | seven tag rows plus "All Tags..." |
| dark | 10-15-Catalina-Dark-Applications.png | 140,980,230,410 | same, dark |
| light | 10-15-Catalina-Light-Finder-Home.png | 920,644,180,40 | green dot in an icon-view label |
| light | 10-15-Catalina-Light-Finder-Open.png | 130,900,270,330 | tags in an Open panel sidebar |
