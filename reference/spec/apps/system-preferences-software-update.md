# System Preferences — Software Update

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Software-Update.png`; `10-15-Catalina-Dark-System-Preferences-Software-Update.png` [M].
- **Window:** opaque `668 × 285 pt`, image origin `112,76`, both [M], each @ 112,76,1336,570 (`info`). Unified shared chrome uses `title-bar`, `window-controls`, `toolbar`, `toolbar-button`, `toolbar-segmented-control`, `toolbar-search-field`; title “Software Update”, search “Search” [M]. Shared toolbar is not remeasured.
- **Comparison:** both show macOS Catalina Beta 10.15 up to date, enrolled in Apple Developer Seed Program, with mixed automatic-update checkbox [M]. Last checked differs: light “Today at 10:47 AM”; dark “Today at 10:29 AM” [M]. No progress or available-update list appears [M].

## Layout

```text
+-------------------- shared toolbar -------------------+
|                   | Your Mac is up to date — …        |
|  gear artwork     | Last checked: …                   |
|                   |                                   |
|  Software Update  |                                   |
|  seed-program text|                                   |
|  Details…         | ▣ Automatically keep… Advanced… ? |
+-------------------------------------------------------+
```

E-L = `10-15-Catalina-Light-System-Preferences-Software-Update.png`; E-D = `10-15-Catalina-Dark-System-Preferences-Software-Update.png` [M]. Rects `(x,y,w,h)` are frame-relative pt [M]. Stored colour samples [M].

| Region | Rect [M] | Light / dark fill [M] | Evidence E-L/E-D image px |
|---|---|---|---|
| Artwork/program column | (0,38,192,247) | `#ececec` / `#303031` | @ 130,350; @ 112,152,384,494 |
| Vertical divider | (192,38,1,247) | `#d7d7d7` light, `#454546` then `#4f4f50` dark | row 350 x496..498; @ 496,152,2,494 |
| Status / settings column | (193,38,475,247) | `#e3e3e3` / `#363637` | @ 550,350; @ 498,152,950,494 |
| Gear circular artwork, rim extent | (40,66,112,112) | artwork, not flat fill [M] | row 320 x192..416, col 303 y208..432; @ 192,208,224,224 |

## Components used

`image-view`, `label`, `checkbox`, `push-button`, `help-button`, `separator` [M]. “Details…” is a link-style label/control (`label` link variant), not a bordered button [M]. No lock footer is shown [M].

## Content in the screenshot — complete control table

Rect and `x/B` (first glyph x / baseline y) are measured frame pt [M]; label-only rects are ink extents. R = `13 pt` regular, S = `11 pt` regular [C], from cap-height mapping and `label.md`; heading/caption are bold [M]. Embedded button-title positions are completed below [M].

| Component | Variant / state / type | Rect [M] | Exact visible text [M]; x/B [M] | Evidence E-L/E-D image px |
|---|---|---|---|---|
| image-view | circular gear artwork | (40,66,112,112) | no text | @ 192,208,224,224 |
| label | R bold centred | (42,192,108,12.5) | Software Update; 42/201.5 | @ 196,460,216,25 |
| label | S centred, wrapped | (27.5,211.5,136.5,38.5) | This Mac is enrolled in the / Apple Developer Seed / Program; 27.5/219.5 | @ 167,499,273,77 |
| label | S link, enabled | (74,253.5,43.5,8.5) | Details…; 74/261.5 | @ 260,583,87,17 |
| label | R bold | (235.5,67.5,333,13) | Your Mac is up to date — macOS Catalina Beta 10.15; 235.5/77 | @ 583,211,666,26 |
| label | S regular | (236,89.5,171.5,10.5) | L: Last checked: Today at 10:47 AM; D: Last checked: Today at 10:29 AM; 236/97.5 | @ 584,255,343,21 |
| checkbox | regular mixed, R | (235,248,14,14) | Automatically keep my Mac up to date; 253.5/259.5 | @ 582,572,28,28; ink @ 619,576,459,25; row 585, col 589 |
| push-button | regular enabled | (520.5,245.5,98,20) | Advanced… | @ 1152,566,198,42; row 575, col 1164 |
| help-button | regular enabled | (627.5,245.5,20,20) | ? | @ 1367,567,40,40; row 587, col 1387 (halo excluded) |

### Layout grid

Left column centre x`96 pt`; title/seed/link are centred on it [C]. Main text/control column x`235–236 pt`, inset `42–43 pt` from right region [C]. Heading baseline `77 pt`, checked baseline `97.5 pt`, gap `20.5 pt` [C]. Seed text baseline pitch `14 pt` [M], E-L/E-D @ 167,499,273,77. Checkbox title begins `4.5 pt` after box right edge; button and help top y`245.5 pt`, bottom y`265.5 pt`, window bottom margin `19.5 pt`; button/help gap `9 pt` [C]. Mixed state is a horizontal white minus inside the blue checkbox, not an unchecked state [M], E-L/E-D @ 582,572,28,28.

## App-specific elements

Circular metal gear icon has a pale blue-grey rim and dark background; its interior includes shaded photographic/illustrated metal rather than a flat template glyph [M], E-L/E-D @ 192,208,224,224. Light shadow extends beyond this rim; dark rim contrasts more strongly with its background [M], E-L/E-D row 320 x180..424 and col 303 y196..447. Preserve icon artwork, do not rebuild the gear as a modern SF Symbol [I].

### Embedded label and explicit evidence

Advanced… first glyph x`534 pt`, baseline y`259.5 pt` [M], regular `13 pt` [C], independently sampled in both appearances; the dark antialiased top is `0.5 pt` higher [M]. Evidence: `10-15-Catalina-Light-System-Preferences-Software-Update.png @ 1180,577,138,19`; `10-15-Catalina-Dark-System-Preferences-Software-Update.png @ 1180,576,138,20` [M]. Control rects exclude the outer halo/shadow [M].

Grouped geometry/colour evidence for all preceding rows [M]: `10-15-Catalina-Light-System-Preferences-Software-Update.png @ 112,152,1336,494`; `10-15-Catalina-Dark-System-Preferences-Software-Update.png @ 112,152,1336,494`. The circular rim is measured separately from the soft external shadow [M], using the row/column scans cited above.

## Not reproducible / assets needed

Matching Catalina Software Update icon with appearance-appropriate shadow is required [I]. No hidden update payload, download size or update list is inferable from this up-to-date state [I]. Details sheet, advanced automatic-update options, searching/loading, available-update state, pressed/hover and inactive-window state are not shown [M]. SF font fallback may change measured wrap/width [I].
