# Print dialog (`print-panel`)

- **Status:** present (TextEdit, expanded "Show Details" form, as a sheet; light and dark)
- **AppKit:** `NSPrintPanel` (`options`: `.showsCopies`, `.showsPageRange`, `.showsPaperSize`, `.showsOrientation`, `.showsScaling`, `.showsPrintSelection`, `.showsPageSetupAccessory`, `.showsPreview`), run by `NSPrintOperation.runModal(for:delegate:didRun:contextInfo:)`; app pane via `addAccessoryController(_:)`
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/system-capabilities/printing/
- **Appearances shown:** light, dark

## Purpose and behaviour

The Print dialog sends the current document to a printer or PDF workflow. It appears as a sheet on the
document window, with a simple form (printer, presets, copies, pages) that expands with "Show Details"
to show paper size, orientation and a pane pop-up for app-specific and driver-specific options. The
HIG asks apps to put frequently changed settings here and document-wide, rarely changed ones in Page
Setup, and to add a custom pane named after the app when it has its own options (HIG Printing) [D].

## Anatomy (expanded form, as captured)

```
=============================== sheet 756 x 419 pt ===============================
|  +-----------+        Printer: [ Brother HL-2270DW series      ^v]            |
|  |           |        Presets: [ Default Settings              ^v]            |
|  |  preview  |         Copies: [ 1 ]  [ ] Two-Sided                           |
|  |  233x301  |          Pages: (o) All  ( ) From [1] to [1]                   |
|  |           |     Paper Size: [ US Letter      ^v]  8.50 by 11.00 inches     |
|  |           |    Orientation: [portrait][landscape]                         |
|  +-----------+   ------------- [ TextEdit      ^v] -------------              |
|  [<<][<] 1 of 1 [>][>>]        [ ] Print header and footer                    |
|                                [x] Rewrap contents to fit page                |
|  ---------------------------------------------------------------------------- |
|  (?) [PDF v] [Hide Details]                         [ Cancel ]  [  Print  ]   |
==================================================================================
```

## Variants and parameters

| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| form | simple, detailed | simple | "Show Details"/"Hide Details" button | detailed |
| presentation | sheet, app-modal window | sheet | `runModal(for:)` / `runModal()` | sheet |
| pane | app pane ("TextEdit"), Layout, Paper Handling, Cover Page, ... | app pane | pane pop-up in the separator | TextEdit pane |
| preview | shown, hidden | shown | `.showsPreview` | shown |

## States

| State | Shown? | Evidence or basis |
|---|---|---|
| Detailed form, Presets pop-up menu open with "Black and White" highlighted | yes | 10-15-Catalina-Light-Print.png, 10-15-Catalina-Dark-Print.png |
| Simple form | no | [D/I] same sheet without Paper Size, Orientation and pane rows; about 419 - 150 pt tall |
| Rows hidden behind the open menu (Copies, Pages) | partly | labels "Copies" and "Pages" visible at the left of the menu; controls covered. Content of those rows is [D] from the standard panel |

## Measurements

Light capture: sheet x 141..1652, y 204..1041 px (756 x 419 pt) [M]. See `sheet` for the frame,
material and shadow.

### Geometry (pt)

| Property | Value | Tag | Evidence |
|---|---|---|---|
| Preview page (white) | 233 x 301 pt (x 259..724, y 244..845), 59 pt from the sheet's left edge, 20 pt below its top | [M] | 10-15-Catalina-Light-Print.png row 600, col 300 |
| Preview page shadow | soft, about 1 pt, visible as a grey edge below the page | [M] | 10-15-Catalina-Light-Print.png @ 255,240,474,612 |
| Page navigation | two 2-segment controls, each segment 30 pt wide (x 285..344, 347..406 and 575..634, 637..696), 14.5 pt tall band at y ~869..897, label "1 of 1" centred between them (11 pt) | [M] | 10-15-Catalina-Light-Print.png row 870; @ 464,877,51,18 |
| Label column | right-aligned, ends at x ~980 (419.5 pt from the sheet's left edge); controls start at x 1000 (pop-ups: faint outer blend px at 1000, edge px at 1001; orientation buttons: border from 1000) | [M] | 10-15-Catalina-Light-Print.png @ 896,255,84,19 ("Printer:"), rows 264 and 620 |
| Printer / Presets pop-ups | 238.5 pt wide (edge px x 1001..1477; 16 pt cap fill at 1445..1476 plus its right edge px 1477), 20 pt tall, row pitch 30 pt (label baselines y 273, 333) | [M] | 10-15-Catalina-Light-Print.png row 264, col 1300 |
| Paper Size pop-up | 177 pt (edge px x 1001..1354), cap fill at x 1322..1353; size text "8.50 by 11.00 inches" follows 10 pt after | [M] | row 544 |
| Orientation buttons | two 38 x 38 pt image buttons (x 1000..1075, 1100..1175, y 582..657), 12 pt apart, the selected one drawn pressed (darker) | [M] | 10-15-Catalina-Light-Print.png @ 1000,582,176,76 |
| Pane separator | 1 pt line at y 694..695 from x 801 to 1612, interrupted by the pane pop-up (edge px x 1033..1380, 174 pt wide) centred on the options column | [M] | row 694 |
| Pane checkboxes | 14 pt boxes at x 1021, row pitch 20 pt (y 742, 782) | [M] | @ 1021,742,316,28 |
| Bottom separator | 1 pt line at y 918..919 across the sheet content | [M] | col 1100 |
| Bottom row | Help 20 pt (x 182..221), "PDF" pull-down 57 pt with a 16 pt accent cap (edge px x 248..361), "Hide Details" 101 pt (x 380..581), Cancel 69 pt (x 1310..1447), Print 69 pt (x 1474..1611), Cancel -> Print gap 13 pt; button edge rows y 961..1000 | [M] | rows 963 and 980 |
| Margins | right 20.5 pt (1611 -> 1652), bottom 20.5 pt (1000 -> 1041), left of Help 20.5 pt (141 -> 182) | [M] | row 980 |
| Open pop-up menu | menu x 976..1463 (wider than the button), highlighted row 18 pt (y 402..437) | [M] | col 1300, col 1460 |

### Colours and fills

| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Sheet background | vibrant; `#edeeee` over white, `#c4d5e6 (sRGB #c0d5e8)` over sky | vibrant dark | [M] | 10-15-Catalina-Light-Print.png @ 1100,220 `#edeeee`, @ 300,220 `#c4d5e6 (sRGB #c0d5e8)` |
| Preview page | `#ffffff` | `#ffffff` (paper stays white in dark mode) | [M] | 10-15-Catalina-Light-Print.png @ 500,600 `#ffffff`; 10-15-Catalina-Dark-Print.png @ 400,600 `#ffffff` |
| Separator lines | `#d5d5d4`..`#d8d8d8` (translucent black over the material) | - | [M] | 10-15-Catalina-Light-Print.png row 694 run x 801..1029 |
| Highlighted item in the open pop-up menu (blue accent, over this backdrop) | `#518cef (sRGB #408bf7)`..`#548ef0 (sRGB #448df8)` | - | [M] | 10-15-Catalina-Light-Print.png col 1460 y 402..437; col 1300 same rows |
| Pop-up cap, default button | accent, see `accent-colors` | same | [M] | 10-15-Catalina-Light-Print.png @ 1460,264 `#4d8af5 (sRGB #3b89fd)` |

### Text and icons

| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Labels ("Printer:", "Presets:", "Copies:", "Pages:", "Paper Size:", "Orientation:") | SF Pro Text Regular 13 pt (cap 19 px), `#242424`, right-aligned | light text | [M], [C] | 10-15-Catalina-Light-Print.png @ 896,255,84,19 |
| Pop-up titles, button titles | 13 pt, `#252525`/`#262626`; Print `#ffffff` | - | [M] | @ 1020,255,300,19; @ 1340,971,70,19 |
| "1 of 1", paper dimensions | 11 pt (cap 16 px), `#222324` | - | [M], [C] | @ 464,877,51,18 |
| Orientation icons | portrait and landscape page-with-figure glyphs, 38 pt buttons | same | [M] | @ 1000,582,176,76 |
| Preview | a live thumbnail of page 1 at the paper's aspect ratio (8.5 x 11 -> 233 x 301 pt) | same | [M] | @ 259,244,466,602 |

### Shadows and effects

See `sheet`.

## Layout and spacing

Two columns: preview (left, fixed) and form (right). The form is a right-aligned label column and a
control column; the pane area below the separator is replaced when the pane pop-up changes, and the
sheet resizes vertically to fit the pane.

## Keyboard and accessibility

Return = Print, Escape = Cancel, Tab through fields; Command-P opens the panel [D]. AX: AXSheet with
labelled AXPopUpButtons. ARIA: `dialog` with a form; the preview is an `img` with a page label.

## Browser notes

Browsers have their own print UI (`window.print()`); this panel is a replica. The preview must be
rendered by the app (for example a scaled clone of the document).

## Evidence

| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Print.png | 141,204,1512,838 | full detailed print sheet with open Presets menu |
| dark | 10-15-Catalina-Dark-Print.png | 56,174,1512,838 | same, dark |
