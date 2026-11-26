# Messages
- **Screenshots:** 10-15-Catalina-Light-Messages.png, 10-15-Catalina-Dark-Messages.png (cropped desktop captures; the Messages window is INACTIVE and partly covered by the key Preferences window "General")
- **Window (main):** 730 x 520 pt [M] (light: image x=746..2205, y=102..1141). Full-size content view: no title-bar strip; grey (inactive) traffic lights sit at the top-left of the conversation list.
- **Window (Preferences):** `preferences-window`, title "General", about 540 x 310 pt (light: x~130..1209, y~382..1000); owned by group dialogs.

## Layout
| Region | Size (pt) | Light | Dark | Tag / evidence |
|---|---|---|---|---|
| Conversation list (vibrant, `sidebar` material) | 270 wide (x=746..1285), full height | `#c8c7c0 (sRGB #c8c7bf)` over the wallpaper | `#2c2e31` | [M] Light-Messages @ 900,104,1,49; Dark-Messages @ 900,96,1,49 |
| Divider | 1 | `#c2beaf (sRGB #c3bead)` (blended) | dark hairline | [M] Light-Messages @ 1286,260,2,1 |
| Header bar ("To:", "Details") | 55 high (y=102..211) + 1 pt rule | `#f0f0f0`, rule `#d9d9d9` | `#292929`, rule `#4c4c4c` | [M] Light-Messages @ 1700,102,1,112; Dark-Messages @ 1700,96,1,110 |
| Transcript | y=214..1059 | `#ffffff` | `#1d1e1f` | [M] @ 1700,600 |
| Input bar | 40 high (y=1062..1141) + 1 pt top rule; text field 24 high (y=1078..1125) | bar `#f0f0f0`, top rule `#d9d9d9`, field `#ffffff` with 1 pt `#cccccc` border | bar `#292929`, top rule `#4c4c4c`, field `#535355` with 1 pt `#6d6d6f` border (dark: bar y 1054..1131, field y 1070..1117) | [M] `10-15-Catalina-Light-Messages.png @ 1700,1060,1,82`; `10-15-Catalina-Dark-Messages.png @ 1700,1052,1,82` |

```
| o o o                         | To: [name]                      Details |
| [ Search        ] [compose]   |          iMessage with ...               |
| (avatar)            3:27 PM   |          Today, 3:26 PM                  |
|  New macOS, who dis?          |        [Can you believe another year...] |
|                               |                               Delivered  |
|                               | [New macOS, who dis?]                    |
|                               | [ iMessage                  (emoji) (mic)]|
```

## Components used
`window`, `window-controls` (inactive), `sidebar` material, `search-field`, `toolbar-button`-style compose button, `list-view` (conversation rows, emphasized blue selection), `split-view`, `message-bubble`, `text-field` (rounded "iMessage" field), `image-button` (emoji, audio), `label` ("Details" link); in front: `preferences-window`, `preferences-toolbar`, `pop-up-button`, `checkbox`, `slider` (with tick marks), `help-button`.

## App-specific elements
- Conversation row: 64 pt high, full-width blue selection (`#2866cd (sRGB #0b64d4)`..`#3b7ae5 (sRGB #2678ed)` light, `#2766c9 (sRGB #0664d0)`..`#235ab1 (sRGB #0959b7)` dark); 45 pt avatar (white ring, grey silhouette disc) 21.5 pt from the pane edge; snippet 13 pt white starting x=900; time right-aligned ("3:27 PM"). [M] see `list-view`.
- Search field (light): x 787..1171, y 153..194 including its 1 px edges (192.5 x 21 pt; fill x 788..1170, y 154..193), 20.5 pt from the pane's left edge and 25.5 pt below the window top; fill `#b3b1a7 (sRGB #b3b1a6)` over the wallpaper (vibrant, darker than the pane `#cac8bf (sRGB #cac8be)`). Compose button: fill x 1197..1258, y 154..193 (31 x 20 pt, white `#ffffff`), 13 pt after the search field and 13.5 pt before the divider (x=1286). Dark: search field y 145..186 including its edges (21 pt), fill from x=800; compose button x 1209..1270 (31 pt), y 146..185 (20 pt), fill `#6b6c6f`. [M] `10-15-Catalina-Light-Messages.png @ 760,158,530,1`; `10-15-Catalina-Light-Messages.png @ 900,140,1,66`; `10-15-Catalina-Dark-Messages.png @ 1120,150,180,1`.
- Header: "To:" grey 13 pt, recipient shown as a redacted/blurred token; "Details" blue 13 pt right-aligned 14 pt from the edge.
- Transcript header text "iMessage with" / date, 11 pt `#8e8e93`, centred.
- Input field: capsule, placeholder "iMessage" grey; emoji button inside the right end; audio-record glyph outside at the far right.

## Content in the screenshot
List: one conversation, "3:27 PM" (dark: "Yesterday"), "New macOS, who dis?". Transcript: "iMessage with", "Today, 3:26 PM" (dark: "Yesterday, 3:26 PM"); sent: "Can you believe another year has gone by?!"; "Delivered"; received: "New macOS, who dis?". Header "To:", "Details". Field placeholder "iMessage". Preferences window: tabs "General" (selected), "iMessage"; "Keep messages:" Forever; "Application:" [ ] Save history when conversations are closed, [x] Notify me about messages from unknown contacts, [ ] Notify me when my name is mentioned, [x] Play sound effects; "Message received sound:" Note (Default); "Save received files to:" Downloads; "Text size:" slider (A .. A); help button.

## Not reproducible / assets needed
Wallpaper-dependent list tint and blue selection gradient (use flat fallbacks), avatar silhouette, emoji/audio glyphs.
