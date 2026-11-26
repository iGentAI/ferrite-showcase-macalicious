# Print dialog (TextEdit)

- **Screenshots:** 10-15-Catalina-Light-Print.png (opaque region capture, 1780 x 1205 px), 10-15-Catalina-Dark-Print.png (1633 x 1144 px)
- **Window:** a sheet of 756 x 419 pt (light: x 141..1652, y 204..1041 px) attached to a TextEdit document window about 460 pt wide (title bar visible at x 437..1356); desktop wallpaper behind [M]

Component measurements: `components/print-panel.md` (panel) and `components/sheet.md` (attachment,
material, shadow).

## Layout

| Region | px (light) | Size pt | Notes |
|---|---|---|---|
| Parent title bar ("512 Pixels", document proxy icon; close disabled) | y ~107..161 | 22 + toolbar | stays undimmed |
| Parent format bar (paragraph style, font family "Helvetica", typeface "Regular", size "12", colour wells, B / I / U, alignment segments) | y 162..203 | 21 | partly hidden by nothing; sheet starts below it |
| Sheet | x 141..1652, y 204..1041 | 756 x 419 | vibrant |
| - Preview page | x 259..724, y 244..845 | 233 x 301 | white |
| - Page navigation | y ~869..897 | | [<<][<] "1 of 1" [>][>>] |
| - Form column | x 880..1476, y 244..660 | | labels right-aligned to x 980 |
| - Pane separator with pop-up | y 694 | | "TextEdit" |
| - Pane options | y 742..810 | | two checkboxes |
| - Bottom separator | y 918..919 | 1 | |
| - Bottom row | y 961..1000 | 20 | ? / PDF / Hide Details ... Cancel / Print |
| Parent document area below the sheet | y 1042..1103 | | white page, sheet shadow falls on it |

## Components used

`sheet`, `print-panel`, `pop-up-button`, `menu` + `menu-item` (open Presets menu, checked and
highlighted items, separators), `text-field` and `stepper`/`radio-button` (Copies and Pages rows, hidden
behind the menu), `image-button` (orientation), `checkbox`, `help-button`, `pull-down-button` (PDF),
`push-button`, `default-button`, `toolbar-segmented-control` look-alike page navigation
(`segmented-control`), `separator`, `label`, `material`, `title-bar`, `window-controls`, `toolbar`
(TextEdit format bar, owned by group views as `ruler`), `desktop`.

## App-specific elements

- Preview thumbnail: scaled first page with the text "Here's to the crazy ones..." at the top left
  (10-15-Catalina-Light-Print.png @ 317,300,103,9) [M].
- Orientation buttons: 38 pt square image buttons with a page-and-person glyph; portrait selected.

## Content in the screenshot

- Printer: "Brother HL-2270DW series". Presets (menu open): "Default Settings" (checked), "Last Used
  Settings", separator, "Black and White" (highlighted), separator, "Save Current Settings as Preset...",
  "Show Presets...". Labels: "Printer:", "Presets:", "Copies:", "Pages:", "Paper Size:", "Orientation:".
- Paper Size: "US Letter", followed by "8.50 by 11.00 inches". Pane pop-up: "TextEdit".
- Checkboxes: "Print header and footer" (off), "Rewrap contents to fit page" (on).
- Page navigation "1 of 1". Bottom: "?", "PDF" (pull-down), "Hide Details", "Cancel", "Print".
- Parent window title "512 Pixels"; format bar values "Helvetica", "Regular", "12".

## Not reproducible / assets needed

Wallpaper, printer names, the live page preview (render from the document), orientation glyphs.
