# System Preferences — Sidecar

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Sidecar.png`; `10-15-Catalina-Dark-System-Preferences-Sidecar.png` [M].
- **Window:** opaque `668 × 354 pt`, image origin `112,76`, both [M], each @ 112,76,1336,708 (`info`). Unified shared chrome uses `title-bar`, `window-controls`, `toolbar`, `toolbar-button`, `toolbar-segmented-control`, `toolbar-search-field`, `focus-ring`; title “Sidecar”, search “Search” [M]. Chrome is referenced, not remeasured.
- **Comparison:** same settings and no connected devices [M]. Light toolbar search is focused with ring and caret; dark search is not [M]. iPad screen artwork is identical, while its shadow composite differs against the backing [M].

## Layout

```text
+-------------------- shared toolbar -------------------+
| + iPad preview -------+  ☑ Show Sidebar [on the left] |
| | sidebar + Touch Bar |  ☑ Show Touch Bar [on bottom] |
| | purple/pink screen  |  ☐ Enable double tap…         |
| +---------------------+                              |
|       Connect to:                                    |
|       [No Devices]                                   |
|                                                    ? |
+-------------------------------------------------------+
```

E-L = `10-15-Catalina-Light-System-Preferences-Sidecar.png`; E-D = `10-15-Catalina-Dark-System-Preferences-Sidecar.png` [M]. Rects `(x,y,w,h)` are frame-relative pt [M]. Stored PNG colours [M].

| Region | Rect [M] | Light / dark fill [M] | Evidence E-L/E-D image px |
|---|---|---|---|
| Content / footer | (0,38,668,316) | `#ececec` / `#303031` | @ 130,300 and @ 800,500; @ 112,152,1336,632 |
| iPad artwork including rim | (73.5,66,217,156) | screen sample `#8e88d1 (sRGB #9086d7)` both; bezel `#000000` both | @ 475,300 and @ 475,220; row 250 x259..693, col 270 y208..520; @ 259,208,434,312 |
| Settings cluster | (334,97,225,90) [C], envelope of controls/text | transparent over content [I], no enclosing box visible | @ 780,270,450,180 |
| Connection cluster | (132,247.5,100,44.5) [C], envelope | transparent over content [I] | @ 376,571,200,89 |

## Components used

`image-view`, `checkbox`, `pop-up-button`, `label`, `help-button` [M]. No tab view, sidebar list, enclosing group box or lock button is visible [M].

## Content in the screenshot — complete control table

Rect and label `x/B` (first ink x / baseline y) are frame-relative pt [M]. Label-only rects are ink extents [M]. R = `13 pt` regular [C], from measured cap heights and `label.md`. Embedded popup text metrics are delegated to `pop-up-button` [I].

| Component | Variant / state / type | Rect [M] | Exact visible text [M]; x/B [M] | Evidence E-L/E-D image px |
|---|---|---|---|---|
| image-view | static iPad illustration | (73.5,66,217,156) | no legible text | @ 259,208,434,312 |
| checkbox | regular on, R | (334,101,14,14) | Show Sidebar; 352.5/112.5 | @ 780,278,28,28; ink @ 817,282,165,21; row 280, col 788 |
| pop-up-button | regular enabled | (446.5,98.5,102.5,20) | on the left | @ 1004,273,207,41; row 280, col 1009 |
| checkbox | regular on, R | (334,137,14,14) | Show Touch Bar; 352.5/148.5 | @ 780,350,28,28; ink @ 817,354,194,21 |
| pop-up-button | regular enabled | (460.5,134.5,117,20) | on the bottom | @ 1032,345,236,41 |
| checkbox | regular off, R | (334,173,14,14) | Enable double tap on Apple Pencil; 353/184.5 | @ 780,422,28,28; ink @ 818,426,408,25 |
| label | R centred under preview | (147,247.5,69,10) | Connect to:; 147/257 | @ 406,571,138,20 |
| pop-up-button | regular disabled | (132.5,271,99,20) | No Devices | @ 376,617,200,41; row 620, col 381 |
| help-button | regular enabled | (627.5,307.5,20,20) | ? | @ 1367,691,40,40; row 712, col 1387 (halo excluded); row 712, col 1387 |

### Layout grid

Artwork centre x`182 pt`; connection label and popup centre x`182 pt` [C]. Checkbox column x`334 pt`, label first ink x`352.5–353 pt`; box-to-label gap `4.5–5 pt` [C]. Checkbox top pitch `36 pt` [M], E-L/E-D col 788 y278..450. Popup starts follow the label widths rather than a shared left column: sidebar x`446.5 pt`, Touch Bar x`460.5 pt` [M]; both align to their checkbox label baseline [I], component baseline relationship. Preview rim bottom y`222 pt`; connection label cap top y`247.5 pt`, gap `25.5 pt` [C]. Connection popup bottom y`291 pt`, help bottom y`327.5 pt`, window bottom margin `26.5 pt` [C]. No lock footer [M].

## App-specific elements

The illustration is a black rounded landscape iPad with a narrow sidebar and Touch Bar displayed inside it [M]. Sampled screen colour is the same in both appearances [M], E-L/E-D @ 475,300 `#8e88d1 (sRGB #9086d7)`; artwork rim sample @ 475,220 `#000000`. The light artwork has a broad soft shadow below the rim; dark has a fine pale rim and subtler composite shadow [M], E-L/E-D col 270 y517..526. Treat this as a supplied image, not a live embedded tablet UI [I].

### Embedded labels and explicit evidence

First ink x / baseline B in frame pt [M]; regular `13 pt` [C]. All three popup-title crops were sampled independently in light/dark; first x and baseline agree [M]. Popup rects exclude external halo/shadow [M].

| Label | x / B [M] | Full evidence citation |
|---|---|---|
| on the left | 455.5/112.5 | `10-15-Catalina-Light-System-Preferences-Sidecar.png @ 1023,282,121,20`; dark same |
| on the bottom | 469.5/148.5 | `10-15-Catalina-Light-System-Preferences-Sidecar.png @ 1051,354,168,20`; dark same |
| No Devices | 141/285 | `10-15-Catalina-Light-System-Preferences-Sidecar.png @ 394,627,134,20`; dark same |

Grouped geometry/colour evidence for all preceding rows [M]: `10-15-Catalina-Light-System-Preferences-Sidecar.png @ 112,152,1336,632`; `10-15-Catalina-Dark-System-Preferences-Sidecar.png @ 112,152,1336,632`. Artwork sample pair [M]: `10-15-Catalina-Light-System-Preferences-Sidecar.png @ 475,300` and `10-15-Catalina-Dark-System-Preferences-Sidecar.png @ 475,300`, both stored `#8e88d1 (sRGB #9086d7)`.

## Not reproducible / assets needed

Supply the exact Catalina Sidecar iPad illustration and its shadow/rim treatments [I]. No available-device list, connected state, settings changes, open menus, hover/pressed or inactive window are shown [M]; do not add fictitious device names. Platform font fallback may alter text width [I].
