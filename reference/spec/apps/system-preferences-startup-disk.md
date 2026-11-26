# System Preferences — Startup Disk

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Startup-Disk.png`; `10-15-Catalina-Dark-System-Preferences-Startup-Disk.png` [M].
- **Window:** 668 × 403 pt in both [M]; opaque frame `@ 112,76,1336,806`. Title “Startup Disk”; shared unified navigation shell uses `toolbar`, `title-bar`, `window-controls`, `toolbar-segmented-control`, `toolbar-search-field` [I] (common System Preferences shell, not the icon preferences toolbar).
- **State:** authorization locked in both [M]. Light shows **Macintosh SSD only**; dark shows **Macintosh HD followed by Macintosh SSD**, plus a scanning spinner at the heading's trailing edge [M]. Both status paragraphs name Macintosh SSD as the selected startup disk [M]. No visible blue selection bezel [M].

## Layout

```text
+ navigation / Startup Disk / Search -------------------+
| Select the system ...                         (spinner)|
| +----------------------------------------------------+|
| | [disk] label       [second disk, dark only]         ||
| +----------------------------------------------------+|
| You have selected macOS, 10.15             [Restart...]|
| on the disk “Macintosh SSD.”                           |
|                                                       |
| Click to restart this computer in target disk mode    |
| explanatory text, three lines       [Target Disk Mode]|
|                                                       |
| (lock) Click the lock to make changes.                 |
+-------------------------------------------------------+
```

Coordinates are relative to frame in pt [C] (image minus (112,76), divided by 2). Colours below are stored channels [M].

| Region | Rect (x,y,w,h) pt [M] | Light / dark fill [M] | Evidence |
|---|---|---|---|
| Body and footer | (0,38,668,365) | #ececec / #303031 | both `@ 112,152,1336,730`; samples `10-15-Catalina-Light-System-Preferences-Startup-Disk.png @ 120,180`, `10-15-Catalina-Dark-System-Preferences-Startup-Disk.png @ 120,180` |
| Startup-volume chooser including border | (20,83,628,100) | #ffffff / #1e1e1f | both `@ 152,242,1256,200`; row y=260, col x=1400; fill samples `@ 600,300` |
| Selected-volume status allocation | (28,190,240,27) | inherited body | both `@ 168,456,480,54` |
| Target disk explanation allocation | (23,257,383,58) | inherited body | both `@ 158,590,766,116` |
| Authorization footer allocation | (19.5,354.5,227,27.5) | inherited body | light `@ 151,785,454,55`; dark same region |

Chooser border light #c5c5c5, dark #565656 at image (152,260) [M]. Disk captions are subdued: light #c0c0c0, dark #555556, modal palette of `@ 190,333,180,50` excluding background [M]. This is the locked chooser's rendering, not missing text [I] (lock status explains the subdued volume entries).

### Layout grid

Chooser horizontal margins 20 pt [M]. Heading first glyph x=22.5 pt [M]. Disk centres x=82.5 pt in light, x=82.5 and 207.5 pt in dark [C] (from image centres 277,527); cell pitch 125 pt [C]. Two caption lines have approximately 13.5 pt pitch [M]. Restart and Target Disk Mode buttons share left x=495.5 pt, right=647.5 pt [M]; their top-edge pitch=55 pt [M]. Paragraph label column x=23..28.5 pt is leading-aligned, not a right-aligned form [M]. Target explanation line pitch 14 pt [M]. Lock artwork left=19.5 pt, bottom=382 pt; bottom margin=21 pt [C]. No help button [M].

## Components used

`label`, `bordered-list`, `icon-view`, `image-view`, `push-button`, `progress-spinner` (dark only), `lock-button`, shared chrome [M].

### Complete control and label table

Rect dimensions [M], pt conversion [C]. R=13 pt regular, H=13 pt bold, S=11 pt regular [C] (cap heights 18 px / 16 px). `b` is cap-derived baseline [C]; label x is first-glyph coordinate [M]. Evidence for each rect is `10-15-Catalina-Light-System-Preferences-Startup-Disk.png @ (112+2x),(76+2y),(2w),(2h)` or explicitly dark-only equivalent [M]. Row/col checks at y=260,293,480 and x=274,1300,1400 confirm chooser, artwork and button edges in both [M]. Dark bezels are inset 0.5 pt [M].

| Component / variant / state | Rect (x,y,w,h) pt; glyph x / b / class | Exact visible text |
|---|---|---|
| label / heading | (22.5,59,388.5,12.5); b=68, H | Select the system you want to use to start up your computer |
| progress-spinner / dark only | allocation (630,57,16,16) [I] (standard spinner allocation around visible spokes in dark `@ 1372,190,32,32`) | — |
| icon-view / locked cell, light | artwork (69.5,95.5,28,30.5); caption x=43.5, b=138.5, S | Macintosh SSD |
| label / locked cell, light | (47.5,144,69.5,10); b=152, S | macOS, 10.15 |
| icon-view / locked first cell, dark | artwork (69.5,95.5,28,30.5); caption x=46, b=139, S | Macintosh HD |
| label / locked first cell, dark | (47.5,143.5,70,10.5); b=152, S | macOS, 10.15 |
| icon-view / locked second cell, dark | artwork (194.5,95.5,28,30.5); caption x=167, b=139, S | Macintosh SSD |
| label / locked second cell, dark | (171.5,143.5,70,10.5); b=152, S | macOS, 10.15 |
| label / S status line | (28.5,193.5,168,10.5); b=201.5 | You have selected macOS, 10.15 |
| label / S status line | (28.5,207.5,152,9); b=215.5 | on the disk “Macintosh SSD.” |
| push-button / regular normal | (495.5,199,152,20.5); x=545, b=213.5, R | Restart... |
| label / R section heading | (23.5,258,296,12.5); b=267 | Click to restart this computer in target disk mode |
| push-button / regular normal | (495.5,254,152,20.5); x=513.5, b=268, R | Target Disk Mode... |
| label / S explanation line | (23,276.5,382.5,11); b=284.5 | After you restart this computer in target disk mode, you can connect it to |
| label / S explanation line | (23.5,290.5,371.5,11); b=298.5 | another computer using a Thunderbolt or FireWire cable and use it as a |
| label / S explanation line | (23.5,304.5,50,8.5); b=312.5 | hard disk. |
| lock-button / locked | artwork (19.5,354.5,22,27.5); label (55.5,367,190.5,12.5), b=376, R | Click the lock to make changes. |

## App-specific elements

Macintosh SSD uses a gold external-drive icon; Macintosh HD in the dark capture uses a grey internal-drive icon [M]. Artwork source areas: light `@ 251,267,56,61`, dark `@ 251,267,56,61` and `@ 501,267,56,61` [M]. Captions are centred beneath individual disk images [M]. Tiny isolated pixels near the gap below the status row are present in the captures; they are not a separator or control [I] (no continuous line is measurable).

## Content in the screenshot

Every visible pane label/control is listed above [M]. Disk discovery is visibly at different stages [I] (extra dark volume and spinner). The captures do not establish scan duration, volume order after scanning, unlock dialog, restart confirmation or target-mode screen [M]. Hover, pressed, keyboard focus and inactive states are not shown [M].

## Not reproducible / assets needed

Need the two drive icons, locked authorization artwork, spinner frames and shared shell glyphs [M]. A browser can reproduce chooser/status presentation but cannot select a Mac boot volume, restart the computer or enter Target Disk Mode [I] (privileged hardware/OS operations).
