# Window shadow (`window-shadow`)

- **Status:** present
- **AppKit:** `NSWindow.hasShadow`, drawn by the window server; the size depends on the window level and key state
- **HIG:** https://web.archive.org/web/20200503141343/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/window-anatomy/
- **Appearances shown:** light, dark

## Purpose and behaviour
The shadow separates a window from what is behind it and signals layering: the key window casts the largest shadow, inactive windows "appear to fall backward" [D] with a smaller one, and menus, popovers and utility panels use a small tight shadow.

## Anatomy
Two parts, both outside the frame: a 0.5 pt hairline hugging the edge (see `window`) and a soft Gaussian shadow offset downwards.

## Variants and parameters
| Class | Used by | Shown in screenshots |
|---|---|---|
| key | key document/app windows, dialogs and preference windows captured on their own | 184 window captures |
| inactive | windows of background apps | Safari in the Picture in Picture shots |
| small | menus, popovers, utility panels (Help Viewer) | Theme shots (menu), Calendar/Reminders (popover), Help |
| banner | notification-style panels | Finder Eject Warning, Siri |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| key window | yes | alpha channel of window captures; also in situ in `...About-This-Mac.png` |
| inactive window | yes | in situ, recovered against the same pixels of `10-15-Catalina-Light-Desktop.png` / `10-15-Catalina-Dark-Desktop.png` |
| sheet | yes, Print | [M] below-sheet composite falloff on white: `#cfcfcf` at first pixel, `#dfdfdf` at +8 px, `#efeeee` at +18 px, `#f7f7f7` at +28 px; 10-15-Catalina-Light-Print.png @ 700,1043; 10-15-Catalina-Light-Print.png @ 700,1050; 10-15-Catalina-Light-Print.png @ 700,1060; 10-15-Catalina-Light-Print.png @ 700,1070; full profile and fit in `sheet` |

## Measurements
### Geometry (pt)
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Canvas margins reported by `$M info` (key) | 56 L, 38 T, 56 R, 74 B (112/76/112/148 px) | same | [M] | every standard window capture |
| Extent of non-zero alpha (key) | 48 L, 31 T, 48 R, 67 B (96/62/96/134 px) | 52.5 L, 33 T, 52.5 R, 69 B (105/66/105/138 px) | [M] | alpha bbox `(16,14,..)` light and `(7,10,..)` dark, 87 light and 97 dark captures |
| Canvas margins, utility panel (Help) | 23 L, 19 T, 23 R, 27 B (46/38/46/54 px) | same | [M] | `10-15-Catalina-Light-Help.png`, `10-15-Catalina-Dark-Help.png` |
| Extent, utility panel | 18.5 L, 15 T, 18.5 R, 23 B | 19.5 L, 15.5 T, 19.5 R, 23.5 B | [M] | same |
| Canvas margins, banner | 19 L, 18 T, 19 R, 20 B; extent 15.5/14/15/16.5 | same | [M] | `10-15-Catalina-Light-Finder-Eject-Warning.png` |

### Colours and fills
Shadow RGB is black; the measured alpha varies with distance and window class [M] (profiles below). The edge hairline is a separate compositing layer [C] (fit below), not a second opaque border.

### Text and icons
None; this effect adds no text, icon or hit target.

### Alpha falloff (black, alpha at d image px outside the frame edge; 2 px = 1 pt)
Values are the mean of 9 neighbouring lines (the stored alpha is dithered by about +/-0.01). d=1 includes the hairline.

Key window, `10-15-Catalina-Light-Finder-Network.png` (frame x 112..1963, y 76..1497), measured on column x=1037 (top, bottom) and row y=786 (sides) [M]:
| d (px) | 1 | 2 | 3 | 4 | 6 | 8 | 12 | 16 | 20 | 30 | 40 | 60 | 80 | 100 | 120 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| top | .247 | .111 | .072 | .062 | .058 | .054 | .046 | .039 | .031 | .018 | .010 | .003 | 0 | | |
| bottom | .447 | .351 | .322 | .319 | .310 | .307 | .292 | .280 | .264 | .227 | .185 | .112 | .056 | .024 | .008 |
| side | .351 | .230 | .191 | .190 | .177 | .168 | .156 | .142 | .127 | .090 | .063 | .027 | .009 | 0 | |

Key window, `10-15-Catalina-Dark-Finder-Network.png` (frame x 112..2109, y 76..1493), column x=1110, row y=784 [M]:
| d (px) | 1 | 2 | 3 | 4 | 6 | 8 | 12 | 16 | 20 | 30 | 40 | 60 | 80 | 100 | 120 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| top | .958 | .120 | .119 | .114 | .103 | .095 | .084 | .070 | .053 | .034 | .020 | .004 | 0 | | |
| bottom | .981 | .566 | .559 | .559 | .544 | .533 | .510 | .485 | .464 | .398 | .325 | .195 | .093 | .041 | .012 |
| side | .969 | .342 | .334 | .325 | .311 | .299 | .269 | .244 | .219 | .161 | .115 | .049 | .013 | .004 | |

Utility panel, `10-15-Catalina-Light-Help.png` / `10-15-Catalina-Dark-Help.png` (frame x 46..1799, y 38..1481) [M]:
| d (px) | 1 | 2 | 3 | 4 | 6 | 8 | 12 | 16 | 20 | 30 | 40 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| light top | .236 | .107 | .070 | .062 | .051 | .041 | .028 | .021 | .015 | .005 | 0 |
| light bottom | .314 | .195 | .165 | .151 | .143 | .129 | .101 | .084 | .061 | .024 | .008 |
| light side | .273 | .153 | .113 | .102 | .089 | .075 | .056 | .045 | .028 | .008 | 0 |
| dark top | .863 | .086 | .078 | .068 | .062 | .053 | .037 | .024 | .013 | .005 | 0 |
| dark bottom | .883 | .194 | .190 | .181 | .169 | .154 | .125 | .098 | .069 | .028 | .009 |
| dark side | .871 | .137 | .132 | .124 | .110 | .098 | .071 | .052 | .035 | .013 | 0 |

Inactive window, recovered in situ as `1 - shadowed/unshadowed` against the identical desktop pixels (`10-15-Catalina-Light-Desktop.png`, `10-15-Catalina-Dark-Desktop.png`) [C]. Safari frame: light x 316..2823, y 104..1831 in `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png`; dark x 344..2851, y 78..1883 in `10-15-Catalina-Dark-Safari-v13-Picture-in-Picture.png`. Top on column x=1000, bottom on x=1200, side on row y=1200:
| d (px) | 1 | 2 | 3 | 4 | 6 | 8 | 12 | 16 | 24 | 32 | 48 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| light top | .222 | .100 | .060 | .050 | .049 | .044 | .033 | .025 | .013 | .005 | 0 |
| light bottom | .327 | .221 | .177 | .171 | .169 | .159 | .152 | .126 | .091 | .063 | .024 |
| light side | .277 | .152 | .118 | .112 | .100 | .093 | .076 | .063 | .039 | .021 | .005 |
| dark top | .868 | .105 | .098 | .093 | .081 | .077 | .060 | .043 | .022 | | |
| dark bottom | .893 | .316 | .322 | .316 | .311 | .291 | .257 | .223 | .167 | .116 | .044 |
| dark side | .882 | .211 | .208 | .200 | .182 | .170 | .138 | .118 | .077 | .043 | .011 |

Menu (small class), in situ in `10-15-Catalina-Theme-Light-Graphite.png` / `10-15-Catalina-Theme-Dark-Graphite.png` (menu x 90..561, bottom y 359), bottom on column x=300, side on row y=250 [C]:
| d (px) | 1 | 2 | 3 | 4 | 6 | 8 | 12 | 16 | 24 | 32 |
|---|---|---|---|---|---|---|---|---|---|---|
| light bottom | .312 | .198 | .162 | .154 | .141 | .130 | .102 | .083 | .043 | .020 |
| light side | .273 | .154 | .115 | .103 | .090 | .079 | .059 | .042 | .018 | .006 |
| dark bottom | .838 | .198 | .189 | .185 | .168 | .154 | .126 | .099 | .052 | .024 |
| dark side | .825 | .139 | .136 | .127 | .111 | .098 | .070 | .049 | .022 | .009 |

Popover (small class), alpha channel of `10-15-Catalina-Dark-Calendar.png` (popover body x 2098..2675, y 504..867), column x=2600 and row y=560 [M]: top .861 .084 .080 .072 (d=1..4), .060 (6), .044 (8), .037 (12), .025 (16), .007 (24); bottom .881 .200 .192 .180, .170, .153, .125, .094, .054; side .875 .136 .136 .123, .110, .101, .071, .051, .017. Light popover side (`10-15-Catalina-Light-Calendar.png`, row y=900 from x=2430): .273 .154 .114 .099, .089 (6), .078 (8), .058 (12), .044 (16), .018 (24) [M] (identical to the menu side profile; the top and bottom profiles there also contain the parent window's shadow).

Banner, `10-15-Catalina-Light-Finder-Eject-Warning.png` (frame x 38..725, y 36..161) [M]: top .224 .133 .094 .082, .067 (6), .055 (8), .031 (12), .016 (16), .008 (20); bottom .255 .169 .129 .114, .098, .078, .051, .031, .020; side .243 .153 .112 .096, .080, .067, .043, .024, .012. Dark: top .776 .114 .106 .098, .078, .063, .039, .020, .012; bottom .788 .157 .145 .137, .118, .094, .063, .039, .020.

### Shadows and effects
#### Fitted CSS (all [C])
Model: alpha(d) = A x (1 - Phi((d - offset)/sigma)), blur radius = 2 sigma, least squares over all three sides; root-mean-square error in alpha units given.

| Class | Light | Dark | RMS error |
|---|---|---|---|
| key window | `0 0 0 0.5px rgba(0,0,0,0.19), 0 18px 40px rgba(0,0,0,0.40)` | `0 0 0 0.5px rgba(0,0,0,0.95), 0 18px 40px rgba(0,0,0,0.70)` | 0.002 / 0.002 (window capture); 0.004 in situ in `...About-This-Mac.png` with the same parameters |
| inactive window | `0 0 0 0.5px rgba(0,0,0,0.19), 0 8px 24px rgba(0,0,0,0.26)` | `0 0 0 0.5px rgba(0,0,0,0.87), 0 8px 24px rgba(0,0,0,0.46)` | 0.005 / 0.004 |
| panel (utility), menu, popover | `0 0 0 0.5px rgba(0,0,0,0.19), 0 4px 16px rgba(0,0,0,0.26)` | `0 0 0 0.5px rgba(0,0,0,0.85), 0 4px 16px rgba(0,0,0,0.30)` | 0.003 / 0.002 |
| dialog captured alone | same as key window (identical canvas margins and alpha extent) | same | [M] by extent only |
| banner | `0 0 0 0.5px rgba(0,0,0,0.15), 0 1px 12px rgba(0,0,0,0.26)` | `0 0 0 0.5px rgba(0,0,0,0.75), 0 1px 12px rgba(0,0,0,0.30)` | 0.002 / 0.001 |

Dark windows additionally need the inner highlight `inset 0 0 0 1px rgba(255,255,255,0.20)` (see `window`).

## Layout and spacing
The shadow does not take part in layout. Leave at least 48 pt (sides), 31 pt (top) and 67 pt (bottom) of free space around a key window if the shadow must not be clipped [M].

## Keyboard and accessibility
None. The shadow change between key and inactive is a redundant cue next to the window controls' colour.

## Browser notes
`box-shadow` matches the Gaussian falloff within 0.5% alpha. The hairline needs `0.5px` spread (works at 2x; at 1x use a 1 px layer at half the alpha). The window server composites the shadow in linear-ish space; differences are below one 8-bit level.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Finder-Network.png` | 16,14,2044,1618 | whole key shadow in alpha |
| dark | `10-15-Catalina-Dark-Finder-Network.png` | 7,10,2208,1622 | whole key shadow in alpha |
| light | `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png` | 216,1832,400,100 | inactive shadow over the desktop (bottom) |
| light | `10-15-Catalina-Light-Help.png` | 9,8,1828,1520 | utility panel shadow |
| dark | `10-15-Catalina-Dark-Calendar.png` | 2040,440,700,480 | popover shadow in alpha |
| light | `10-15-Catalina-Theme-Light-Graphite.png` | 80,44,560,400 | menu shadow over the desktop |
