# System Preferences — Time Machine

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Time-Machine.png`; `10-15-Catalina-Dark-System-Preferences-Time-Machine.png` [M].
- **Window:** 668 × 440 pt in both [M], opaque frame `@ 112,76,1336,880`. Title “Time Machine”; shared shell uses `toolbar`, `title-bar`, `window-controls`, `toolbar-segmented-control`, `toolbar-search-field` and `focus-ring` [I] (common System Preferences navigation, not icon preferences toolbar).
- **State:** both Back Up Automatically and Show Time Machine in menu bar are checked [M]. **Light is actively backing up, with progress/cancel; dark is idle, with three dated schedule lines** [M]. Search has an insertion caret and blue focus ring only in light [M]. Capacity strings differ [M].

## Layout

```text
+ navigation / Time Machine / Search --------------------+
|                | ------------------------------------ |
| (large clock)  | [drive]      Time Machine             |
| Time Machine   |              capacity                |
| ☑ Back Up ...  | [Select Disk] progress / dates        |
|                | ------------------------------------ |
|                | Time Machine keeps:                  |
|                | • Local snapshots ...                |
|                | • Hourly / Daily / Weekly ...         |
|                | The oldest backups ...               |
|                |                                      |
|                | ☑ Show ...          [Options...] (?)  |
+-------------------------------------------------------+
```

Coordinates are frame-relative pt [C] (image coordinates minus (112,76), divided by 2). Colours are stored channels [M].

| Region | Rect (x,y,w,h) pt [M] | Light / dark fill [M] | Evidence |
|---|---|---|---|
| Left identity/options region | (0,38,229,402) | #ececec / #303031 | both `@ 112,152,458,804`; samples `10-15-Catalina-Light-System-Preferences-Time-Machine.png @ 130,180`, `10-15-Catalina-Dark-System-Preferences-Time-Machine.png @ 130,180` |
| Vertical divider | (229,38,1,402) | #dedede then #e1e1e1 / #4f4f50 then #414142 | both `@ 570,152,2,804`; row y=600 and sample `@ 570,350` |
| Right detail/footer region | (230,38,438,402) | #e3e3e3 / #363637 | both `@ 572,152,876,804`; samples `@ 610,230` |
| Top separator | (243,65,415,1) | #cdcdcd / #4a4a4b | both `@ 598,206,830,2`; samples `@ 700,206` |
| Backup-section separator | (243,224,415,1) | #cdcdcd / #4a4a4b | both `@ 598,524,830,2`; samples `@ 700,524` |
| Light progress track | (401,138.5,199,6) | unfilled #d3d3d3; filled #4d89f4 (sRGB #3c87fc) | light `@ 914,353,398,12`; row y=358, col x=1240; dark absent [M] |

### Layout grid

Left region centres identity artwork/title around x=115 pt [C] (from artwork centre image x=342). Its checkbox left=37 pt, title first glyph x=56.5 pt [M]. Right-region text column x=261.5..262.5 pt below the separator; backup status column x=400.5..401 pt [M]. Select Disk centred under drive [C], top y=170 pt [M]. First explanatory baseline y=254.5 pt; bullet baseline pitch 17 pt, gap to first bullet=22 pt, final paragraph gap=22 pt [M]. Right footer checkbox top y=405 pt and Options top y=402 pt [M]; help top y=402.5 pt [M]. Bottom margin below Options bezel=16.5 pt [C]. No tabs, lock or right-aligned form column [M].

## Components used

`split-view`, `separator`, `image-view`, `label`, `checkbox`, `push-button`, `progress-bar`, `round-button` (cancel), `help-button`, shared chrome and light search `focus-ring` [M].

### Complete control and label table

Geometry [M], pt conversion [C]. R=13 pt regular, H=13 pt bold, B=12 pt regular explanatory/status text [C] (capitals 18/19 px and 17 px). `b` is cap-derived baseline [C]; first glyph x is supplied for all labels [M]. Each rect maps to `10-15-Catalina-Light-System-Preferences-Time-Machine.png @ (112+2x),(76+2y),(2w),(2h)` and corresponding dark region, except appearance-specific rows [M]. Confirmation rows/columns: y=329,423,600,890; x=340,650,700,755,830,1260 [M]. Dark push-button bezel lies 0.5 pt inside light painted bounds [M].

| Component / variant / state | Rect (x,y,w,h) pt; glyph x / b / class | Exact visible text |
|---|---|---|
| image-view / large Time Machine icon | (59,71,112,112) | — |
| label / H centred title | (70.5,196.5,89,10.5); b=206.5 | Time Machine |
| checkbox / R on | (37,228,14,14); x=56.5, b=237.5 | Back Up Automatically |
| image-view / backup drive | (296,95,54,57.5) | — |
| label / H drive name | (400.5,95.5,89,10.5); b=105.5 | Time Machine |
| label / B capacity, light | (400.5,116,150.5,9); b=124.5 | 49.7 GB of 60 GB available |
| label / B capacity, dark | (400.5,116,148.5,9); b=124.5 | 41.3 GB of 60 GB available |
| progress-bar / determinate, light only | (401,138.5,199,6); fill ends x=529 pt | — |
| round-button / light cancel backup | (616.5,134.5,14,14) | × |
| label / B light status | (401,156,193.5,11.5); b=164.5 | Backing up: 504.6 MB of 787.8 MB |
| label / B light estimate | (401,175,163,11.5); b=183.5 | Less than a minute remaining |
| label / B dark status | (400.5,136,200,11); b=144.5 | Oldest backup: Yesterday, 10:17 AM |
| label / B dark status | (401,155,176.5,11); b=163.5 | Latest backup: Today, 10:15 AM |
| label / B dark status | (401,174,165.5,11); b=182.5 | Next backup: Today, 11:15 AM |
| push-button / regular normal | (269.5,170,106,20); x=283.5, b=184.5, R | Select Disk... |
| label / B introductory line | (261.5,246,118,11); b=254.5 | Time Machine keeps: |
| label / B bullet line | (262.5,268,198,11); b=276.5 | • Local snapshots as space permits |
| label / B bullet line | (262.5,285,217,11.5); b=293.5 | • Hourly backups for the past 24 hours |
| label / B bullet line | (262.5,302,193.5,11.5); b=310.5 | • Daily backups for the past month |
| label / B bullet line | (262.5,319,231,11.5); b=327.5 | • Weekly backups for all previous months |
| label / B final paragraph | (261.5,341,344.5,11.5); b=349.5 | The oldest backups are deleted when your disk becomes full. |
| checkbox / regular on | (261,405,14,14); x=279.5, b=417, R | Show Time Machine in menu bar |
| push-button / regular normal | (534.5,402,85,20.5); x=548.5, b=416, R | Options... |
| help-button / normal | (629.5,402.5,20,20) | ? |

The first explanatory baseline is y=254.5 pt [C] (from capital T at image x=635..647, y=569..585); label ink includes descenders below that baseline [M]. The filled progress region spans image x=914..1169 in the light capture [M], not a claimed underlying numerical progress setting [I].

## App-specific elements

Large icon source `@ 230,218,224,224` and drive art `@ 704,266,108,115` [M]. Same coloured artwork cores in both appearances [M]; exterior antialias/shadow differs with background [M]. Large icon depicts a clock/return arrow, not a stock line symbol [M]. Disk image incorporates smaller matching icon on a drive [M]. The sidebar does not have a selection row [M].

## Content in the screenshot

Every visible pane string is transcribed above [M]. Light backup total and dark capacity/timestamps must remain appearance-specific rather than harmonized [M]. Disk-selection dialog, Options sheet and backup history are not shown [M]. Idle dark has no progress bar or cancel button [M].

## Not reproducible / assets needed

Need the large Time Machine icon, matching drive artwork, cancel template and shared toolbar glyphs [M]. Still captures do not supply animated progress, changing estimates or real backup storage [M]. Browser imitation cannot run macOS Time Machine or configure its backup policy [I] (OS-specific service).
