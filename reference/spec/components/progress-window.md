# Progress window (`progress-window`)

- **Status:** present (Finder Copy, light and dark)
- **AppKit:** Finder's progress window: `NSWindow` with `titlebarAppearsTransparent = true`, `titleVisibility = .hidden`, containing an `NSImageView`, two labels, an `NSProgressIndicator` (`style = .bar`, `controlSize = .small`, determinate) and a borderless stop button
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/indicators/progress-indicators/
- **Appearances shown:** light, dark

## Purpose and behaviour

Shows a long-running file operation. The HIG asks for a determinate bar whenever the duration can be
estimated, a description of what is happening, an accurate time estimate, and a way to cancel (HIG
Progress Indicators) [D]. Finder shows one window per operation; several operations stack as rows in
one window, each with its own bar and stop button. Clicking the x-circle stops the operation; the
window closes itself when the work finishes. The bar itself is specified in `progress-bar` (group sysB).

## Anatomy

```
+---------------------------------------------------------------+
| (o)(o)(o)                                                     |  window controls on the content background, no title
|  [doc]  Copying "Pippin - Apple's F...e Console.mov" to "Desktop"
|  [icon] [====----------------------------------------]   (x)  |  6 pt bar + 13 pt stop button
|         192.9 MB of 6 GB - About 3 minutes                    |
+---------------------------------------------------------------+
```

## Variants and parameters

| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| operations | 1 or more stacked rows | 1 | - | 1 |
| bar | determinate, indeterminate ("Preparing to copy...") | determinate | `isIndeterminate` | determinate (about 3% and 8%) |

## States

| State | Shown? | Evidence or basis |
|---|---|---|
| Running, key window | yes | 10-15-Catalina-Light-Finder-Copy.png, 10-15-Catalina-Dark-Finder-Copy.png |
| Window controls | yes | close and zoom disabled (grey), minimize enabled (yellow): 10-15-Catalina-Light-Finder-Copy.png @ 128,86,104,24 |
| Indeterminate / paused / finishing | no | [I] see `progress-bar` |

## Measurements

Frame: x 112..909, y 76..213 px = **399 x 69 pt** [M].

### Geometry (pt)

| Property | Value | Tag | Evidence |
|---|---|---|---|
| Title bar | transparent: the whole window is the content colour; no title, no separator line | [M] | 10-15-Catalina-Light-Finder-Copy.png @ 500,90 `#ececec` equals @ 500,200 `#ececec` |
| Window controls | 12 pt buttons, first at x 128 (8 pt from the left edge), y 86..109 (5 pt from the top), 20 pt pitch | [M] | @ 128,86,104,24 |
| File icon | 32 pt canvas; artwork 23 x 31 pt at x 145..190, y 132..193 (16.5 pt from the left, 28 pt from the top) | [M] | @ 145,132,46,62 |
| Text and bar left edge | 57 pt from the left (x 226) | [M] | bar starts x 226; title glyphs start x 225 |
| Title baseline | 32.5 pt below the window top (y 141) | [M] | "C" of "Copying" y 126..141 |
| Bar | 307 x 6 pt (x 226..839, y 157..168); top 40.5 pt below the window top; 8 pt below the title baseline | [M] | col 300, row 164 |
| Stop button | 13 pt circle (x 860..885, y 151..176; 14 pt with anti-aliasing), centred on the bar, 10 pt to the right of the bar, right margin 12 pt | [M] | row 164, col 874 |
| Status line baseline | 61.5 pt below the window top (y 199); 15.5 pt below the bar's bottom edge | [M] | digits y 187..199 |
| Bottom margin under the status baseline | 7 pt | [M] | 199 -> 213 |

### Colours and fills

| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Window background | `#ececec` | `#2f3235 (sRGB #2e3235)` | [M] | 10-15-Catalina-Light-Finder-Copy.png @ 500,200 `#ececec`; 10-15-Catalina-Dark-Finder-Copy.png @ 500,200 `#2f3235 (sRGB #2e3235)` |
| Bar track | `#dbdbdb` with 0.5 pt top and bottom lines `#bfbfbf` | `#4c4f52 (sRGB #4b4f52)` flat, no lines | [M] | 10-15-Catalina-Light-Finder-Copy.png @ 300,163 `#dbdbdb`, @ 300,157 `#bfbfbf`, @ 300,168 `#bfbfbf`; 10-15-Catalina-Dark-Finder-Copy.png @ 300,163 `#4c4f52 (sRGB #4b4f52)`, @ 300,157 `#4c4f52 (sRGB #4b4f52)` |
| Bar fill (blue accent) | `#4d8af5 (sRGB #3b89fd)` | `#2e6bde (sRGB #1869e6)` | [M] | 10-15-Catalina-Light-Finder-Copy.png @ 235,164 `#4d8af5 (sRGB #3b89fd)`; 10-15-Catalina-Dark-Finder-Copy.png @ 235,164 `#2e6bde (sRGB #1869e6)` |
| Stop button disc | `#757575` with the x cut out in the window colour | `#a1a2a4` | [M] | 10-15-Catalina-Light-Finder-Copy.png @ 874,155 `#757575`; 10-15-Catalina-Dark-Finder-Copy.png @ 874,155 `#a1a2a4` |

### Text and icons

| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Title ("Copying "..." to "Desktop"") | SF Pro Text Regular 11 pt (cap 16 px), `#242424`; file name middle-truncated with an ellipsis | `#dfe0e0` | [M], [C] | @ 225,126,14,16 in both files |
| Status ("192.9 MB of 6 GB - About 3 minutes") | SF Pro Text Regular 9 pt (digit height 13 px), `#767676` | `#a1a3a4` | [M], [C] | @ 226,187,32,13 in both files |
| Icon | the item's document icon | same | [M] | @ 145,132,46,62 |

### Shadows and effects

Standard window shadow.

## Layout and spacing

Fixed width 399 pt; each additional operation adds a row of about 46 pt separated by a 1 pt line [I].
The title truncates in the middle so both the start of the name and the extension stay visible [M].

## Keyboard and accessibility

Command-period or clicking the stop button cancels [D]. AX: AXProgressIndicator with AXValue and the
two static texts as its description. ARIA: `role="progressbar"` with `aria-valuenow`/`aria-valuetext`
(the status line) and a labelled "Stop" button.

## Browser notes

Middle truncation is not available in CSS; compute it in script by measuring text width.

## Evidence

| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Finder-Copy.png | 112,76,798,138 | whole window, 3% progress |
| dark | 10-15-Catalina-Dark-Finder-Copy.png | 112,76,798,138 | whole window, 8% progress |
