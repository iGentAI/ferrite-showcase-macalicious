# Feature inventory: Maps

Main commit read: `e62c2ac9`, from GitHub only; the rows marked done were run later, in the running desktop (`e2e/maps-depth-journey.mjs`). Files read: `demos/maps/app.ts`, `maps-desktop.tsx`, the start of `maps.mdx`, `demos/desktop/desktop-menus.tsx`. `maps-tiles.tsx` was not read, so its keyboard rows say "not traced".

Status: **done** (worked in the running app, screenshot linked; an unavailable row is done when it is dimmed and says why), **missing**, **partial** (the note says what is absent), or **built-unchecked** (in main's code, not yet seen running). The real app's list comes from knowledge of macOS 10.15 Maps, not from a Mac. "Call" marks a decision made here.

Calls:
- Paid map tiles are out of scope. Satellite, Transit lines, Traffic, 3D, Flyover and Look Around stay shown as unavailable.
- Weather comes from Open-Meteo through the server (`src/apps/weather`), free with attribution for non-commercial use; both its hosts are declared down to their paths. Directions run on the FOSSGIS routers (`routing.openstreetmap.de`, one request a second, attribution and a fix-the-map link in the panel); their usage policy was read on their about page.
- Tabs: Maps keeps each map in a window of its own here, so New Tab and Show Tab Bar are dimmed with that reason and New Window works.
- Share: Mail, Messages, Notes and Reminders take the link as every other app's Share does; Messages no longer posts straight into the desktop's room.
- The ledger marks directions, tabs, Transit, Satellite, weather and 3D as "Obsolete: cut and documented in `maps.mdx`". The owner's later direction, everything the real app does, reopens them, so they appear here.

## Menus

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 1 | Maps > About Maps | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/73), [Window menu](#project-artifact/art_3f7380b0451dc3ac/75) |
| 2 | Maps > Preferences… | done | Dimmed with its reason, "Maps has no preferences". `maps-rows-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/159) |
| 3 | Maps > Services | built-unchecked | With no text selected "No Services Apply", as on a Mac; text selected in the window gets the desktop's services (`ServicesItems`) |
| 4 | Maps > Hide Maps | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/73), [Window menu](#project-artifact/art_3f7380b0451dc3ac/75) |
| 5 | Maps > Hide Others | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/73), [Window menu](#project-artifact/art_3f7380b0451dc3ac/75) |
| 6 | Maps > Show All | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/73), [Window menu](#project-artifact/art_3f7380b0451dc3ac/75) |
| 7 | Maps > Quit Maps | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/73), [Window menu](#project-artifact/art_3f7380b0451dc3ac/75) |
| 8 | File > New Window ⌘N | done | Each window has its own map and shares the person's places. [Two windows](#project-artifact/art_3f7380b0451dc3ac/16) |
| 9 | File > New Tab ⌘T | done | Call: dimmed with its reason. [File menu](#project-artifact/art_3f7380b0451dc3ac/21) |
| 10 | File > Close Window ⌘W | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/73), [Window menu](#project-artifact/art_3f7380b0451dc3ac/75) |
| 11 | File > Share | done | Copy Link and Notes worked, Messages opens Messages, dimmed with its reason until a place is chosen. [File menu](#project-artifact/art_3f7380b0451dc3ac/21), [to Notes](#project-artifact/art_3f7380b0451dc3ac/14) |
| 12 | File > Export as PDF… | done | A PDF of the map as shown, with its pins and route, 170 KB, read back by the journey. [File menu](#project-artifact/art_3f7380b0451dc3ac/21) |
| 13 | File > Print… ⌘P | done | A picture of the map in a frame of its own; the journey stands in for the browser's print dialog and checks the picture. [File menu](#project-artifact/art_3f7380b0451dc3ac/21) |
| 14 | Edit > Undo | done | Dimmed with its reason. [Edit menu](#project-artifact/art_cb50176e877da932/3) |
| 15 | Edit > Redo | done | Dimmed with its reason. [Edit menu](#project-artifact/art_cb50176e877da932/3) |
| 16 | Edit > Cut | done | Dimmed with its reason; the search field's own key still works. [Edit menu](#project-artifact/art_cb50176e877da932/3) |
| 17 | Edit > Copy | done | Dimmed with its reason; the search field's own key still works. [Edit menu](#project-artifact/art_cb50176e877da932/3) |
| 18 | Edit > Paste | done | Dimmed with its reason; the search field's own key still works. [Edit menu](#project-artifact/art_cb50176e877da932/3) |
| 19 | Edit > Select All | done | Dimmed with its reason; the search field's own key still works. [Edit menu](#project-artifact/art_cb50176e877da932/3) |
| 20 | Edit > Find ⌘F | done | Puts the keyboard in the search field, from the menu and from the map. [Edit menu](#project-artifact/art_cb50176e877da932/3) |
| 21 | Edit > Drop Pin ⇧⌘D | done | Worked in the middle of the map, with its card, on land and on open sea, where the lookup finds no address and the card gives the coordinates. A reply with `extratags: null` reads as a place. [A dropped pin](#project-artifact/art_cb50176e877da932/5), [at sea](#project-artifact/art_cb50176e877da932/12) |
| 22 | Edit > Remove Pin | done | Worked; dimmed while no pin is dropped. A pin stays when another place is chosen. [Edit menu](#project-artifact/art_cb50176e877da932/3) |
| 23 | View > Map ⌘1 | done | The checked type, and the only one. [View menu](#project-artifact/art_cb50176e877da932/2) |
| 24 | View > Transit ⌘2 | done | Call: unavailable. Dimmed with its reason; ⌘2 does nothing. [View menu](#project-artifact/art_cb50176e877da932/2) |
| 25 | View > Satellite ⌘3 | done | Call: unavailable. Dimmed with its reason; ⌘3 does nothing. [View menu](#project-artifact/art_cb50176e877da932/2) |
| 26 | View > Show Labels | done | Call: dimmed; OpenStreetMap's tiles have their labels drawn in. [View menu](#project-artifact/art_3f7380b0451dc3ac/22) |
| 27 | View > Show Traffic | done | Call: unavailable. Dimmed with its reason. [View menu](#project-artifact/art_cb50176e877da932/2) |
| 28 | View > Show Scale | done | Shows and hides the scale, as the Show menu on the map does. [View menu](#project-artifact/art_cb50176e877da932/2) |
| 29 | View > Zoom In | done | ⌘+, with or without Shift. [View menu](#project-artifact/art_cb50176e877da932/2) |
| 30 | View > Zoom Out | done | ⌘-. [View menu](#project-artifact/art_cb50176e877da932/2) |
| 31 | View > Go to Current Location ⌘L | done | With the browser's location fixed by the journey. [View menu](#project-artifact/art_cb50176e877da932/2) |
| 32 | View > Directions ⌘R | done | Opens and closes the panel. [View menu](#project-artifact/art_3f7380b0451dc3ac/22), [the route](#project-artifact/art_3f7380b0451dc3ac/18) |
| 33 | View > Show Tab Bar | done | Call: dimmed with its reason. [View menu](#project-artifact/art_3f7380b0451dc3ac/22) |
| 34 | View > Enter Full Screen | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/73), [Window menu](#project-artifact/art_3f7380b0451dc3ac/75) |
| 35 | View > Show 3D Map | done | Call: unavailable. Dimmed with its reason; ⌘D does nothing. [View menu](#project-artifact/art_cb50176e877da932/2) |
| 36 | Window > Minimize | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/73), [Window menu](#project-artifact/art_3f7380b0451dc3ac/75) |
| 37 | Window > Zoom | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/73), [Window menu](#project-artifact/art_3f7380b0451dc3ac/75) |
| 38 | Window > Bring All to Front | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/73), [Window menu](#project-artifact/art_3f7380b0451dc3ac/75) |
| 39 | Window > window list | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/73), [Window menu](#project-artifact/art_3f7380b0451dc3ac/75) |
| 40 | Help > Maps Help | built-unchecked | Opens Maps' guide in Help Viewer: `e2e/help-guides-journey.mjs` |

Menus: 40 rows; 38 done, 2 partial.

## Views, sidebar, toolbar

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 41 | OpenStreetMap tile map | done | OpenStreetMap's tiles arrive and its credit is on the map. `maps-rows-journey`. [Tiles](#project-artifact/art_3f7380b0451dc3ac/169) |
| 42 | Search on Return | done | Nominatim, through the server; typing asks nothing. `maps-rows-journey`. [Card](#project-artifact/art_3f7380b0451dc3ac/160) |
| 43 | Search suggestions while typing | done | Call: Recents, Favorites and Guides only, as Nominatim's terms limit search while typing; arrows and Return work, and nothing typed leaves the window. [Suggestions](#project-artifact/art_cb50176e877da932/8) |
| 44 | Results list | done | Several answers: a list under the field, a pin each, framed on the map, a row opens its card. Worked for "Paris", "Main Street" and "Springfield" on real replies. [List](#project-artifact/art_cb50176e877da932/10), [Springfield](#project-artifact/art_cb50176e877da932/11), [at the smallest window, with Places open](#project-artifact/art_cb50176e877da932/9), [a row's card](#project-artifact/art_cb50176e877da932/6) |
| 45 | Place card: address, phone, site, coordinates, links | done | Read from a real hotel's card, with its site and OpenStreetMap links. `maps-rows-journey`. [Card](#project-artifact/art_3f7380b0451dc3ac/160) |
| 46 | Card: Directions, Call | done | Directions worked; Call is a `tel:` link, read on a place with a phone number. [Card](#project-artifact/art_3f7380b0451dc3ac/160) |
| 47 | Favorites | done | The card's heart adds to them on the server; back over a reload. `maps-rows-journey`. [After a reload](#project-artifact/art_3f7380b0451dc3ac/158) |
| 48 | Recents, Clear Recents | done | The place shown is in Recents on the server; Clear Recents empties them and leaves the guide. `maps-rows-journey`. [Cleared](#project-artifact/art_3f7380b0451dc3ac/161) |
| 49 | Guides, Add to Guide | done | New Guide and the card's Add to Guide, on the server. Two rows dragged onto a guide land in order; onto one with room for one they are refused with the reason. `maps-rows-journey`. [Add](#project-artifact/art_3f7380b0451dc3ac/157), [places](#project-artifact/art_3f7380b0451dc3ac/165), [full](#project-artifact/art_3f7380b0451dc3ac/163) |
| 50 | Rename a guide, reorder | done | Rename Guide worked, from the row's menu; reorder is row 76. [Row menu](#project-artifact/art_3f7380b0451dc3ac/15) |
| 51 | Directions panel: route, steps, drive and walk | done | A real route from the routers, its time and length, steps that move the map, the line on the map, Swap, and Drive or Walk; an answer to a question since changed is not shown. [Route](#project-artifact/art_3f7380b0451dc3ac/18) |
| 52 | Transit details | done | Call: unavailable. The panel's Transit is dimmed with its reason, as is the View row. [Route](#project-artifact/art_3f7380b0451dc3ac/18) |
| 53 | Satellite imagery | done | Call: unavailable. Dimmed with its reason. [View menu](#project-artifact/art_3f7380b0451dc3ac/22) |
| 54 | Weather on the map | built-unchecked | The temperature at the map's middle in its corner, in Language & Region's unit, from zoom 7 in; condition, source and time in its tooltip; `--` and the reason when the source is down. Below the tiles' attribution, which holds the corner the captures show it in. No air quality capsule: Open-Meteo serves that from a host not declared. While a search's results are open their list covers the plate's glyph, not its temperature. `e2e/weather-rates-batch13-journey.mjs`; screenshot not yet published |
| 55 | Compass | built-unchecked | Dragged round, the compass turns the map; its rose turns against it; its ring faces north; the arrow keys turn it by 15° while it has the keyboard. Tiles, pins, the route, the location, panning, zooming, a dropped pin and Print or Export all follow the heading, which is kept on the server (`maps.heading`). Pins stay upright and the tiles' labels turn with the map. `maps-geo` and `maps-tiles` tests; `e2e/media-batch4-journey.mjs` read the heading, pin and pan on screen and over a reload. A trackpad's rotate gesture is not offered: a browser does not report it. Print's turned picture was not run. Screenshot not yet published |
| 56 | 3D and Flyover | done | Call: unavailable. Dimmed with its reason. [View menu](#project-artifact/art_3f7380b0451dc3ac/22) |
| 57 | Look Around | done | Call: unavailable. Dimmed with its reason. [View menu](#project-artifact/art_3f7380b0451dc3ac/22) |
| 58 | Tabs on the served window | done | Call: unavailable, each map has a window of its own. [File menu](#project-artifact/art_3f7380b0451dc3ac/21) |
| 59 | Scale | done | Off at first; the Show menu's Scale shows a legend that follows the zoom. `maps-rows-journey`. [Scale](#project-artifact/art_3f7380b0451dc3ac/166) |
| 60 | Current location | done | The toolbar's button shows the browser's location in the middle of the map. `maps-rows-journey`. [Location](#project-artifact/art_3f7380b0451dc3ac/164) |
| 61 | Share: Messages, Copy Link | done | Copy Link read back from the clipboard; Messages opens with the link. [File menu](#project-artifact/art_3f7380b0451dc3ac/21) |
| 62 | Share: Mail, Notes, Reminders | built-unchecked | Notes made a note of the link ([To Notes](#project-artifact/art_3f7380b0451dc3ac/14)). Mail started a message holding it, and Reminders made a reminder with it, read back from the server, in `e2e/media-batch4-journey.mjs`. Screenshot not yet published |

Views: 22 rows; 19 done, 3 built-unchecked.

## Context menus

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 63 | Map menu: Drop Pin | done | Drops it where the menu was asked for. [Map menu](#project-artifact/art_3f7380b0451dc3ac/19) |
| 64 | Map menu: Directions To and From, Report | built-unchecked | The rows are there and Directions works ([Map menu](#project-artifact/art_3f7380b0451dc3ac/19)). Report an Issue opened OpenStreetMap's fix-the-map page at the pressed point in Safari, read from its address field, in `e2e/media-batch4-journey.mjs`. Screenshot not yet published |
| 65 | Pin menu | done | Show Info, Directions, Favorites, Copy Link, Remove Pin. [Pin menu](#project-artifact/art_3f7380b0451dc3ac/20) |
| 66 | Sidebar row menu | done | Show on Map, Directions To Here, Copy Link, Rename Guide, Remove. [Row menu](#project-artifact/art_3f7380b0451dc3ac/15) |

Context menus: 4 rows; 3 done, 1 built-unchecked.

## Keyboard shortcuts

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 67 | Arrow keys pan | done | Each of the four keys moves the map 100 px, read from a marker's place. `maps-rows-journey`. [Map](#project-artifact/art_3f7380b0451dc3ac/166) |
| 68 | + and - zoom | done | Read from the map's zoom. `maps-rows-journey`. [Map](#project-artifact/art_3f7380b0451dc3ac/166) |
| 69 | ⌘1 to ⌘3 | done | ⌘1 is the map shown; ⌘2 and ⌘3 are the dimmed rows' keys. [View menu](#project-artifact/art_cb50176e877da932/2) |
| 70 | ⌘L, ⌘R | done | ⌘R opens and closes Directions. [View menu](#project-artifact/art_3f7380b0451dc3ac/22) |
| 71 | Delete in the sidebar removes the row | done | Straight after a row's click. `maps-rows-journey`. [Places](#project-artifact/art_3f7380b0451dc3ac/165) |
| 72 | Return searches | done | Asks the server for what the field holds. `maps-rows-journey`. [Card](#project-artifact/art_3f7380b0451dc3ac/160) |

Keys: 6 rows; 6 done.

## Drag and drop

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 73 | Drag the map | done | The map moves with the pointer. `maps-rows-journey`. [Mid-drag](#project-artifact/art_3f7380b0451dc3ac/162) |
| 74 | Drag a pin to move it | done | The dropped pin moves under the pointer, without panning the map, and is named again where it lands. A found place's pin stays put. [Pin](#project-artifact/art_3f7380b0451dc3ac/50) |
| 75 | Drag a place into a guide | done | A Favorite or Recent stays where it was and joins the guide; a place of another guide moves. A full guide says so. A row pressed shows on the map only when the press ends in a click, so a drag does not add it to Recents. [Rows](#project-artifact/art_3f7380b0451dc3ac/49) |
| 76 | Reorder Favorites and guides | done | A real drag with a line where it lands, also of a guide's places; kept on the server. [Rows](#project-artifact/art_3f7380b0451dc3ac/49) |
| 77 | Drop a contact or address | done | Words dropped on the map are searched for by their first line; run with a dispatched drop event, since a text drag out of a field does not start under the journey's mouse. A contact card does not drag out as an address in Contacts. [Pin](#project-artifact/art_3f7380b0451dc3ac/50) |
| 78 | Drag a place out to Notes or Mail | built-unchecked | A place's row drags as its name and link, and a pin on the map does too; a dropped pin's own drag still moves it. Dropped on a note and a Mail message in `e2e/media-batch4-journey.mjs`, which read the text back from each. Screenshot not yet published |

Drag: 6 rows; 5 done, 1 built-unchecked.

## Multi-selection

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 79 | Several sidebar rows: remove | done | Command-click and Shift-click choose rows across the lists; the menu, the Remove button (not run) and Delete remove them. [Rows](#project-artifact/art_3f7380b0451dc3ac/49) |

Multi-selection: 1 row; 1 done.

## Saved state

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 80 | Favorites, Recents, Guides | done | On the server, as they were over a reload. `maps-rows-journey`. [After a reload](#project-artifact/art_3f7380b0451dc3ac/158) |
| 81 | Last map view, panel | done | The view and the Places panel survived a reload. [After a reload](#project-artifact/art_3f7380b0451dc3ac/15) |
| 82 | Show menu settings | done | The scale survived a reload. [After a reload](#project-artifact/art_3f7380b0451dc3ac/15) |

Saved state: 3 rows; 3 done.

## Cross-app

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 83 | Share to Messages | done | The card's Share starts a message with the place's link, and the card goes. `maps-rows-journey`. [Messages](#project-artifact/art_3f7380b0451dc3ac/170) |
| 84 | Contacts address opens Maps | done | Show on Map searches for it in Maps, run by `e2e/contacts-fields-journey.mjs`. [Pin](#project-artifact/art_3f7380b0451dc3ac/50) |
| 85 | Calendar location opens Maps | built-unchecked | The map was stale: Calendar's Show in Maps and the event editor call `askMapsSearch` (`demos/calendar/calendar.tsx`). Not run here |
| 86 | Spotlight finds places | done | Lists a place under Places and opens its card. `media-spotlight-journey`. [Spotlight](#project-artifact/art_3f7380b0451dc3ac/172) |
| 87 | Dock menu | done | `media-dock-journey`. [Dock menu](#project-artifact/art_3f7380b0451dc3ac/171) |
| 88 | Siri directions | done | Siri asks Maps, which opens Directions on the place and draws the route. `maps-rows-journey`. [Siri](#project-artifact/art_3f7380b0451dc3ac/168) |

Cross-app: 6 rows; 5 done, 1 built-unchecked.

## Build items, most-used first

1. **Directions:** panel, route, steps, card button, map menu, ⌘R; needs a routing egress. Rows 32, 46, 51, 64, 70.
2. **Menus carry the commands:** Share, zoom, Location, Scale, Pin; Keys. Rows 11, 20-23, 28-31, 69.
3. **Results list** and suggestions from the person's places. Rows 43-44.
4. **Places editing:** rename, reorder, drag into guides, row menu, multi-select. Rows 50, 66, 75-76, 79.
5. **Pins:** drag, menu, Remove Pin, labels. Rows 22, 26, 65, 74.
6. **Tabs and windows.** Rows 8-9, 33, 58.
7. **Keep the view:** last map, panel, scale. Rows 81-82.
8. **Share widely and cross-app:** shared link helper, Contacts, Calendar, Spotlight, Dock, drag out. Rows 62, 77-78, 84-87.
9. **Print and PDF.** Rows 12-13.
10. **Weather and keyboard panning.** Rows 54, 67-68.
11. **Unavailable rows with reasons:** Transit, Satellite, Traffic, 3D, Look Around, Siri, Preferences, Help, compass rotation. Rows 2, 14-19, 24-25, 27, 35, 40, 52-53, 55-57, 88.

## Counts (by hand)

88 rows: 80 done, 2 built-unchecked, 6 partial.
