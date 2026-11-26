# System Preferences — Users & Groups

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Users-and-Groups.png`; `10-15-Catalina-Dark-System-Preferences-Users-and-Groups.png` [M].
- **Window:** 668 × 486 pt both [M]; opaque frame `@ 112,76,1336,972`. Title “Users & Groups”; unified navigation reuses `toolbar`, `title-bar`, `window-controls`, `toolbar-segmented-control`, `toolbar-search-field` [I] (common System Preferences shell, not app-preferences icon toolbar).
- **State:** locked, Stephen/Admin selected, Password tab selected in both [M]. **Dark additionally lists mhackett/Standard before Guest User/Off** [M]. Reset-password checkbox is disabled/off; administer-computer checkbox disabled/on [M]. **Dark tab group extends 4 pt farther down; Contacts Card/Open and the two disabled checkboxes are 4 pt lower** [M]. Other positions match [M].

## Layout

```text
+ navigation / Users & Groups / Search ------------------+
| +----------------+ +[Password|Login Items]------------+|
| | Current User   | | (penguin) Stephen [Change Password]|
| | penguin Stephen| |                                  ||
| |         Admin  | |                                  ||
| | Other Users    | |                                  ||
| | mhackett (dark)| |                                  ||
| | Guest User Off | |                                  ||
| |                | |           Contacts Card: [Open...]||
| |                | | □ Allow user to reset ...        ||
| | Login Options  | | ☑ Allow user to administer ...   ||
| | [+][-]         | +----------------------------------+|
| +----------------+                                     |
| (lock) Click the lock to make changes.              (?) |
+-------------------------------------------------------+
```

All coordinates are frame-relative pt [C] (image minus (112,76), divide by 2). Colours are stored channels [M].

| Region | Rect (x,y,w,h) pt [M] | Light / dark fill [M] | Evidence |
|---|---|---|---|
| Body/footer | (0,38,668,448) | #ececec / #303031 | both `@ 112,152,1336,896`; samples `10-15-Catalina-Light-System-Preferences-Users-and-Groups.png @ 120,180`, `10-15-Catalina-Dark-System-Preferences-Users-and-Groups.png @ 120,180` |
| Account list including border | (20,66,170,347) | #ffffff / #1e1e1f | both `@ 152,208,340,694`; col x=155; fill samples `@ 160,450` |
| Selected current-user row | (21,90,168,34) | #dcdcdc / #464646 | both `@ 154,256,336,68`; col x=155 |
| Login Options row | (21,357.5,168,35.5) | #ffffff / #1e1e1f | both `@ 154,791,336,71`; sample `@ 180,793` |
| List-management strip | (20,392,170,21) | #f6f6f6 / #3c3c3c at sample | both `@ 152,860,340,42`; row y=875; sample `@ 175,890` |
| Password content group | light (198,66,448,344), dark (198,66,448,348) | #e3e3e3 / #363637 | light `@ 508,208,896,688`, dark `@ 508,208,896,696`; col x=1399; fills `@ 525,400` |
| Tab strip | (334,56,177,20) | selected accent; white / #646465 unselected | both `@ 780,188,354,40`; row y=195 |

At image (800,900), light is already on footer #ececec while dark remains inside the longer group #363637 [M]. The account list does not grow with the extra dark account [M].

### Layout grid

List outer margins x=20 pt and top=66 pt [M]. Gap from list right to group left=8 pt [C]. List header first glyph x=29.5 pt, account first glyph x=59..62 pt; user/status line pitch about 15 pt [M]. Large avatar x=229 pt, user heading x=303.5 pt, Change Password button x=476.5 pt [M]. Contacts Card label right edge=418 pt, Open bezel left=426.5 pt, gap=8.5 pt [C]. Checkbox left=230 pt, label first glyph x=247.5 pt [M]; checkbox pitch=28 pt [M]. Lower control y values shift +4 pt in dark [M]. Group right=646 pt; Change Password right=622 pt [M]. Authorization artwork x=25.5 pt, y=437.5 pt, bottom margin=21 pt [C]. Help left=625.5 pt, top=446.5 pt [M].

## Components used

`bordered-list`, `sidebar`, `table-view`, `label`, `image-view`, `image-button`, `gradient-button` (list plus/minus), `tab-view`, `box`, `push-button`, `checkbox`, `lock-button`, `help-button`, shared chrome [M].

### Complete control and label table

Geometry [M], pt conversion [C]. R=13 pt regular, H=13 pt bold, S=11 pt regular [C] (cap heights 18/19 px and 16 px). `b` is cap-derived baseline [C]; x is first glyph [M]. Each rect maps to `10-15-Catalina-Light-System-Preferences-Users-and-Groups.png @ (112+2x),(76+2y),(2w),(2h)` and equivalent dark region [M], applying explicitly stated dark offsets. Row/column confirmations: y=195,209,278,450,720,875; x=155,580,632,1070,1300,1382,1399 [M]. Normal dark push-button bezels are inset 0.5 pt from their light allocation [M].

| Component / variant / state | Rect (x,y,w,h) pt; glyph x / b / class | Exact visible text |
|---|---|---|
| label / S list section | (29.5,76,66.5,8); b=83.5 | Current User |
| sidebar / selected current-user cell | (21,90,168,34); avatar (29,95,24,24); name x=59.5, b=103.5, R | Stephen |
| label / S selected-user status | (59,109.5,32,9); b=118 | Admin |
| label / S list section | light (29,132,61.5,8), dark (28.5,131.5,62,8.5); b=139.5 | Other Users |
| sidebar / light locked guest cell | allocation (21,145,168,34); avatar (31,150,24,24); x=62, b=158.5, R | Guest User |
| label / S light guest status | (61.5,165,15.5,8); b=172.5 | Off |
| sidebar / dark locked other-user cell | allocation (21,145,168,34); avatar (31,150,24,24); x=62, b=158.5, R | mhackett |
| label / S dark other-user status | (61.5,164.5,46,8.5); b=172.5 | Standard |
| sidebar / dark locked guest cell | allocation (21,179,168,34); avatar (31,184,24,24); x=62, b=192.5, R | Guest User |
| label / S dark guest status | (61.5,198.5,15.5,8.5); b=206.5 | Off |
| sidebar / Login Options normal | (21,357.5,168,35.5); house (29,363,22,22); x=58, b=376.5, R | Login Options |
| gradient-button / small disabled add | (20,392,24,21) | + |
| gradient-button / small disabled remove | (44,392,25,21) | − |
| tab-view / R selected | (334,56,83,20); x=346.5, b=70.5 | Password |
| tab-view / R unselected | (417,56,94,20); x=428.5, b=70.5 | Login Items |
| image-button / current account portrait | (229,93,62,62) | — |
| label / H current account | (303.5,105,53,12.5); b=114.5 | Stephen |
| push-button / regular normal | (476.5,99.5,146,20.5); x=490, b=113.5, R | Change Password... |
| label / R right aligned | light (328.5,322,89.5,10.5), dark (328.5,326,89.5,10); b=331.5 / 335.5 | Contacts Card: |
| push-button / regular normal | light (426.5,317.5,71,20.5), dark allocation (426.5,321.5,71,20.5); x=441, b=331.5 / 335.5, R | Open... |
| checkbox / regular disabled off | light (230,348,14,14), dark (230,352,14,14); x=247.5, b=359.5 / 363.5, R | Allow user to reset password using Apple ID |
| checkbox / regular disabled on | light (230,376,14,14), dark (230,380,14,14); x=247.5, b=387.5 / 391.5, R | Allow user to administer this computer |
| lock-button / locked | artwork (25.5,437.5,22,27.5); label x=61.5, b=459.5, R | Click the lock to make changes. |
| help-button / normal | (625.5,446.5,20,20) | ? |

## App-specific elements

Stephen's circular penguin portrait appears at large source `@ 570,262,124,124` and small source `@ 170,266,48,48` [M]. Other account avatars: dark mhackett has a yin-yang symbol, Guest User a grey user silhouette [M]; dark source areas `@ 174,376,48,48` and `@ 174,444,48,48`, light Guest `@ 174,376,48,48` [M]. Login Options house icon source `@ 170,802,44,44` [M]. Locked user cells are subdued except the selected current user's text/avatar [M]. The large blank group middle is captured layout, not a missing panel [M].

## Content in the screenshot

All visible labels, users, statuses, checks and footer strings are above [M]. Login Items contents, portrait picker, password sheet, Contacts card, account-management menus and authorization prompt are not shown [M]. The extra dark user is real content variation; do not replace it with light Guest User [M]. No hover/pressed/focus or unlocked state is captured [M].

## Not reproducible / assets needed

Need penguin portrait at both resolutions, yin-yang and guest avatars, house glyph, lock artwork and shared shell glyphs [M]. Browser imitation cannot manage Mac accounts/passwords or grant administrator rights [I] (privileged OS authorization). Contacts integration requires a separately modeled interaction because the opened card is not shown [I].
