# Open dialog (TextEdit)

- **Screenshots:** 10-15-Catalina-Light-Finder-Open.png, 10-15-Catalina-Dark-Finder-Open.png (Documents folder, a file selected); 10-15-Catalina-Light-Finder-Open-iCloud.png, 10-15-Catalina-Dark-Finder-Open-iCloud.png (iCloud Drive, nothing selected)
- **Window:** 914 x 615 pt (frame x 112..1939, y 76..1305 px) for both Documents captures and the dark iCloud capture; 799 x 448 pt (x 112..1709, y 76..971) for the light iCloud capture. No title, no window controls; toolbar unified with the top edge [M]

Component measurements: `components/open-panel.md`.

## Layout

| Region | px (light Documents) | Size pt | Light | Dark |
|---|---|---|---|---|
| Toolbar | y 76..161 | 914 x 43 | gradient, mid `#dfdfdf` | `#3b3c3e` |
| Sidebar | x 112..421, y 162..1221 | 155 x 530 | `#e8e8e7` (vibrant) | `#2c2d2e` |
| Header band "Shared Folder" | x 424..1939, y 162..209 | 758 x 24 | `#f0f0f0` | `#2b2c2f` |
| File column | x 424..831, y 210..1221 | 204 x 506 | `#ffffff` | `#1e1f21` |
| Preview column | x 834..1939, y 210..1221 | 553 x 506 | `#ffffff` | `#1e1f21` |
| Bottom bar | y 1222..1305 | 914 x 42 | gradient, mid `#e2e2e2` | `#2f2f2f` |

```
[<][>] [view v] [folder+]      [ Documents ^v ]        [ Search ]
+ sidebar +- Shared Folder ------------------------------------+
|         | files (204)  | preview                             |
+---------+--------------+-------------------------------------+
[New Document] [Options]                    [Cancel] [ Open ]
```

## Components used

`open-panel`, `toolbar`, `toolbar-segmented-control` (back/forward), `toolbar-pop-up` (view switcher,
location), `toolbar-button` (new folder), `toolbar-search-field`, `sidebar`, `tag-dot`, `column-view`,
`split-view`, `scroll-view`, `push-button`, `default-button`, `label`, `image-view` (preview well),
`highlight-color` (emphasised file row, unemphasised sidebar row).

## App-specific elements

- Preview pane (as Finder's): bordered preview well px 874..1897 x 250..757 (512 x 254 pt) showing the
  document's first lines; name "512 Pixels" 17 pt bold at y 826; "Rich Text Document - 264 bytes" 11 pt
  grey; "Information" 13 pt bold with "Show More" link at the right edge; rows Created / Modified / Last
  opened (label grey, value right-aligned) at 20 pt pitch (y 982, 1022, 1062) with hairlines between;
  "Tags" 13 pt bold; "Add Tags..." placeholder [M: 10-15-Catalina-Light-Finder-Open.png @ 874,250,1024,960].
- "Shared Folder" band: a banner Finder shows for the app's iCloud/shared container.

## Content in the screenshot

- Toolbar: back (enabled), forward (disabled), column-view icon with chevron, new-folder icon, location
  pop-up "Documents" with folder icon, search field placeholder "Search".
- Sidebar (light): Favorites: Recents, Applications, Desktop, Documents (selected), Downloads; iCloud:
  TextEdit, iCloud Drive; Locations: Time Machine, ismhpro, Network; Tags: Blue, Work, Orange, Gray,
  Green, Home. Dark adds "Macintosh HD" at the top of Locations.
- Files: "512 Pixels" (selected), "Aqua and Bondi.pdf", "Aqua_and_Bo...review.ibooks", "For Desktop
  Stacks" (folder, disclosure arrow), "iPhone Field Guide.ibooks".
- Preview text "Here's to the crazy ones..."; Created "Tuesday, May 15, 2018 at 3:55 PM"; Modified
  "Monday, May 28, 2018 at 3:12 PM"; Last opened "Today, 10:51 AM" (dark: "Today, 10:20 AM").
- Bottom bar: "New Document", "Options", "Cancel", "Open" (default; disabled in the iCloud captures).
- iCloud captures: location "iCloud Drive" with cloud icon; sidebar selection on "iCloud Drive"; light
  shows two empty columns; dark shows one folder "TextEdit" with a disclosure arrow.

## Not reproducible / assets needed

Sidebar glyphs (template icons), document and folder icons at 16 pt, tag colours (see `tag-dot`). Real
file-system access is not available in a browser (mock data).
