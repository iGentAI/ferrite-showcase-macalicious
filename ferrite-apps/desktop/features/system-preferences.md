# Feature inventory: System Preferences

First read from GitHub at main `e62c2ac9` (29 October 2026). A row is done once it was checked in a browser, and the note names the journey or screenshot. The owner calls this app System Settings; on macOS 10.15 it is System Preferences.

**How to read the status**

- **missing**: not in main's code.
- **partial**: present, but something is absent; the note says what.
- **built-unchecked**: present in main's code for the desktop served by Ferrite, not yet seen running.
- **kept**: short for "the control shows and saves its value per account, and changes nothing on this desktop". Each such pane says this in its note under the pane.
- **Browser limit**: what a browser page cannot do. The app must say so instead of inventing a fact. A done row that says this, or **Not on this desktop**, means the page says what is true: the Mac's feature itself is not there.
- **Invented**: a captured or made-up value shown as if it were true of this desktop. The owner's direction is to say so rather than invent.

**Limits of this inventory**

- The real-app rows are written from knowledge of macOS 10.15, not checked on a Mac.
- Simple controls with the same status are grouped in one row. Rows were counted by script.
- Corrected when landed, against every pane file on main `e62c2ac`: the rows that were first taken from doc comments and `system-preferences.mdx` now say what the code does.

**Counts:** 308 done (82 of them a browser limit or not on this desktop, which the page says), 0 built-unchecked, 2 partial, 0 missing, 310 rows.

## Shell: System Preferences menu

| Item | Status | Note |
| --- | --- | --- |
| About System Preferences | done | The desktop's About; `system-preferences-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/164) |
| Preferences… | done | No such row, as on a Mac; `sp-served-rows-journey.mjs` |
| Services | done | Not on this desktop: "No Services Apply", dimmed, as no application offers one |
| Hide System Preferences ⌘H | done | Goes at once, with no tile of its own, and comes back with its tile, across a reload; `desktop-hide-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/467) |
| Hide Others ⌥⌘H | done | The others go at once; a window minimized by hand keeps its tile; `desktop-hide-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/467) |
| Show All | done | `system-preferences-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/170) |
| Quit ⌘Q | done | `system-preferences-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/170) |

## Shell: Edit menu

| Item | Status | Note |
| --- | --- | --- |
| Undo, Redo | done | In the text field that had the keyboard last, and dimmed with a reason until one has; `system-preferences-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/162) |
| Cut, Copy, Paste | done | The same; a password field is never read; `system-preferences-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/162) |
| Select All | done | The same; `system-preferences-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/162) |
| Delete | done | The same; `system-preferences-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/162) |
| Start Dictation | built-unchecked | The desktop's row: types what the browser's recognizer hears, dimmed with a reason with no field or no recognizer. `system-preferences-shell-journey.mjs`, and with a stub recognizer in other apps in `e2e/dictation-batch5-journey.mjs` |
| Emoji & Symbols | done | Opens the desktop's character viewer; `system-preferences-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/168) |

## Shell: View menu

| Item | Status | Note |
| --- | --- | --- |
| Back ⌘[ | done | [Screenshot](#project-artifact/art_7026fbcdd84f1550/1) |
| Forward ⌘] | done | [Screenshot](#project-artifact/art_7026fbcdd84f1550/1) |
| Show All Preferences ⌘L | done | [Screenshot](#project-artifact/art_7026fbcdd84f1550/1) |
| Customize… | done | [Screenshot](#project-artifact/art_7026fbcdd84f1550/3) |
| Search ⌘F | done | [Screenshot](#project-artifact/art_7026fbcdd84f1550/1) |
| One item per pane | done | [Screenshot](#project-artifact/art_7026fbcdd84f1550/1) |
| Enter Full Screen | done | Dimmed with the "fixed size" reason; `system-preferences-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/160) |

## Shell: Window menu

| Item | Status | Note |
| --- | --- | --- |
| Minimize ⌘M | done | `system-preferences-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/165) |
| Zoom | done | Dimmed, as the window has a fixed size; `system-preferences-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/165) |
| Bring All to Front | done | Listed here; what it does is shown on Finder, `system-apps-shell-journey.mjs`; [shot](#project-artifact/art_a7e016210b9b9bc1/165) |
| Window list | done | `system-preferences-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/165) |

## Shell: Help menu

| Item | Status | Note |
| --- | --- | --- |
| Search field | done | The shared Help menu's; Return opens Help Viewer on the words; `system-apps-help-journey.mjs`, [shot](#project-artifact/art_7026fbcdd84f1550/23) |
| System Preferences Help | done | Opens Help Viewer; `system-preferences-depth-journey.mjs` |

## Shell: window and toolbar

| Item | Status | Note |
| --- | --- | --- |
| Fixed width, height follows pane | done | `system-preferences-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/166) |
| Back and Forward | done | `system-preferences-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/166) |
| Show All button | done | A press shows all; held, or by the right button, it lists the panes; `sp-served-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/483) |
| Search field | done | Dims non-matching panes and lists matches; [Screenshot](#project-artifact/art_7026fbcdd84f1550/3) |
| Return opens the first match | done | `system-preferences-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/163) |
| Account header opens Apple ID and Family Sharing | done | Under the signed-in account's name; Apple ID driven; `system-preferences-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/167) |
| Grid of 33 panes | done | 31 in the two bands and 2 in the header; `system-preferences-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/158) |
| Customize mode (checkboxes that hide panes) | done | Saved per account; [Screenshot](#project-artifact/art_7026fbcdd84f1550/3) |
| Tab to an icon, Return or Space opens | done | Return driven; `system-preferences-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/161) |
| Note under each pane naming what takes effect | done | Seen on Dock; `system-preferences-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/166) |
| Focus moves to the pane after navigation | done | `system-preferences-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/166) |

## Shell: keyboard shortcuts

| Item | Status | Note |
| --- | --- | --- |
| ⌘W ⌘M ⌘H ⌥⌘H ⌘Q | done | From the desktop; ⌥⌘H is the Hide Others row's key and only the row was driven; `system-preferences-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/169) |
| ⌘[ ⌘] | done | `system-preferences-depth-journey.mjs` |
| ⌘L | done | `system-preferences-depth-journey.mjs` |
| ⌘F | done | `system-preferences-depth-journey.mjs` |

## Shell: saved state and cross-app

| Item | Status | Note |
| --- | --- | --- |
| Every pane's settings per account across reloads | done | One setting of each pane that has a control, changed and read back from the server after a reload, on one account; the 15 panes with no such control are named in the journey. The census checks each control per pane; `system-preferences-kept-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/290) |
| Saved theme restored at desktop start | done | With the window closed; `system-preferences-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/171) |
| Reopens on the pane last shown | done | `system-preferences-depth-journey.mjs`; kept with the person's settings |
| Status menus' "Open … Preferences…" opens the pane | done | Time Machine's driven; `system-preferences-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/172) |
| About This Mac opens Software Update and Displays | done | Software Update driven; Displays goes the same way; `system-preferences-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/173) |
| Dock icon's contextual menu lists panes | done | Band by band; a press opens the pane; `preferences-reach-journey.mjs`, [shot](#project-artifact/art_7026fbcdd84f1550/21) |
| Spotlight result opens a pane | done | Under a System Preferences group, by the pane's name, and off when that category is off; `preferences-reach-journey.mjs`, [shot](#project-artifact/art_7026fbcdd84f1550/22) |
| Help button in every pane | done | Opens Help Viewer on the desktop; the library's demo still says it stops there |

## General

| Item | Status | Note |
| --- | --- | --- |
| Appearance Light, Dark, Auto | done | Takes effect; `system-preferences-panes-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/227) |
| Accent color | done | Takes effect, and holds after a reload; `system-preferences-panes-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/227) |
| Highlight color | done | Takes effect, and holds after a reload; `system-preferences-panes-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/227) |
| Recent items | done | Takes effect in the Apple menu: None empties the list and 5 brings it back; `system-preferences-panes-more-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/259) |
| Sidebar icon size | done | Sets the sidebars' icon and row size, read from the property on the page; `system-preferences-panes-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/227) |
| Automatically hide and show the menu bar | done | `system-preferences-depth-journey.mjs`; hides, returns under the pointer, holds after a reload |
| Show scroll bars | done | Always keeps overlay scrollers shown, through the scroll view's own properties; the journey checks the property on the page, not a drawn scroller; `system-preferences-panes-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/227) |
| Click in the scroll bar | done | Jump to the next page and Jump to the spot act on the library's scrollers, kept across a reload; a browser's own scroll bars keep the browser's behaviour; `sp-general-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/409) |
| Default web browser | done | Safari is the only browser here, and a web search from Spotlight opens in it; `sp-general-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/409) |
| Ask to keep changes | done | For TextEdit's documents with a file: on, nothing is written until the person says, and the red button, File > Close Window and Quit each ask Save, Don't Save or Cancel, across a reload; off, autosave as before; `sp-documents-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/443) |
| Close windows when quitting | done | Off: an application opened again brings back the windows it quit with, where they were, also after a reload: those the desktop opened (a second Maps window) and Terminal's own. On: one new window. Each application's own contents come back either way, as it keeps them for the account; `sp-documents-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/445) |
| Allow Handoff | done | Dimmed and off, with the reason: a web page cannot reach your other devices. Browser limit; `sp-general-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/409) |
| Font smoothing | done | Sets `-webkit-font-smoothing`, which shows only in browsers on a Mac; the journey reads the attribute; `system-preferences-panes-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/227) |

## Dock

| Item | Status | Note |
| --- | --- | --- |
| Size | done | Takes effect; a Dock that fills the screen stays at the width that fits until Size goes below it; `system-preferences-panes-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/228) |
| Magnification | done | Takes effect; `system-preferences-panes-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/230) |
| Position on screen | done | Takes effect; `system-preferences-panes-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/229) |
| Automatically hide and show the Dock | done | Takes effect; `system-preferences-panes-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/231) |
| Minimize windows using | done | Scale, and a narrower approximation of Genie: not Apple's curve; the journey reads the property, not the motion; `system-preferences-panes-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/231) |
| Prefer tabs when opening documents | done | Terminal's New Window opens a tab under Always, and under In Full Screen Only while in full screen; Manually opens a window. Finder and Safari have settings of their own, and no other application here has tabs; `sp-documents-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/444) |
| Double-click a title bar to | done | `system-preferences-depth-journey.mjs` |
| Minimize windows into application icon | done | Off gives a minimized window its own tile, on none, and the application's tile brings it back, across a reload; `sp-dock-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/412) |
| Animate opening applications | done | Decides whether a tile bounces, across a reload; `sp-dock-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/407) |
| Show indicators for open applications | done | `system-preferences-depth-journey.mjs` |
| Show recent applications in Dock | done | Decides whether the recent section is there, across a reload; `sp-dock-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/407) |

## Desktop & Screen Saver

| Item | Status | Note |
| --- | --- | --- |
| Picture gallery chooses the desktop picture | done | Takes effect; `system-preferences-panes-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/225) |
| Dynamic, Light, Dark | done | Light and Dark take effect. Dynamic goes by the page's clock, day at 7 and night at 7, as a page is told no location, and the pane says so; `sp-desktop-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/411) |
| Source outline | done | `system-preferences-panes-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/224) |
| Folders > Pictures from the person's drive | done | Newest 24; `system-preferences-panes-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/224) |
| + uploads pictures | done | `system-preferences-panes-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/224) |
| − removes the folder | done | `system-preferences-panes-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/232) |
| Colors source | done | Eight plain colours, kept across a reload. Catalina's own list is in no capture, so the names and shades are approximate; `preferences-reach-journey.mjs`, [shot](#project-artifact/art_7026fbcdd84f1550/20) |
| Photos source | done | Lists the Photos library's newest 24 pictures, and one chosen is kept as its file; `sp-desktop-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/408) |
| Change picture, interval, random order | done | In order, at random, every 5 seconds to every day, When logging in and When waking from sleep (this desktop's own display sleep), off stops it, and a reload does not restart the count; `sp-desktop-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/413) |
| Screen Saver tab | done | Start after, Show with clock and Preview; there is one saver; `screen-saver-journey.mjs`, [shot](#project-artifact/art_7026fbcdd84f1550/4) |
| Screen saver start after, Show with clock, idle trigger | done | Counts from the last input on this page, and a playing video holds it off; `screen-saver-journey.mjs`, [shot](#project-artifact/art_7026fbcdd84f1550/4) |
| Hot Corners… | done | Launchpad, Notification Center, Start Screen Saver, Disable Screen Saver, Put Display to Sleep and Lock Screen, at the corners of the page; the setting is in Mission Control's pane and this tab says so; `hot-corners-journey.mjs`, [shot](#project-artifact/art_7026fbcdd84f1550/15) |
| Drag an image onto the well | done | From Finder; `preferences-reach-journey.mjs`, [shot](#project-artifact/art_7026fbcdd84f1550/19) |
| Drag a folder onto the sources | done | From Finder; it lists the pictures inside, and goes when the folder is trashed; `preferences-reach-journey.mjs`, [shot](#project-artifact/art_7026fbcdd84f1550/20) |
| Add any folder of the drive | done | By dragging it from Finder, or by the folder button's sheet; `sp-desktop-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/406) |

## Mission Control

| Item | Status | Note |
| --- | --- | --- |
| Rearrange Spaces, Switch to Space, Group by application, Separate Spaces | done | Group windows by application works and holds across a reload. The other three are dimmed at what this desktop does, each saying why: Spaces stay in the order given, the Dock goes to the application's Space, a page has one display. The journey checks the first two claims against the saved Spaces; `sp-mission-control-rows-journey.mjs` |
| Keyboard shortcut pop-ups | done | Each opens what it names, kept across a reload; F3 is always Mission Control's; `mission-control-shortcuts-journey.mjs`, `desktop-spaces-keys.test.tsx` |
| Hot Corners… | done | `hot-corners-journey.mjs`, [shot](#project-artifact/art_7026fbcdd84f1550/15) |
| Shift, Control, Option, Command variants | done | Held with the menu open, the rows become those shortcuts, and the chosen one works; ⌘ is Control off a Mac; `mission-control-shortcuts-journey.mjs` |
| Mouse button shortcuts | done | A second pop-up on the served desktop: the middle, back and forward buttons a page can see; the browser's own use of a button gives way only when it is bound. Other buttons never reach a page; `mission-control-shortcuts-journey.mjs` |

## Siri

| Item | Status | Note |
| --- | --- | --- |
| Enable Ask Siri | done | Off takes Siri out of the Dock and the menu bar, and disables the settings under it; `siri-spotlight-journey.mjs`, [shot](#project-artifact/art_7026fbcdd84f1550/14) |
| Listen for "Hey Siri" | done | Browser limit: dimmed, saying a web page cannot listen while it is not asked to; `sp-served-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/501) |
| Allow Siri when locked | done | Dimmed, saying why; `sp-served-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/501) |
| Keyboard Shortcut | done | Browser limit: dimmed, saying your computer keeps that key; `sp-served-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/501) |
| Language, Siri Voice | done | Dimmed: English, in the browser's voice, each saying so; `sp-served-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/501) |
| Voice Feedback | done | On: a spoken request is answered aloud in the words on the screen; a typed one in text only; Off is kept across a reload. A stand-in recognizer and a recording `speak`, as a headless browser has neither; `siri-voice-feedback-journey.mjs` |
| Show Siri in menu bar | done | Off takes the extra out of the menu bar, and leaves the Dock's; `siri-spotlight-journey.mjs` |
| Siri Suggestions & Privacy… | done | Popover says Siri answers from this desktop's server and makes no suggestions; the pane has no About Siri button |

## Spotlight

| Item | Status | Note |
| --- | --- | --- |
| Search Results category checkboxes | done | Applications, Calculator, Conversion, Definition and the person's own kinds of thing; the desktop's Spotlight leaves out what is off. Categories with no results here (Fonts, Movies, Presentations, Spreadsheets, Siri Suggestions, PDF Documents, Folders, Other, System Preferences) are kept and change nothing; `siri-spotlight-journey.mjs`, [shot](#project-artifact/art_7026fbcdd84f1550/14) |
| Allow Spotlight Suggestions in Look up | done | Dimmed and off: this desktop has no Spotlight Suggestions, and the pane's words no longer promise them; `sp-spotlight-rows-journey.mjs` |
| Privacy tab | done | The folders kept out, added by dragging from Finder, as this desktop has no folder panel; the Mac's disks are not searched here and the tab says so; `spotlight-privacy-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/240) |
| Keyboard Shortcuts…, About Search & Privacy… | done | Popovers with their own titles. Keyboard Shortcuts names the key, which the journey presses. About names the public dictionaries a word goes to through the server; the page's requests are read, and Definition off stops the Dictionary one. Those server calls are read from the source, not driven; `sp-spotlight-rows-journey.mjs` |
| Drag a folder into Privacy | done | From Finder; its files at any depth leave Spotlight's results, across a reload, and − brings them back; a file is refused with the reason. Applied in the window, as the server's search still reads them; `spotlight-privacy-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/240) |

## Language & Region

| Item | Status | Note |
| --- | --- | --- |
| Formatting examples follow region and time format | done | On the served desktop they show today in the browser's time zone, not a captured date; `system-preferences-panes-more-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/257) |
| Preferred languages | done | The browser's languages, first the primary one; `language-region-journey.mjs`, [shot](#project-artifact/art_7026fbcdd84f1550/6) |
| Add a language | done | Browser limit: dimmed with the reason, as is remove; `sp-language-rows-journey.mjs` |
| Region | done | Writes the examples and the date in Notification Center's Today; other apps keep their own way of writing dates and the pop-up's title says so; `sp-language-rows-journey.mjs` |
| First day of week | done | Calendar follows until the person saves its own Start week on; `language-region-journey.mjs`, [shot](#project-artifact/art_7026fbcdd84f1550/6) |
| Calendar | done | Writes the examples and the date in Notification Center's Today; the Calendar app stays Gregorian and the pop-up's title says so; `sp-language-rows-journey.mjs` |
| 24-Hour Time | done | The menu bar's clock follows; `system-preferences-depth-journey.mjs` |
| Temperature | built-unchecked | Kept and read by Today's Weather, Maps, Siri and Spotlight. The journey sees Celsius in the widget only; the other three share `degrees` in `maps-weather.ts`. `weather-rates-batch13-journey.mjs`, `sp-language-rows-journey.mjs` |
| Advanced… | done | Dimmed with the reason: this desktop has no custom formats, as no app has a shared number format to follow; `sp-language-rows-journey.mjs` |
| Apps tab | done | Says no app has a language to choose, and what the browser's language does set (Siri's listening, units in Maps and Find My); `sp-language-rows-journey.mjs` |
| Drag to reorder languages | done | Browser limit: the list is the browser's own languages, and its small text and title say so; a drag changes nothing. Three languages set in the page by script, as a headless browser has one; `sp-language-rows-journey.mjs` |

## Notifications

| Item | Status | Note |
| --- | --- | --- |
| Do Not Disturb schedule | done | Turns Do Not Disturb on and off at the span's edges, walked on a set clock; `system-preferences-panes-more-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/256) |
| Do Not Disturb when sleeping, locked, mirroring | done | Sleeping holds banners and sound while the desktop's display sleep is up, and off lets them come, kept across a reload. Locked is dimmed on, as the lock screen closes notifications; mirroring dimmed off, as a page cannot tell. The lock claim is read from the source: a guest cannot lock; `sp-notifications-rows-journey.mjs` |
| Allow calls, repeated calls | done | With Do Not Disturb on, a call's banner comes only with Allow calls on, or on the same person's second call within three minutes, remembered while the page is open. FaceTime's own open window still shows the call. Calls raised through the notify route, not by a second person; `sp-notifications-rows-journey.mjs` |
| Applications list | done | The apps that really send notifications, with their settings as the second line; `notifications-pane-journey.mjs`, [shot](#project-artifact/art_7026fbcdd84f1550/5) |
| A selected app's settings | done | Allow, alert style, Show in Notification Center and sound are followed by banners and Notification Center. Badges and the lock screen are not offered, and the pane says why; `notifications-pane-journey.mjs`, [shot](#project-artifact/art_7026fbcdd84f1550/5) |
| Notification Center sort order | done | Recents and Recents by App followed in the panel; `system-preferences-panes-more-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/253) |

## Internet Accounts

| Item | Status | Note |
| --- | --- | --- |
| Served page: what the browser and the app really report, and what cannot be known | done | [Screenshot](#project-artifact/art_7026fbcdd84f1550/2) |
| Accounts list | done | Not on this desktop: the page names the account signed in, and says no outside account can be added; `sp-served-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/492) |
| Remove an account | done | Not on this desktop: there is none to remove; the same shot |
| Providers | done | Not on this desktop: the page says it signs in to no iCloud, Google or Exchange account; the same shot |
| Add Other Account | done | Not on this desktop: the same; the same shot |

## Wallet & Apple Pay

| Item | Status | Note |
| --- | --- | --- |
| Served page: what the browser and the app really report, and what cannot be known | done | [Screenshot](#project-artifact/art_7026fbcdd84f1550/2) |
| Introduction | done | Browser limit: the page says why cards cannot be added; `sp-served-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/493) |
| Add Card, privacy link | done | Browser limit: no card is kept and no payment made, and the page says so; the same shot |

## Touch ID

| Item | Status | Note |
| --- | --- | --- |
| Served page: what the browser and the app really report, and what cannot be known | done | [Screenshot](#project-artifact/art_7026fbcdd84f1550/2) |
| Fingerprint tiles | done | Browser limit: the page says it cannot read fingerprints, and reports whether the browser has a built-in authenticator; `sp-served-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/495) |
| Four uses | done | Browser limit: this desktop signs in with a password, and the page says so; the same shot |

## Users & Groups

| Item | Status | Note |
| --- | --- | --- |
| Served page: what the browser and the app really report, and what cannot be known | done | [Screenshot](#project-artifact/art_7026fbcdd84f1550/2) |
| Current User | done | The account's full name, account name and kind, from the server; `sp-served-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/494) |
| Other Users | done | The other accounts used in this browser, as the login window lists them, and the page says only those are listed; the same shot |
| Change Password… | done | The old password and the new one twice, checked by the server; the account's other browsers are signed out; `users-password-journey.mjs`, [shot](#project-artifact/art_7026fbcdd84f1550/9) |
| Edit picture | done | Edit… chooses a picture from this computer; it is kept for the account and shows at this browser's login window and lock screen; Remove Picture takes it away. A login window in another browser shows the silhouette until the account has signed in there; `sp-account-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/576), [at the login window](#project-artifact/art_a7e016210b9b9bc1/575) |
| Contacts Card Open… | done | Opens Contacts on My Card, with another card sorted before it; `sp-account-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/572) |
| Reset with Apple ID; Administer | done | Not on this desktop: there is no Apple ID, and accounts have no administrators; Change Password… is how a password changes |
| Login Items tab | done | On the page, not a tab: Add Login Item… lists the applications, − removes one, and a login at the login window opens them: the journey logs a fresh account out and back in, and reads the setting from the server after; `sp-served-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/494) |
| Login Options | done | Display login window as List of users or Name and password, for this browser's login window, across a log-out, and the account then logs in by name. Automatic login, password hints and the input menu are not on this desktop; `sp-account-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/607) |
| Lock button | done | Not on this desktop: nothing on this page needs an administrator |
| + and − | done | Not on this desktop: the page says new accounts are made at the login window. Removing an account is not offered |
| Drag a picture onto the account | done | From Finder, replacing the picture; another kind of file is refused with the reason (read in the code, not driven); `sp-account-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/574) |

## Accessibility

| Item | Status | Note |
| --- | --- | --- |
| Category list | done | `system-preferences-panes-more-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/260) |
| Display | done | Invert colors, grayscale, contrast, Reduce motion (transitions) and Reduce transparency, on this page; `accessibility-journey.mjs`, [shot](#project-artifact/art_7026fbcdd84f1550/13) |
| Speech | done | The browser's voices, rate, Play, and speaking the selection with ⌥⎋; the sound itself was not heard, the journey sees the browser asked to speak; `accessibility-journey.mjs` |
| Audio: flash the screen | done | With every alert sound; `accessibility-journey.mjs` |
| VoiceOver, Zoom, Descriptions, Captions | done | Zoom scales this page around the pointer by ⌥⌘8, ⌥⌘=, ⌥⌘−, Control-scroll and a slider, kept across a reload; pop-up menus were not checked while zoomed. Captions styles the subtitles of TV's home videos, Large Text seen on a real one by pixels and by eye. VoiceOver and Descriptions are browser limits, stated; `sp-accessibility-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/410) |
| Show status in menu bar | done | Adds a menu in the menu bar, kept across a reload: toggles for Invert colors, Use grayscale, Increase contrast, Reduce motion and Reduce transparency (Use grayscale driven), and Open Accessibility Preferences…; `sp-accessibility-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/415) |
| Motor and General groups | done | Each says what a page can do, all six read. Browser limit. Their pictures are the Overview's; `sp-accessibility-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/414) |

## Screen Time

| Item | Status | Note |
| --- | --- | --- |
| Served page: what the browser and the app really report, and what cannot be known | done | Today's time for each app that has been in front, today's total and the week's; `screen-time-journey.mjs`, [shot](#project-artifact/art_7026fbcdd84f1550/18) |
| Section list | done | All eight of the pane's sections, in its list, beside the account's name and picture (the capture's layout); `served-screen-time-sections.test.tsx`, `sp-served-rows-journey.mjs` |
| Day chooser and arrows | done | Seven days as bars: a bar or an arrow chooses the day, and the figures follow. The page's clock is moved on by the journey; `sp-served-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/497) |
| Scope bar | done | Not on this desktop: apps here have no categories, so they are listed by name, and App Usage says so; `sp-account-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/606) |
| Usage charts | done | A bar for each of the last seven days; `sp-served-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/497) |
| Apps table | done | Measured: only time this page sees, the app in front, the browser's window in front and input in the last two minutes; `screen-time-journey.mjs` |
| Notifications, Pickups | done | Notifications: the seven days as bars, and each application's count, of what this desktop delivered, once each across a reload, and kept when a notification is dismissed. Pickups: browser limit, and the section says a page cannot see them; `sp-account-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/573) |
| Downtime, App Limits, Always Allowed, Content & Privacy | done | The settings are real and kept on the server for the account: Downtime's every-day or per-day schedule with what it means now, App Limits with today's measured use of each limit, Always Allowed, and Content & Privacy's four tabs. None is enforced, and each section says so: stopping an application needs a change to `demos/desktop`. No capture shows these sections, so their controls follow macOS 10.15 from memory and their look is not checked against a reference; `served-screen-time-sections.test.tsx`, `sp-served-rows-journey.mjs` |
| Options | done | Count Screen Time on this desktop: off is kept for the account and nothing is counted, what came meanwhile is passed over, and what was counted stays. The off state was read from the server, and the counting by a unit test. Share across devices and the passcode show dimmed with the reason under the pointer; `sp-account-rows-journey.mjs`, `desktop-screen-time.test.tsx`, `served-screen-time-sections.test.tsx`, [shot](#project-artifact/art_a7e016210b9b9bc1/606) |

## Extensions

| Item | Status | Note |
| --- | --- | --- |
| Category list | done | `system-preferences-panes-more-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/255) |
| New item dot | done | Goes once the extension is chosen; `system-preferences-panes-more-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/258) |
| Share Menu checkboxes | done | Notes, Reminders and Add to Photos leave the desktop's Share menus when off; Mail and Messages stay, as built-in rows do; Add to Reading List and Save to Books have no row to change; `preference-tabs-journey.mjs`, [shot](#project-artifact/art_7026fbcdd84f1550/16) |
| Other categories | done | Each says what is true here, as nothing can be installed: Actions and Finder what is built in, Finder Extensions and Quick Look that they take none; `sp-served-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/500) |
| Drag to order Today items | done | [Today in the order it was dragged to](#project-artifact/art_a7e016210b9b9bc1/312), in this pane and in Notification Center's Edit: `e2e/extensions-today-journey.mjs`, `e2e/extensions-today-drag-journey.mjs`, `e2e/today-widgets-journey.mjs` |

## Security & Privacy

| Item | Status | Note |
| --- | --- | --- |
| Change Password… | done | Goes to Users & Groups, which changes it; `security-journey.mjs`, [shot](#project-artifact/art_7026fbcdd84f1550/10) |
| Require password after sleep | done | The screen locks that long after the screen saver or the display's sleep begins; a Preview does not; `security-journey.mjs`, [shot](#project-artifact/art_7026fbcdd84f1550/10) |
| Lock message | done | Set Lock Message… shows the words on the lock screen, also after a reload while locked (a copy per account in this browser); not on the login window; `sp-security-rows-journey.mjs` |
| Disable automatic login | done | On and dimmed with why: this desktop has no automatic login; `sp-security-rows-journey.mjs` |
| Allow apps from | done | Browser limit: dimmed with why and nothing chosen, so it claims nothing of this computer; `sp-security-rows-journey.mjs` |
| Lock button | done | Dimmed: nothing on the pane needs an administrator. Toggles only in the library demo; `sp-security-rows-journey.mjs` |
| Advanced… | done | Log out after N minutes with no input on this page, kept across a reload; a minute was timed, and input restarts it. Require an administrator password is dimmed with why; `sp-security-rows-journey.mjs` |
| FileVault tab | done | Browser limit, stated, with how the desktop keeps data; `sp-security-rows-journey.mjs` |
| Firewall tab | done | Browser limit, stated, with what the desktop may reach; `sp-security-rows-journey.mjs` |
| Privacy tab | done | What the browser says this page may use; only the browser changes it; `security-journey.mjs`, [shot](#project-artifact/art_7026fbcdd84f1550/10) |

## Software Update

| Item | Status | Note |
| --- | --- | --- |
| Served page: what the browser and the app really report, and what cannot be known | done | [Screenshot](#project-artifact/art_7026fbcdd84f1550/2) |
| Status line | done | The deployment, its site build and when this page last looked; `sp-served-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/490) |
| Details… | done | Not on this desktop: nothing is downloaded, so there is no update to detail; the page says so; the same shot |
| Automatically keep up to date | done | Always so: the page says a new deployment reaches you the next time it loads; Reload the Desktop does that now; the same shot |
| Advanced… | done | Not on this desktop: nothing to choose, as the server is updated, not the computer; the same shot |

## Network

| Item | Status | Note |
| --- | --- | --- |
| Served page: what the browser and the app really report, and what cannot be known | done | [Screenshot](#project-artifact/art_7026fbcdd84f1550/2) |
| Turn Wi-Fi Off | done | Browser limit: the page says it cannot see or change Wi-Fi; `sp-served-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/488) |
| Gear menu | done | Browser limit: there are no services for it to act on; the same shot |
| Location | done | Browser limit: named on the page; the same shot |
| Services list | done | Browser limit: named on the page; the same shot |
| Status text | done | Connected or Offline, the speed class, bandwidth and round trip, from the browser, or "Not reported by this browser"; the same shot |
| Network Name | done | Browser limit: "Not visible to a web page", as is the IP address; the same shot |
| Auto-join, hotspots, new networks, menu bar checkboxes | done | Show Wi-Fi status in menu bar takes the extra away and brings it back, across a reload. The other three are a browser limit; `sp-served-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/499) |
| + and − | done | Browser limit: as for the services list; the first shot |
| Advanced… | done | Browser limit: the same; the first shot |
| Other services | done | Browser limit: the same; the first shot |
| Revert, Apply | done | Not on this desktop: the one check box takes effect at once |

## Bluetooth

| Item | Status | Note |
| --- | --- | --- |
| Served page: what the browser and the app really report, and what cannot be known | done | [Screenshot](#project-artifact/art_7026fbcdd84f1550/2) |
| Turn Bluetooth Off | done | Browser limit: the page says it cannot; `sp-served-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/487) |
| Devices | done | Browser limit: the page says it cannot list them, and reports what the browser says of Bluetooth; the same shot |
| Looking-for-devices spinner | done | Browser limit: nothing is looked for; the same shot |
| Advanced… | done | Browser limit: the same; the same shot |
| Show in menu bar | done | Brings the Bluetooth extra, across a reload; `sp-served-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/499) |

## Sound

| Item | Status | Note |
| --- | --- | --- |
| Alert sound list | done | Plays a drawn stand-in tone, not Apple's sound; `system-preferences-depth-journey.mjs` |
| Play sound effects through | done | Dimmed at Selected sound output device, with the reason: a web page cannot choose the computer's device; `sp-sound-rows-journey.mjs` |
| Alert volume | done | Sets the tone's volume, saved for the account; the journey does not hear it; `system-preferences-panes-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/233) |
| Play user interface sound effects | done | Empty Trash and moving to the Trash play a drawn tone, under Alert volume and Output volume; off is silent, kept across a reload. Emptying from the Dock is driven; moving to the Trash shares the path, not driven; the sound itself is not heard, the journey reads what Web Audio was asked to play; `sp-sound-rows-journey.mjs` |
| Feedback when volume changes | done | Letting go of Output volume plays a tone at the new volume; off or muted is silent; kept across a reload. The sound is not heard, the journey reads what Web Audio was asked to play; `sp-sound-rows-journey.mjs` |
| Output tab | done | Lists the browser's devices and says a page cannot choose one; `system-preferences-panes-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/234) |
| Input tab | done | Lists the browser's devices, none in the test browser, and says a page cannot choose one; no level meter yet; `system-preferences-panes-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/235) |
| Output volume, Mute | done | This desktop's own sounds only, starting at full: alerts, interface sounds and any `audio` or `video` element of the page, whose application reads back the volume it asked for. YouTube in TV and the browser's spoken voices do not follow, and the pane says a web page cannot change the computer's volume. Tones and a stand-in element, not Music itself; not heard; `sp-sound-rows-journey.mjs` |
| Show volume in menu bar | done | A menu extra with the same volume and Mute as the pane, kept across a reload; `sp-sound-rows-journey.mjs` |

## Printers & Scanners

| Item | Status | Note |
| --- | --- | --- |
| Served page: what the browser and the app really report, and what cannot be known | done | [Screenshot](#project-artifact/art_7026fbcdd84f1550/2) |
| Sharing Preferences… | done | Browser limit: no printer is shared from a page, as the Sharing pane says; `sp-served-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/484) |
| Printers list | done | Browser limit: the page says it cannot list them. Print This Page… opens the browser's dialog; that button was not pressed by the journey; the same shot |
| + and − | done | Browser limit: the same; the same shot |
| Open Print Queue, Options & Supplies | done | Browser limit: the same; the same shot |
| Share this printer | done | Browser limit: the same; the same shot |
| Default printer | done | Browser limit: the browser's own dialog chooses it, and the page says so; the same shot |
| Default paper size | done | Browser limit: the same; the same shot |

## Keyboard

| Item | Status | Note |
| --- | --- | --- |
| Key Repeat, Delay Until Repeat | done | Dimmed at Catalina's defaults, and the pane says so: a web page can neither read nor change them; `sp-keyboard-rows-journey.mjs` |
| Brightness and backlight | done | Dimmed the same way; `sp-keyboard-rows-journey.mjs` |
| Touch Bar shows, Fn key, Control Strip | done | Dimmed the same way; `sp-keyboard-rows-journey.mjs` |
| Show keyboard and emoji viewers | done | A menu extra whose Emoji & Symbols opens the desktop's character viewer, kept across a reload; Keyboard Viewer is dimmed as the desktop draws none; `sp-keyboard-rows-journey.mjs` |
| Customize Control Strip… | done | Dimmed with the reason; `sp-keyboard-rows-journey.mjs` |
| Modifier Keys… | done | Dimmed with the reason; `sp-keyboard-rows-journey.mjs` |
| Set Up Bluetooth Keyboard… | done | Dimmed with the reason; `sp-keyboard-rows-journey.mjs` |
| Text tab | done | Replacements added and removed here work in text fields and text areas once a space or punctuation follows the word, kept across a reload, and one undo takes one back; not in password, URL or email fields, or Terminal. A new one is typed under the list, not in the row. Spelling and capitals stay the browser's, and the tab says so; `sp-keyboard-rows-journey.mjs`, `keyboard-journey.mjs` |
| A word in rich text in any other shape | done | The word is read from the caret's line, so it is replaced across style runs, at the start of a later line and after punctuation, and takes the style of its first letter. A word running on from a letter, or crossing an uneditable part, stays; `sp-keyboard-rows-journey.mjs` |
| Shortcuts tab | done | The keys of the desktop's menus; they cannot be changed; `keyboard-journey.mjs`, [shot](#project-artifact/art_7026fbcdd84f1550/11) |
| Input Sources tab | done | Says a web page cannot add or switch them, with the browser's languages, read from the browser by the journey; `sp-keyboard-rows-journey.mjs` |
| Dictation tab | done | Says the computer's dictation types into the fields and whether this browser offers speech recognition, checked against the browser; `sp-keyboard-rows-journey.mjs` |

## Trackpad

| Item | Status | Note |
| --- | --- | --- |
| Gesture callout follows pointer and focus | done | `system-preferences-panes-more-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/254) |
| Look up, Secondary click, Tap to click | done | Dimmed at Catalina's defaults with the reason, and so are the ways of making them; the callout still follows them; `sp-pointer-rows-journey.mjs` |
| Click and Tracking speed sliders | done | Dimmed with the reason; `sp-pointer-rows-journey.mjs` |
| Force Click | done | Dimmed with the reason; `sp-pointer-rows-journey.mjs` |
| Scroll & Zoom tab | done | Says what reaches a web page; `sp-pointer-rows-journey.mjs` |
| More Gestures tab | done | Says what reaches a web page; `sp-pointer-rows-journey.mjs` |
| Set Up Bluetooth Trackpad… | done | Dimmed with the reason; `sp-pointer-rows-journey.mjs` |

## Mouse

| Item | Status | Note |
| --- | --- | --- |
| Gesture callout | done | Follows the pointer and the focus; `system-preferences-panes-more-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/261) |
| Natural scroll, Secondary click, Smart zoom | done | Natural off reverses scrolling in this desktop's views, for a mouse and a trackpad alike, kept across a reload; on leaves what the computer sends. An application that takes the wheel itself, such as Maps, keeps its direction; Terminal and Console, which read the wheel themselves, were not driven. Secondary click and Smart zoom are dimmed with the reason. Playwright's wheel events, not a person's mouse; `sp-pointer-rows-journey.mjs` |
| Tracking speed | done | Dimmed with the reason; `sp-pointer-rows-journey.mjs` |
| More Gestures tab | done | Says what reaches a web page; `sp-pointer-rows-journey.mjs` |
| Battery level | done | Says a web page cannot read it, and no level is shown; `sp-pointer-rows-journey.mjs` |
| Set Up Bluetooth Mouse… | done | Dimmed with the reason; `sp-pointer-rows-journey.mjs` |

## Displays

| Item | Status | Note |
| --- | --- | --- |
| Served page: what the browser and the app really report, and what cannot be known | done | [Screenshot](#project-artifact/art_7026fbcdd84f1550/2) |
| Resolution | done | Browser limit, stated: the page gives the size, available size and pixel ratio the browser reports and says a page cannot change the resolution; `sp-displays-rows-journey.mjs` |
| Brightness | done | Dims this page only, as the page says; `displays-energy-journey.mjs`, [shot](#project-artifact/art_7026fbcdd84f1550/7) |
| Automatic brightness, True Tone | done | Browser limit, stated on the page; `sp-displays-rows-journey.mjs` |
| Color tab | done | No tab. Browser limit, stated: a page cannot change the colour profile; it shows the colour depth, colour range and dynamic range the browser reports; `sp-displays-rows-journey.mjs` |
| Night Shift tab | done | A check box that warms this page only, as the page says; no schedule; `displays-energy-journey.mjs`, [shot](#project-artifact/art_7026fbcdd84f1550/7) |
| AirPlay Display | done | Browser limit, stated on the page; `sp-displays-rows-journey.mjs` |
| Mirroring in menu bar | done | Browser limit, stated on the page; whether another screen is connected is shown from `screen.isExtended` where the browser reports it; `sp-displays-rows-journey.mjs` |
| Display title and picture | done | Browser limit, stated: a page cannot learn the display's name, so the window is titled This Screen and shows no picture; `sp-displays-rows-journey.mjs` |

## Sidecar

| Item | Status | Note |
| --- | --- | --- |
| Sidebar and Touch Bar pop-ups move the drawing | done | Compared by the drawing's pixels; `system-preferences-panes-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/236) |
| Connect to: No Devices | done | True on this desktop; `system-preferences-panes-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/236) |
| Double tap on Apple Pencil | done | Dimmed, saying no Apple Pencil can reach this page; `sp-served-rows-journey.mjs` |

## Energy Saver

| Item | Status | Note |
| --- | --- | --- |
| Served page: what the browser and the app really report, and what cannot be known | done | [Screenshot](#project-artifact/art_7026fbcdd84f1550/2) |
| Restore Defaults | done | Puts Turn display off after and the menu bar check box back; the check box's return is what the journey reads; `sp-served-rows-journey.mjs` |
| Automatic graphics switching | done | Browser limit: not offered, and the page says it cannot change what the computer does; `sp-served-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/498) |
| Turn display off after | done | Blanks this page after that long with no input on it; a video holds it off; `displays-energy-journey.mjs`, [shot](#project-artifact/art_7026fbcdd84f1550/7) |
| Prevent sleep, disk sleep, wake for network | done | Browser limit: the page says it cannot change when your computer sleeps; the same shot |
| Power Nap | done | Browser limit: the same; the same shot |
| Schedule… | done | Browser limit: the page says it cannot schedule the computer to start; the same shot |
| Battery tab | done | On the one page, not a tab: level and power source, where the browser reports them; the same shot |
| Battery status line | done | The same; a browser that does not report them is told apart; the same shot |
| Show battery status in menu bar | done | Takes the Battery extra away and brings it back, across a reload; `sp-served-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/499) |

## Date & Time

| Item | Status | Note |
| --- | --- | --- |
| Served page: what the browser and the app really report, and what cannot be known | done | [Screenshot](#project-artifact/art_7026fbcdd84f1550/2) |
| Open Language & Region… | done | Goes to that pane; `sp-date-time-rows-journey.mjs` |
| Set date and time automatically | done | Browser limit, stated on the page; `sp-date-time-rows-journey.mjs` |
| Time server | done | Browser limit, stated on the page; no server is named; `sp-date-time-rows-journey.mjs` |
| Date field and calendar | done | Today from the browser's clock, dimmed with why; the journey overrides the browser's time zone to tell a real reading from a captured one; `sp-date-time-rows-journey.mjs` |
| Time field and clock | done | The time now, running, dimmed with why; `sp-date-time-rows-journey.mjs` |
| Lock button | done | Dimmed: nothing here needs an administrator; `sp-date-time-rows-journey.mjs` |
| Time Zone tab | done | Zone, name and difference from UTC, read from the browser; a page cannot change them, as it says; `sp-date-time-rows-journey.mjs` |
| Clock tab | done | Sets the menu bar clock: show or hide, Digital or Analog, seconds, flashing separators, 24-hour (Language & Region's setting), AM/PM, day of the week, date, and Announce the time in the browser's voice under Output volume; kept across a reload; `sp-date-time-rows-journey.mjs` |

## Sharing

| Item | Status | Note |
| --- | --- | --- |
| Served page: what the browser and the app really report, and what cannot be known | done | [Screenshot](#project-artifact/art_7026fbcdd84f1550/2) |
| Computer Name, local address | done | The desktop's own address stands in, and the page says a page has no name on your local network; `sp-served-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/496) |
| Services checkboxes | done | Browser limit: the page says it cannot share the screen, files, printers or remote login; the same shot |
| File Sharing status | done | Browser limit: "Only your account, once signed in", and files are shared from Finder; Open Finder opens it; the same shot |
| Shared Folders | done | Browser limit: the same; the same shot |
| Users access pop-ups | done | Browser limit: the same; the same shot |
| + and − | done | Browser limit: the same; the same shot |
| Options… | done | Browser limit: the same; the same shot |
| Other services | done | Browser limit: the same; the same shot |
| Edit… | done | Browser limit: there is no local name to edit; the same shot |
| Drag a folder into Shared Folders | done | Browser limit: the same; the same shot |

## Time Machine

| Item | Status | Note |
| --- | --- | --- |
| Served page: what the browser and the app really report, and what cannot be known | done | [Screenshot](#project-artifact/art_7026fbcdd84f1550/2) |
| Menu extra says no disk and dims Back Up Now | done | `sp-served-rows-journey.mjs` |
| Backup progress | done | Not on this desktop: the page says nothing is backed up, and Latest backup says None; `sp-served-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/486) |
| Stop backing up | done | Not on this desktop: the same; the same shot |
| Back Up Automatically | done | Not on this desktop: the same; the same shot |
| Select Disk… | done | Not on this desktop: the page says it has no Time Machine disk; the same shot |
| Options… | done | Not on this desktop: the same; the same shot |
| Show in menu bar | done | Takes the extra away and brings it back, across a reload; `sp-served-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/499) |

## Startup Disk

| Item | Status | Note |
| --- | --- | --- |
| Served page: what the browser and the app really report, and what cannot be known | done | [Screenshot](#project-artifact/art_7026fbcdd84f1550/2) |
| Volumes | done | The deployment and site build stand in, as this desktop starts from its deployment, and the page says so; `sp-served-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/485) |
| Lock button | done | Not on this desktop: nothing here needs an administrator; the same shot |
| Choose a volume | done | Browser limit: the page says it cannot choose your computer's startup disk; the same shot |
| Restart… | done | Restarts this desktop, not the computer, asking first as the Apple menu does; the journey presses it and cancels; `sp-served-rows-journey.mjs` |
| Target Disk Mode… | done | Browser limit: the page says it cannot; the same shot |

## Apple ID

| Item | Status | Note |
| --- | --- | --- |
| Served page: what the browser and the app really report, and what cannot be known | done | [Screenshot](#project-artifact/art_7026fbcdd84f1550/2) |
| Pages list | done | Not on this desktop: the page says it has no Apple ID and no iCloud, and names the account instead; `sp-served-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/489) |
| iCloud apps checkboxes | done | Not on this desktop: the same; the same shot |
| Optimize Mac Storage | done | Not on this desktop: the same; Storage Management is a button away; the same shot |
| iCloud storage bar | done | The Ferrite Drive's free space as a line, standing in for iCloud Drive, as the page says; the same shot |
| Options, Manage | done | Open Storage Management… is the way to manage it; the same shot |
| Other pages | done | Not on this desktop: the same; the same shot |
| Media & Purchases | done | Not on this desktop: the same; the same shot |
| This device row | done | Not on this desktop: the same; the same shot |

## Family Sharing

| Item | Status | Note |
| --- | --- | --- |
| Served page: what the browser and the app really report, and what cannot be known | done | [Screenshot](#project-artifact/art_7026fbcdd84f1550/2) |
| Introduction | done | Not on this desktop: the page says Family Sharing needs Apple IDs; `sp-served-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/491) |
| Next | done | Not on this desktop: the same; the same shot |

## Build items, most-used first

Items that touch `demos/desktop/` need the Finder and desktop integration worker's files, which it holds; coordinate before changing them.

1. **Menus and keys.** View menu (Back, Forward, Show All, Search, Customize, pane list), Edit on the focused field, Help to Help Viewer, ⌘[ ⌘] ⌘L ⌘F, reopen on the last pane.
2. **Search.** Suggestion list and highlight; Spotlight results open a pane.
3. **General effects.** Menu bar hiding, sidebar size, scroll bars, font smoothing, close-on-quit, ask-to-keep, Help buttons to Help Viewer across all panes.
4. **Dock effects.** Minimize effect, animation, indicators, recents, double-click action.
5. **Truthful pass 1.** Date & Time real clock, Time Zone and Clock tabs (menu bar clock follows), Software Update from the site build, Displays from `screen`.
6. **Truthful pass 2.** Network from `onLine` and `connection`, Bluetooth, Printers, Time Machine, Startup Disk, Apple ID, Internet Accounts, Touch ID, Wallet, Family Sharing: real facts or a plain statement.
7. **Desktop pane.** Colors, Photos source, add a folder, drags, Change picture timer.
8. **Screen Saver and Hot Corners.** Drawn screen savers, idle start, clock, corners, lock after.
9. **Sound.** Web Audio alerts and interface sounds; Output and Input tabs; volume, mute and menu extra.
10. **Notifications.** Real apps, per-app settings honoured, Do Not Disturb schedule, sort order.
11. **Language & Region.** Region, 24-hour, first day and temperature followed by the desktop and Calendar; language list.
12. **Displays effects.** Brightness and Night Shift as a labelled page filter.
13. **Energy Saver.** Display sleep timer, Schedule as a statement or real timer, Battery tab from `useBattery`.
14. **Users & Groups.** Signed-in and other accounts, Change Password, picture with drag, Login Items, Login Options, lock with the account's password.
15. **Security & Privacy.** Require password, lock message, real browser permissions in Privacy, statements for FileVault and Firewall.
16. **Keyboard.** Shortcuts tab listing real keys, Text replacements, Dictation, statements for the rest.
17. **Accessibility.** Motor and General groups; Display, Zoom, Speech and Captions with real page effects; menu extra.
18. **Mission Control.** Bound shortcuts and Group by application, with the desktop's Mission Control.
19. **Siri and Spotlight panes.** Their settings honoured by those apps; Spotlight Privacy with drag.
20. **Extensions and Sharing.** Share Menu followed by the share sheet; computer name; Sharing's real facts and drag.
21. **Screen Time.** Measured front time per app in place of invented figures.
22. **Trackpad and Mouse.** Other tabs and a plain statement of what a page cannot change.
23. **Customize.** Hide panes, saved per account.
