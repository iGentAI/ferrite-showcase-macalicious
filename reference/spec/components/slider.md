# Slider (`slider`)

- **Status:** present
- **AppKit:** `NSSlider` (`sliderType = .linear`, `numberOfTickMarks`, `tickMarkPosition`, `allowsTickMarkValuesOnly`, `isVertical`, `controlSize`, `trackFillColor`)
- **HIG:** https://web.archive.org/web/20200504054800/https://developer.apple.com/design/human-interface-guidelines/macos/selectors/sliders/
- **Appearances shown:** light, dark

## Purpose and behaviour
A horizontal or vertical track with a thumb that the user drags to pick a value in a range. Without tick marks the thumb is round and the track between the minimum and the thumb is filled with colour; with tick marks the thumb is directional, pointing at the ticks, and the track is not tinted. Sliders often have icons or labels at the minimum and maximum ends, an introductory label (title-style capitalisation, ending in a colon), and may give live feedback while dragging. Tick marks may carry labels; labelling only minimum and maximum is usually enough. Never reverse the direction. [D] (HIG, Sliders)

Clicking the track moves the thumb to the click; with `allowsTickMarkValuesOnly` the thumb snaps to ticks. [D]

## Anatomy
```
round (no ticks)                         directional (ticks below)
     ___                                       _____
====(   )--------   track 3 pt             ---|     |-------
     ---   knob 15 pt                          \   /   thumb 15 x 16.25 pt
                                           |    \ /    |      ticks 1 x 4 pt
```
1. Track: 3 pt high capsule (radius 1.5 pt). Filled part (round style only): accent colour from the leading end to the thumb centre.
2. Tick marks (optional): 1 pt wide bars below the track.
3. Thumb: white (light) / light grey (dark) with a hairline outline and a soft shadow.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| style | round thumb with filled track; directional thumb with ticks | round | `numberOfTickMarks == 0` or > 0 | both |
| controlSize | regular, small (mini exists) | regular | `controlSize` | regular (Sound, Dock, Displays, Energy Saver), small (Trackpad) |
| tick position | below (above / leading / trailing) | below | `tickMarkPosition` | below only |
| orientation | horizontal, vertical | horizontal | `isVertical` | horizontal only |
| value | min..max | - | `doubleValue` | several |
| enabled | true, false | true | `isEnabled` | enabled only |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal, round, key window | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Displays.png @ 856,388,480,36`; `10-15-Catalina-Dark-System-Preferences-Displays.png @ 856,388,480,36` |
| normal, directional with ticks, regular | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Sound.png @ 636,944,368,42`; Dark same |
| normal, directional with ticks, small | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Trackpad.png @ 228,680,204,30`; Dark same |
| pressed (dragging) | not shown | [I] thumb fill darkens to `#f0f0f0` (light) / lightens to `#e0e0e0` (dark) |
| disabled | not shown (the Dock Magnification slider with its checkbox off is drawn identically to the enabled Size slider: `10-15-Catalina-Light-System-Preferences-Dock.png` rows 210 and 306) | [I] whole control at 50 % opacity, filled track drawn in the unfilled colour |
| focused | not shown | [I] `focus-ring` around the thumb shape |
| inactive window | not shown in my screenshots | [I] filled track becomes the unfilled track colour (accent removed) |

## Measurements
### Geometry (pt)
| Property | Regular | Small | Tag | Evidence |
|---|---|---|---|---|
| Track height | 3 | 3 | [M] | Light Sound col 700: y 954..959; Light Trackpad col 260: y 688..693 |
| Track end radius | 1.5 (capsule) | 1.5 | [M] | Light Sound rows 954 / 956 / 959 start at x 637 / 636 / 637 |
| Round knob diameter (fill) | 15 | not shown | [M] | Light Displays row 404: white x 1218..1247; col 1232: y 390..419. Dark Displays row 404: x 1209..1238 |
| Round knob outline | 0.5 outside the fill (total 16) | - | [M] | Light Displays col 1232: y=389 `#c3c3c3`, y=420 `#a9a9a9` |
| Round knob centre | on the track centre line | - | [M] | knob y 390..419, track y 402..407 |
| Directional thumb body (fill) | 15 wide x 16.25 high | 11 wide x 11.5 high | [M] | Light Sound row 958: white x 825..854; col 838: y 946..977 + apex 978. Light Trackpad row 686: white x 319..340; col 330: y 682..704 |
| Directional thumb shape (body-local pt) | `M2 0 H13 A2 2 0 0 1 15 2 V8.75 L7.5 16.25 L0 8.75 V2 A2 2 0 0 1 2 0 Z` | `M1.5 0 H9.5 A1.5 1.5 0 0 1 11 1.5 V6 L5.5 11.5 L0 6 V1.5 A1.5 1.5 0 0 1 1.5 0 Z` | [C] | taper is exactly 1 px per row per side (45 deg): Light Trackpad rows 696 / 698 / 700 / 702 / 704 white widths 16 / 12 / 8 / 4 / 2 px; Light Sound grid `@ 824,940,30,32` rows 964..971 |
| Directional thumb outline | 0.5 outside the body (total 16 wide) | 0.5 (total 12 wide) | [M] | Light Sound row 958 x=824 `#969696`, x=855 `#979797`; Light Trackpad row 692 x=318, 341 |
| Thumb body top above track top | 4 | 3 | [M] | Sound: body top y=946, track top 954; Trackpad: 682, 688 |
| Thumb apex below track bottom | 9.25 | 5.5 | [M] | Sound: track bottom 960, apex 978.5; Trackpad: 694, 705 |
| Tick mark size | 1 wide x 4 high | 1 wide x 3 high | [M] | Light Sound row 978: x 650..651; col 736: y 977..984. Light Trackpad col 239: y 703..708; row 704: x 238..239 |
| Tick top below track bottom | 8.5 | 4.5 | [M] | Sound: 960 -> 977; Trackpad: 694 -> 703 |
| First / last tick centre inset from track end | 7.5 (half the thumb width) | 5.5 | [M] | Sound: track x 636..1003, ticks at 651 and 989; Trackpad: track 228..431, ticks 239 and 421 |
| Tick spacing | (track length - thumb width) / (ticks - 1) | same | [C] | Sound: 5 ticks, 84.5 px apart; Trackpad Tracking speed: 10 ticks, 20.2 px apart (x 547..729) |
| Thumb travel | thumb centre runs from track start + half thumb to track end - half thumb | same | [M] | Light Dock Magnification at maximum: thumb x 1018..1049, track ends x=1048 |
| Control height to reserve | 15 (round), 24 (ticks) | 18 (ticks) | [C] | thumb plus ticks extents above |
| Track lengths seen | 240 (Displays), 184 (Sound), 202 (Dock), 434 (Energy Saver) | 102 (Trackpad) | [M] | rows cited above; Energy Saver row 422 x 464..1331 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Track, unfilled | `#b1b1b1` on `#e3e3e3`, `#b9b9b9` on `#ececec` = `rgba(0,0,0,0.22)` | `#515152` on `#363637`, `#4c4c4d` on `#2f3031` = `rgba(255,255,255,0.14)` | [M] / [C] | Displays col 1300 y 402..407; Sound col 700 y 954..959 |
| Track, filled (round style) | `#4d8af5 (sRGB #3b89fd)` | `#2e6bde (sRGB #1869e6)` | [M] | Displays col 900 y 402..407 (light, dark) |
| Thumb fill | `#ffffff` | `#cccccc` flat, first row `#d2d2d2`..`#d6d6d6` | [M] | Light Displays grid `@ 1212,384,42,42`; Dark Displays col 1232; Dark Sound col 838 y 946..977 |
| Thumb outline (light) | top `#c8c8c8`, sides `#c0c0c0` (`#969696` where it crosses the track), taper `#b4b4b4`..`#bcbcbc` on `#ececec` = `rgba(0,0,0,0.15)` top -> `rgba(0,0,0,0.19)` sides -> `rgba(0,0,0,0.23)` bottom | - | [M] / [C] | Light Sound grid `@ 824,940,30,32` |
| Round knob outline (light) | top `#c3c3c3`, bottom `#a9a9a9` on `#e3e3e3` = `rgba(0,0,0,0.14)` -> `rgba(0,0,0,0.26)` | - | [M] / [C] | Light Displays col 1232 y 389, 420 |
| Thumb outer ring (dark) | - | `#2a2b2c`..`#28292a` on `#2f3031`; `#313132`..`#2e2e2f` on `#363637` = `rgba(0,0,0,0.15)` 0.5 pt | [M] / [C] | Dark Sound rows 948..972 (x 824, 855); Dark Trackpad rows 686..704 |
| Thumb shadow | below the outline: `#cbcbcb`, `#dbdbdb` on `#e3e3e3` = `0 0.5px 1px rgba(0,0,0,0.11)` | `#2b`, `#30`, `#34` on `#36` = `0 0.5px 1px rgba(0,0,0,0.2)` | [M] / [C] | Displays col 1232 y 421..422 (light), grid rows 420..422 (dark) |
| Tick marks | `#979797` on `#ececec`, `#909090` on `#e3e3e3` = `rgba(0,0,0,0.36)` | `#636464` on `#2f3031`, `#686869` on `#363637` = `rgba(255,255,255,0.25)` | [M] / [C] | Sound row 978; Trackpad row 704 |

### Text and icons
End labels under tick sliders (Dock "Small" / "Large", Trackpad "Light" / "Medium" / "Firm", Energy Saver "1 min" ... "Never") use the `label` style "small label" (11 pt regular, primary label colour), centred on their tick, cap top 6 pt below the tick bottom [M] (`10-15-Catalina-Light-System-Preferences-Trackpad.png` ticks end y=708, label caps start y=721). The title above a slider (Trackpad "Click", Keyboard "Key Repeat") is 13 pt regular centred over the track. Speaker glyphs at the ends of the Sound sliders are pane artwork (see `apps/system-preferences-sound.md`).

### Shadows and effects
Listed with the thumb above. The track has no inner shadow or border: it is a flat translucent capsule.

## Layout and spacing
- A right-aligned form label ends 12 pt before the track start and is centred on the track (Displays: label ink ends at image x=832, track starts at x=856, that is 24 px = 12 pt). [M]
- Icons at the ends of the Sound sliders: 13 pt gap icon-to-track on the left, 9 pt on the right (see the Sound blueprint). [M]
- Minimum length: thumb width + 2 x radius; sliders stretch horizontally and never vertically. [I]

## Keyboard and accessibility
With Full Keyboard Access: arrow keys step the value (to the next tick when `allowsTickMarkValuesOnly`), Option-arrow or Page keys take larger steps. Role `AXSlider` with `AXValue`, min and max; increment / decrement actions. ARIA: `role="slider"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-orientation`; or a visually restyled `<input type="range">`. [D]

## Browser notes
- `<input type="range">` pseudo-elements cannot draw the directional thumb or the tick marks consistently across engines; build it from elements: a track `div`, a fill `div`, an SVG thumb and absolutely positioned tick `div`s.
- The track and tick colours are translucent blacks / whites, so use the rgba values, not the composites, to stay correct on both `#ececec` window and `#e3e3e3` box backgrounds.
- The outline is outside the 15 pt body: use `filter: drop-shadow` or an SVG stroke on a 16 pt path, not `border`.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-System-Preferences-Displays.png | 856,388,480,36 | round knob, filled track |
| light | 10-15-Catalina-Light-System-Preferences-Sound.png | 636,944,368,42 | regular directional thumb, 5 ticks |
| light | 10-15-Catalina-Light-System-Preferences-Trackpad.png | 228,680,512,32 | two small tick sliders (3 and 10 ticks) |
| light | 10-15-Catalina-Light-System-Preferences-Dock.png | 644,190,406,160 | regular tick sliders, thumb at maximum |
| light | 10-15-Catalina-Light-System-Preferences-Energy-Saver.png | 464,400,868,60 | long regular tick slider |
| dark | 10-15-Catalina-Dark-System-Preferences-Displays.png | 856,388,480,36 | round knob, filled track |
| dark | 10-15-Catalina-Dark-System-Preferences-Sound.png | 636,944,368,42 | regular directional thumb |
| dark | 10-15-Catalina-Dark-System-Preferences-Trackpad.png | 228,680,512,32 | small tick sliders |
