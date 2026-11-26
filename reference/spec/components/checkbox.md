# Checkbox (`checkbox`)

- **Status:** present
- **AppKit:** `NSButton` with `setButtonType(.switch)`; `state` = `.off` / `.on` / `.mixed` (`allowsMixedState`); `controlSize`
- **HIG:** https://web.archive.org/web/20200503161552/https://developer.apple.com/design/human-interface-guidelines/macos/buttons/checkboxes/
- **Appearances shown:** light, dark (blue accent; the other accents are in `accent-colors`)

## Purpose and behaviour
A checkbox lets the user choose between two opposite states; it is on when it contains a checkmark and off when empty, and is almost always followed by a title unless it is in a checklist. Titles use sentence case without punctuation. Checkboxes belong in views, not in toolbars or status bars. Groups are arranged vertically, left-aligned, with indentation to show dependency; an introductory label's baseline aligns with the first checkbox. Dependent checkboxes are disabled when not applicable. A parent checkbox whose children differ shows the mixed state, drawn as a dash. [D] (HIG, Checkboxes)

Clicking anywhere on the box or the title toggles it. There is no hover state on macOS. [D]

## Anatomy
```
  0        14   18.75 (first ink of title)
  +--------+
  |  box   |  Title text (13 pt system, baseline 2 pt above box bottom)
  +--------+
```
1. Box: 14 x 14 pt rounded square (radius 3 pt).
2. Off: white (light) / grey gradient (dark) well with a 0.5 pt border. On / mixed: accent-coloured fill.
3. Glyph: checkmark or dash, white, centred.
4. Title: `label` style "control label" to the right.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| state | off, on, mixed | off | `NSControl.StateValue` | all three |
| enabled | true, false | true | `isEnabled` | both (disabled off and disabled on) |
| controlSize | regular, small, mini | regular | `NSControl.ControlSize` | regular only |
| title | string or none (checklist cell) | - | `title` | both (titled; untitled in Sharing "On" column and Spotlight list) |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| off, enabled | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Network.png @ 830,668,28,28`; `10-15-Catalina-Dark-System-Preferences-Network.png @ 830,668,28,28` |
| on, enabled | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Network.png @ 830,548,28,28`; `10-15-Catalina-Dark-System-Preferences-Network.png @ 830,548,28,28` |
| mixed, enabled | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Software-Update.png @ 582,572,28,28`; `10-15-Catalina-Dark-System-Preferences-Software-Update.png @ 582,572,28,28` |
| off, disabled | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Security-and-Privacy.png @ 328,408,28,28`; Dark same coordinates |
| on, disabled | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Security-and-Privacy.png @ 328,452,28,28`; Dark same coordinates |
| pressed | not shown | [I] see Colours |
| focused (full keyboard access) | not shown on a checkbox | [I] standard `focus-ring` around the 14 pt box, radius 3 pt + ring width |
| inactive window | not shown in my screenshots | [I] on/mixed fill becomes the off (unfilled) well with a dark glyph; see Colours |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Box outer size (regular) | 14 x 14 | [M] | Light Network `@ 830,548,28,28` (row 562: accent run x 830..857); Dark Network same; Light Spotlight `@ 300,428,28,28`; Light Sharing `@ 182,442,28,28` |
| Corner radius | 3, on the outer edge of the 0.5 pt border. Confirmed by a least-squares fit with `tools/corner_fit.py` to a checked box: best 3 (rms 2.3 levels; 3.6 at 2.75, 3.8 at 3.25, 6.9 at 3.5) | [C] fit from [M] pixels | Light Network grid `@ 826,544,10,10`: top row first edge pixel x=832, full colour at x=835; left column full at y=553; fit corner `10-15-Catalina-Light-System-Preferences-Network.png @ 830,548,12,12` |
| Border width (off, light) | 0.5 (1 px) | [M] | Light Network row 682: x=830 `#b6b7b7` x1 then fill |
| Border width (on, light) | 0.5, inside the 14 pt | [M] | Light Network row 562 x=830 `#4181f5 (sRGB #2d7ffd)` x1, then `#4d89f5 (sRGB #3c87fd)` |
| Checkmark ink bounds (box-local pt) | x 2.5..11.5, y 3.0..11.0 | [M] | Dark Network `@ 834,553,20,18` (coverage > 0.3 spans px x 835..852, y 554..569) |
| Checkmark path (box-local pt, fitted centre line) | `M 3.4 7.0 L 6.7 9.55 L 10.75 3.85` | [C] | least-squares fit of per-row ink centroids, Dark Network `@ 834,553,20,18` |
| Checkmark stroke | 1.75 wide, round caps, miter join | [C] | horizontal ink width 3.9 px (long arm, slope 55 deg) and 6.2 px (short arm, 37 deg) -> 3.2..3.7 px perpendicular |
| Mixed dash | 8 x 2, centred (box-local x 3..11, y 6..8), ends square with 0.5 pt anti-aliased pixel | [M] | Light Software Update row 585: x 588 `#ebf2fc (sRGB #eaf2fd)`, 589..602 `#ffffff`, 603 `#ebf2fc (sRGB #eaf2fd)`; column 596: y 584..587 white |
| Title first ink from box right edge | 4.5..4.75 (title origin about 4 pt after the box) | [M] | Light Network: box ends x=857, `A` ink starts x=867; Light Touch ID: box ends 595, ink 605 |
| Title baseline | 2 pt above box bottom (cap top 2.5 pt below box top) | [M] | Light Network: box y 548..575, cap `A` y 553..571 |
| Vertical pitch, stacked checkboxes | 22 (standard, in lists and groups) | [M] | Light Touch ID boxes at y 524, 568, 612, 656; Light Spotlight rows 428, 472 |
| Small size box | 12 x 12 | [I] | AppKit small control metric; not shown in the reviewed screenshots |
| Mini size box | 10 x 10 | [I] | AppKit mini control metric; not shown |

Exact checkmark coverage (alpha, hex digit 0..f = 0..100 %), one character per device pixel, origin at box-local px (4,5) = pt (2, 2.5); from `10-15-Catalina-Dark-System-Preferences-Network.png @ 834,553,20,17` [M]:
```
00000000000000007a30
0000000000000007ffc0
000000000000003fffa0
00000000000001dfff30
00000000000009fff600
0000000000005fffb000
000000000001effe1000
03dd3000000bfff40000
08ffe300006fff800000
04fffe3003fffc000000
009fffd11cffe3000000
0009fffc9fff60000000
0000affffffa00000000
00001cffffe100000000
000001cfff3000000000
0000001be50000000000
```

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Off: border top | `#a6a5a5` | highlight `#767677` (first row inside the box) | [M] | Network col 844, y=668 (both) |
| Off: border sides | `#b6b7b7` | none (fill reaches the edge) | [M] | Network row 682, x=830 / 857 |
| Off: border bottom | `#b8b8b8` | none | [M] | Light Network col 844 y=695 |
| Off: fill | `#ffffff` | gradient 0% `#545556` -> 100% `#6e6f70` (lighter at the bottom), second row `#5a5b5b` | [M] | Network col 844 y 669..695 |
| Off: inner shadow (light) | rows below top border `#e2e1e1`, `#ededec`, `#f8f8fa`, then white; columns inside side border `#f7f7f7`, `#fcfcfc`; rows above bottom border `#fcfcfc`, `#f7f7f7` | - | [M] | Light Network col 844 y 669..672; row 682 x 831..832 |
| Off: inner shadow as CSS | `inset 0 0.5px 1px rgba(0,0,0,0.12), inset 0 0 0 0.5px rgba(0,0,0,0.03)` | - | [C] | from the rows above |
| Off: outer ring / shadow (dark) | - | 1 px ring outside the box: sides `#2e2f30`, top `#313232`, bottom `#2a2b2c`, then `#2f3031`, `#333435` on bg `#353637` | [M] | Dark Network row 682 x=829/858; col 844 y 667, 696..698 |
| On / mixed: border (light) | `#4181f5 (sRGB #2d7ffd)` all four sides | - | [M] | Light Network row 548 x 836..851; col 830 |
| On / mixed: fill | `#4d89f5 (sRGB #3c87fd)`-class flat, excluding the checkmark and its shadow (`#4d8af5 (sRGB #3b89fd)` at the cited unobstructed pixel) | gradient 0% `#2e6bdd (sRGB #1869e5)` -> 100% `#285fc6 (sRGB #145dcd)`; first row highlight `#6898e9 (sRGB #5c97f0)`, second row `#3774df (sRGB #2272e7)` | [M] | `10-15-Catalina-Light-System-Preferences-Network.png @ 852,572`; `10-15-Catalina-Dark-System-Preferences-Network.png` col 850 y 548..575 (glyph excluded) |
| On / mixed: outer ring / shadow (dark) | none | ring sides `#2b2c2d`, top `#2d2e2f`, bottom `#272828`, then `#303131`, `#343535` (bg `#353637`) | [M] | Dark Network row 562 x=829/858; col 850 y 547, 576..578 |
| Dark ring as CSS | - | `0 0 0 0.5px rgba(0,0,0,0.18), 0 0.5px 1px rgba(0,0,0,0.12)` | [C] | bg `#36` -> `#2c` = 18 % black; bottom rows 26 %, 11 %, 4 % |
| Glyph (on, mixed) | `#ffffff` | `#dee7f8 (sRGB #dce7fa)` over the fill = white @ 0.85 | [M] / [C] | `10-15-Catalina-Light-System-Preferences-Network.png @ 850,556`; `10-15-Catalina-Dark-System-Preferences-Network.png @ 850,556` |
| Glyph drop shadow (light only) | darkest `#336cd9 (sRGB #216ae1)`..`#2f69d5 (sRGB #1b67dd)`, offset 0.5 pt down, about 0.5 pt blur; as CSS `drop-shadow(0 0.5px 0.5px rgba(3,54,165,0.35))` | none | [M] / [C] | Light Network `@ 834,553,20,20` (shadow row under dash: Light Software Update row 588 x 590..601 `#2f69d5 (sRGB #1b67dd)`) |
| Disabled off: border | sides `#c3c3c3`, top `#bbbbbb`, bottom `#c3c3c3` | highlight row `#565657`, outer ring `#323334` | [M] | Security and Privacy row 422, col 342 (light, dark) |
| Disabled off: fill | `#f1f1f1` (top rows `#e3e3e3`, `#e7e7e7`, `#eeeeee`) | gradient `#474849` -> `#535354` | [M] | same |
| Disabled on: box | same as disabled off | same as disabled off (`#464646` -> `#525252`) | [M] | Security and Privacy `@ 328,452,28,28` |
| Disabled on: glyph | `#919191` = black @ 0.40 on `#f1f1f1`, no shadow | `#767676`..`#7b7b7b` = white @ 0.25 on the gradient | [M] / [C] | Security and Privacy row 466 x 335, 343 |
| Pressed on | `#3f7ae0 (sRGB #2d78e8)` fill (about 12 % darker) | `#2459b8 (sRGB #0f57bf)` -> `#2050a6 (sRGB #0e4eac)` | [I] | never captured; AppKit darkens the pressed bezel |
| Pressed off | `#f0f0f0` fill | fill lightened 8 % | [I] | never captured |
| Inactive window, on/mixed | off well with glyph `rgba(0,0,0,0.85)` | off well with glyph `rgba(255,255,255,0.85)` | [I] | AppKit removes the accent in non-key windows; not captured here |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Title font | SF Pro Text 13 pt regular (cap height 18-19 px) | same | [C] | Light Network `A` y 553..571 |
| Title colour, enabled | `#222222` on `#e3e3e3` = `rgba(0,0,0,0.85)` | `#e1e1e1` on `#353637` = `rgba(255,255,255,0.85)` | [M] / [C] | Network `@ 866,548,300,30` darkest / lightest |
| Title colour, disabled | `#a9a9aa` = `rgba(0,0,0,0.25)` | `#686869` = `rgba(255,255,255,0.25)` | [M] / [C] | Security and Privacy `@ 366,780,120,30` |

### Shadows and effects
Light: no outer shadow on either state. Dark: the 0.5 pt dark ring plus 1 pt soft shadow below, listed above. No glow.

## Layout and spacing
- Box and title are centred on the cap height: box centre = cap centre (box y 548..575, cap 553..571). [M]
- Standard stacked pitch 22 pt (14 pt box + 8 pt gap). Panes that want more air use 24 pt (Notifications) or 30 pt (Network). [M] Light Notifications boxes at y 592, 640, 688; Light Network 548, 608, 668.
- A checkbox followed by an inline pop-up button (Sidecar, Security) shares the pop-up's text baseline. [M] `10-15-Catalina-Light-System-Preferences-Sidecar.png`
- Indent dependent checkboxes by 26 pt under the parent (Security and Privacy: parent text x=276 px, child boxes x=328 px). [M]
- Hit area: box plus title. [D]

## Keyboard and accessibility
Space toggles when focused; focusable with Tab only when Full Keyboard Access is on. Role `AXCheckBox`, value 0 / 1 / 2 (mixed). ARIA: `role="checkbox"` with `aria-checked="true|false|mixed"`, or a native `<input type="checkbox">` with `indeterminate`. [D]

## Browser notes
- Fully reproducible: `appearance:none` 14 px box, `border-radius:3px`, the fills above and an inline SVG glyph. Use the fitted path with `stroke-linecap:round; stroke-linejoin:miter; stroke-width:1.75`.
- Half-point borders need `0.5px` borders or `box-shadow: inset 0 0 0 0.5px`; on 1x displays fall back to 1 px with the colour lightened so the box does not look heavier.
- The dark off gradient runs lighter towards the bottom; do not reuse the push-button gradient direction.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-System-Preferences-Network.png | 830,548,28,28 | on |
| light | 10-15-Catalina-Light-System-Preferences-Network.png | 830,668,28,28 | off |
| light | 10-15-Catalina-Light-System-Preferences-Software-Update.png | 582,572,28,28 | mixed |
| light | 10-15-Catalina-Light-System-Preferences-Security-and-Privacy.png | 328,408,28,72 | disabled off, disabled on |
| light | 10-15-Catalina-Light-System-Preferences-Spotlight.png | 300,428,28,28 | on, inside a white list row |
| dark | 10-15-Catalina-Dark-System-Preferences-Network.png | 830,548,28,28 | on |
| dark | 10-15-Catalina-Dark-System-Preferences-Network.png | 830,668,28,28 | off |
| dark | 10-15-Catalina-Dark-System-Preferences-Software-Update.png | 582,572,28,28 | mixed |
| dark | 10-15-Catalina-Dark-System-Preferences-Security-and-Privacy.png | 328,408,28,72 | disabled off, disabled on |
| dark | 10-15-Catalina-Dark-System-Preferences-Sharing.png | 182,442,28,28 | off, inside a dark list row |
