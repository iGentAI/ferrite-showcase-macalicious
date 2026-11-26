# Automator
- **Screenshots:** 10-15-Catalina-Light-Automator.png, 10-15-Catalina-Dark-Automator.png
- **Window:** 1000 x 868 pt [M] (image x=112..2111, y=76..1811). Title bar + icon-and-label toolbar, 68 pt (y=76..211). Title "Untitled".

## Layout
| Region | Size (pt) | Light | Dark | Tag / evidence |
|---|---|---|---|---|
| Title + toolbar | 68 | gradient to `#c9c9c9`, lines `#b9b9b9` / `#a3a3a3` | `#383939` -> `#353637`, line `#000000` | [M] @ 1400,180,1,32 |
| Library header band (Actions / Variables switch + search field) | 25 (y=212..261), spans x=112..873 | `#e4e4e4`, bottom lines `#d5d5d5` / `#c2c2c2` | `#2f3032`, lines `#3e3f41` / `#515254` | [M] Light-Automator @ 860,255,1,7; Dark-Automator @ 860,255,1,7 |
| Library outline (`outline-view`) | 163 wide (x=112..437), y=262..1537 | `#ffffff` | `#1e1f21` | [M] @ 300,900 |
| Divider | 1 | `#d4d4d4` | not visible (same as background) | [M] Light @ 438,900 |
| Action list (`table-view`, no stripes) | 217 wide (x=440..873) | `#ffffff` | `#1e1f21` | [M] @ 700,900 |
| Divider | 1 | `#d4d4d4` | - | [M] Light @ 874,900 |
| Description pane (under both lists) | y=1540..1769 (115 pt), top rule at y=1538 | `#ffffff`, rule `#d4d4d4` | `#1e1f21`, rule `#2a2a2a` | [M] @ 300,1538,1,2 |
| Workflow area | x=876..2111, y=212..1473 | `#e7e9e9` | `#2c2d2f` | [M] @ 1400,400 |
| Log table header + rows | header y=1476..1525 (1 + 23 + 1), rows 19 pt to y=1769 | header `#f0f0f0`, stripes `#ffffff` / `#f5f5f5` | `#2b2c2f`, `#1e1f21` / `#29292b` | [M] @ 1400,1474,1,296 |
| Bottom bar | 21 (y=1770..1811) | top line `#cfcfcf`, gradient `#e4e4e4` -> `#cfcfcf` | line `#636465`, `#3e4041` -> `#333536` | [M] @ 1400,1770,1,42 |

Toolbar (px, row y=148; labels below): Library 127..204 (selected/highlighted icon); Media 219..296; Record 1743..1820; Step 1835..1912 (disabled); Stop 1927..2004 (disabled); Run 2019..2096 (each 39 pt wide, 46 pt pitch) [M]. Log columns: "Log" 876..1909 (517 pt), "Duration" from x=1912; separator at x=1910 [M] (row y=1500).

```
                                   Untitled
 [Library][Media]                                          [Record][Step][Stop][Run]
 [Actions|Variables] [Q Name      ] |
 v Library      | Activate Fonts    |     ( Drag actions or files here to build your workflow. )
    Calendar    | Add Attachments.. |
    Contacts    | ...               +----------------------------------------------
    ...         |                   | Log                                  | Duration
 [F] Activate Fonts                 |
 This action activates the fonts... |
 [gear v] [v]                       | [list][flow]
```

## Components used
`window`, `title-bar`, `window-controls`, `toolbar`, `toolbar-labelled-item`, `toolbar-button`, `segmented-control` (Actions | Variables, small, in content), `search-field` (focused, with `focus-ring`), `outline-view` (Library), `table-view` (actions; log with alternating rows), `table-header` (Log / Duration), `split-view`, `empty-state` (capsule), `status-bar` (bottom bar), `pull-down-button` (gear), `image-button` (bottom bar toggles), `label`.

## App-specific elements
- Library and action rows: 19 pt pitch (18 pt highlight + 1), 16 pt full-colour app icons, 11-12 pt labels. The first action "Activate Fonts" is selected with the unemphasized highlight `#dcdcdc` (light) / `#464646` (dark), y=262..297, because the search field has keyboard focus. [M] 10-15-Catalina-Light-Automator.png @ 860,262,1,36; 10-15-Catalina-Dark-Automator.png @ 860,262,1,36.
- Description pane: 32 pt action icon, title "Activate Fonts" about 17 pt Bold, body 11 pt; "Input:" / "Result:" / "Version:" right-aligned Bold labels with values.
- Bottom bar left: gear pull-down and a disclosure toggle; right part (under the workflow): two view toggles (list selected in accent blue, flow).

## Content in the screenshot
Toolbar labels: Library, Media, Record, Step, Stop, Run. Tabs: Actions (selected), Variables; search placeholder "Name". Library: Library > Calendar, Contacts, Developer, Files & Folders, Fonts, Internet, Mail, Movies, Music, PDFs, Photos, Text, Utilities; Most Used; Recently Added. Actions: Activate Fonts, Add Attachments to Front Message, Add Grid to PDF Documents, Add Songs to Playlist, Add to Album, Add to Font Library, Apple Versioning Tool, Apply ColorSync Profile to Images, Apply Quartz Co...ter to Image Files, Apply Quartz Filt...PDF Documents, Apply SQL, Ask for Confirmation, Ask for Finder Items, Ask for Movies, Ask for Photos, Ask For Servers, Ask for Songs, Ask for Text, Burn a Disc, Change System Appearance, Change Type of Images, Choose from List, Combine PDF Pages, Combine Text Files, Compress Image...PDF Documents, Connect to Servers, Convert CSV to SQL, Convert Quartz...QuickTime Movies, Copy Finder Items, Copy to Clipboard, Create Annotated Movie File, Create Archive, Create Banner Image from Text, Create Package. Placeholder: "Drag actions or files here to build your workflow." Log header: "Log", "Duration". Description: "Activate Fonts"; "This action activates the fonts passed from the previous action."; "Input: Font Book typeface"; "Result: Font Book typeface"; "Version: 5.0".

## Not reproducible / assets needed
Action and library icons (colour artwork), toolbar glyphs.
