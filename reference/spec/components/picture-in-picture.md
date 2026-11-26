# Picture in Picture window (`picture-in-picture`)

- **Status:** present
- **AppKit:** PIP.framework (`PIPViewController`) / AVKit `AVPictureInPictureController`; in Safari via the video's context menu or the audio button's menu
- **HIG:** https://web.archive.org/web/20200503141343/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/window-anatomy/ (no dedicated macOS page)
- **Appearances shown:** light, dark (the PiP window itself looks the same in both)

## Purpose and behaviour
A borderless video window that floats above all windows and spaces, snaps to one of the four screen corners, can be resized from its edges and dragged between corners (Command-drag to place freely) [D] (macOS User Guide). On hover it shows an overlay with close, play/pause and "return to window" controls (not captured). The source player shows a placeholder: a PiP glyph and "This video is playing in picture in picture." [M].

## Anatomy
Video frame with rounded corners and a window shadow; hover overlay (not shown); placeholder in the source page.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| placement | four screen corners, freely placed with Command-drag | corner snap [D] | PiP window controller | top-right only |
| aspect ratio | source video ratio | source-defined [D] | video presentation size | 16:9 [M], geometry below |
| overlay | hidden, hovered | hidden [I] | PiP controller controls | hidden only |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| playing, no hover | yes | `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png @ 2264,84,1056,594` |
| hover controls | no | [D]/[I] below |
| placeholder in the page | yes | `@ 364,390,1560,878` |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Window size in the capture | 528 x 297 (16:9), x 2264..3319, y 84..677 | [M] | `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png @ 2255,400,18,1`, `@ 3312,400,19,1`, `@ 3000,76,1,17`, `@ 3000,670,1,21` |
| Position | top-right corner: 20 from the screen's right edge (3360 - 3320 = 40 px), 20 below the menu bar (y 84 vs 44) | [M] | same |
| Corner radius | 4 (the video reaches the top row 7-8 px from the corner) | [M] | `@ 2262,84,19,1`, `@ 2264,82,1,19` |
| Border | none | [M] | edge pixels are video content |
| Hover overlay | black @ 0.5 scrim; centred play/pause 44; close (x) top-left and return-to-window top-right, 28 each, 10 inset | [I] | not captured; AVKit PiP layout |
| Placeholder glyph in the source player | two overlapping rounded rectangles, 115 x 90 (ink x=1029..1258, y=713..892), with the caption 13 below (26 empty px, y=893..918) | [M] size; [C] gap | `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png @ 1000,700,320,210`; `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png @ 670,912,950,40` |

### Colours and fills
| Part | Value | Tag | Evidence |
|---|---|---|---|
| Placeholder background | `#000000` | [M] | `@ 700,600` |
| Placeholder glyph and caption | `#a4a4a4` | [M] | lightest ink in `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png @ 1020,710,270,190`; `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png @ 898,919,491,26` |
| Overlay controls | white glyphs on the scrim | [I] | |

### Text and icons
The source caption and overlapping-rectangle glyph are described above. Caption size is 15 pt [C] from the 21 px capital height ("This", y=919..939), `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png @ 898,912,50,35`; native overlay glyphs are not seen in the screenshots and their proposed hit sizes remain [I].

### Shadows and effects
A window shadow is visible below the PiP window over the Safari page; use the inactive-window class `0 8px 24px rgba(0,0,0,0.26)` [I] (not separable from the page content).

## Layout and spacing
Default width is about a quarter of the screen width; the window keeps the video's aspect ratio when resized [D].

## Keyboard and accessibility
No keyboard focus by default; controls are `AXButton`s ("Close", "Play/Pause", "Return to window"). In a page, use the Picture-in-Picture Web API (`video.requestPictureInPicture()`), which opens the real system PiP window.

## Browser notes
A DOM imitation cannot float above other apps; the Web API gives the native window where supported. For a demo inside the page, a fixed-position `<video>` with `border-radius: 4px` and the shadow above matches the appearance.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png` | 2240,60,1100,640 | PiP window over Safari and the desktop |
| dark | `10-15-Catalina-Dark-Safari-v13-Picture-in-Picture.png` | 2240,60,1100,640 | same |
| light | `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png` | 364,390,1560,878 | placeholder in the YouTube player |
