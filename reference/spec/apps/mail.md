# Mail
- **Screenshots:** 10-15-Catalina-Light-Mail.png, 10-15-Catalina-Dark-Mail.png (cropped desktop captures: the viewer window is INACTIVE, a New Message window is key and overlaps it; wallpaper visible around)
- **Window (viewer):** 1061 x 711 pt [M] (light: image x=52..2173, y=38..1459; dark: x=40..2161, y=36..1457). Unified title bar + toolbar, title "Inbox (1 message)", plus a Favorites bar.
- **Window (New Message):** 886 x 585 pt [M] (light: x=502..2273, y=328..1497), title-less unified toolbar.

## Layout
Viewer, top to bottom (light px in parentheses; pt from the window top-left):

| Region | Size (pt) | Light | Dark | Tag / evidence |
|---|---|---|---|---|
| Title bar + toolbar (inactive: flat) | 55 high (y=38..147 incl. 1 pt bottom line) | `#f6f6f6`, line `#d1d1d1` | `#2c2d2f`, line `#000000` | [M] Light-Mail @ 300,38,1,110; Dark-Mail @ 240,188,1,6 |
| Favorites bar | 23 + 1 pt line (y=148..195) | `#f6f6f6`, line `#d1d1d1` | `#2c2d2f` | [M] Light-Mail @ 300,148,1,48 |
| Sidebar (`sidebar`, inactive material) | 200 wide (x=52..451) | `#f6f6f6` | `#2c2d2f` | [M] Light-Mail @ 250,600 |
| Divider | 1 | `#dedede` | `#000000` | [M] @ 452,300 / Dark @ 440,300 |
| Message list (`list-view`) | 343 wide (x=454..1139); sort bar 22 + 1 on top | list `#f6f6f6` under the sort bar, selected row `#dcdcdc` | `#2b2c2f`; selected `#464646` | [M] Light-Mail @ 1000,196,1,132 |
| Divider | 1 | `#d2d2d2` | `#000000` | [M] @ 1140,300 / Dark @ 1128,300 |
| Message viewer | 516 wide (x=1142..2173) | `#ffffff` | `#1c1d20` | [M] Light-Mail @ 1400,230; Dark-Mail @ 1140,300 |

```
+ title: Inbox (1 message) ------------------------------------------+
| [get][compose]   [arch][del|junk][reply|all|fwd][flag v][mute][Move to...]   [Search] |
| [=] Mailboxes  (Inbox)  Sent  Drafts (1)                            |
+-----------+----------------------+-----------------------------------+
| Mailboxes | Sort by Date v   (=) | Apple        September 29, 2019.. (A)|
|  Inbox    | Apple        9/29/19 | Your Apple ID was used ...  Details |
|  Drafts 1 | Your Apple ID was... |      +---- New Message window ----+ |
|  Sent     | Dear Stephen ...     |      | To: [Stephen Hackett v]      |
| Smart ... |                      |      | Cc:                          |
```

Toolbar item extents, light, image px on the button row (y=88..132): Get Mail 67..146; New Message 161..240; Archive 461..540; Delete | Junk 555..706 (joined pair, split at 630); Reply | Reply All | Forward 721..944 (splits at 796 and 868); Flag + menu 959..1050 (split at 1014); Mute 1065..1144; "Move to..." 1159..1488; Search 1522..2157 [M] (border pixels on row y=94 of 10-15-Catalina-Light-Mail.png). Buttons are 39 pt wide singles; all are drawn in the inactive style (flat `#f6f6f6` face, `#d1d1d1` border).

Favorites bar items (px, row y=172): sidebar-toggle icon + "Mailboxes" 82..218; "Inbox" 246..339 as the selected pill (`#c6c6c6`, 16 pt high, y=156..187); "Sent" 364..403; "Drafts (1)" 448..542 [M].

New Message window: toolbar 38 pt (y=328..403, gradient `#e5e5e5` -> `#cdcdcd`, bottom line `#a7a7a7`); header field rows 33 pt pitch (To y=404..467, Cc 470..533, Subject 536..599) separated by 1 pt `#e6e6e6` rules; body `text-view` white / `#1e1e20` [M] (10-15-Catalina-Light-Mail.png @ 1400,318,1,290).

## Components used
`window`, `title-bar`, `window-controls` (inactive grey in the viewer, coloured in the compose window), `toolbar`, `toolbar-button`, `toolbar-segmented-control`, `toolbar-pop-up` (Move to..., flag menu), `toolbar-search-field`, `scope-bar` (Favorites bar pill), `sidebar` (Mailboxes, inactive), `sidebar-badge` (Drafts "1"), `split-view`, `list-view` (message list), `text-view` (compose body, viewer), `token-field` (To: recipient token), `label`, `image-button` (list filter button), `desktop` (wallpaper behind).

## App-specific elements
- Sort bar: "Sort by Date" 12 pt Semibold with a small chevron, left inset 17.5 pt (x=489); circular filter button at the right (x~1094..1118). [M] 10-15-Catalina-Light-Mail.png @ 489,210,160,22.
- Message row: sender 13 pt Bold + right-aligned date; subject 13 pt; two preview lines in grey; line pitch 15 pt.
- Viewer header: sender "Apple" 15 pt Bold; date right-aligned grey 12 pt; "Details" link blue; monogram avatar disc 34.5 pt (x=2046..2114), fill grey `#9a9ea9 (sRGB #999eaa)`, white "A" [M] @ 2046,260,69,1.
- Compose header labels ("To:", "Cc:", "Subject:") grey 13 pt; recipient token `#c0d7fc (sRGB #bbd7ff)` with a disclosure chevron (light), blue in dark.

## Content in the screenshot
Title "Inbox (1 message)". Sidebar: header "Mailboxes"; rows Inbox (selected), Drafts [1], Sent, (dark only: Trash); header "Smart Mailboxes". List: "Sort by Date"; message "Apple" / "9/29/19" / "Your Apple ID was used to sign in to FaceTime and i..." / "Dear Stephen Hackett, Your Apple ID ...". Viewer: "Apple", "September 29, 2019 at 6:24 PM", "Your Apple ID was used to sign in to FaceTime and iMessa...", "Details". Compose: "To:" Stephen Hackett; "Cc:"; "Subject:" "Hello from macOS Catalina!". Search placeholder "Search"; pop-up "Move to...".

## Not reproducible / assets needed
Toolbar and sidebar glyphs (envelope, compose, archive box, trash, junk, reply arrows, flag, bell-slash, paper plane, paperclip, markup, "A", emoji, photo); Catalina wallpaper behind the windows.
