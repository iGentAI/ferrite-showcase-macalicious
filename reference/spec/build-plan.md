# Build plan: component batches and demo apps

This plan splits the inventoried components (142 at first, 150 since batch B11 and the two B10a additions, 154 with the Colors panel, 156 since the demo audit, 158 since the second pass of B11, 160 with the book cover and the story card, 161 with the toolbar combo box, 162 with the capsule segmented control) into batches that separate threads can build at the
same time without touching the same files, in dependency order, and ranks the apps to rebuild as
demos. Batch membership is recorded per component in `inventory-meta.json` and shown in the last
column of `inventory.md`; the lists below are the same data.

## Why the batches cannot collide

The library's layout (root `CONTRIBUTING.md`) gives every component its own folder,
`src/components/<id>/`, where `<id>` is exactly the inventory id used here (`push-button`,
`pop-up-button`, `window-tab-bar`). Package entries, stylesheets, docs pages and visual tests are
picked up from the folder, so no list is edited by hand. A batch therefore owns a set of folders
and nothing else. Three rules keep that true:

1. **Tokens are changed only by batch T0** (one owner). A component thread that needs a shared
   value that is missing asks for it or keeps the value private in its own CSS; it does not edit
   `src/styles/tokens/*.css`.
2. **A component depends only on components in an earlier wave or in its own batch** (every wave-1
   batch may use `label` from wave 0). Dependencies
   are imports of the other component's public entry, never copies of its CSS.
3. **Demos live in `demos/<app>/`**, one folder per app, and import only published components.

## Waves

```text
Wave 0   T0 tokens | B0 label
Wave 1   B1 buttons | B2 selection controls | B3 fields and labels | B4 indicators and containers | B6 window chrome
Wave 2   B5 menus and choosers | B7 data views
Wave 3   B8a alerts, sheets, transient panels | B8b standard panels | B9a desktop shell | B9b system panels
Wave 4   B10a browser and media kits | B10b app-specific kits
Wave 5   demo apps (one thread per app)
```

Batches on the same line have no dependencies on each other and can run in parallel.

## Batches

Each component's spec is `components/<id>.md`. "Not seen" means no screenshot shows it; its spec is
built from documentation and inference and it cannot be compared visually.

### T0 tokens (wave 0)

- **Owns:** `src/styles/tokens/*.css` (scaffold thread).
- **Status:** done on 2026-10-01 by the token-layer thread: the token files carry the measured values of
  `tokens.md`, including the per-accent tables and the tinted and untinted dark grey ramps. Later
  corrections to the sheet go through `tokens-core.txt` here and are then applied there by that owner.
- **Specs that define token behaviour rather than a component:** `accent-colors`,
  `highlight-color`, `material`, `focus-ring`.
- **Check:** `tokens.md` sections "What changed when the token layer adopted this sheet" and "Notes from adopting the sheet in the token layer".

### B0 label (wave 0)

`label`: the static-text component and the text styles every other batch uses (control labels,
secondary and tertiary text, small text, links). It is built before wave 1 so that no wave-1 batch
depends on another wave-1 batch. Status: built (`src/components/label/`).

### B1 buttons (wave 1; depends on T0)

`push-button`, `default-button`, `help-button`, `gradient-button`, `bevel-button`, `round-button`
(AppKit style from documentation; only app-drawn circular buttons are shown), `image-button`,
`disclosure-button` (not seen), `disclosure-triangle`, `lock-button`, `borderless-button` (added
by the demo audit of 6 October 2026; specified on its docs page).

- The shared rounded bezel (heights, hairline edges, shadow rows, dark highlight rows) is the first
  thing to build; `push-button` already exists in the scaffold as the reference implementation.
- Visual references: Finder Go to Folder, Empty Trash and Copy Replace dialogs; System Preferences
  Security and Privacy, Users and Groups, Network (gradient buttons), any pane footer (help and lock).

### B2 selection controls (wave 1; depends on T0)

`checkbox`, `radio-button`, `switch`, `segmented-control`, `slider`, `circular-slider` (not seen),
`stepper`, `color-swatch-picker`, `color-well`, `image-well`.

- Visual references: System Preferences General (all 32 accent screenshots for accent tinting),
  Sound, Displays, Dock, Trackpad, Mouse (sliders with and without ticks), Date and Time (stepper),
  Desktop and Screen Saver (image well), Notification Center Today (the only switch).

### B3 fields and labels (wave 1; depends on T0, B0)

`text-field`, `secure-text-field` (standard style not seen), `search-field`, `token-field`,
`text-view`, `tooltip` (not seen), `empty-state`.

- Visual references: Finder Go to Folder and Connect to Server (focused field), Users and Groups,
  Network, Mail (recipient token), Finder Search (search token), TextEdit and Notes (text view).

### B4 indicators and containers (wave 1; depends on T0)

`progress-bar`, `progress-spinner`, `level-indicator`, `status-dot`, `new-item-dot`, `sidebar-badge`,
`tag-dot`, `page-control`, `box`, `separator`, `tab-view`, `image-view`.

- Visual references: Finder Copy (progress bar), Software Update, Storage Management and Disk Utility
  (capacity bars), Network (status dots), Sound, Keyboard, Trackpad and Security and Privacy (tab
  view on a box), Photo Booth and Launchpad (page dots).

### B6 window chrome (wave 1; depends on T0)

`window`, `window-shadow`, `title-bar`, `window-controls`, `toolbar`, `toolbar-button`,
`toolbar-segmented-control`, `toolbar-search-field`, `toolbar-labelled-item`, `window-tab-bar`,
`scope-bar`, `path-bar`, `status-bar`, `window-banner`.

- Includes the key, main and inactive window states (a `data-window-state` on the window that the
  controls inside read), which batches B1 to B5 need for their inactive renderings. The
  attribute is settled: `data-window-state` with values `key`, `main`, `inactive` (root `AGENTS.md`).
- Visual references: every Finder window capture, System Preferences (title-hidden 38 pt bar),
  Disk Utility and Console (icon and label toolbars), Safari Picture in Picture and the Command-Tab
  captures (inactive windows), the Graphite accent screenshots (grey window controls).

### B5 menus and choosers (wave 2; depends on B1, B2, B3)

`menu`, `menu-item`, `submenu`, `contextual-menu` (not seen), `dock-menu` (not seen),
`pop-up-button`, `pull-down-button`, `combo-box`, `share-menu`, `menu-bar`, `menu-bar-extra`,
`toolbar-pop-up`, `toolbar-combo-box`, `date-picker`, and the Colors panel a colour well opens
(not seen): `color-panel` with its pickers `color-wheel`, `color-sliders` and `color-palette`.

- `menu` first, then everything that opens one. `combo-box` uses `text-field`; `date-picker` uses
  `text-field` and `stepper`.
- Visual references: Apple, Finder, Go, Battery, Time Machine and user menus; the open application
  menu in all 32 accent screenshots; the Print dialog (open pop-up menu); Safari Sharing; Date and
  Time (date picker, clock, calendar); Font Book and Go to Folder (combo boxes).

### B7 data views (wave 2; depends on B1, B4, B6)

`scroll-view`, `split-view`, `table-view`, `table-header`, `outline-view`, `list-view`,
`column-view`, `icon-view`, `gallery-view`, `sidebar`, `ruler`, `bordered-list`.

- `scroll-view` and `split-view` first. `sidebar` uses `disclosure-triangle`, `sidebar-badge` and
  `tag-dot`; `bordered-list` uses `table-view` and `gradient-button`.
- Visual references: Activity Monitor, Console, Keychain Access, System Information (tables and
  outlines); Mail, Notes, Reminders (lists); Finder Network and the Open dialogs (column view);
  Finder Applications (icon view); Finder Gallery View; every sidebar app.

### B8a alerts, sheets and transient panels (wave 3; depends on B1 to B7)

`alert`, `dialog`, `sheet`, `popover`, `progress-window`, `about-window`, `assistant-window`,
`notification-alert`, `hud-window`, `drawer` (not seen), `placard` (not seen).

### B8b standard panels (wave 3; depends on B1 to B7)

`open-panel`, `save-panel` (not seen), `print-panel`, `preferences-window`, `preferences-toolbar`,
`inspector-panel`, `quick-look-panel`, `markup-toolbar`.

### B9a desktop shell (wave 3; depends on B5, B6)

`desktop`, `desktop-icon`, `desktop-stack`, `dock`, `dock-stack`, `launchpad`, `launchpad-folder`,
`mission-control`, `app-switcher`, `full-screen-window`, `split-view-full-screen`,
`picture-in-picture`.

- Owns the window manager used by the demos: z-order, key window, drag, resize, minimize to Dock,
  full screen. Everything that sits "behind" another surface must be in the same page for the
  materials to work (see `browser-limits.md`).

### B9b system panels (wave 3; depends on B3, B5, B6)

`spotlight`, `notification-center`, `today-widget`, `notification-banner`, `siri`, `dictation`,
`login-window`, `time-machine-browser`.

### B10a browser and media kits (wave 4; depends on B6, B7)

`safari-tab-bar`, `smart-search-field`, `favorites-bar` (not seen), `web-view`, `media-app-chrome`,
`now-playing-lcd`, `card-grid`, `store-pill-button`, `editorial-card`, `shelf-pager`, `book-cover`,
`story-card`.

- `editorial-card` (the hero banner and the App Store's editorial panel) and `shelf-pager` (the
  paging chevrons) were added on 2026-10-06. Both are members of the `card-grid` pattern that
  its component could not hold under the size budget; each has a spec of its own.
- `book-cover` (the Books library's cover cell) and `story-card` (the stories of News) were
  added on 2026-10-07 for the same reason. With them every member of the pattern is built.

### B10b app-specific kits (wave 4; depends on B6, B7)

`catalyst-chrome`, `homekit-tile`, `stock-row`, `waveform-view`, `calculator-keypad`, `sticky-note`,
`message-bubble`, `map-controls`, `calendar-week-grid` (specified in `apps/calendar.md`),
`account-header`, `preference-pane-icon`, `gesture-option-row`, `smart-list-tile` (added by the
demo audit of 6 October 2026; specified in `apps/reminders.md`).

- These exist to serve demos. Build each one together with, or just before, the demo that uses it;
  they are listed as a batch so that their folders have an owner.

### B11 inventory gap closure (after wave 4; depends on B0, B1, B4, B6)

`form`, `system-image`: the two things the screenshots show everywhere that the first inventory had
no row for. Added on 6 October 2026 together with the rows of four folders that had been built
without one (`window-manager` and `managed-window` in B9a, `calendar-mini-month` in B10b,
`token-field-completions` in B3).

- `form` uses `separator`; its comparisons use `pop-up-button`, `text-field` and `label`.
  `system-image` has no dependencies; its comparisons place the images in `gradient-button`,
  `toolbar-button` and `toolbar-segmented-control`.
- From here on a new component folder needs a row: add it to `inventory-meta.json`, write
  `components/<id>.md` (or point `spec` at where it is specified) and run `build.py inventory` and
  `build.py check`, which fails on a folder without a row and on a row that nothing implements.
- Visual references: Calendar Preferences and the Sharing pane (form); Console's toolbar, the
  Sharing pane's Users table, Finder's toolbar and the Language & Region list buttons (images).
- Second pass, after every screenshot of both appearances had been viewed for things without a
  row: `section-header` (no dependencies; reference: Finder's grouped search results in the
  Spotlight "More" captures) and `round-rect-button` (no dependencies; reference: Finder's Network
  window). `scope-bar` keeps its own `ScopeBarAction`, the same bezel laid out for the bar.
- From the audit of the demos: `capsule-segmented-control` (no dependencies; reference: the card
  being edited in the Aqua Contacts capture; no Dark Aqua capture shows it).

## Demo apps

### How the ranking was made

Two measures, both taken from the inventory: how well the screenshots cover the app (number of
screenshots in each appearance, and how many different states they show) and how many inventory
components the app exercises beyond the bare window chrome (the union over its screenshots, from
`inventory.json`). Apps whose pixels are mostly photographs, maps, video or 3D rendering are ranked
down because a faithful rebuild is mostly image assets, not components. Calculator is included on
the owner's explicit mention even though it exercises few library components.

Every demo needs both appearances and has a blueprint in `apps/` with measured layout, the visible
strings and the list of image assets it needs. "Shots" is light / dark.

### Recommended twelve, in build order

| # | Demo | Shots | Components exercised | Why | Screenshots to match (prefix `10-15-Catalina-Light-` / `-Dark-`) | Blueprints |
|---|---|---|---|---|---|---|
| 1 | **Desktop shell** (menu bar, Dock, desktop, Spotlight, Notification Center, Launchpad, Mission Control, app switcher) | 15 / 15 | 30+ across the system surfaces | Every other demo runs inside it; it is what makes the site "look exactly like Catalina" | Desktop, Stacks, Desktop-Stacks, Apple-Menu, Menu-Bar-Battery, Time-Machine-Menu, Fast-User-Switching-Menu, Spotlight, Spotlight-More, Notification-Center-Today, Notification-Center-Notifications, Launchpad, Launchpad-Folder, Mission-Control, Command-Tab | `desktop-and-dock`, `menu-bar-menus`, `spotlight`, `notification-center`, `launchpad`, `mission-control`, `app-switcher` |
| 2 | **Finder** | 17 / 17 | 50 | Best-covered app: four view modes, tabs, search, sidebar, dialogs, alerts, progress, inspector, Quick Look | Finder-Home, Applications, Applications-Utilities, Finder-Network, Finder-Gallery-View, Finder-Search, Finder-Get-Info, Finder-Go-To-Folder (dark: Go-to-Folder), Finder-Connect-to-Server (dark: Conect-to-Server), Finder-Copy, Finder-Copy-Replace, Finder-Empty-Trash, Finder-Eject-Warning, Finder-Quick-Look, Finder-Quick-Look-Markup, Finder-Menu, Finder-Go-Menu | `finder`, `finder-dialogs`, `finder-get-info`, `quick-look` |
| 3 | **System Preferences** | 34 / 34 plus 32 accent shots | 49 | The control showcase: every standard control, tab views, boxes, lists, and live accent and appearance switching | System-Preferences-0 and the 33 panes (General, Dock, Displays, Sound, Keyboard, Trackpad, Network, Security-and-Privacy, Users-and-Groups, Date-and-Time, Notifications first); Theme-{Morning,Light,Evening,Dark}-{accent} | `system-preferences`, `system-preferences-<pane>` (33), `accent-theme-desktop` |
| 4 | **Safari** | 7 / 7 | 32 | Tabs, Smart Search field, start page, Reader, Tab Overview, Share menu, preferences window, Picture in Picture | Safari-v13, Safari-v13-Favorites, Safari-v13-Reader-Mode, Safari-v13-Tab-Overview, Safari-v13-Sharing, Safari-v13-Picture-in-Picture, Safari-v13-Preferences | `safari`, `safari-preferences` |
| 5 | **Calculator** | 1 / 1 | `calculator-keypad` plus window chrome | Named by the owner; tiny, self-contained, no image assets, fully specified key matrix | Calculator | `calculator` |
| 6 | **Mail** | 2 / 2 | 22 | Three-pane app: sidebar with badges, message list, viewer, compose window with token field, inactive-window rendering, preferences | Mail, Mail-Preferences | `mail`, `mail-preferences` |
| 7 | **TextEdit with Open and Print dialogs** | 4 / 4 | 9 + 18 + 20 | Document window with format bar and ruler, plus the two standard panels (open panel with column view, print sheet with open pop-up menu) | Text-Edit (dark: TextEdit), Finder-Open, Finder-Open-iCloud, Print | `textedit`, `open-dialog`, `print-dialog` |
| 8 | **Calendar** | 2 / 2 | 19 | Week grid, mini month, event popover, toolbar segmented control, preferences | Calendar, Calendar-Preferences | `calendar`, `calendar-preferences` |
| 9 | **Music** | 2 / 2 | 21 | Media chrome: transport controls, now-playing display, volume slider, sidebar, album grid, preferences; little artwork needed | Music, Music-Preferences | `music`, `music-preferences` |
| 10 | **Notes** | 1 / 1 (also in Split-Screen-Apps) | 14 | Sidebar, note list, text view, toolbar; also the left tile of the Split View screenshot | Notes, Split-Screen-Apps | `notes`, `full-screen-and-split-view` |
| 11 | **Reminders** | 1 / 1 | 15 | Sidebar with coloured list badges and search field, list rows with checkmarks, popover | Reminders | `reminders` |
| 12 | **Activity Monitor** | 1 / 1 | 11 | The table demo: sortable header, alternating rows, emphasized selection, toolbar segmented control, footer boxes | Activity-Monitor | `activity-monitor` |

### Next eight, if more are wanted

| # | Demo | Shots | Components | Note | Blueprint |
|---|---|---|---|---|---|
| 13 | Preview | 2 / 2 | 18 | Toolbar pop-up, sidebar thumbnails, search scope bar; needs the PDF pages as images | `preview` |
| 14 | Messages | 1 / 1 | 15 | Conversation list and bubbles; region capture, so the window frame is partly cropped | `messages` |
| 15 | Contacts | 1 / 1 | 17 | Three-column list and card, action buttons, detached menu; region capture | `contacts` |
| 16 | Podcasts | 2 / 2 | 16 | Shares the media chrome with Music; two now-playing states | `podcasts`, `podcasts-preferences` |
| 17 | App Store | 1 / 1 | 9 | Card grid and offer buttons; identical content in both appearances; many icons needed | `app-store` |
| 18 | Stickies | 1 / 1 | 2 | Trivial and charming on the desktop: notes are pure CSS | `stickies` |
| 19 | Disk Utility | 1 / 1 | 14 | Icon and label toolbar, three-level outline sidebar, capacity bar | `disk-utility` |
| 20 | QuickTime Player | 1 / 1 | 3 | HUD controller; the same dark styling in both appearances | `quicktime-player` |

### Poor demo candidates

- **Chess, Photo Booth, FaceTime, Maps, Find My, Photos, Books (reader), News, TV:** most of the
  window is a 3D scene, camera image, map, photographs or licensed artwork. They can be rebuilt as
  frames around image assets, but that shows little of the toolkit.
- **AirPort Utility:** the "Light" capture is dark-styled, so there is no light reference.
- **Siri, Dictation, Login window, Time Machine:** system surfaces rather than apps; they belong to
  the desktop shell as optional extras (blueprints exist for each).

### What a demo thread gets

For each demo: the blueprint(s) in `apps/` (window size, every region with size and colours in both
appearances, toolbar item positions, list and grid metrics, exact strings), the component specs it
cites, the token sheet, and the screenshots above as visual-test references. Image assets (app and
document icons, wallpapers, artwork) are listed at the end of each blueprint; none are extracted or
redrawn by this specification, and Apple's artwork cannot be redistributed, so each demo needs
substitutes or a decision from the project on how icons are sourced.
