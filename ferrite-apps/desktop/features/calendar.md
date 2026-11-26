# Feature inventory: Calendar

Read from GitHub, main commit `e62c2ac9`. Nothing was built or run for this inventory, and the shared tree was not read.

**Status.** `missing`: main has nothing for it. `partial`: main has some of it, and the note says what is absent. `built-unchecked`: main's code has it, and nobody has checked it in a browser for this inventory. No row says done. A row becomes done only with a screenshot of it working in the running app.

**Source of the real app's list.** The menu items and shortcuts are written from knowledge of Calendar on macOS 10.15. They were not checked on a Mac, or against the reference screenshots, because the tree is stale. Fix a wrong row when it is found.

**Files read.** `demos/calendar/`: `app.ts`, `calendar.tsx` (its menus, keys and state), `calendar.mdx`, `calendar-settings.ts`. `demos/desktop/`: `desktop-menus.tsx`, `desktop-app-menus.ts`. Also the open work ledger.

**How the menu bar works.** `app.ts` names six menus and no Edit, View or Window items of Calendar's own. Calendar registers only File, so Edit shows the desktop's dimmed rows, and View only Enter Full Screen. `mdx` calls the month and year views composed, "not Calendar's own month and year grids".

## Counts

| Section | Rows | done | built-unchecked | partial | missing |
| --- | --- | --- | --- | --- | --- |
| Calendar menu | 8 | 6 | 2 | 0 | 0 |
| File menu | 14 | 12 | 2 | 0 | 0 |
| Edit menu | 16 | 11 | 5 | 0 | 0 |
| View menu | 16 | 14 | 2 | 0 | 0 |
| Window menu | 8 | 5 | 3 | 0 | 0 |
| Help menu | 2 | 0 | 2 | 0 | 0 |
| Preferences window | 4 | 0 | 4 | 0 | 0 |
| Views | 7 | 7 | 0 | 0 | 0 |
| Toolbar | 6 | 6 | 0 | 0 | 0 |
| Sidebar | 7 | 6 | 1 | 0 | 0 |
| Event popover | 16 | 14 | 2 | 0 | 0 |
| Context menus | 4 | 3 | 1 | 0 | 0 |
| Keyboard | 8 | 7 | 1 | 0 | 0 |
| Drag and grid gestures | 11 | 7 | 4 | 0 | 0 |
| Multi-selection | 3 | 3 | 0 | 0 | 0 |
| Saved state | 4 | 4 | 0 | 0 | 0 |
| iCalendar and ledger | 6 | 4 | 2 | 0 | 0 |
| Cross-app | 13 | 4 | 8 | 1 | 0 |
| **Total** | **153** | **113** | **39** | **1** | **0** |

## Menus

### Calendar menu

| Item | Status | Note |
| --- | --- | --- |
| About Calendar | done | [The window](#project-artifact/art_0ec4ebf78af349f9/93). Desktop's item. `calendar-rows-journey`. |
| Preferences… ⌘, | done | [The second window](#project-artifact/art_0ec4ebf78af349f9/116). Item and key. `calendar-rows-journey`. |
| Accounts… | built-unchecked | Opens System Preferences on Internet Accounts, as Mail's does. `calendar-batch-journey` (below). |
| Services | built-unchecked | The map was stale: the desktop's Services submenu lists what applies to the selected text, and says why when nothing does (`ServicesItems`, `desktop-menus.tsx`). Row seen in `calendar-batch-journey`; no service was run from Calendar. |
| Hide Calendar ⌘H | done | [Hidden](#project-artifact/art_0ec4ebf78af349f9/102). Item and key. `calendar-rows-journey`. |
| Hide Others ⌥⌘H | done | [Finder's window gone](#project-artifact/art_0ec4ebf78af349f9/103). Item and key. `calendar-rows-journey`. |
| Show All | done | Brings back what Hide Others hid, [same run](#project-artifact/art_0ec4ebf78af349f9/103). `calendar-rows-journey`. |
| Quit Calendar ⌘Q | done | [Its windows closed](#project-artifact/art_0ec4ebf78af349f9/117). Item and key. `calendar-rows-journey`. |

### File menu

| Item | Status | Note |
| --- | --- | --- |
| New Calendar | done | [Asks the name in a sheet](#project-artifact/art_0ec4ebf78af349f9/100), read from the server. `calendar-rows-journey`. |
| Import… | done | [File menu](#project-artifact/art_0ec4ebf78af349f9/98). `.ics` from the computer, read from the server in the calendar shown. `calendar-rows-journey`. |
| Import from Drive… | done | [The drive's panel](#project-artifact/art_0ec4ebf78af349f9/97). Brought a deleted event back, read from the server. Served desktop. `calendar-rows-journey`. |
| Export “name”… | done | [File menu](#project-artifact/art_0ec4ebf78af349f9/98). Downloads the calendar; the file's event read. `calendar-rows-journey`. |
| Save “name” to Drive… | done | [The Save sheet](#project-artifact/art_0ec4ebf78af349f9/101). The file read from the drive. Served desktop. `calendar-rows-journey`. |
| Export Event… | done | [Dimmed with nothing selected](#project-artifact/art_0ec4ebf78af349f9/98), with a reason, then downloads the one selected. `calendar-rows-journey`. |
| Save Event to Drive… | done | [The Save sheet](#project-artifact/art_0ec4ebf78af349f9/101). The file read from the drive. Served desktop. `calendar-rows-journey`. |
| Close Window ⌘W | done | [File menu](#project-artifact/art_0ec4ebf78af349f9/98). Item and key. `calendar-rows-journey`. |
| New Event ⌘N | done | Item checked in `calendar-commands-journey`. A browser may keep Ctrl-N for itself. |
| New Calendar Subscription ⌥⌘S | done | [Subscribed](#project-artifact/art_0ec4ebf78af349f9/52). Asks the address in a sheet; `webcal:` is read as the web. The browser reads the feed, since the application's own requests reach only what its manifest names, so a site has to let other pages read it (CORS) and the window says so when one does not. `calendar-subscription-journey`, also on the hosted site, with a feed the journey itself answers inside the browser: no real outside feed has been read. |
| New Calendar Group ⇧⌘N | done | [Family, with two calendars](#project-artifact/art_0ec4ebf78af349f9/74). `calendar-groups-journey`. |
| Export > Calendar Archive… | built-unchecked | Downloads an `.icbu` holding each of the person's calendars, its colour and its iCalendar text. A browser's download is one file, so it is not Apple's package format and macOS cannot read it. Import, a Finder double click and a drop read it back: it adds to the calendar of that name or makes one, and replaces nothing. `calendar-batch-journey`, read from the server. |
| Export as PDF… | done | [File menu](#project-artifact/art_0ec4ebf78af349f9/98). The browser's print dialog saves the PDF. Same agenda as Print; the page handed to the browser was read. A headless browser shows no dialog, so the dialog itself is unchecked. `calendar-rows-journey`. |
| Print… ⌘P | built-unchecked | Screenshot `cc3-print-sheet`. A sheet as Calendar's: View (Day, Week, Month, List), Starts, Ends, Calendars, All-day events, Timed events, Mini calendar, Calendar keys, Black and white, Text Size and a preview; Continue hands the grid as the view draws it to the browser. Week, Month and the options read from the page in `contacts-calendar-batch3-journey`; Export as PDF… hands the view's grid straight on. A headless browser shows no dialog, so the dialog itself is unchecked. |

### Edit menu

Dimmed desktop rows, "Calendar adds no Edit commands".

| Item | Status | Note |
| --- | --- | --- |
| Delete | done | [Edit menu](#project-artifact/art_3911243b768b7538/2), checked in `calendar-commands-journey`; the keys too. |
| Edit Event ⌘E | done | Item and key; the key checked in the journey. |
| Find ⌘F | done | Item and key; the key checked in the journey. |
| Undo ⌘Z | done | Key checked in `calendar-events-journey`. Each of the person's own changes to events, in this window; another window's change clears it. |
| Redo ⇧⌘Z | done | Key checked in the journey. |
| Cut ⌘X | done | [Event's menu](#project-artifact/art_3911243b768b7538/5), checked in the journey. |
| Copy ⌘C | done | Key checked in the journey. Puts the title on the system clipboard, and the event on Calendar's own. |
| Paste ⌘V | done | Key and [the day's menu](#project-artifact/art_3911243b768b7538/6) checked in the journey. |
| Duplicate ⌘D | done | Key checked in the journey. |
| Select All ⌘A | done | See Multi-selection. |
| Show Inspector ⌥⌘I | done | [The panel](#project-artifact/art_0ec4ebf78af349f9/20). A panel over the window that follows the selection and edits it; drags by its title bar, stays shown after a reload, and edits nothing while the events load. `calendar-fields-journey`, read from the server. |
| Spelling and Grammar | built-unchecked | Submenu and panel, on an event's notes while its field is there; dimmed otherwise. The popover now stays open while the menu bar or the panel is used. Absent: the title, location and URL fields, which are single lines the shared tool does not read. Panel opened in `calendar-batch-journey`; Change and Learn were not pressed here. |
| Substitutions | built-unchecked | Submenu and panel, on an event's notes. A typed quote turned curly in `calendar-batch-journey`; the panel was not opened. |
| Speech | built-unchecked | Speaks the notes field, or the selected event when no field is there; Stop stops. Unit test with a stand-in for the browser's `speechSynthesis`: no voice was heard. |
| Start Dictation | built-unchecked | The desktop's Edit footer: types what the browser's recognizer hears at the insertion point, dimmed with a reason with no field or no recognizer. `e2e/dictation-batch5-journey.mjs`, in other apps, with a stub recognizer. |
| Emoji & Symbols | built-unchecked | The desktop's Edit footer (`desktop-menus.tsx`). |

### View menu

A `partial` here means the act exists in the window and the item and its key do not.

| Item | Status | Note |
| --- | --- | --- |
| By Day ⌘1 | done | Key checked in the journey. |
| By Week ⌘2 | done | Key checked in the journey. |
| By Month ⌘3 | done | Key checked in the journey. |
| By Year ⌘4 | done | Item checked in the journey. |
| Show or Hide Calendar List | done | Item checked in the journey. |
| Next ⌘→ | done | Key checked in the journey. |
| Previous ⌘← | done | Key checked in the journey. |
| Go to Today ⌘T | done | Item checked in the journey. A browser keeps Ctrl-T for a new tab. |
| Show Alternate Calendar | built-unchecked | View's submenu and Preferences choose None, Chinese, Hebrew or Islamic. Each day's date in that calendar shows on the week and day headings and in the month's days, read from the browser's own calendars, and is kept after a reload. `calendar-batch-journey` for Hebrew on the week; the others by unit test. |
| Show Declined Invitations | done | [A declined event back](#project-artifact/art_0ec4ebf78af349f9/94). In View and in the list's contextual menu. `calendar-rows-journey`. |
| Go to Date ⇧⌘T | done | [The sheet](#project-artifact/art_3911243b768b7538/3); key checked in the journey. |
| Refresh Calendars ⌘R | done | [Another browser's change](#project-artifact/art_0ec4ebf78af349f9/124). Reads the person's calendars again: a change stored elsewhere appears, by the item and by the key, and the page does not reload. `calendar-rows-journey`. |
| Time Zone Support | built-unchecked | Preferences > Advanced turns it on. An event's popover shows and changes its zone, with Floating. The toolbar's menu draws the whole window on another zone's clock, kept in this browser across a reload; a new event is stored at that clock's instant; all-day and floating events do not move. `calendar-zones-journey`, `calendar-zones.test.ts`, `calendar-reminders-batch4-journey`. |
| Make Text Bigger ⌘+ | done | [The month view's text and event rows](#project-artifact/art_0ec4ebf78af349f9/54), a point at a time up to three, kept with the person's settings. Absent: week and day views' text. `calendar-text-journey`. |
| Make Text Smaller ⌘- | done | One point below the normal size; its key driven. `calendar-text-journey`. |
| Enter Full Screen ⌃⌘F | done | [Full screen](#project-artifact/art_0ec4ebf78af349f9/126). The item, and Exit brings back its size. The key names Control and Command, which match only on Apple platforms, so it was not pressed. `calendar-rows-journey`. |

### Window menu

| Item | Status | Note |
| --- | --- | --- |
| Minimize ⌘M | done | [In the Dock](#project-artifact/art_0ec4ebf78af349f9/110). Item and key. `calendar-rows-journey`. |
| Zoom | done | [Zoomed](#project-artifact/art_0ec4ebf78af349f9/128), and again brings back its frame. `calendar-rows-journey`. |
| Bring All to Front | done | [Over Calculator](#project-artifact/art_0ec4ebf78af349f9/92), read from the windows' order. `calendar-rows-journey`. |
| Open windows list | done | [Both windows named](#project-artifact/art_0ec4ebf78af349f9/127); a row brings its window forward. `calendar-rows-journey`. |
| Tile Window | built-unchecked | Shared desktop menu, Tile Window to Left and Right of Screen (`desktop-menus.tsx`). |
| Calendar | done | [The menu](#project-artifact/art_0ec4ebf78af349f9/127). Item and ⌘0 bring it forward from Preferences. Registered in one list with Availability Panel and Address Panel: a second list of Window had replaced this row. `calendar-rows-journey`, `apps-window-menu-journey`. |
| Availability Panel | built-unchecked | Dimmed with its reason: this desktop does not share free and busy times between accounts. `calendar-batch-journey`. |
| Address Panel ⌥⌘A | built-unchecked | The person's contacts with an account, searched by name, each with Invite for the selected event; dimmed with its reason otherwise. Opened in `calendar-batch-journey`; Invite has no browser or unit run behind it. |

### Help menu

| Item | Status | Note |
| --- | --- | --- |
| Calendar Help | built-unchecked | The map was stale: the row asks Help Viewer for Calendar's help (`desktop-menus.tsx`). Seen in `calendar-batch-journey`; not chosen. |
| Search field | built-unchecked | The map was stale: the Help menu's search (`HelpMenuSearch`). Seen in `calendar-batch-journey`; nothing searched. |

## Preferences window

| Item | Status | Note |
| --- | --- | --- |
| General | built-unchecked | Every control acts. Scroll in week view by steps the arrows and a sideways scroll: Day (the date shown goes first), Week, and Week, Stop on Today, which ends a scroll on today's week (unit tests). Day starts and ends at shade the hours outside the day on the desktop (`calendar-batch-journey`; the capture's window draws no shade). Alternate calendar acts; Help asks Help Viewer. Default calendar app lists Calendar alone, the only one a desktop has. |
| Accounts | built-unchecked | Says the calendars are kept with the account here and others cannot be added, with Internet Accounts…, which opens that pane. Unit test covers the words; the button has no run behind it. |
| Alerts | built-unchecked | Account lists On This Desktop, the one account. Events, All Day Events and Birthdays as before. Time to Leave stays dimmed with its reason: it needs a map service's trip times. Unit test. |
| Advanced | built-unchecked | Show events in year view, Show week numbers and Open events in separate windows (in the Inspector, a panel of this window) act, by unit tests. Ask before sending changes is dimmed with its reason: a change reaches those invited as soon as it is saved. |

## Windows and views

### Views

| Item | Status | Note |
| --- | --- | --- |
| Week | done | [Seven days](#project-artifact/art_0ec4ebf78af349f9/125), and [five](#project-artifact/art_0ec4ebf78af349f9/119), per the preference. `calendar-rows-journey`. |
| Current-time line | done | [At the clock's minute](#project-artifact/art_0ec4ebf78af349f9/125), its place read against the real clock. `calendar-rows-journey`. |
| All-day row | done | [An all-day event in it](#project-artifact/art_0ec4ebf78af349f9/125). `calendar-rows-journey`. |
| Mini month | done | [Sidebar footer](#project-artifact/art_0ec4ebf78af349f9/108). Its arrow changes month, and a day chosen shows in the view. `calendar-rows-journey`. |
| Day | done | [Details beside the day](#project-artifact/art_0ec4ebf78af349f9/19). The week grid with one day, beside a pane with the selected event's details, which edit it, or the day's list. A double click still opens the popover, and the pane rests while it is open. `calendar-views-journey`, read from the server and after a reload. |
| Month | done | [Grid with events in its days](#project-artifact/art_3911243b768b7538/4), checked in `calendar-month-journey`. An event of several days is drawn in each day, not as one bar; "more" opens the day. |
| Year | done | [Days shaded](#project-artifact/art_0ec4ebf78af349f9/21). Twelve mini months, each day shaded yellow to red by how many events it has, with the count in its tip. `calendar-views-journey`. Today keeps its red disc in place of a shade. |

### Toolbar

| Item | Status | Note |
| --- | --- | --- |
| Calendars | done | [The list hidden](#project-artifact/art_0ec4ebf78af349f9/122), and shown again. `calendar-rows-journey`. |
| Plus, New Event | done | [Its popover](#project-artifact/art_0ec4ebf78af349f9/111). The event read from the server. `calendar-rows-journey`. |
| Day, Week, Month, Year switcher | done | [Week pressed](#project-artifact/art_0ec4ebf78af349f9/125); each press read back. `calendar-rows-journey`. |
| Previous, Today, Next | done | [The buttons](#project-artifact/art_0ec4ebf78af349f9/125); each moves the week, read back. `calendar-rows-journey`. |
| Search field and results list | done | [By its notes](#project-artifact/art_0ec4ebf78af349f9/123). Title, location, notes; other words find none. `calendar-rows-journey`. |
| Quick Event, typing "Lunch at noon" under a held plus | done | [The field](#project-artifact/art_0ec4ebf78af349f9/23). Held for a third of a second, or File > Quick Event… ⌥⌘N. Reads times, dates, ranges, lengths and "at Place"; what reads as a date and is none stays in the title. `calendar-quick-event-journey`, read from the server and after a reload. |

### Sidebar

| Item | Status | Note |
| --- | --- | --- |
| iCloud and Other sections | done | [The list](#project-artifact/art_0ec4ebf78af349f9/125). `calendar-rows-journey`. |
| Checkboxes that hide a calendar | done | [Work unticked](#project-artifact/art_0ec4ebf78af349f9/120); its events go and come back. `calendar-rows-journey`. |
| Invitations calendar | done | [Listed for the person invited](#project-artifact/art_0ec4ebf78af349f9/105), with the event in the view. Served desktop. `calendar-rows-journey`. |
| Birthdays | done | [On its day](#project-artifact/art_3911243b768b7538/12): the cards of Contacts whose birthday can be read as a date, each year; `calendar-birthdays-journey`. Text it cannot read shows nothing. |
| Holidays | built-unchecked | On the desktop, thirteen US holidays worked out for the year shown and those beside it, from each one's rule (Rosh Hashanah and Yom Kippur from the browser's Hebrew calendar); read-only, and saying so. Not subscribed from the network, which needs an egress the application does not have. Found by search in `calendar-batch-journey`. |
| Calendar groups | done | [Same screenshot](#project-artifact/art_0ec4ebf78af349f9/74). Own calendars only, moved in by the list's menu or by dragging; the checkbox shows or hides them together. Kept with the person's settings. `calendar-groups-journey`. |
| Subscribed calendars | done | [Club, with its mark and event](#project-artifact/art_0ec4ebf78af349f9/52). Listed under Other with the subscription mark; Rename, Color and Unsubscribe in the list's menu; events read-only, never saved with the person's own, read again on opening, each hour and on Refresh Calendars ⌘R. The list is kept with the person's settings. Absent: an auto-refresh choice and alerts of subscribed events. Limit: of two reads of one feed overlapping, the last to finish wins until the next read. A feed that cannot be read when the window opens, or at the hourly read, keeps what was read of it while the page lives and an alert says why, once until it can be read again. |

### Event popover

| Item | Status | Note |
| --- | --- | --- |
| Title | done | [The popover](#project-artifact/art_0ec4ebf78af349f9/111), read from the server. `calendar-rows-journey`. |
| Location | done | [The popover](#project-artifact/art_0ec4ebf78af349f9/111), read from the server. Text only. `calendar-rows-journey`. |
| Calendar menu | done | [Moved to Work](#project-artifact/art_0ec4ebf78af349f9/111), read from the server. `calendar-rows-journey`. |
| All-day | done | [Ticked](#project-artifact/art_0ec4ebf78af349f9/112), and off again, read from the server. `calendar-rows-journey`. |
| Starts and Ends | done | [The fields](#project-artifact/art_0ec4ebf78af349f9/114). Starts moves the event whole, Ends makes it longer, read from the server. `calendar-rows-journey`. |
| End repeat | done | [After 3](#project-artifact/art_0ec4ebf78af349f9/114). Never, after a number, on a date, each read from the server. `calendar-rows-journey`. |
| Invitees | built-unchecked | [Asked, and Accepted after Refresh Calendars](#project-artifact/art_0ec4ebf78af349f9/190). Account name. Accept and Decline reach the organizer, read from the server. The name lost in about two runs of six is fixed: reproduced at 3 of 12 with no wait after a change from elsewhere (name gone from the popover and the server, no message). A name arrives after an await, so React rendered it in a later task, and a load's reply in between replaced the events; `calendar-invitees.tsx` now renders and saves it in its own task. `pim-batch5-journey` asks ten times with no wait and reads each from the server. Served desktop. `calendar-rows-journey`. |
| Notes and URL | done | [The URL a link](#project-artifact/art_0ec4ebf78af349f9/111), both read from the server. `calendar-rows-journey`. |
| Delete one or all future occurrences | done | [The alert](#project-artifact/art_0ec4ebf78af349f9/188), its three titles inside it at 620 points. One removed, then the series ended there, read from the server. `calendar-rows-journey`. |
| Move one or all occurrences | done | [The alert](#project-artifact/art_0ec4ebf78af349f9/115). Only This Event and All Events, read from the server. `calendar-rows-journey`. |
| Repeat | done | [Interval and weekdays](#project-artifact/art_3911243b768b7538/7), checked after a reload in `calendar-grid-journey`. |
| Alert | built-unchecked | [Snooze](#project-artifact/art_0ec4ebf78af349f9/22). Default alerts from Preferences, and Snooze on an alert (5 minutes to 1 day), saved with the event, coming back at its moment; `calendar-default-alerts-journey`. One event keeps one snooze: snoozing a second occurrence replaces the first's. With no Calendar window open, while the person has a desktop open or when they next do while the event lasts: the server raises a single event's alert, and a snoozed one, through Notification Center within about ten seconds of its moment (`pim-batch5-journey`, `calendar/alerts.rs` unit tests); the desktop shell lays out a repeating or floating event's, a birthday's and an accepted invitation's as the window does, in the browser's own zone, and names what is due to `POST /api/calendar/alerts/raise` (`calendar-alert-watch.ts`). One notification per occurrence: another browser, the server's pass or the window raise it no second time, and the window tells the server what it shows. Close and Snooze (five minutes) on the notification are saved with the event, or beside the document for a birthday or an invitation (`GET /alerts/others`), which the window reads too. A notification the shell raises says the time of day; one the server finds itself says how far off the event is, as it does not know the person's zone. `e2e/cross-batch7-journey.mjs`, `calendar-alert-watch.test.ts`. |
| Travel time | done | [Above the event](#project-artifact/art_0ec4ebf78af349f9/18). None to 2 hours, stored, drawn as a dotted block above the event in the week and day views. It does not move the alert. `calendar-fields-journey`. |
| Attachments | done | [A file on an event, with its zone](#project-artifact/art_0ec4ebf78af349f9/75). Add Attachment… or files dropped on the popover, up to 10 MB each and 20 on an event; each name downloads the file, and Remove takes it off. Kept across a reload. Not given to invitees. `calendar-zones-journey`. Limits as Mail's: bytes stay on the server after an event or a file goes. |
| Show As, busy or free | done | [A free event striped](#project-artifact/art_0ec4ebf78af349f9/18). Stored; a free event is striped in the views. Every new event starts busy, all-day ones too. `calendar-fields-journey`. |
| Time zone per event | done | [Same screenshot](#project-artifact/art_0ec4ebf78af349f9/75). Changing it keeps the clock reading, so the event moves in time. Kept across a reload. The date fields stay on the browser's clock, and the zone's own reading shows beneath. `calendar-zones-journey`. |

## Context menus

| Item | Status | Note |
| --- | --- | --- |
| Calendar list | done | [After the color](#project-artifact/art_0ec4ebf78af349f9/109). New Calendar, Rename…, Color, Delete, Import, Export, Show Declined, each read back. `calendar-rows-journey`. |
| Event (Get Info, Cut, Copy, Duplicate, Delete) | done | [Screenshot](#project-artifact/art_3911243b768b7538/5), `calendar-events-journey`. Mail Event is not offered yet (Cross-app). |
| Empty grid (New Event, New All-Day Event, Paste) | done | [Screenshot](#project-artifact/art_3911243b768b7538/6), month view checked in the journey; the week grid's hour under the pointer has only code behind it. |
| Mini month day and day headings | built-unchecked | New Event, New All-Day Event, Paste and Show Day; a day not shown is brought into view. Show Day on a mini month's day in `calendar-batch-journey`; a heading by unit test. |

## Keyboard

| Item | Status | Note |
| --- | --- | --- |
| ⌘, Preferences | done | [The window](#project-artifact/art_0ec4ebf78af349f9/116). `calendar-rows-journey`. |
| Delete and Backspace | done | [After both](#project-artifact/art_0ec4ebf78af349f9/107), read from the server. `calendar-rows-journey`. |
| Return opens the popover | done | [The popover](#project-artifact/art_0ec4ebf78af349f9/111). `calendar-rows-journey`. |
| Escape closes the popover | done | [After it](#project-artifact/art_0ec4ebf78af349f9/107). `calendar-rows-journey`. |
| Mini month's arrows, Home, End, Page Up, Page Down | done | [Mini month](#project-artifact/art_0ec4ebf78af349f9/108). Each key moves the keyboard to the day it should, read from the focused day. `calendar-rows-journey`. |
| The menu items' keys above (⌘N, ⌘1 to ⌘4, ⌘←, ⌘→, ⌘T, ⇧⌘T, ⌘F, ⌘E, ⌘R) | built-unchecked | All bound. ⌘R now also reads subscribed calendars again, as the item does. Those the journeys pressed are done in their rows; ⌘N and ⌘T a browser may keep for itself. |
| Arrow keys that move a selected event | done | [Moved in the week](#project-artifact/art_0ec4ebf78af349f9/107). Down a quarter of an hour and a day to the side, read from the server. The month view's week step and a repeating event's question were not pressed in this run. `calendar-rows-journey`. |
| Tab between events | done | [Selected](#project-artifact/art_0ec4ebf78af349f9/107). Tab selects the next in time and Shift-Tab the one before. Past either end was not pressed in this run. `calendar-rows-journey`. |

## Drag and grid gestures

| Item | Status | Note |
| --- | --- | --- |
| Move and resize in week and day | done | [In the week](#project-artifact/art_0ec4ebf78af349f9/96). Both views, read from the server. `calendar-rows-journey`. |
| All-day event by whole days | done | [A day later](#project-artifact/art_0ec4ebf78af349f9/99), read from the server. `calendar-rows-journey`. |
| Move in the month view | done | [Same screenshot](#project-artifact/art_3911243b768b7538/4); checked after a reload in `calendar-month-journey`. |
| Move to a calendar in the sidebar | done | [Moved to Home](#project-artifact/art_3911243b768b7538/14): an event dragged onto one of the person's calendars goes there with its times, read from the server; onto US Holidays it stays. A repeating event goes whole (no journey for that). `calendar-drop-on-list-journey`. |
| Drag on the empty grid to create an event | done | [Two hours dragged on Wednesday](#project-artifact/art_3911243b768b7538/9). Week and day views, in the day it began in, 15-minute steps; Escape gives it up. `calendar-drag-create-journey`, read from the server and after a reload. |
| Double click on the empty grid to create an event | done | Week and month checked in `calendar-grid-journey`; the all-day row has only code behind it. |
| `.ics` from Finder onto the window | done | Asks where it goes, as Import does; `calendar-open-journey`, read from the server. |
| Event to Finder as `.ics` | built-unchecked | An event dragged out of the window, by a real mouse drag, onto the desktop: `<title>.ics` on the drive, its text read as the event, and the event itself not moved. `contacts-calendar-batch3-journey`. A Finder window, Mail and any other drop target take it the same way and were not driven. No drag image follows the pointer outside the window: the grid's own drag is what is seen. |
| Contact from Contacts onto invitees | built-unchecked | A card with an account dropped on an event's block, or on the invitee field while it is open, invites that account, read from the server in `contacts-calendar-batch3-journey` for the block; a card with only an email is refused with its reason. The field by code only. |
| File onto an event as an attachment | built-unchecked | Onto its popover, and now onto its block in a view, from the computer or the drive; an `.ics` is still an import. From the computer in `calendar-batch-journey`, read from the server; the drive's landing by unit test, its upload not driven. |
| Reordering calendars in the sidebar | built-unchecked | A calendar dragged onto another of the person's goes before it, and into its group; saved with the calendars. `calendar-batch-journey`, read from the server. |

## Multi-selection

| Item | Status | Note |
| --- | --- | --- |
| Selecting several events | done | [Three selected](#project-artifact/art_3911243b768b7538/13): a click with Command or Shift adds or takes off; a plain click leaves one. `calendar-select-several-journey`. |
| Select All | done | Every event the view shows. |
| Moving or deleting several | done | [Several pasted](#project-artifact/art_0ec4ebf78af349f9/17). A drag or an arrow key moves them all, a drop on a calendar in the list takes them there, and Cut, Copy, Paste and Duplicate take them all; each one change for Undo. Paste puts the earliest on the day shown and the others as far from it as they were. Of a repeating event, only the occurrence selected moves, as an event of its own (the drop takes the series; no journey for repeating events). `calendar-several-journey`. |

## Saved state

| Item | Status | Note |
| --- | --- | --- |
| Events and the person's calendars | done | [After a reload](#project-artifact/art_0ec4ebf78af349f9/118). Served desktop. `calendar-rows-journey`. |
| Preferences | done | [Five days after a reload](#project-artifact/art_0ec4ebf78af349f9/118), read from the server. `calendar-rows-journey`. |
| Which calendars are unticked | done | [After a reload](#project-artifact/art_3911243b768b7538/8), `calendar-saved-journey`. In this browser, per account. |
| View and date shown | done | Checked after a reload in the journey, with whether the list is shown. In this browser, per account. |

## iCalendar and ledger

The four `partial` rows marked Ledger were traced by hand in the ledger and need reproducing. They are the ledger's seventh front-end item.

| Item | Status | Note |
| --- | --- | --- |
| Import and export of `.ics` | done | [Imported events](#project-artifact/art_0ec4ebf78af349f9/104). What is exported holds the event and its repeat, and importing it adds nothing. `calendar-rows-journey`. |
| Export content | built-unchecked | Writes alarms, attendees (by account name), attachments' addresses, free or busy and travel time; UIDs are stable, `id@macalicious`, so the note of new UIDs was stale. Import reads back the alert, free or busy and travel time. It never invites anyone, and an attachment's address needs the person's session. Unit tests; the alert and free or busy read from the download in `calendar-batch-journey`. |
| **Ledger:** WKST | done | [Fortnight, a single event](#project-artifact/art_0ec4ebf78af349f9/106). A fortnightly rule whose weeks differ from Sunday's is imported as a single event, and the import says it was simplified; `WKST=MO;BYDAY=SU,MO` driven. `calendar-rows-journey`. |
| **Ledger:** TZID recurrences | done | [Next week's view](#project-artifact/art_0ec4ebf78af349f9/104). A repeat keeps its written days and its zone, read from the server; a Sunday evening in New York shows as Monday 2 AM in a browser on UTC. A zone the browser cannot name has only unit tests. `calendar-rows-journey`. |
| **Ledger:** UID and RECURRENCE-ID exceptions | done | [The moved occurrence](#project-artifact/art_0ec4ebf78af349f9/104). `EXDATE` takes one week's occurrence away and `RECURRENCE-ID` replaces the next. `calendar-rows-journey`. |
| **Ledger:** all-day event stored as an instant | built-unchecked | An all-day event now keeps the zone it was written in, and each browser shows the day that names: written in Tokyo and read in Los Angeles, the page handed to the printer has it on Tokyo's date. `contacts-calendar-batch3-journey`, `calendar-zones.test.ts`, the module's `a_timed_event_keeps_its_zone`. An event saved before this has no zone and reads as before until it is next saved. `repeat.until` stays an instant. |

The Repeat editor, also a ledger item, is in Event popover. The ledger marks the search cap obsolete and the alert across daylight saving done (`3fb6df11`, `eb12273b`).

## Cross-app

| Item | Status | Note |
| --- | --- | --- |
| Invitations in Notification Center | built-unchecked | [Offered to the person invited](#project-artifact/art_0ec4ebf78af349f9/189); Accept in `calendar-rows-journey`; Decline reaches the organizer, read from /api/calendar/sent, and the offer goes, in `calendar-reminders-batch4-journey`. |
| Spotlight finds events | built-unchecked | [Selected in Calendar](#project-artifact/art_0ec4ebf78af349f9/121). Return goes to an event 40 days from the one shown, in `calendar-reminders-batch4-journey`. Dragged onto Finder it lands as an .ics, read from the drive. |
| Drive import and save | done | [The drive's panel](#project-artifact/art_0ec4ebf78af349f9/97). Saved and imported, read from the drive and the server. `calendar-rows-journey`. |
| Invitee picker | partial | [Offers](#project-artifact/art_3911243b768b7538/11): an account name is typed and looked up, and the person's contacts with an account are offered as it is typed; `calendar-invitee-offers-journey` reads the invitation from the server. A card or a typed address of this desktop's own mail (name@macalicious) invites that account, looked up first. **Why partial:** any other address cannot be invited, and each one is named with why, typed (`rows-batch28-journey`) or dropped (unit tests for the words; the drag not driven): invitations go between accounts, and Mail, which would carry one as a message, delivers only to this desktop's accounts, so no invitation by mail is offered, as it could not be sent. |
| Birthdays from Contacts | done | As the Birthdays row. A birthday's popover reads, and says Contacts holds it; Delete leaves it. |
| Siri creates an event | built-unchecked | Siri makes the event on the server, read back there. `e2e/desktop-batch3-journey.mjs`. |
| `.ics` opened from Finder | done | A double click opens Calendar with the import's sheet. [The sheet](#project-artifact/art_3911243b768b7538/10). `calendar-open-journey`. |
| Add to Calendar from Mail | built-unchecked | File > Add to Calendar, dimmed with why on a message with no `.ics`, and an Add to Calendar button on the attachment in the reader. Each puts the file in Downloads, as Open does, and Calendar's import asks where it goes. `pim-batch5-journey` reads the event from the server, across a reload. |
| Mail Event, to invitees | built-unchecked | In the event's menu: a new message with the event's title as subject, one for each person invited, since Mail's request names one address. Dimmed with its reason when nobody is. Unit test reads the request sent; Mail's message was not seen. |
| Location opens in Maps | built-unchecked | Show in Maps in the popover and the event's menu searches Maps for the location; dimmed with its reason when there is none. The menu's row opened Maps in `calendar-batch-journey`. |
| Dock icon with today's date | built-unchecked | Calendar's tile draws today's date and month. `e2e/desktop-batch3-journey.mjs`. |
| Dock icon menu | done | [The new event](#project-artifact/art_0ec4ebf78af349f9/95). New Event, while the window is open, read from the server. `calendar-rows-journey`. |
| Share an event | built-unchecked | Share Event in the event's menu hands the event as an `.ics` to Mail, whose message gets it as an attachment, read in `contacts-calendar-batch3-journey`; Messages and Notes share its path and were not driven. AirDrop stays dimmed: "AirDrop sends to nearby devices, which a web page can't reach." Share in the same menu still offers the event's URL. |

## Calls made

- **`calendar-batch-journey`.** A journey of 23 steps against the served desktop, which passed in Chromium. It and its screenshots are not landed in this batch, so the rows it covers stay `built-unchecked` until a screenshot is published and linked.
- **Off-hours shade.** Only on the served desktop: the reference capture's window shows none, so the visual references are untouched.
- **Scrolling by the day.** The date shown is the week's first day, and Today or a day of the mini month puts that day first.
- **Holidays and subscriptions.** A subscription needs a new egress handle. Listed as missing; the build item decides per feed.
- **Tab between events.** Tab goes through events in time and lets go at either end, so the keyboard is not trapped in the view.
- **The plus.** A click still makes an event at once, as File > New Event does; holding it offers Quick Event, and File > Quick Event… ⌥⌘N does for the keyboard. ⌥⌘N is this desktop's, not Calendar's.
- **Quick Event's guesses.** A date without a time is all-day; neither is the next full hour; a plain hour of 1 to 7 is in the afternoon, and "dinner" or "tonight" makes any plain hour the evening's. It makes the event selected and opens no popover.
- **A birthday's alerts** are kept with the person's settings (`calendar.birthdayAlerts`), since a birthday is Contacts' and not in Calendar's document.

## Build items, most-used first

Each lands as small reviewed commits. Each row changes to done only with a browser screenshot.

1. **View and File commands with keys.** Register View (Day, Week, Month, Year, Calendar List, Next, Previous, Today, Go to Date) and Edit (Delete, Edit Event, Find), and bind ⌘N.
2. **A real month view.** A month grid with events in its cells, opening and moving them.
3. **Event commands.** Cut, Copy, Paste and Duplicate; contextual menus on an event and the empty grid; Undo and Redo.
4. **Making events on the grid.** Double click and drag to create; drag between calendars; Quick Event.
5. **Repeat editor.** Weekdays and an interval, which the model already takes.
6. **iCalendar correctness.** The ledger's WKST, BYDAY, EXDATE and RECURRENCE-ID fixes with corrected tests; reproduce and fix the all-day case.
7. **Multi-selection.** Several events; move and delete together.
8. **Saved window state.** Unticked calendars, view and date.
9. **Alerts.** Default alerts, Snooze, alerts while no window is open (needs the server timer Reminders has).
10. **Day and year views.** The day's detail pane, year density.
11. **Attachments, travel time, Show As, zone per event, inspector.**
12. **Calendars.** Groups, subscriptions, Birthdays from Contacts, real Holidays.
13. **Cross-app.** `.ics` from Finder, Contacts picker for invitees, Add to Calendar from Mail, location to Maps, Dock icon, Siri.
14. **Print and export.** Print, PDF, archive, and alarms and attendees in `.ics`.
15. **Remaining items.** Preferences panes that act, text size, Refresh, Availability and Address panels, Spelling and the other Edit submenus, Time Zone Support. Items a browser cannot do are shown dimmed with a reason.
