# Mission Control (`mission-control`)

- **Status:** present
- **AppKit:** Mission Control (Dock.app); apps opt windows in or out with `NSWindow.collectionBehavior`
- **HIG:** https://web.archive.org/web/20200503153858/https://developer.apple.com/design/human-interface-guidelines/macos/system-capabilities/mission-control/
- **Appearances shown:** light, dark

## Purpose and behaviour
Mission Control shows every open window of the current space as a non-overlapping thumbnail, with a Spaces bar at the top listing desktops and full-screen / Split View spaces. The user clicks a window to bring it forward, a space to switch, drags windows onto spaces, and adds a desktop with the + button. It opens with Control-Up, F3 or a three-finger swipe up (HIG, Mission Control) [D]. The Spaces bar is collapsed to a text strip until the pointer moves to the top; the screenshots show it expanded with thumbnails.

## Anatomy
```
+--------------------------------------------------------------------------+
|        [thumb][thumb][thumb][thumb]                                   +  |  146 pt Spaces bar
|        Desktop 1 Desktop 2 Notes & Safari Photos                          |
+--------------------------------------------------------------------------+
|   scaled windows of the current space, with their shadows, over the      |
|   desktop picture; Dock at the bottom                                    |
```

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| Spaces bar | collapsed (labels only), expanded (thumbnails) | collapsed | - | expanded |
| space kind | desktop, full-screen app, Split View pair | - | - | Desktop 1, Desktop 2, "Notes & Safari" (Split View), "Photos" (full screen) |
| current space | any | - | - | Photos (light), Desktop 1 (dark) |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| expanded bar, 4 spaces | yes | 10-15-Catalina-Light-Mission-Control.png @ 0,0,3360,294; 10-15-Catalina-Dark-Mission-Control.png @ 0,0,3360,294 |
| current-space ring | yes | 10-15-Catalina-Light-Mission-Control.png @ 2056,48,304,196; 10-15-Catalina-Dark-Mission-Control.png @ 1000,48,304,196 |
| window hovered (blue outline + title label) | no | [I] 3 pt accent outline around the thumbnail, title in a label below |
| space hovered (close x at the top-left of the thumbnail) | no | [I] 14 pt dark disc with x |
| collapsed bar | no | [I] 30 pt strip, same material, labels only, centred |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Spaces bar height (expanded) | 146 (px y=0..291), full width; 1 px darker line at y=292 in light | [M] | 10-15-Catalina-Light-Mission-Control.png @ 300,0,1,300; 10-15-Catalina-Dark-Mission-Control.png @ 300,0,1,300 |
| Space thumbnail | 144 x 90 (px 1008..1295 x 56..235): the 16:10 screen at 3/35 scale | [M] | 10-15-Catalina-Light-Mission-Control.png @ 985,140,400,1; 1150,36,1,210 |
| Thumbnail pitch | 176 (left edges px 1008, 1360, 1712, 2064): 32 pt gaps; the row is centred | [M] | 10-15-Catalina-Light-Mission-Control.png @ 985,140,1400,1 |
| Thumbnail top | 28 below the screen top | [M] | 10-15-Catalina-Light-Mission-Control.png @ 1150,36,1,30 |
| Current-space ring | 3 pt stroke, 1 pt gap to the thumbnail: outer box 152 x 98 (px 2056..2359 x 48..243) | [M] | 10-15-Catalina-Light-Mission-Control.png @ 2040,140,40,1; 2340,140,32,1; 10-15-Catalina-Dark-Mission-Control.png @ 1150,36,1,220 (ring rows 48..53 and 238..243) |
| Ring corner radius | outer 4 (ring corner at 2056,48; top edge straight from x=2064, left edge from y=56); the ring is 3 thick and a 1 pt gap separates it from the thumbnail, so the thumbnail corner is square | [M] | 10-15-Catalina-Light-Mission-Control.png @ 2050,44,16,14 |
| Space label | centred under the thumbnail; cap top 9 pt below the thumbnail bottom (y=254 against 236), baseline 18 pt below | [M] | 10-15-Catalina-Light-Mission-Control.png @ 1098,254,107,22 |
| Add (+) button | plus glyph 20 x 20 (px 3272..3311 x 126..165), stroke about 1.5; centre 34 pt from the right edge, vertically centred in the bar | [M] | 10-15-Catalina-Light-Mission-Control.png @ 3272,126,40,40 |
| Window thumbnails | each window scaled uniformly so all fit without overlap, keeping relative positions; light Maps x=36..1991, y=372..1721 (978 x 675 pt); System Preferences x=2016..3323, y=816..1899 (654 x 542 pt) | [M] extents; [D] scaling rule | edge runs in 10-15-Catalina-Light-Mission-Control.png @ 30,1000,3300,1; 10-15-Catalina-Light-Mission-Control.png @ 1300,365,1,15; 10-15-Catalina-Light-Mission-Control.png @ 1300,1714,1,15; 10-15-Catalina-Light-Mission-Control.png @ 2200,810,1,18; 10-15-Catalina-Light-Mission-Control.png @ 2200,1894,1,15 |

### Colours and fills
| Part | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Spaces bar fill, observed | `#8ac9f8 (sRGB #78cafd)` (top) to `#9cd3f8 (sRGB #8dd4fc)` (bottom) at x=300; `#91cdf8 (sRGB #80cefd)` (x=900), `#a6d2f8 (sRGB #9bd3fc)` (x=2500), `#b1d8f8 (sRGB #a8d9fb)` (x=3100) at y=150 | `#2a4269 (sRGB #24426c)` at x=300; `#273f66 (sRGB #213f69)` (900), `#192c4f (sRGB #142c52)` (2500), `#132648 (sRGB #0e264b)` (3100) | [M] | 10-15-Catalina-Light-Mission-Control.png @ 300,0,1,292; 900,150,12,12; 2500,150,12,12; 3100,150,12,12; dark same |
| Spaces bar recipe | very strong blur of the picture (the fill varies only slowly across 1680 pt) with a light tint: `backdrop-filter: blur(60px) saturate(1.8)` + `rgba(255,255,255,0.25)` | `backdrop-filter: blur(60px) saturate(1.8)` + `rgba(0,0,0,0.15)` | [I] | no un-blurred backdrop of this (different, close-up) desktop picture exists in the library, so the tint cannot be solved; values chosen to reproduce the observed lightening/darkening against the strip just below the bar (`#95bee3 (sRGB #8bbfe7)` light, `#3b527a (sRGB #36527d)` dark) |
| Opaque fallback | `#93cff8 (sRGB #82d0fc)` | `#2a4269 (sRGB #24426c)` | [M] | 10-15-Catalina-Light-Mission-Control.png @ 1040,262; 10-15-Catalina-Dark-Mission-Control.png @ 300,0 |
| Bottom edge line | `#7394b2 (sRGB #6b94b5)` (1 px) | none | [M] | 10-15-Catalina-Light-Mission-Control.png @ 300,292 |
| Current-space ring | `#5399f5 (sRGB #3b98fc)` | `#5399f5 (sRGB #3b98fc)` | [M] | 10-15-Catalina-Light-Mission-Control.png @ 2058,140; 10-15-Catalina-Dark-Mission-Control.png @ 1002,140 |
| Label text | `#001b45 (sRGB #001a48)` (vibrant dark navy) | `#ffffff` | [M] | 10-15-Catalina-Light-Mission-Control.png @ 1098,254,107,22; 10-15-Catalina-Dark-Mission-Control.png @ 1098,254,107,22 |
| Add button glyph | `#4c4c4c` | `#e5e5e5` | [M] | 10-15-Catalina-Light-Mission-Control.png @ 3272,126,40,40; 10-15-Catalina-Dark-Mission-Control.png @ 3272,126,40,40 |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Label font | SF Pro Text 13 pt Regular (cap height 18 px: "Notes & Safari" rows 254..271) | same | [C] | 10-15-Catalina-Light-Mission-Control.png @ 1776,254,158,18 |
| Labels | "Desktop 1", "Desktop 2", "Notes & Safari", "Photos" | same | [M] | 10-15-Catalina-Light-Mission-Control.png @ 1000,246,1400,40 |

### Shadows and effects
Window thumbnails keep their normal window shadows, scaled. The desktop picture below the bar is not dimmed.

## Layout and spacing
Space thumbnails are centred as a row with 32 pt gaps; the + button is pinned right. The Dock stays visible. Windows of the same app are not grouped unless "Group windows by application" is on [D].

## Keyboard and accessibility
Control-Up opens/closes, Control-Left/Right switch spaces, Control-Down shows App Expose, arrows + Return pick a window, Esc closes [D]. ARIA: modal `dialog`; spaces as a `tablist`, windows as a `list` of buttons labelled with the window title.

## Browser notes
Rendering live scaled windows means cloning or `transform: scale()`-ing the window elements; space thumbnails need a snapshot of each space (render the space's DOM at 3/35 scale).

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Mission-Control.png | 0,0,3360,2100 | bar expanded, Photos space current, two windows |
| dark | 10-15-Catalina-Dark-Mission-Control.png | 0,0,3360,2100 | Desktop 1 current, dark |
