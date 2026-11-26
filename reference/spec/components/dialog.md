# Dialog (`dialog`)

- **Status:** present
- **AppKit:** `NSWindow` / `NSPanel` run with `NSApplication.runModal(for:)` (app-modal), `beginSheet(_:completionHandler:)` (document-modal, see `sheet`) or simply ordered front (modeless, see `inspector-panel`); `styleMask` `.titled` with or without `.closable`/`.miniaturizable`
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/dialogs/
- **Appearances shown:** light, dark

## Purpose and behaviour

A dialog is a small, transient window that asks the user for a response, often several values at once.
It is presented document-modal (as a sheet), app-modal, or modeless (a panel). The HIG asks for default
values wherever possible, initial focus on the first control that accepts input, a clearly marked
default button, and for dismissing buttons to be placed at the bottom right with the action button
rightmost and Cancel to its left; buttons that affect content (not dismissal) go at the left (HIG
Dialogs) [D].

## Anatomy

```
+----------------------- Title (13 pt, centred) -----------------------+   22 pt title bar
|  20.5 pt margin                                                      |
|  Label:                                                              |
|  [ control ............................................... ]        |
|                                                                      |
|  [aux buttons / ?]                         [ Cancel ]  [ Action ]    |   button row
+----------------------------------------------------------------------+   20.5 pt bottom margin
```

## Variants and parameters

| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| modality | app-modal, document-modal (sheet), modeless | app-modal | `runModal(for:)`, `beginSheet`, `orderFront` | app-modal (Go to Folder), modeless with window controls (Connect to Server, Force Quit), sheet (Print) |
| title bar | title only; title + window controls; none (sheet) | title only | `styleMask` | all three |
| toolbar | none; preferences-style toolbar (Music/TV Preferences are app-modal dialogs with a toolbar and OK/Cancel) | none | `NSToolbar` | both |
| button row | Cancel + default; default only; auxiliary buttons at left; Help at left | - | - | all |

## States

| State | Shown? | Evidence or basis |
|---|---|---|
| Key | yes | all dialog screenshots |
| Inactive | no | [I] title text and controls use the inactive rules of `title-bar` and each control |
| Default button disabled (nothing chosen yet) | yes | 10-15-Catalina-Light-Finder-Open-iCloud.png @ 1535,911,154,40 (Open disabled: no accent, fill `#f3f3f3` -> `#ececec`, title `#b4b4b4`); 10-15-Catalina-Dark-Finder-Open-iCloud.png @ 1765,1245,154,40 (fill `#494949`, title `#777777`) |

## Measurements

### Geometry (pt)

Primary instance: Finder "Go to Folder" (frame 429 x 146 pt). Second instance: "Connect to Server"
(486 x 231 pt). Third: the button rows of Music and TV Preferences.

| Property | Value | Tag | Evidence |
|---|---|---|---|
| Title bar height | 22 pt (y 76..119 incl. the two bottom line rows) | [M] | 10-15-Catalina-Light-Finder-Go-To-Folder.png col 130 |
| Title baseline | 15.5 pt below the window top (px 107 - 76 = 31) | [M] | "G" of the title y 89..107 |
| Side margin (window edge -> control edge) | 20.5 pt (41 px: field border at x 153, frame from 112; right: 928 -> 969) | [M] | 10-15-Catalina-Light-Finder-Go-To-Folder.png row 227 |
| Text left edge (labels) | 20.5 pt (x 153) | [M] | "Go to the folder:" @ 153,167 |
| Top margin: title bar -> first label cap top | 23.5 pt (120 -> 167) | [M] | same |
| Label baseline -> field top edge | 11 pt (185 -> 207) | [M] | same |
| Field/combo box height | 20 pt between outer border rows (y 207..246) | [M] | col 500 |
| Field -> button row gap | 20 pt (246 -> 287 top edge) | [M] | buttons y 287..326 |
| Button height | 20 pt (40 px) + shadow | [M] | 10-15-Catalina-Light-Finder-Go-To-Folder.png @ 571,287,166,41 |
| Cancel / default button width | 83 pt each (x 571..736, 763..928) | [M] | same |
| Gap between Cancel and default | 13 pt (px 737..762) | [M] | same |
| Right margin of button row | 20.5 pt (928 -> 969) | [M] | same |
| Bottom margin (button bottom edge -> window edge) | 20.5 pt (326 -> 367) | [M] | same |
| Connect to Server: button row | [+ / - / action] segmented 98 pt at left (x 153..348), help button 20 pt (x 375..414), Browse 72 pt (x 715..858), Connect 79 pt (x 885..1042); gap Browse -> Connect 13 pt; bottom margin 20.5 pt (496 -> 537) | [M] | 10-15-Catalina-Light-Finder-Connect-to-Server.png @ 153,457,890,41 |
| Preferences-style dialog button row (Music) | separator line 1 pt at y 540..541 full width; help button at left margin 20.5 pt (x 153..192); Cancel 69 pt (x 835..972) and OK 69 pt (x 999..1136); gap 13 pt; right margin 20.5 pt; buttons y 579..618, bottom margin 20.5 pt (618 -> 659) | [M] | 10-15-Catalina-Light-Music-Preferences.png @ 114,540,1062,80 |

The 13 pt button gap, the 20.5 pt margins and the 20 pt control-to-buttons gap repeat in Go to Folder,
Connect to Server, Music and TV Preferences (TV: Cancel x 1049..1186, OK x 1213..1350, frame right edge
1391) [M]. NSAlert is the exception with 15 pt between buttons (see `alert`).

### Colours and fills

| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Content background | `#ececec` | `#303031` | [M] | 10-15-Catalina-Light-Finder-Connect-to-Server.png @ 600,250 `#ececec`; 10-15-Catalina-Dark-Finder-Conect-to-Server.png @ 600,250 `#303031` |
| Title bar gradient | `#e5e5e5` -> `#cdcdcd`, lines `#bebebe`, `#a8a8a8` | `#414243` -> `#363637`, lines `#2b2b2c`, `#000000` | [M] | col 130 of 10-15-Catalina-Light-Finder-Go-To-Folder.png and 10-15-Catalina-Dark-Finder-Go-to-Folder.png |
| Separator above a button row | `#d5d5d5`, 1 pt | `#444445`, 1 pt | [M] | 10-15-Catalina-Light-Music-Preferences.png @ 600,540 `#d5d5d5`; 10-15-Catalina-Dark-Music-Preferences.png @ 600,540 `#444445` |

### Text and icons

| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Title | SF Pro Text Regular 13 pt, centred, stems `#474747` | `#bbbcbc` | [M] colour, [C] size (cap 19 px) | 10-15-Catalina-Light-Finder-Go-To-Folder.png @ 467,89,17,19; Dark-Finder-Go-to-Folder same |
| Labels | SF Pro Text Regular 13 pt, `#242424` | `#dfdfdf` | [M], [C] | @ 153,167,17,19 in both |
| Small label ("Favorite Servers:") | 11 pt [C: band 18 px with ascenders], `#242424` | `#dfdfdf` | [M], [C] | 10-15-Catalina-Light-Finder-Connect-to-Server.png @ 153,227,173,18 |

### Shadows and effects

Standard window shadow (`window-shadow`). No dimming of other windows for app-modal dialogs.

## Layout and spacing

- Dismissal buttons bottom right, action rightmost; 13 pt apart; minimum width 69 pt (OK/Cancel in
  preferences dialogs) or 83 pt (Finder dialogs) [M].
- Auxiliary buttons and Help at the bottom left on the same baseline.
- Left-align labels with controls at the 20.5 pt margin, or use a right-aligned label column with
  controls starting on a common x (see the preferences blueprints).

## Keyboard and accessibility

Return = default button, Escape = Cancel, Tab cycles text fields and lists (all controls with full
keyboard access), initial focus on the first editable control (the combo box is focused in both
Go to Folder and Connect to Server captures) [M for focus; D for keys]. AX: AXWindow with subrole
AXDialog (modal) or AXFloatingWindow/AXSystemDialog; ARIA `role="dialog"`, `aria-modal` for the modal
kinds, labelled by the title.

## Browser notes

Nothing dialog-specific beyond `window`. Focus trapping and Return/Escape handling must be scripted.

## Evidence

| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Finder-Go-To-Folder.png | 112,76,858,292 | app-modal dialog, title only, focused combo box, Cancel + Go |
| dark | 10-15-Catalina-Dark-Finder-Go-to-Folder.png | 112,76,858,292 | same, dark |
| light | 10-15-Catalina-Light-Finder-Connect-to-Server.png | 112,76,972,462 | dialog with window controls, list, auxiliary buttons and help |
| dark | 10-15-Catalina-Dark-Finder-Conect-to-Server.png | 112,76,972,462 | same, dark |
| light | 10-15-Catalina-Light-Music-Preferences.png | 112,76,1066,584 | toolbar dialog with separator and ? / Cancel / OK row |
| dark | 10-15-Catalina-Dark-Music-Preferences.png | 112,76,1066,584 | same, dark |
