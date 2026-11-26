# Stickies
- **Screenshots:** `10-15-Catalina-Light-Stickies.png`, `10-15-Catalina-Dark-Stickies.png` (full-screen 3360 x 2100 px captures: desktop, menu bar, Dock and two notes)
- **Window:** no document window. Two borderless note windows on the desktop: yellow 352 x 260 pt at screen position (69, 303) pt and blue 355 x 268 pt at (48, 281) pt [M] (`@ 138,606,704,520` and `@ 96,562,710,536`). Screen 1680 x 1050 pt.

## Layout
Evidence shorthand: `Light @` / `Dark @` are the two screenshots above; a bare `@` refers to the Light file and holds at the same coordinates in the Dark file unless a Dark location is given.

| Region | Position / size (pt) | Light | Dark | Tag |
|---|---|---|---|---|
| Menu bar | 0, 0, 1680 x 22 | see `menu-bar` | see `menu-bar` | - |
| Desktop | full screen, Catalina day picture | Catalina night picture | - | image asset |
| Blue note (back) | 48, 281, 355 x 268 | body `#bcf2fd (sRGB #aef4ff)` | body `#bcf2fd (sRGB #aef4ff)` | [M] `@ 100,566` |
| Yellow note (front) | 69, 303, 352 x 260 | strip `#fbe961 (sRGB #feea3d)` (12 pt) + body `#fdf3a7 (sRGB #fef49c)` | body `#fdf3a7 (sRGB #fef49c)` only (app not frontmost) | [M] `@ 500,610`, `@ 500,900` |
| Desktop icons | top right: "Macintosh SSD", "Time Machine" | same | same | see `desktop-icon` |
| Dock | bottom centre | Stickies icon with running dot, right of the divider | same | see `dock` |

```
+--------------------------------------------------------------+
| menu bar                                                      |
|                                                [Macintosh SSD]|
|                                                [Time Machine] |
|  +-blue note---------+                                        |
|  | +-yellow note-------+                                      |
|  | | Make a note of it!|                                      |
|  +-|                   |                                      |
|    +-------------------+                                      |
|                     [ Dock ]                                  |
+--------------------------------------------------------------+
```

## Components used
- `sticky-note`: both notes (yellow key in Light, both non-key in Dark).
- `menu-bar`, `menu-bar-extra`: app menus and status items.
- `desktop`, `desktop-icon`: wallpaper and the two volume icons.
- `dock`: with the Stickies icon running.
- `text-view`: the note body (insertion point visible in Light at `@ 160,978,2,28`).

## App-specific elements
None beyond `sticky-note`.

## Content in the screenshot
Menu bar titles, Light: `Stickies` (bold), `File`, `Edit`, `Font`, `Color`, `Window`, `Help`; clock `Thu 3:06 PM`, user `Stephen`. Dark: Finder is frontmost: `Finder`, `File`, `Edit`, `View`, `Go`, `Window`, `Help`; clock `Fri 10:36 AM`.

Yellow note (Helvetica 12, first line bold, 14 pt line pitch) [M, read from the screenshot]:

```
Make a note of it!

Stickies lets you keep notes (like these) on your desktop. Use
a Stickies note to jot down reminders, lists, or other
information. You can also use notes to store frequently used
text or graphics.

• To close this note, click the close button.

• To collapse this note, double click the title bar.

Your current notes appear when you open Stickies.
```
(line breaks as wrapped at 352 pt width; the insertion point sits at the start of the following empty line in Light.)

Blue note: only its top 22 pt and left 21 pt are visible. Visible fragments: `It’s …` (bold first line), then line starts `M`, `•`, `•`, `•`, `S`, `ch`, `ar`, `N`, `Lo`. The full default text is [D, Stickies default second note]:

```
It’s easy to customize your notes!

Make your notes stand out and get noticed.

• Format text using different fonts and font sizes.
• Add emphasis with bold and italic text styles or color.
• Include graphics.

Stickies has lots of other great features, including a spell
checker, import and export features, and other ways to
arrange and customize your notes. Plus, you can use Services to make a Sticky
Note with text selected in any app.

Look in Help to find out more about using Stickies.
```

## Not reproducible / assets needed
- Catalina desktop pictures (day and night) as image assets.
- Dock icons, volume icons.
- Everything in the notes themselves is CSS and text.
