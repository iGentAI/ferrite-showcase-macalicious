# Feature inventory: Find My

Main commit read: `e62c2ac9`, from GitHub only. Rows marked done were run later, as their notes say; the rest were not run. Files read: `demos/find-my/app.ts`, `find-my-desktop.tsx`, `demos/desktop/desktop-menus.tsx`, the README's Find My section.

Status: **done** (seen working, with a picture linked), **missing**, **partial** (the note says what is absent), or **built-unchecked** (in main's code, not yet seen running). The real app's list comes from knowledge of macOS 10.15 Find My, not from a Mac. "Call" marks a decision made here.

Calls:
- A device is a browser. Mark As Lost and Erase can act only on what the browser holds: Lost shows a message on that browser's desktop; Erase signs it out. Neither touches the account's data.
- Sharing between accounts, today refused by design ("no sharing between accounts"), is the largest item. It needs consent on both sides and a test that an account sees only those who shared with it, so location is never exposed by default.
- Ledger: Find My's journey items are done (`13555579`, `625f794a`) and carry no open item.

## Menus

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 1 | Find My > About | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/77), [Window menu](#project-artifact/art_3f7380b0451dc3ac/78) |
| 2 | Find My > Preferences… | done | Dimmed: "Find My has no preferences". [App menu](#project-artifact/art_1b41e533eee452a3/9) |
| 3 | Find My > Services | built-unchecked | With no text selected "No Services Apply", as on a Mac; text selected in the window gets the desktop's services (`ServicesItems`) |
| 4 | Find My > Hide | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/77), [Window menu](#project-artifact/art_3f7380b0451dc3ac/78) |
| 5 | Find My > Hide Others | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/77), [Window menu](#project-artifact/art_3f7380b0451dc3ac/78) |
| 6 | Find My > Show All | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/77), [Window menu](#project-artifact/art_3f7380b0451dc3ac/78) |
| 7 | Find My > Quit | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/77), [Window menu](#project-artifact/art_3f7380b0451dc3ac/78) |
| 8 | File > Close Window ⌘W | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/77), [Window menu](#project-artifact/art_3f7380b0451dc3ac/78) |
| 9 | File > Share My Location | built-unchecked | Opens the sheet; dimmed, saying why, only while nobody is signed in. `find-my-people-journey`. [File menu](#project-artifact/art_3f7380b0451dc3ac/191) |
| 10 | Edit > Undo | done | Dimmed: nothing to undo. [Edit menu](#project-artifact/art_1b41e533eee452a3/3) |
| 11 | Edit > Redo | done | Dimmed: nothing to redo. [Edit menu](#project-artifact/art_1b41e533eee452a3/3) |
| 12 | Edit > Cut | done | Dimmed: no text to edit. [Edit menu](#project-artifact/art_1b41e533eee452a3/3) |
| 13 | Edit > Copy | done | Dimmed, and its reason says to select a card's coordinates and press ⌘C. [Edit menu](#project-artifact/art_1b41e533eee452a3/3) |
| 14 | Edit > Paste | done | Dimmed: no text to edit. [Edit menu](#project-artifact/art_1b41e533eee452a3/3) |
| 15 | Edit > Select All | done | Selects every device, ⌘A too; dimmed under People, saying why. The [Edit menu](#project-artifact/art_1b41e533eee452a3/3) picture is from before this. |
| 16 | View > People | done | ⌘1 too. [View menu](#project-artifact/art_1b41e533eee452a3/4) |
| 17 | View > Devices | done | ⌘2 too. [View menu](#project-artifact/art_1b41e533eee452a3/4) |
| 18 | View > Map, Hybrid, Satellite | done | Call: Map only; Hybrid and Satellite dimmed, saying OpenStreetMap has no imagery. [View menu](#project-artifact/art_1b41e533eee452a3/4) |
| 19 | View > Zoom In and Out | done | ⌘+ and ⌘- too. [View menu](#project-artifact/art_1b41e533eee452a3/4) |
| 20 | View > Current Location | done | "Go to Current Location", ⌘L too; centres the map on the browser. [View menu](#project-artifact/art_1b41e533eee452a3/4) |
| 21 | View > Enter Full Screen | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/77), [Window menu](#project-artifact/art_3f7380b0451dc3ac/78) |
| 22 | Window > Minimize | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/77), [Window menu](#project-artifact/art_3f7380b0451dc3ac/78) |
| 23 | Window > Zoom | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/77), [Window menu](#project-artifact/art_3f7380b0451dc3ac/78) |
| 24 | Window > Bring All to Front | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/77), [Window menu](#project-artifact/art_3f7380b0451dc3ac/78) |
| 25 | Window > window list | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/77), [Window menu](#project-artifact/art_3f7380b0451dc3ac/78) |
| 26 | Help > Find My Help | built-unchecked | Opens Find My's guide in Help Viewer: `e2e/help-guides-journey.mjs` |

Menus: 26 rows; 24 done, 2 partial.

## Views, sidebar, windows

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 27 | People list | built-unchecked | Me, then each account linked with this person, in both directions, with where they are, when last seen, or how the link stands. `find-my-people-journey` |
| 28 | Devices list | done | Each browser of the account, with the time it was last seen. `find-my-rows-journey`. [Map and list](#project-artifact/art_3f7380b0451dc3ac/194) |
| 29 | Map with markers | done | OpenStreetMap: a marker for each other device, the blue dot for this one. `find-my-rows-journey`. [Map](#project-artifact/art_3f7380b0451dc3ac/194) |
| 30 | Device card | done | The device's position, and its marker names it. `find-my-rows-journey`. [Card](#project-artifact/art_3f7380b0451dc3ac/188) |
| 31 | Play Sound | done | Asked of the device on the server, and the window says so. `find-my-rows-journey`. [Play Sound](#project-artifact/art_3f7380b0451dc3ac/196) |
| 32 | Remove This Device | done | Asks, then forgets that device and no other on the server. `find-my-rows-journey`. [Remove](#project-artifact/art_3f7380b0451dc3ac/197) |
| 33 | Share My Location | built-unchecked | Button and File menu open a sheet naming an account of this desktop; signed out it says to sign in. `find-my-people-journey` |
| 34 | Mark As Lost | done | Call: unavailable, a web page cannot lock another browser. Dimmed with its reason in the device's menu. [Device menu](#project-artifact/art_3f7380b0451dc3ac/25) |
| 35 | Erase | done | Call: unavailable, as above. [Device menu](#project-artifact/art_3f7380b0451dc3ac/25) |
| 36 | Directions | done | Opens Maps with a route from here to the device; dimmed for this browser and for several, saying why. A listed device always has a position: the module lists only devices that reported a valid one. [In Maps](#project-artifact/art_3f7380b0451dc3ac/28) |
| 37 | Notify When Found | done | Call: unavailable, as above. [Device menu](#project-artifact/art_3f7380b0451dc3ac/25) |
| 38 | Person info: Contact, Share, Stop Sharing | built-unchecked | A card over the map and a row or marker menu: Contact, Message, Directions, Share or Stop Sharing My Location, Ask To Follow Location, Add or Remove Notification, Remove. Contact opens the card whose account is theirs, or says there is none. `find-my-people-journey` |
| 39 | Invitations and sharing between accounts | built-unchecked | Sharing starts at once by the sharer's choice and tells the other person. Ask To Follow Location asks, and the person asked shares or says no. Only the sharer's own record grants, and only the newest position shows, with no device name or history. Who has blocked the person in Messages is not reached, and the person is not told. `tests/find_my_people.rs`, `find-my-people-journey` |
| 40 | Arrive and leave notifications | built-unchecked | Add Notification: notify me when they arrive or leave, or notify them when I do; at your current location or at another place named and found through Maps (within 200 m), once or every time; held against each report the sharer's browsers make, so it works with everyone's windows closed. `tests/find_my_people.rs`, `find-my-people-journey`; both new rules, read from the server and from the friend's inbox, in `calendar-reminders-batch4-journey`, with a stand-in for `/api/maps/search`, so the real geocoder was not used. |
| 41 | Map types | done | Call: Map only. The window's control shows Map, with Hybrid and Satellite dimmed, saying why. [Map types](#project-artifact/art_1b41e533eee452a3/8) |
| 42 | Compass | done | North up; its tooltip says the map does not rotate. [Map types](#project-artifact/art_1b41e533eee452a3/8) |
| 43 | Location permission and failure states | done | With location refused it says so and shows no dot; a failed read says the list is as of when it was read, and the next read clears that. `find-my-rows-journey`. [Refused](#project-artifact/art_3f7380b0451dc3ac/189), [failed read](#project-artifact/art_3f7380b0451dc3ac/195) |

Views: 17 rows; 12 done, 5 built-unchecked.

## Context menus

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 44 | List row menu | done | Device: Play Sound, Directions (row 36), Remove This Device. Me: Go to Current Location, Directions dimmed. The screenshot predates row 36, when the device's Directions was dimmed. [Row menu](#project-artifact/art_1b41e533eee452a3/5) |
| 45 | Map marker menu | done | The same device commands; this browser's blue dot has none. [Marker menu](#project-artifact/art_1b41e533eee452a3/6) |

Context menus: 2 rows; 2 done.

## Keyboard shortcuts

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 46 | Arrow keys in the list | done | Up and Down move the selection, and the card follows. [Map types](#project-artifact/art_1b41e533eee452a3/8) shows the result. |
| 47 | Delete removes a device | done | Delete key and Edit > Delete, after an alert; dimmed on this browser, saying why. Applies to Remove This Device as well. [Alert](#project-artifact/art_1b41e533eee452a3/2) |
| 48 | ⌘1 and ⌘2 switch lists | done | [View menu](#project-artifact/art_1b41e533eee452a3/4) |

Keys: 3 rows; 3 done.

## Drag and drop

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 49 | Drag the map | done | Carries what is on it with the pointer. `find-my-rows-journey`. [Dragged](#project-artifact/art_3f7380b0451dc3ac/190) |
| 50 | Drop a contact on Share My Location | built-unchecked | Shares with each dropped card's account, and names a card that has none. Driven with a synthetic DataTransfer and a routed card list. `find-my-people-journey` |

Drag: 2 rows; 1 done, 1 built-unchecked.

## Multi-selection

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 51 | Several devices: remove | done | ⌘-click, Select All; menu says Remove 2 Devices; alert first; this browser is left out. Play Sound asks each. [Several selected](#project-artifact/art_1b41e533eee452a3/7) |

Multi-selection: 1 row; 1 done.

## Saved state

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 52 | Devices on the server | done | Forgotten after 7 days. After a reload the server still holds all three before the window reports again. `find-my-rows-journey`. [After a reload](#project-artifact/art_3f7380b0451dc3ac/193) |
| 53 | Last list, selection and map | done | All three survive a reload, and the browser's position does not move a kept map. [After a reload](#project-artifact/art_3f7380b0451dc3ac/26) |

Saved state: 2 rows; 2 done.

## Cross-app

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 54 | Got from the App Store | done | Not on a new desktop; Get installs it in the account's library and Open opens it. `find-my-rows-journey`. [Got](#project-artifact/art_3f7380b0451dc3ac/192) |
| 55 | Directions in Maps | done | As row 36. [In Maps](#project-artifact/art_3f7380b0451dc3ac/28) |
| 56 | Contacts and Messages for a person | built-unchecked | Contact and Message on the person's card and menu. `find-my-people-journey` drives Message. |
| 57 | Notification Center | built-unchecked | A share, an ask and a fired rule reach the other person's inbox. `tests/find_my_people.rs` |
| 58 | Spotlight finds a device | done | Lists another browser's report under Devices and opens it, chosen among them. `media-spotlight-journey`. [Spotlight](#project-artifact/art_3f7380b0451dc3ac/199) |
| 59 | Dock menu | done | `media-dock-journey`. [Dock menu](#project-artifact/art_3f7380b0451dc3ac/198) |

Cross-app: 6 rows; 4 done, 2 built-unchecked.

## Build items, most-used first

1. **Menus and keys:** lists, zoom, location, Delete. Rows 16-17, 19-20, 47-48.
2. **Row and marker menus,** with Play Sound, Directions, Remove. Rows 44-45, 51.
3. **Directions in Maps,** after Maps' directions land. Rows 36, 55.
4. **Mark As Lost and Notify When Found.** Rows 34, 37, 57.
5. **Erase** with confirmation. Row 35.
6. **Sharing between accounts,** consent and tests first. Rows 9, 27, 33, 38-40, 50, 56.
7. **Keep the view, Spotlight, Dock.** Rows 53, 58-59.
8. **Unavailable rows with reasons.** Rows 2, 10-15, 18, 26, 41-42, 46.

## Counts (by hand)

59 rows: 41 done, 16 built-unchecked, 2 partial, 0 missing. Done means seen in Chromium; Firefox, WebKit and a real Mac's Command key were not run. Rows 3 and 26 stay partial: Services has nothing to offer, and Help opens the guide's welcome page.
