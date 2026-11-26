# Dock menu (`dock-menu`)

- **Status:** not seen in the screenshots (no Dock icon has its menu open in any of the 294 files)
- **AppKit:** `NSApplicationDelegate.applicationDockMenu(_:)`, `NSApplication.dockTile`
- **HIG:** https://web.archive.org/web/20200503225732/https://developer.apple.com/design/human-interface-guidelines/macos/menus/dock-menus/
- **Appearances shown:** none

## Purpose and behaviour
A Dock menu appears when the user Control-clicks (or clicks and holds) an app's Dock icon. The system supplies items such as the app's open windows, Options (Keep in Dock, Open at Login, Show in Finder), Show All Windows, Hide and Quit; the app can add its own items above them (HIG, Dock Menus) [D].

## Anatomy
A detached `menu` anchored above the Dock icon with a small pointer, containing `menu-item` rows: app-defined items, separator, window list (checkmark on the key window, diamond on minimised windows), separator, Options submenu, separator, Show All Windows / Hide / Quit.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| app state | running (windows + Hide + Quit) / not running (Options, Show Recents, Open) | - | - | not shown |
| Dock position | bottom (menu above icon), left/right (menu beside icon) | bottom | Dock preference | not shown |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| open | no | - |

## Measurements
Not shown. Specified by reference to `menu` and `menu-item` with these differences:

| Property | Value | Tag | Basis |
|---|---|---|---|
| Container | detached `menu`, all corners 5 pt, 4 pt vertical padding | [I] | same `NSMenu` class; measured on other detached menus in `menu` |
| Appearance | always the dark menu material, in both light and dark mode (the Dock's own menus use the dark HUD style in Catalina) | [I] | recollection of Catalina behaviour; not verifiable from the screenshots. If in doubt follow the system appearance |
| Row height / font | 19 pt rows, 14 pt Regular | [I] | as `menu-item` |
| Anchor | horizontally centred on the icon, bottom edge 4-8 pt above the Dock shelf top, with a downward 12 x 6 pt pointer centred on the icon | [I] | not shown |
| Key equivalents | none | [D] | HIG: Dock menus do not show keyboard shortcuts |
| Standard items for a running app | (app items), separator, window titles, separator, "Options" (submenu: "Keep in Dock", "Open at Login", "Show in Finder", "Assign To" group), separator, "Show All Windows", "Hide", "Quit" | [D] | HIG, Dock Menus |

## Layout and spacing
As `menu`.

## Keyboard and accessibility
Control-F3 focuses the Dock; Up opens the focused icon's menu; arrows/Return/Esc as any menu [D] (macOS keyboard shortcuts). ARIA: `role="menu"` owned by the Dock item button (`aria-haspopup="menu"`).

## Browser notes
None beyond `menu`.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| - | - | - | not shown in the library |
