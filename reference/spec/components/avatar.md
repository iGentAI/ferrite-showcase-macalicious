# Avatar (`avatar`)

- **Status:** present
- **AppKit:** none: Find My draws it (UIKit for Mac; an image view with a circular mask). No system-drawn style.
- **HIG:** none specific. Related: image views https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/image-views/
- **Appearances shown:** light, dark
- **Provenance:** added on 2026-10-06 for the disc in the People list of Find My, which the Find My demo had drawn with the monogram of `image-view` (a flat grey disc measured in System Preferences). Measured that day on the two Find My captures.

## Purpose and behaviour
The picture that stands for a person in a list. Find My shows the person's picture, or, for a person without one, a white silhouette on a grey disc; the captures show the silhouette. Not interactive: the row around it is.

## Anatomy
```
   .--.
  ( () )   28.75 pt disc, grey gradient; white head and shoulders (Apple's artwork)
   '--'
```

## Variants and parameters
| Parameter | Values | Default | Shown in screenshots |
|---|---|---|---|
| content | picture, initials, silhouette | silhouette | silhouette |
| diameter | any | 29 pt (the component's default; the captures' disc measures 28.75) | 28.75 pt |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal, silhouette | yes | `10-15-Catalina-Light-Find-My.png @ 134,247,60,60`; `10-15-Catalina-Dark-Find-My.png @ 90,223,60,60` |
| picture | no | [I] the picture cropped to the disc |
| initials | no | [I] white initials on the same disc |
| inactive window | yes (dark) | the Dark Aqua capture's window is not key: the disc is the same as in the light, key one |

## Measurements
Evidence shorthand: `Light` before `@`, `row y=` or `col x=` means `10-15-Catalina-Light-Find-My.png`, `Dark` the dark file. The window's origin is image px (112, 76) in the light file and (68, 52) in the dark one; geometry is in pt from the window's top-left corner.

### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Disc | 28.75 in diameter (57.5 px), centred at 25.75, 100.25 | [M] | Light row y=276: x=135..191; col x=163: y=248..305. Dark row y=252: x=91..147 |
| Silhouette, head | a circle about 9.75 across, its top 6.5 under the disc's | [M] | Light col x=163: y=261..280; row y=276: x=156..170 |
| Silhouette, shoulders | from 19.5 to 26.25 under the disc's top; 13.5 wide at 24 | [M] | Light col x=163: y=287..300; row y=296: x=150..176 |
| Disc in the row | 11.5 from the window's leading edge; its centre 23.25 under the top of its 48 pt row | [C] | Light row y=276: x=135, the window's edge at x=112; rows from y=77 pt (the rule under the switch at 76) |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Disc, top | `#a5aab6` | `#a5aab6` | [M] | Light `@ 163,250`; Dark `@ 119,226` |
| Disc, middle | `#959aa4` | `#959aa4` | [M] | Light `@ 137,276`; Dark `@ 93,252` |
| Disc, bottom | `#868a93` | `#868a93` | [M] | Light `@ 163,303`; Dark `@ 119,279` |
| Disc, as a recipe | `linear-gradient(#a5aab6, #868a93)` | the same | [C] | the three rows above; the middle of the two ends is `#969aa5` |
| Silhouette | `#ffffff` | `#ffffff` | [M] | Light `@ 163,268`; Dark `@ 119,244` |
| Sidebar behind the disc | `#f8f7f4` | `#1f2122` | [M] | Light `@ 130,276`; Dark `@ 86,252` |

## Layout and spacing
- The name starts 50 pt from the window's leading edge, 9.75 pt after the disc.

## Keyboard and accessibility
An `AXImage` [I]. ARIA: `img` named by the person's name, or hidden when the name stands beside it.

## Browser notes
- The silhouette is Apple's artwork and is not reproduced: the component draws a head and shoulders of its own at the measured places.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Find-My.png` | 128,240,72,72 | the disc of "Me" on the sidebar |
| dark | `10-15-Catalina-Dark-Find-My.png` | 84,216,72,72 | the same, dark, window not key |
