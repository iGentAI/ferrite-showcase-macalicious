# Feature inventory: Notification Center

Main commit read: `e62c2ac9` (29 October 2026), from GitHub only. Nothing was run. Open ledger items are carried in the rows marked "Ledger".

Sources read: `demos/desktop/desktop-notifications.tsx`, `desktop-menus.tsx`, `desktop.mdx`; `desktop-overlays-census-journey.mjs`; the head of `notifications-journey.mjs`; the desktop README's Notification Center section; the open work ledger, version 3. Not read: `desktop-live.ts`, `src/apps/notification_center/`. The real app's list comes from knowledge of macOS 10.15.

Status key: **missing**, **partial** (the note says what is absent), **built-unchecked** (in main's code, not seen running for this inventory). Nothing is done until it is checked in a browser with a screenshot.

**Counts: 48 rows: 38 done, 8 built-unchecked, 2 partial.**

This is the deepest of the shell apps: live delivery, Do Not Disturb, banners and widgets are all in main's code.

## Panel (6: 4 done, 1 built-unchecked, 1 partial)

| Item | Status | Main |
| --- | --- | --- |
| Opens from the menu bar extra | done | [The panel](#project-artifact/art_a7e016210b9b9bc1/546): `e2e/notification-rows-journey.mjs` |
| Escape or a press beside it closes | done | Both, same journey |
| Today and Notifications tabs | done | [Notifications](#project-artifact/art_a7e016210b9b9bc1/549) and [Today](#project-artifact/art_a7e016210b9b9bc1/546), same journey |
| Option-click the extra: Do Not Disturb | done | [The extra dimmed and the panel not opened](#project-artifact/art_a7e016210b9b9bc1/545), same journey |
| Swipe in from the screen's edge | partial | **Limit:** the operating system takes a two-finger swipe from the trackpad's edge, and a browser reports it to a page at most as scrolling, with nothing to say where it began. The menu bar extra and the assigned key open it |
| Assignable keyboard shortcut | built-unchecked | System Preferences > Keyboard > Shortcuts, Show Notification Center: a function key or none, kept on the server. It opens and closes the panel, after a reload as well: `e2e/desktop-batch3-journey.mjs`. F3 and F4 stay Mission Control's and Launchpad's |

## Today (13: 10 done, 3 built-unchecked)

| Item | Status | Main |
| --- | --- | --- |
| Date | done | [At the head of Today](#project-artifact/art_a7e016210b9b9bc1/546): `e2e/notification-rows-journey.mjs` |
| Summary with count and next event | built-unchecked | [The count](#project-artifact/art_a7e016210b9b9bc1/546), same journey. “The next thing on your calendar is…” with the event's title and time, read from a saved event: `e2e/spotlight-people-journey.mjs`; screenshot not yet published |
| Do Not Disturb switch | done | Same journey, and heard by the person's other browser: `e2e/notifications-journey.mjs` |
| Calendar widget, Up Next | done | [Shows the event saved](#project-artifact/art_a7e016210b9b9bc1/555): `e2e/notifications-journey.mjs` |
| Reminders widget | done | Same picture, same journey |
| Stocks widget | done | Same picture and journey, with a live quote where egress reaches one |
| Weather widget | built-unchecked | On by default, as on a Mac. Choose Places… finds places by name, up to four, kept per account, and Use My Location asks the browser, read again only while the browser says it is granted. Each row has the temperature in Language & Region's unit, the condition, high and low, three days, and “Open-Meteo, as of <time> local time”. A source that is down says so with Try Again; a reading of the last 3 hours stands under its own time. Read against Open-Meteo directly: `e2e/weather-rates-batch13-journey.mjs` (the browser's position is Playwright's emulated one; run in Chromium, Firefox and WebKit). With no usable position, including Playwright WebKit's NaN coordinates, the widget says “Your location is not available right now.”, keeps Use My Location and asks the server nothing. Screenshot not yet published. Open-Meteo stands in for the Mac's Weather Channel, whose feed is not free, and a row opens nothing, where a Mac's opens weather.com |
| World Clock widget | done | [A face and the difference for each city](#project-artifact/art_a7e016210b9b9bc1/311), and [Choose Cities… finds any of the browser's zones by name, up to four](#project-artifact/art_a7e016210b9b9bc1/344), kept on the server and after a reload: `e2e/notification-depth-journey.mjs`. The widget's own button, not the back of a Mac's widget |
| Calculator widget | done | [Works a sum out on the Calculator application's arithmetic](#project-artifact/art_a7e016210b9b9bc1/311), off until added, as on a Mac: `e2e/today-widgets-journey.mjs` |
| Tomorrow summary | done | A line of its own at the end of Today, read from the person's events: `e2e/today-widgets-journey.mjs` |
| Edit: add, remove and reorder widgets, saved | done | [Edit, with what can be added beside the panel](#project-artifact/art_a7e016210b9b9bc1/312): add, remove, drag, Option-Up, kept across a reload, shared with System Preferences > Extensions > Today: `e2e/today-widgets-journey.mjs`, `e2e/extensions-today-journey.mjs` |
| A row opens its item | built-unchecked | [A row opens its application and asks it for the item](#project-artifact/art_819e645e9197a100/49), `e2e/notification-open-journey.mjs`. Reminders then has that reminder selected: `e2e/desktop-batch3-journey.mjs`. Calendar takes the request in its code (`useOpenItemRequests` in `calendar.tsx`); that it shows the event from here was not seen |
| Night Shift switch | done | Warms this page, the same setting as Displays, since a page cannot change the screen: `e2e/today-widgets-journey.mjs` |

## Notifications list (9: 7 done, 1 built-unchecked, 1 partial)

| Item | Status | Main |
| --- | --- | --- |
| Live list grouped by app | done | [Grouped by application](#project-artifact/art_a7e016210b9b9bc1/549): `e2e/notification-rows-journey.mjs` |
| Clear a group | done | Read back from the server, same journey |
| Clear one | done | Read back from the server, same journey. [In every browser of the person](#project-artifact/art_a7e016210b9b9bc1/554): `e2e/notifications-journey.mjs` |
| Opening a notification | built-unchecked | Opens its application and shows the item: Mail's message in its mailbox, a Messages conversation or the room, a Chess game, a Calendar event, a shared note or shared list (told of it, or told someone left it), Find My's people list, the symbol of a Stocks price alert, a Podcasts episode's show, and a reminder's alert. Pressing an alert's body opens it as a banner's does, and its buttons do only their own work. Banners stand beside the alert Calendar's own window shows, so they can be pressed. FaceTime opens on its recents. A Calendar invitation shows its event once the inbox has been read (`askedEvent` in `calendar.tsx`). A reply or cancellation opens Calendar only: a reply's token is a digest that names no event the window knows; a cancellation has no event left. `open-items-batch6-journey`, `notification-ids-batch6-journey`; Podcasts by `podcasts-server.test.tsx`, because a real notification needs a feed publishing after the person last looked |
| An alert's actions in the list | done | [Decline, on a FaceTime call](#project-artifact/art_a7e016210b9b9bc1/553): `e2e/notification-alert-journey.mjs`, between two accounts. A person's call ends for the caller |
| No Notifications | done | [The list empty](#project-artifact/art_a7e016210b9b9bc1/550): `e2e/notification-rows-journey.mjs` |
| Order by app or by time, as set in Preferences | built-unchecked | [Recents, the newest first](#project-artifact/art_a7e016210b9b9bc1/551), against Recents by App, same journey, with the setting written to the server. The pane's own pop-up: `e2e/system-preferences-panes-more-journey.mjs` |
| The inbox survives a reload | done | Same journey |
| Says when an action failed | done | [The words beside the button](#project-artifact/art_a7e016210b9b9bc1/553), and tried again it works: `e2e/notification-alert-journey.mjs`. The server's failure is a stand-in in the browser's route, the second answer the real one |

## Banners and alerts (9: 9 done)

| Item | Status | Main |
| --- | --- | --- |
| Banner stays 5 seconds, at most 3 | done | [Three of four shown](#project-artifact/art_a7e016210b9b9bc1/547), gone after about 4.7 seconds in the journey's clock: `e2e/notification-rows-journey.mjs` |
| Alert stays until acted on | done | [Past a banner's time](#project-artifact/art_a7e016210b9b9bc1/552): `e2e/notification-alert-journey.mjs`; Reminders' own alert: `e2e/notification-rows-journey.mjs` |
| Options pull-down with two actions | done | [Decline and Answer](#project-artifact/art_a7e016210b9b9bc1/552), same journey |
| Do Not Disturb holds them back | done | The banner held and the item still listed: `e2e/notification-rows-journey.mjs` |
| Cleared elsewhere leaves the screen | done | Same journey |
| Show opens the app | done | [Its window comes](#project-artifact/art_a7e016210b9b9bc1/548), same journey |
| Dismiss a banner | done | Close, or [dragged to the right](#project-artifact/art_a7e016210b9b9bc1/502): let go short it comes back, far enough it goes, and stays in Notification Center: `e2e/notification-depth-journey.mjs` |
| Act in place: reply to a message, Later | done | [Reply on a message's banner](#project-artifact/art_a7e016210b9b9bc1/343): the banner stays while the person types, Return or Send delivers it to the other person's conversation and clears it, Cancel or Escape leaves it. `e2e/notification-depth-journey.mjs`, between two accounts. A conversation of a room has no Reply. Reminders' actions are as before |
| Sound | done | The sound chosen in Sound, from `playAlert`: a tone is made for a notification that comes in and none under Do Not Disturb, counted in the browser since a page cannot hear itself. Same journey |

## Who sends (6: 4 done, 2 built-unchecked)

| Item | Status | Main |
| --- | --- | --- |
| Messages | done | Delivered between two accounts as a banner and a row: `e2e/notifications-sender-journey.mjs`, `e2e/notifications-journey.mjs` |
| A finished download | done | Raised by the page and reaching every browser, [in the list](#project-artifact/art_a7e016210b9b9bc1/554): `e2e/notifications-journey.mjs` |
| Reminders alerts | built-unchecked | Raised by the person's live stream (`src/live.rs`, `raise_due_alerts` in `src/apps/reminders/mod.rs`) with no Reminders window open, as an alert with Close and Complete, or Show on a reminder that repeats: `e2e/list-reminders-batch6-journey.mjs`, screenshot not yet published. A Reminders window open tells the module what it shows itself (`POST /alerts/shown`) and the notification is taken back, as Calendar's. A shared list's alerts, the Today notification and At a Location are the window's alone, since the server arms none of them |
| Calendar alerts | done | [Under the menu bar, the closed one staying closed after a reload](#project-artifact/art_a7e016210b9b9bc1/556): `e2e/calendar-alerts-journey.mjs` |
| Mail, FaceTime, App Store and the rest | built-unchecked | FaceTime's calls are checked: `e2e/notification-alert-journey.mjs`. Mail: `e2e/open-items-batch6-journey.mjs`. Shared notes and lists, Find My's people and Stocks' price alerts, each delivered and opened: `e2e/notification-ids-batch6-journey.mjs`. Podcasts' new episodes from NPR's real feed told, the banner pressed and the show opened: `e2e/small-rows-batch12-journey.mjs`. The App Store raises none: nothing in its code sends one |
| README's account of the panel | done | Now says what the code does |

## Settings and data (5: 4 done, 1 built-unchecked)

| Item | Status | Main |
| --- | --- | --- |
| Do Not Disturb kept for the person | done | After a reload: `e2e/notification-rows-journey.mjs` |
| Reaches all the person's browsers | done | Banners, clearing and Do Not Disturb, between two browsers of one account: `e2e/notifications-journey.mjs` |
| Do Not Disturb schedule | done | Kept and followed by System Preferences (`setting-effects.ts`): turned on inside its times it turns Do Not Disturb on, banners and sound stop, the message still collects, and the person's own switch stands. `e2e/notification-depth-journey.mjs`. An edge passing while no page is open is not caught up on load, and an edge passing with a page open is unit-tested, not driven here |
| Notifications pane's per-app choices take effect | done | [Messages turned off in the pane](#project-artifact/art_a7e016210b9b9bc1/557); the next message reaches the window with neither banner nor row: `e2e/notifications-sender-journey.mjs` |
| Storage Management listing | built-unchecked | The README now says this inbox is counted but not offered for forgetting, as `DOCUMENTS` has it; the note is closed by the system apps lane |

## Build items, most used first

1. **N1 Open the item.** A notification, a widget row and Show open the thing itself through C2's `openItem`.
2. **N2 Today depth.** Edit mode with saved choices, World Clock, Calculator, Tomorrow line, Weather from a free source.
3. **N3 Acting in place.** Inline reply for Messages, sound, per-app Notifications pane takes effect: banner, alert or none, badges, order.
4. **N4 Do Not Disturb depth.** Schedule, Night Shift.
5. **N5 Delivery sweep and docs.** Check each app delivers what its Mac version does and tell its worker where it does not. Correct the README's section. The ledger's Storage Management note goes with the system apps work.
