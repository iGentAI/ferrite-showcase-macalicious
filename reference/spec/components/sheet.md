# Sheet (`sheet`)

- **Status:** present (one instance: the Print dialog attached to a TextEdit window)
- **AppKit:** `NSWindow.beginSheet(_:completionHandler:)`, `NSWindow.attachedSheet`, `NSWindow.sheetParent`; `NSAlert.beginSheetModal(for:)`; `NSSavePanel.beginSheetModal(for:)`
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/sheets/
- **Appearances shown:** light, dark

## Purpose and behaviour

A sheet is a modal dialog attached to one window, usually a document. It animates out from under the
window's title bar/toolbar and blocks that window until dismissed, while other windows and apps stay
usable. Use it for document-specific requests (save, export, print) and only on windows that have a
frame; avoid stacking sheets (HIG Sheets) [D]. In a tabbed window the sheet belongs to the active tab [D].

## Anatomy

```
   parent title bar + toolbar (stays fully drawn; close button dims)
 ==================================================  <- sheet top edge = toolbar bottom edge, no gap, no top shadow
 |                 sheet content                   |     sheet may be wider or narrower than the parent
 |                                                 |
 +-------------------------------------------------+  <- square corners, 0.5 pt edge, shadow on sides + bottom
        (rest of parent window visible below, not dimmed)
```

## Variants and parameters

| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| content | alert, save panel, print panel, custom | - | - | print panel |
| width | independent of the parent; centred on it | - | sheet window frame | wider than the parent (756 pt on a 460 pt window) |

## States

| State | Shown? | Evidence or basis |
|---|---|---|
| Open over a key parent | yes | 10-15-Catalina-Light-Print.png, 10-15-Catalina-Dark-Print.png |
| Opening / closing animation | no | [D/I] slides down from the toolbar edge, about 0.2 to 0.25 s ease-out; reverse on close |
| Parent inactive | no | [I] sheet controls take inactive colours |

## Measurements

Both Print captures are opaque region captures (1780 x 1205 px light, 1633 x 1144 px dark); the sheet is
measured inside them.

### Geometry (pt)

| Property | Value | Tag | Evidence |
|---|---|---|---|
| Sheet frame (light) | x 141..1652, y 204..1041 px = 756 x 419 pt | [M] | 10-15-Catalina-Light-Print.png row 600 (edges 141, 1652), col 700 (top 204, last sheet row 1041) |
| Attachment line | the sheet's first row (y 204) directly follows the parent toolbar's two bottom line rows (y 202 `#bdbdbd`, y 203 `#a8a8a8`) | [M] | 10-15-Catalina-Light-Print.png col 460: 202, 203, sheet from 204 |
| Parent window width (TextEdit) | about 460 pt (title bar visible x 437..1356 px), so the sheet overhangs 148 pt on each side | [M] | 10-15-Catalina-Light-Print.png row 130 |
| Corners | square top (attached) and square bottom | [M] | 10-15-Catalina-Light-Print.png @ 141,1030,14,14 |
| Bottom edge line | 0.5 pt (1 px) `#afafae` over white content below | [M] | 10-15-Catalina-Light-Print.png @ 700,1042 `#afafae` |
| Content margins | 20.5 pt right (default button edge px 1611 -> 1652), 20.5 pt bottom (button bottom edge row 1000 -> 1041) | [M] | 10-15-Catalina-Light-Print.png row 980, col 1500 |

### Colours and fills

The sheet background is a vibrant material (`NSVisualEffectView` material `.sheet`, behind-window
blending): it shows a blurred, lightened copy of whatever is behind the sheet.

| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Sheet background over the white document | `#edeeee` | `#2d2d30`-class (over the dark document area) | [M] | 10-15-Catalina-Light-Print.png @ 1100,220 `#edeeee`; 10-15-Catalina-Dark-Print.png row 600 run x 1090..1564 |
| Sheet background over blue-sky wallpaper | `#c4d5e6 (sRGB #c0d5e8)` | - | [M] | 10-15-Catalina-Light-Print.png @ 300,220 `#c4d5e6 (sRGB #c0d5e8)` |
| Sheet background over tan rock wallpaper | `#dfd5c0 (sRGB #e1d5be)`..`#e4dac6 (sRGB #e6dac4)` | - | [M] | 10-15-Catalina-Light-Print.png col 1560 run y 204..305; row 600 x 1640 |
| Opaque fallback | `#ececec` | `#323232` | [I] | window background of the same appearance |
| Recovered recipe | `backdrop-filter: blur(30px) saturate(1.2)` + `rgba(236,236,236,0.72)` tint | `blur(30px)` + `rgba(40,40,40,0.75)` | [C]/[I] | from the three composites above: white stays `#edeeee`, mid-blue `#8cb4dc (sRGB #82b4e0)`-class sky becomes `#c4d5e6 (sRGB #c0d5e8)` |

### Text and icons

Sheet content uses the normal control and label styles (13 pt labels; see `print-panel`).

### Shadows and effects

| Property | Value | Tag | Evidence |
|---|---|---|---|
| Shadow below the sheet, measured over the white page of the parent | first px under the edge line `#cfcfcf`, +8 px `#dfdfdf`, +18 px `#efeeee`, +28 px `#f7f7f7`, white from about +36 px | [M] | 10-15-Catalina-Light-Print.png @ 700,1043 `#cfcfcf`, @ 700,1050 `#dfdfdf`, @ 700,1060 `#efeeee`, @ 700,1070 `#f7f7f7` |
| Equivalent black alpha | 0.19 at the edge, 0.125 at 4 pt, 0.065 at 9 pt, 0.03 at 14 pt, 0 at 18 pt | [C] | (255 - value) / 255 of the row above |
| Fitted CSS | `box-shadow: 0 5px 18px rgba(0,0,0,0.3)` clipped at the top edge (no shadow above the attachment line) | [C] | fit to the falloff |
| Dimming of the parent | none: parent title bar and toolbar keep their normal colours (title bar `#e1e1e1`/`#dadada` runs on row 130) | [M] | 10-15-Catalina-Light-Print.png row 130 |
| Parent window controls while the sheet is up | close is disabled (grey), minimize and zoom stay coloured | [M] | 10-15-Catalina-Light-Print.png @ 452,116,110,30 |

## Layout and spacing

The sheet is horizontally centred on its parent and hangs from the bottom edge of the parent's title
bar/toolbar; if it is taller than the parent it extends past the parent's bottom edge (here the sheet
ends 31 pt above the parent's bottom edge) [M]. Content follows `dialog` rules (20.5 pt margins, button
row bottom right).

## Keyboard and accessibility

Return = default button, Escape or Command-period = Cancel; focus stays in the sheet; the parent
window cannot be closed, but can be moved, and other windows can be activated [D]. AX: AXSheet as a
child of the parent AXWindow. ARIA: `role="dialog"`, `aria-modal="true"`, with `inert` on the parent
window's content only (other windows stay interactive).

## Browser notes

- The sheet must be clipped at the attachment line for the slide animation: wrap it in an
  `overflow: hidden` container whose top is the toolbar's bottom edge and animate `translateY(-100%)`
  to `0`.
- The material needs `backdrop-filter`; on engines without it use the opaque fallback.
- A sheet wider than its parent means the clip container cannot be a child constrained to the parent's
  width; position it in the parent's stacking context with negative left/right insets.

## Evidence

| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Print.png | 141,100,1512,1010 | sheet attached under the TextEdit toolbar, overhang, bottom shadow |
| dark | 10-15-Catalina-Dark-Print.png | 56,80,1512,980 | same, dark |
