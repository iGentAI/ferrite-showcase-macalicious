# Script Editor
- **Screenshots:** 10-15-Catalina-Light-Script-Editor.png, 10-15-Catalina-Dark-Script-Editor.png
- **Window:** 700 x 705 pt [M] (image x=112..1511, y=76..1485). Title bar + toolbar, 55 pt (y=76..185). Title "Untitled (Untitled Mail Rule Action.scptd 2)" (dark: "... .scptd)").

## Layout
| Region | Size (pt) | Light | Dark | Tag / evidence |
|---|---|---|---|---|
| Title + toolbar | 55 | gradient `#f4f4f4` -> `#c4c4c4`, line `#a7a7a7` | `#37393c`, line `#000000` | [M] Light-Script-Editor @ 250,76,1,110; Dark @ 1000,180,1,6 |
| Navigation bar (language and element pop-ups) | 18.5 + 0.5 line (y=186..223) | `#ececec`, line `#b1b2b2` | `#323232`, line `#656564` | [M] @ 1000,186,1,38 |
| Script text view (`text-view`) | y=224..1063 (420) | `#ffffff` | `#ffffff` (stays white) | [M] @ 1000,224,1,60 |
| Divider (`split-view`) | 1 (y=1064) | `#d5d5d5` | `#000000` | [M] @ 1000,1064,1,2 |
| "Description" header | 22.5 + 0.5 line (y=1066..1111) | `#ececec`, line `#b2b2b2` | `#323232`, line `#656566` | [M] @ 1000,1066,1,46 |
| Description text view | y=1112..1439 (164) | `#ffffff` | `#ffffff` | [M] @ 1000,1112,1,328 |
| Bottom bar | 0.5 line + 22.5 (y=1440..1485) | line `#b2b2b2`, `#ececec` | line `#646465`, `#323332`, bottom edge `#5b5b5b` | [M] @ 1000,1440,1,46 |

Toolbar (px, row y=148): Record 127..204; Stop 219..296; Run 311..388; Compile 403..480 (each 39 pt wide, 46 pt pitch); pane-toggle segmented control 1349..1496 (74 pt, two segments, left one selected in accent blue) [M].

```
            Untitled (Untitled Mail Rule Action.scptd 2)
 [rec][stop][run][compile]                                   [bottom|side]
 AppleScript ^v | <No selected element> ^v
 using terms from application "Mail"
     on perform mail action with messages these_messages for rule this_rule
         ...
 ---------------------------------------------------------------
 Description
 (empty)
 (i)  <-  [=]
```

## Components used
`window`, `title-bar`, `window-controls`, `toolbar`, `toolbar-button`, `toolbar-segmented-control`, `pop-up-button` (borderless, small, in the navigation bar, separated by a 0.5 pt vertical line), `text-view` (script, description), `split-view`, `scroll-view` (overlay knob visible in dark), `status-bar` (bottom bar), `image-button` (bottom bar: description (i) selected blue, result arrow, log).

## App-specific elements
- Script text: Verdana 12, line pitch 15 pt, first line cap top 14.5 pt below the navigation bar, left inset 6.5 pt (x=125), indent step 29 pt. Colours: language keywords Bold `#000000`; application terms `#003ef6 (sRGB #0432ff)` (class names italic); variables and handler names `#5e8c27 (sRGB #4e8f00)`; comments `#5e6060`; literals black regular. [M] see `text-view`.
- "Description" header text: 12 pt Bold, left inset 7.5 pt (x=127). [M] 10-15-Catalina-Light-Script-Editor.png @ 127,1078,127,22.
- Bottom bar icons: three 16 pt glyphs starting about 9 pt from the left edge at 30 pt pitch.

## Content in the screenshot
Navigation: "AppleScript", "<No selected element>". Script (first lines): `using terms from application "Mail"` / `on perform mail action with messages these_messages for rule this_rule` / `tell application "Mail"` / `set the message_count to the count of these_messages` / `repeat with i from 1 to the message_count` / `set this_message to item i of these_messages` / blank / `(*EXAMPLE: getting values of some properties of the message` / `-- GET THE SENDER OF THIS MESSAGE` / `set this_sender to the sender of this_message` / `-- GET SUBJECT OF MESSAGE` / `try` / `set this_subject to (subject of this_message) as Unicode text` / `if this_subject is "" then error` / `on error` / `set this_subject to "NO SUBJECT"` / `end try` / `-- GET CONTENT OF MESSAGE` / `try` / `set this_content to (every character of content of this_message) as Unicode text` / `if this_content is in {"", "?"} then error` / `on error error_message` / `set this_content to "NO CONTENT"` / `end try` / `*)` / blank / `(* EXAMPLE: save images attached to the message, to the pictures folder`. Header "Description".

## Not reproducible / assets needed
Toolbar glyphs (record dot, stop square, run triangle, hammer).
