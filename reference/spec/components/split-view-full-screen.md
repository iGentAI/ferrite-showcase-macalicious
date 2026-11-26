# Split View, two full-screen apps (`split-view-full-screen`)

- **Status:** present
- **AppKit:** system full-screen tiling (`NSWindow.collectionBehavior = .fullScreenAllowsTiling`); in 10.15 entered from the green button's hover menu ("Tile Window to Left/Right of Screen")
- **HIG:** https://web.archive.org/web/20200503161459/https://developer.apple.com/design/human-interface-guidelines/macos/app-architecture/fullscreen-mode/
- **Appearances shown:** light, dark

## Purpose and behaviour
Two full-screen windows share one Space side by side with a draggable black divider between them; dragging the divider resizes both tiles within their minimum widths, double-clicking it resets, and clicking a tile makes that app active [D] (macOS User Guide). The menu bar and Dock are hidden until the pointer reaches a screen edge; each tile keeps its toolbar at the very top [M]. The inactive tile is drawn with inactive chrome [M].

## Anatomy
```
 | left tile (Notes, inactive)  |#|  right tile (Safari, active)       |
   0..1479 px = 740 pt          24   1504..3359 px = 928 pt
                               divider 12 pt black with a 4 x 64 pt grey handle
```

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| active tile | leading, trailing | last focused [D] | key window in tiled Space | trailing Safari active; leading Notes inactive |
| split ratio | resizable subject to app minimum widths | system/app-defined [D] | full-screen tiling | measured 740:928 pt tiles only |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| idle | yes | `10-15-Catalina-Light-Split-Screen-Apps.png @ 0,0,3360,2100` |
| dragging the divider (tiles dim/blur) | no | [D] |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Divider width | 12 (x 1480..1503) | [M] | `10-15-Catalina-Light-Split-Screen-Apps.png @ 1470,300,41,1` |
| Handle | 4 x 64 (x 1488..1495, y 986..1113), centred in the divider and on the screen height, rounded ends (radius 2) | [M] size, [C] radius | `@ 1470,1050,41,1`, `@ 1491,940,1,211` |
| Tile widths in the capture | 740 and 928 of 1680 | [M] | same row |
| Tile toolbars | start at y=0, 38 high (y 0..75) | [M] | `@ 1200,0,1,77`, `@ 2000,0,1,77` |
| Tile corners | square; no shadows | [M] | preview |

### Colours and fills
| Part | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Divider | `#000000` | `#000000` | [M] | `@ 1480,300` in both captures |
| Handle | `#8c8c8c` (ends antialiased `#878787`) | same | [M] | `10-15-Catalina-Light-Split-Screen-Apps.png @ 1491,1050`, `@ 1491,986` |
| Inactive tile toolbar (Notes) | top row `#fbfbfb`, fill `#f6f6f6`, bottom rows `#e7e7e7`, `#cecece` | top rows `#575757`, `#424242`, fill `#2d2d2d`, bottom rows `#242424`, `#000000` | [M] | `10-15-Catalina-Light-Split-Screen-Apps.png @ 1200,0,1,76`; `10-15-Catalina-Dark-Split-Screen-Apps.png @ 1200,0,1,76` |
| Active tile toolbar (Safari) | `#f4f4f4`, `#ebebeb`, `#e5e5e5` -> `#cdcdcd`, `#bdbdbd`, `#a7a7a7` | `#6e6969 (sRGB #6f6969)`, `#5f5759 (sRGB #615759)`, `#4c4347 (sRGB #4e4347)` -> `#3f3739 (sRGB #413739)`, `#312c2e (sRGB #322c2e)`, `#000000` (tinted by the page below) | [M] | `@ 2000,0,1,76` in both |
| Inactive toolbar button outline (Notes) | `#dbdbdb` rows at y 16 and 59, fill = bar | fill `#3d3d3c` with top rows `#4f4f4f`, `#3f4040` | [M] | `@ 1200,16,1,44` in both |

### Text and icons
The gutter has no label or glyph. Each tile keeps its own toolbar text and icons (`toolbar` / `smart-search-field`); the gutter handle is a rounded bar, not an icon [M] (geometry above).

### Shadows and effects
No window shadows between the tiles [M]; use the opaque black gutter and measured handle, not stacked window frames.

## Layout and spacing
Each tile lays out as a full-screen window of its own width; narrow tiles collapse toolbar items into the `>>` overflow (Notes) and shrink flexible items (Safari's address field). Minimum tile width is app-defined [D].

## Keyboard and accessibility
No keyboard resize in 10.15; Mission Control (Control-Up) shows the paired Space [D]. In HTML the divider is `role="separator"` with `aria-orientation="vertical"`, `aria-valuenow`, and arrow-key resizing.

## Browser notes
Reproducible as a two-pane layout with a 12 px black gutter.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Split-Screen-Apps.png` | 1440,900,104,300 | divider and handle |
| dark | `10-15-Catalina-Dark-Split-Screen-Apps.png` | 1440,900,104,300 | same |
| light | `10-15-Catalina-Light-Split-Screen-Apps.png` | 0,0,3360,80 | both tile toolbars, inactive and active |
