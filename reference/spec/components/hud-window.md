# HUD-style window and controls (`hud-window`)

- **Status:** present (the QuickTime Player playback controller is the only HUD surface in the library; a titled `NSPanel` HUD is **not seen in the screenshots**)
- **AppKit:** `NSPanel` with `styleMask` containing `.hudWindow` (with `.utilityWindow`, `.titled`); `NSVisualEffectView.material = .hudWindow` (macOS 10.11+), `NSAppearance.Name.vibrantDark`; QuickTime's controller is `AVPlayerView.controlsStyle = .floating` (AVKit, macOS 10.9+)
- **HIG:** https://web.archive.org/web/20200504055739/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/panels/ (section "HUD-Style Panels")
- **Appearances shown:** light, dark. The HUD is dark and translucent in both; it does not follow the system appearance.

## Purpose and behaviour
A HUD "serves the same function as a normal panel, but its appearance is darker and translucent"; it is meant for media-oriented or immersive apps, when a standard panel would obscure content, or for quick adjustments [D, HIG Panels]. The HIG asks for simple adjustment controls (sliders, steppers), sparing use of colour and a small size [D].

The QuickTime Player controller is a floating HUD inside the movie window: it fades in when the pointer moves over the movie and fades out after a short idle period; it can be dragged anywhere inside the video [I] (not observable in still captures; its vertical position differs between the two captures in proportion to the window height, see Layout).

## Anatomy
Back to front:
1. Backdrop: the live content behind the panel, blurred.
2. Dark tint over the blur (the HUD material). No visible border line and no drop shadow.
3. Controls drawn in vibrant light foreground (near-white that picks up the backdrop), in two rows.
4. Coloured accents only for the filled part of the volume slider (accent blue).

```
+----------------------------------------------------------------------+ 75 pt
| <)  ====O  <)))        <<      >       >>          [^]   [^]   [pip] |
| 00:03:16:12  ---------|--------------------------------   00:12:49:22|
+----------------------------------------------------------------------+
                                440 pt
```

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| kind | floating controller (no title bar), titled HUD panel | - | `AVPlayerViewControlsStyle.floating`; `NSPanel` `.hudWindow` | controller only |
| playing | false (play triangle), true (pause bars) | false | - | paused only |
| volume | 0..1 | 1 | - | 1.0 (knob at the right end) |
| optional buttons | AirPlay, Share, Picture in Picture, chapters, subtitles | per movie | - | AirPlay, Share, PiP |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal, paused | yes | both captures |
| playing (pause glyph) | no | [I] two vertical bars, 5 pt wide, 6 pt apart, same 25 pt height as the play triangle |
| control pressed | no | [I] glyph dims to about 0.5 opacity |
| control disabled | no | [I] glyph at about 0.3 opacity |
| scrubbing | no | [I] thumb unchanged; time labels update |
| titled HUD panel | no | [I]/[D] see "Titled HUD panel" below |

## Measurements
Evidence shorthand: `Light @` = `10-15-Catalina-Light-QuickTime.png`, `Dark @` = `10-15-Catalina-Dark-QuickTime.png`; `row y=` / `col x=` without a file refer to the Light file.

Coordinates in the table are pt relative to the controller's top-left corner. Controller origin in image px: Light (1143, 1325), Dark (1018, 1209); the two captures have identical internal layout (every glyph box is offset by exactly -125, -116 px) [M].

### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Controller size | 440 x 75 | [M] | `10-15-Catalina-Light-QuickTime.png @ 1143,1325,880,150`; `10-15-Catalina-Dark-QuickTime.png @ 1018,1209,880,150` |
| Corner radius | 4 | [M] | Light top-left: panel edge at x=1149, 1147, 1146, 1145, 1144 on rows y=1325..1329, straight (x=1143) from y=1334; Dark bottom-left the same shape on rows 1358..1350 |
| Border | none | [M] | no distinct line on any edge (`Light` row y=1340 @ x=1140..1146) |
| Volume-low glyph (speaker + 1 wave) | x 12, y 18.5, 12 x 12 | [M] | `Light @ 1167,1362,24,24` |
| Volume slider track | x 31, y 23, 51 x 3 (ends rounded, radius 1.5) | [M] | row y=1374: 1205..1306; col x=1250: 1371..1376 |
| Volume slider knob | 11 x 11 circle, centred on the track | [M] | `Light @ 1285,1363,22,22` |
| Volume-high glyph (speaker + 3 waves) | x 88, y 17, 20 x 15 | [M] | `Light @ 1319,1359,40,30` |
| Rewind (two left triangles) | x 153, y 17, 24 x 15 | [M] | `Light @ 1449,1359,48,30` |
| Play (triangle) | x 210, y 12, 22 x 25 | [M] | `Light @ 1563,1349,44,50`; row y=1374: 1563..1605; col x=1570: 1352..1395 |
| Fast-forward | x 263, y 17, 24 x 15 | [M] | `Light @ 1669,1359,48,30` |
| AirPlay glyph | x 331, y 18, 16 x 14 | [M] | `Light @ 1805,1361,32,28` |
| Share glyph | x 371, y 16, 11 x 15 | [M] | `Light @ 1885,1357,22,30` |
| Picture-in-Picture glyph | x 407.5, y 17.5, 20.5 x 16.5 | [M] | `Light @ 1958,1360,41,33` |
| Elapsed time text | x 12.5, cap top y 52, cap height 9 | [M] | `Light @ 1168,1429,142,18` |
| Scrubber track | x 91, y 55, 258 x 3 | [M] | row y=1437: track 1325..1840; col x=1400: 1435..1440 |
| Scrubber thumb | 3 x 14.5, fully rounded ends, vertically centred on the track; the track has a 1 pt gap (panel colour) on each side of the thumb | [M] | `Light @ 1456,1423,6,29`; gaps at x=1454..1455 and 1462..1463 on row y=1437 |
| Duration text | right edge 13 pt from the panel's right edge | [M] | `Light @ 1854,1429,143,18` |
| Gap text to track | 8 pt each side | [C] | 1309 -> 1325 and 1840 -> 1854 |

### Colours and fills
The panel is a vibrant material, so every value below is a composite with the blurred video and differs between the two captures (different movie frames).

| Part / state | Light capture | Dark capture | Tag | Evidence |
|---|---|---|---|---|
| Panel fill, range | `#6b5b3f (sRGB #6e5b3b)` .. `#8f887e (sRGB #90887d)` (warm, left to right) | `#6b5c3f (sRGB #6e5c3b)` .. `#968f86 (sRGB #978f85)` | [M] | row y=1340 (Light), row y=1240 (Dark) |
| Panel vs backdrop at the left edge | outside `#867f6f (sRGB #877f6d)`, inside `#665f44 (sRGB #675f40)` | - | [M] | `Light @ 1140,1400` and `@ 1146,1400` |
| Panel vs backdrop at the top edge | outside `#c5c4c4`, inside `#857762 (sRGB #88775f)` | - | [M] | `Light @ 1500,1322` and `@ 1500,1328` |
| Panel vs backdrop at the bottom edge | inside `#6e634d (sRGB #70634a)`, outside `#867f6f (sRGB #877f6d)` | - | [M] | `Light @ 1500,1472` and `@ 1500,1477` |
| Recovered material recipe | `backdrop-filter: blur(30px) saturate(1.8)`; tint `rgba(30,30,30,0.35)`; opaque fallback `#3d3d3d` | same | [I] | fitted by eye to the three edge pairs above (inside is about 0.75-0.82 of outside on R and G, 0.6-0.7 on B: darker and more saturated); AppKit's own tint is not recoverable from one backdrop |
| Glyphs (play, rewind, AirPlay ...) | `#feeed8 (sRGB #ffeed5)` | `#edd8b7 (sRGB #f1d8b3)` | [M] | `Light @ 1570,1374`; `Dark @ 1445,1258` |
| Glyph colour to use | `rgba(255,255,255,0.9)` with `mix-blend-mode: plus-lighter` where supported, else `#f2f2f2` | same | [I] | vibrant light foreground: lighter than a plain alpha blend on R, darker on B |
| Volume track, filled part | `#2e6cde (sRGB #176ae6)` | `#2e6cde (sRGB #176ae6)` | [M] | `Light @ 1250,1374`; `Dark @ 1125,1258` (stored accent blue) |
| Volume track, unfilled part | not shown (knob at maximum) | not shown | [I] | same as the unplayed scrubber track |
| Volume knob | `#d9d6cf (sRGB #dad6ce)` | `#d9d5ce (sRGB #dad5cd)` | [M] | `Light @ 1295,1374`; `Dark @ 1170,1258` |
| Scrubber track, played | `#b1a691 (sRGB #b3a68e)` | `#a79c89 (sRGB #a99c87)` | [M] | `Light @ 1400,1437`; `Dark @ 1275,1321` |
| Scrubber track, unplayed | `#958870 (sRGB #97886d)` | `#8c7e62 (sRGB #8f7e5e)` | [M] | `Light @ 1600,1437`; `Dark @ 1475,1321` |
| Scrubber track, CSS | played `rgba(255,255,255,0.45)`, unplayed `rgba(255,255,255,0.2)` | same | [C] | from the track values against the adjacent panel fill (`#675b46 (sRGB #695b43)`, `#786a52 (sRGB #7b6a4f)`: col x=1400 and x=1600) |
| Scrubber thumb | `#fbeed8 (sRGB #fdeed5)` | - | [M] | `Light @ 1460,1437` |
| Time text | `#d8d5bc (sRGB #d8d5b9)` (elapsed, over a darker part) .. `#fdeed6 (sRGB #ffeed3)` (duration) | `#d8d6be (sRGB #d8d6bb)` .. `#fcf2dd (sRGB #fef2db)` | [M] | `Light @ 1168,1429,142,18` (brightest pixel), `Light @ 1900,1437`; `Dark @ 1775,1321` |

### Text and icons
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Time font | SF Pro Text 13 pt Regular, tabular (monospaced) digits | [C] | digit height 18 px (`0` boxes 1168..1180 and 1184..1196 x 1429..1446: equal 13 px widths, 16 px pitch) |
| Time format | `HH:MM:SS:FF` (hours, minutes, seconds, frames) | [M] | `00:03:16:12`, `00:12:49:22` (Light); `00:04:40:02` (Dark) |
| Play triangle | points (0,0) (22,12.5) (0,25) pt, corners rounded about 1 pt | [M] | box above |
| Rewind / fast-forward | two triangles each 12 x 15 pt, touching | [M] | box 48 x 30 px |
| AirPlay | 16 x 11 pt rounded-rectangle outline (1.5 pt stroke) open at the bottom centre, with a solid 9 x 5 pt triangle below | [M] | crop `Light @ 1780,1340,240,70` |
| Share | 11 x 10 pt open-top box (1.5 pt stroke) with a 1.5 pt arrow rising 8 pt out of it | [M] | same crop |
| Picture in Picture | 18 x 13 pt outlined rounded rect (1.5 pt stroke) with a diagonal arrow, plus a solid 12 x 8 pt rounded rect overlapping the bottom-right corner | [M] | same crop |

### Shadows and effects
No shadow around the controller [M] (no darkening of the video outside any edge: `Light @ 1140,1400` equals the surrounding video tone). The volume knob has a faint dark edge on its lower half (`#544832 (sRGB #56482f)` at `Light @ 1295,1385`) = `box-shadow: 0 0.5px 1px rgba(0,0,0,.3)` [C].

## Layout and spacing
- The controller is centred horizontally in the movie (Light: window centre x=1581.5 px, controller centre 1582.5) [M].
- Bottom offset is proportional to the window: 127.5 pt in the 827 pt tall Light window, 115.5 pt in the 757 pt Dark window (both 15.3% of the window height) [C].
- Top row controls are vertically centred on y = 24.5 pt; the time row is centred on y = 56.5 pt.
- Left/right padding 12-12.5 pt.

## Titled HUD panel (not seen in the screenshots)
For completeness, the classic `NSPanel` HUD [I], from AppKit behaviour in 10.14-10.15; not shown: the screenshots contain a borderless QuickTime controller, not a titled HUD panel:
- Body: `NSVisualEffectView.Material.hudWindow`, dark, translucent; corner radius about 6 pt; no visible border; standard panel shadow.
- Title bar: 19 pt tall (utility-window height), same material, title centred in 11 pt (small system font) white at about 0.85; a single small close button at the left (10 pt), drawn as a plain "x" in a circle that brightens on hover.
- Controls inside take the dark vibrant appearance: labels white, secondary labels white 0.55, sliders with white 0.25 track and white knob, push buttons with white 0.25 fill.

## Keyboard and accessibility
Space toggles play/pause; Left/Right arrow step a frame while paused; J/K/L shuttle; Up/Down arrow change volume [D, QuickTime Player Help; not visible]. The controller exposes a toolbar-like group: buttons with titles ("Play", "Rewind", "Fast Forward", "AirPlay", "Share", "Picture in Picture"), sliders ("Volume", "Timeline" with a time value) [I]. ARIA: `role="toolbar"` containing `button`s and two `role="slider"` elements with `aria-valuetext` in time format.

## Browser notes
- `backdrop-filter` reproduces the blur; the vibrant foreground (glyphs that lighten with the backdrop) cannot be matched exactly. `mix-blend-mode: plus-lighter` on a 90% white glyph layer is the closest; fall back to flat near-white.
- Tabular digits: `font-variant-numeric: tabular-nums`.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-QuickTime.png` | 1143,1325,880,150 | whole controller, paused, volume at maximum |
| dark | `10-15-Catalina-Dark-QuickTime.png` | 1018,1209,880,150 | same controller over a different frame |
| light | `10-15-Catalina-Light-QuickTime.png` | 1140,1340,240,70 | volume glyphs and slider |
| light | `10-15-Catalina-Light-QuickTime.png` | 1780,1340,240,70 | AirPlay, Share, PiP glyphs |
