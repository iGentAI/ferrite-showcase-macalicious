# System Preferences — Internet Accounts

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Internet-Accounts.png`; `10-15-Catalina-Dark-System-Preferences-Internet-Accounts.png` [M].
- **Window:** 668 × 486 pt, both [M]; opaque frame `@ 112,76,1336,972`. Unified navigation/title/Search chrome reuses `toolbar`, `title-bar`, `window-controls`, `toolbar-segmented-control`, `toolbar-search-field` [I: shared shell]. Title “Internet Accounts” [M].
- **State:** same two account rows, neither selected; right side shows add-account providers in both appearances [M]. Provider artwork adapts: iCloud, Yahoo and AOL lettering is black/purple/black in light, white in dark; Exchange and Google retain colour [M].

## Layout

```text
+ navigation / Internet Accounts / Search ------------+
| (@) Internet Accounts sets up ...                   |
| + accounts ---+ + provider actions ----------------+|
| | iCloud      | |             iCloud                ||
| | Game Center | |             Exchange              ||
| |             | |             Google                ||
| |             | |             YAHOO!                ||
| |             | |             Aol.                  ||
| +-------------+ |         Add Other Account...      ||
| | + | − |     | |                              (?) ||
| +-------------+ +----------------------------------+|
+----------------------------------------------------+
```

Window-relative rectangles subtract the frame origin (112,76) and halve [C]. Stored colours only [M]. Evidence marked “both” uses each named screenshot at the same image coordinates [M].

| Region | Rect (x,y,w,h) pt [M] | Light / dark fill [M] | Evidence |
|---|---|---|---|
| Pane | (0,38,668,448) | #ececec / #303031 | both `@ 112,152,1336,896`; samples `10-15-Catalina-Light-System-Preferences-Internet-Accounts.png @ 120,180`, `10-15-Catalina-Dark-System-Preferences-Internet-Accounts.png @ 120,180` |
| Accounts list | (20,98,210,348) | #ffffff / #1e1e1f | both `@ 152,272,420,696`; fill `@ 160,450` |
| Add/remove strip | (20,446,210,21) | light gradient #f8f8f8 at centre / #3c3c3c dark | both `@ 152,968,420,40`, border top at y=966; centre `@ 160,985` |
| Provider group | (238,98,410,368) | #e3e3e3 / #363637 | both `@ 588,272,820,736`; sample `@ 600,300` |
| Provider separators | x=239, width=408; y=154,210,266,322,378; h=2 | #cdcdcd / #4a4a4a | both `@ 600,384,1,4`, subsequent image y=496,608,720,832 |

List border 1 pt [M], light #c5c5c5 / dark #646465, both `@ 152,450,2,1`. Provider outer border: use `box` tabless recipe [I: visibly matching the library box], measured outer edge at x=588 and x=1407 [M].

### Layout grid

Left margin 20 pt, account width 210 pt, gap 8 pt, provider width 410 pt, right margin 20 pt [C from region edges]. Header icon starts x=22 pt; prose first glyph x=69 pt, 16 pt line pitch [M/C]. Sidebar icons start near x=28 pt; labels x=60 pt [M]. Providers are horizontally centred within the right group (centre x=443 pt) at 56 pt pitch [C]. Footer add/remove have 25 pt pitch; help is inside provider group, not a full-window footer [M]. No lock or tab strip is shown [M].

## Components used

`label`, `image-view`, `sidebar`, `bordered-list`, `box`, `separator`, `gradient-button` (add/remove), `image-button` (provider actions), `help-button`, shared chrome [M].

### Complete control and label table

Rectangles below are pt [M], glyph ink for text and visible bezel for buttons. Text baseline `b` is the raster baseline excluding descenders [M]. Font R=13 pt, S=11 pt, L=16 pt regular [C: CONVENTIONS cap-height scaling; L has approximately 23 px caps]. Provider logos are image artwork, not system-font labels [M]. Every rect cites `10-15-Catalina-Light-System-Preferences-Internet-Accounts.png @ (112+2x),(76+2y),(2w),(2h)` and the equivalent dark region [M]; dark control positions match [M].

| Component / variant / state | Rect (x,y,w,h); text b | Visible text |
|---|---|---|
| image-view / pane icon | (22,50,36,36) | @ |
| label / R line one | (69,55,562,12.5); b=64 | Internet Accounts sets up your accounts to use with Mail, Contacts, Calendar, Messages, and |
| label / R line two | (68.5,71,67.5,12.5); b=80 | other apps. |
| sidebar / unselected account row | (21,99,208,42) | iCloud |
| image-view / iCloud cell artwork | (28.5,106.5,25,25.5) | — |
| label / R | (60,106,36.5,10); b=115.5 | iCloud |
| label / S secondary | (60,123,138.5,8); b=130.5 | iCloud Drive and 10 more... |
| sidebar / unselected account row | (21,141,208,42) | Game Center |
| image-view / Game Center artwork | (26.5,145,28.5,29.5) | — |
| label / S | (60,163,67.5,8); b=170.5 | Game Center |
| gradient-button / small add, normal | (20,446,25,21) | + |
| gradient-button / small remove, disabled | (45,446,25,21) | − |
| image-button / provider action normal | (239,99,408,55); logo ink (384,114,122,24) | iCloud |
| image-button / provider action normal | (239,156,408,54); logo ink (368,167,150.5,33) | Exchange |
| image-button / provider action normal | (239,212,408,54); logo ink (389,223,116,36.5) | Google |
| image-button / provider action normal | (239,268,408,54); logo ink (395.5,285,95,22) | YAHOO! |
| image-button / provider action normal | (239,324,408,54); logo ink (412.5,340,62.5,25) | Aol. |
| image-button / other provider action normal | (239,380,408,85); label L ink (368,401.5,149.5,12.5); b=413.5 | Add Other Account... |
| help-button / normal | light (612,430,20,20); dark (612.5,431,19,19) | ? |

The provider action rects are computed from the measured group edges and separator runs [C]; they express clickable row allocation, not a painted push-button bezel. Do not add visible outlines to those action rows [I: no individual bezel is present]. Other-account action contains a separate help control near its lower-right corner [M]. Help evidence: both `@ 1336,936,42,43`; column x=1356 [M]. Add/remove strip evidence: both row y=985, x=152..253; col x=155, y=966..1007 [M].

## App-specific elements

Large header “@” emblem ink is 36 × 36 pt [M], both `@ 156,176,72,72`; requires its circular cyan/blue artwork. Sidebar iCloud and Game Center icons need distinct assets from the provider logos [M]; their visible ink bounds are `10-15-Catalina-Light-System-Preferences-Internet-Accounts.png @ 169,289,50,51` and `10-15-Catalina-Light-System-Preferences-Internet-Accounts.png @ 165,366,57,59` [M]. Provider wordmarks and their icon padding are measured in the table [M]; preserve intrinsic proportions, including Google’s descender and AOL’s period [I: avoids arbitrary font approximations]. Provider separator has a conspicuous 2 pt thickness, not the common 0.5 pt divider [M], both image column x=600 at y=384..387.

## Content in the screenshot

The exact strings and six provider actions are in the table [M]. Sidebar iCloud summary is truncated exactly as shown; do not replace it with a complete list of services [I]. No credentials, email address, account details or provider dialog are captured [M]. Selected-account, pressed-provider, keyboard-focus and inactive states are not shown [M].

## Not reproducible / assets needed

Needs header emblem, two account icons, five provider wordmarks (appearance-specific iCloud/Yahoo/AOL variants) [I: these are custom artwork]. Provider authentication behavior and unseen account details cannot be recovered from these static captures [I]; this blueprint only describes the captured selection screen.
