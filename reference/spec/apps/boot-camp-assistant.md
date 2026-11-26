# Boot Camp Assistant

- **Screenshots:** 10-15-Catalina-Light-Boot-Camp-Assistant.png, 10-15-Catalina-Dark-Boot-Camp-Assistant.png
- **Window:** 783 x 548 pt (frame x 112..1677, y 76..1171 px); standard title bar, title "Boot Camp Assistant"; close and minimize enabled, zoom disabled; fixed size [M]

Component measurements: `components/assistant-window.md`.

## Layout

| Region | px (light) | Size pt | Light | Dark |
|---|---|---|---|---|
| Title bar | y 76..119 | 783 x 22 | gradient | dark gradient |
| Artwork column | x 112..460, y 120..1171 | 174.5 x 526 | `#ececec` + diamonds | `#303132` + diamonds |
| Heading "Introduction" | x 468, y 161..184 | bold 13 pt | `#242424` | `#dfdfe0` |
| Text box | x 461..1645, y 206..1051 | 592.5 x 423 | `#d5d5d5`, border `#999999` | `#444546`, border `#999999` |
| Button row | y 1093..1132 | 20 | push buttons | dark push buttons |

```
+ (o)(o)(-)        Boot Camp Assistant            +
|  <>     | Introduction                           |
| <><>    | +------------------------------------+ |
|  <>     | | text                               | |
|         | +------------------------------------+ |
|         | [Open Boot Camp Help]      [Continue]  |
+--------------------------------------------------+
```

## Components used

`assistant-window`, `window`, `title-bar`, `window-controls`, `label` (heading), `text-view`
(read-only, bordered), `push-button`, `image-view` (artwork).

## App-specific elements

Boot Camp logo: four glossy diamonds (rotated squares) in greys, about 265 pt wide overall, positioned
so the left diamond is cut by the window edge and the right diamond overlaps the text box by about
44 pt, drawn above the box with partial transparency (10-15-Catalina-Light-Boot-Camp-Assistant.png @
112,250,530,760) [M]. Dark mode uses a lighter, lower-contrast rendering.

## Content in the screenshot

- Heading: "Introduction".
- Body: "Boot Camp Assistant helps install Microsoft Windows on an Intel-based Mac by downloading the
  necessary support software, creating a partition on your disk for Windows, and then starting the
  Windows installer. Please click the Open Boot Camp Help button for instructions to finish installing
  Windows and the support software you downloaded." (blank line) "IMPORTANT:  Back up your disk before
  partitioning it or installing Windows. If you have a portable computer, make sure the power adapter
  is connected."
- Buttons: "Open Boot Camp Help" (left), "Continue" (right, not accent-coloured).

## Not reproducible / assets needed

The diamond artwork (light and dark renderings).
