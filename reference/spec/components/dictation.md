# Dictation HUD (`dictation`)

- **Status:** present
- **AppKit:** system Dictation feedback window (DictationIM); apps start it with `NSApplication.startDictation(_:)`
- **HIG:** https://web.archive.org/web/20200503175359/https://developer.apple.com/design/human-interface-guidelines/macos/user-interaction/data-entry/
- **Appearances shown:** light, dark

## Purpose and behaviour
When the user starts Dictation (pressing Fn twice by default), a small panel with a microphone appears beside the insertion point's window; the microphone fills with a level meter while the user speaks, and the text is typed at the insertion point. Clicking Done (or pressing Fn / Return) ends dictation [D].

## Anatomy
```
 +----------------+
 |      (mic)     |>   pointer on the edge facing the text window
 |----------------|
 |      Done      |
 +----------------+
```

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| level | 0..1 fill of the microphone capsule | 0 | - | outline (light), filled (dark) |
| pointer side | right or left | toward the window | - | right |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| listening, low level | yes | 10-15-Catalina-Light-Dictation.png @ 53,123,196,190 |
| listening, high level (capsule filled) | yes | 10-15-Catalina-Dark-Dictation.png @ 29,117,190,190 |
| Done pressed | no | [I] lower area darkens by `rgba(0,0,0,0.1)` |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Panel size | 84 x 95 (light: px 53..220 x 123..312; dark fill px 31..194 plus 1 pt border, y=117..306) | [M] | 10-15-Catalina-Light-Dictation.png @ 40,180,215,1; 132,100,1,230; 10-15-Catalina-Dark-Dictation.png @ 16,180,215,1; 108,100,1,230 |
| Corner radius | 5 (the outline's top edge is straight from x=38 and its left edge from y=126; the corner starts at 28,116) | [M] | 10-15-Catalina-Dark-Dictation.png @ 26,114,14,14 |
| Upper (microphone) area | 63 high (light y=123..248) | [M] | 10-15-Catalina-Light-Dictation.png @ 132,123,1,128 |
| Divider | 1 pt (light y=249..250; dark y=243..244) | [M] | 10-15-Catalina-Light-Dictation.png @ 132,249,1,2; 10-15-Catalina-Dark-Dictation.png @ 108,243,1,2 |
| Done area | 31 high (light y=251..312) | [M] | 10-15-Catalina-Light-Dictation.png @ 132,251,1,62 |
| Microphone glyph | 25 x 44.5 (px 112..161 x 142..230): capsule 13 pt wide with a 2 pt outline, U-shaped holder 2 pt stroke, stem and 2 pt base line | [M] box; stroke widths from the row/column runs (4 px runs) | 10-15-Catalina-Light-Dictation.png @ 112,142,50,89; 40,180,215,1 |
| Pointer | triangle on the right edge, 10 deep x 19 high, centred 49 pt below the panel top (dark: apex px x=216 at y=214, base y=196..234) | [M] | 10-15-Catalina-Dark-Dictation.png @ 194,194,26,44 |
| "Done" label | centred (ink px 107..166 of panel 53..220), cap rows y=274..290 | [M] | 10-15-Catalina-Light-Dictation.png @ 107,274,60,17 |
| Position | pointer tip 2-3 pt from the document window's left edge, vertically near the insertion point's line | [M] one instance | 10-15-Catalina-Light-Dictation.png @ 200,180,60,1 |

### Colours and fills
| Part | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Panel fill | `#c1e7f5 (sRGB #b8e8f7)`..`#c5e2f6 (sRGB #bee3f8)` over the sky (`#87aed5 (sRGB #7daed9)`) | `#29292b` (`#28292b`..`#2a292b`) over `#314565 (sRGB #2c4568)` | [M] | 10-15-Catalina-Light-Dictation.png @ 60,180,50,1; 10-15-Catalina-Dark-Dictation.png @ 31,180,57,1 |
| Panel recipe | menu material: `backdrop-filter: blur(22px) saturate(1.8)` + `rgba(234,234,234,0.70)` | `rgba(40,40,42,0.92)` (almost opaque: no blue of the backdrop shows) | [C] light (same composite as `menu` over this sky: `#c0e0f4 (sRGB #b8e1f6)` there); [I] dark alpha | same |
| Border | 1 px lighter edge `#cae5f7 (sRGB #c4e6f9)` | 1 pt lighter `#535355` + 0.5 pt dark `#040608` outside | [M] | 10-15-Catalina-Light-Dictation.png @ 53,180,2,1; 10-15-Catalina-Dark-Dictation.png @ 28,180,3,1 |
| Divider | `#aecce0 (sRGB #a7cde2)` on `#c4e6f4 (sRGB #bce7f6)` (about `rgba(0,0,0,0.1)`) | `#4b4b4d` on `#292a2b` (about `rgba(255,255,255,0.16)`) | [M] composite, [C] alpha | 10-15-Catalina-Light-Dictation.png @ 132,249,1,2; 10-15-Catalina-Dark-Dictation.png @ 108,243,1,2 |
| Microphone outline | `#416374 (sRGB #376476)`..`#446374 (sRGB #3b6476)` | `#a2a3a4` | [M] | 10-15-Catalina-Light-Dictation.png @ 112,180,4,1; 10-15-Catalina-Dark-Dictation.png @ 88,180,4,1 |
| Microphone capsule interior | `#ffffff` (empty) | `#909292` (level fill) | [M] | 10-15-Catalina-Light-Dictation.png @ 126,180,22,1; 10-15-Catalina-Dark-Dictation.png @ 102,180,22,1 |
| "Done" text | `#476476 (sRGB #3f6578)` | `#a2a3a3` | [M] | 10-15-Catalina-Light-Dictation.png @ 107,274,60,17; 10-15-Catalina-Dark-Dictation.png @ 83,268,60,17 |
| Shadow | wallpaper darkened beside the panel (`#7597b9 (sRGB #6d97bc)` against `#87aed5 (sRGB #7daed9)`: about `rgba(0,0,0,0.13)` 1-13 pt out) | - | [M] | 10-15-Catalina-Light-Dictation.png @ 223,180,26,1 |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| "Done" font | SF Pro Text 12 pt Bold (cap height 17 px; rounded-letter stems 3-4 px) | same | [C] size and weight from measured ink/stems | 10-15-Catalina-Light-Dictation.png @ 107,274,60,17; stem row 10-15-Catalina-Light-Dictation.png @ 130,282,18,1 (ink x=133..136 and 140..143) |

### Shadows and effects
As `menu` [I]: `0 3px 14px rgba(0,0,0,0.3)`.

## Layout and spacing
Fixed size; placed to the left of the window being dictated into (to the right if there is no room [I]).

## Keyboard and accessibility
Fn Fn (or the configured shortcut) starts; Return or Fn ends; Esc cancels [D]. ARIA: `status` region "Dictation listening" with a `button` "Done".

## Browser notes
The level meter is a clipped fill inside the capsule (`clip-path` + height animation). Speech input itself is outside the scope of a visual replica.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Dictation.png | 40,110,220,215 | HUD beside a TextEdit window |
| dark | 10-15-Catalina-Dark-Dictation.png | 16,104,220,215 | HUD with the capsule filled |
