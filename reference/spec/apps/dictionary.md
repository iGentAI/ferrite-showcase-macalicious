# Dictionary
- **Screenshots:** 10-15-Catalina-Light-Dictionary.png, 10-15-Catalina-Dark-Dictionary.png
- **Window:** 690 x 650 pt [M] (image x=112..1491, y=76..1375). Title bar + toolbar (55 pt, y=76..185) + scope bar (25 pt, y=186..235). Title "Dictionary (32 found)".

## Layout
| Region | Size (pt) | Light | Dark | Tag / evidence |
|---|---|---|---|---|
| Title + toolbar | 55 | gradient to `#d5d5d5`, line `#bebebe` | dark gradient | [M] Light-Dictionary @ 300,180,1,6 |
| Scope bar (`scope-bar`) | 24 + 1 pt lines (y=186..235) | `#d5d5d5` -> `#cdcdcd`, bottom lines `#bdbdbd` / `#a6a6a6` | `#3a3a3c` -> `#363738`, line `#000000` | [M] Light @ 300,186,1,50; Dark @ 300,186,1,50 |
| Word list (`sidebar` material) | 183 wide (x=112..477), rows 28 | `#e8e8e7` | `#2b2c2e` | [M] @ 300,500 |
| Divider | 1 | `#d5d5d5` | `#000000` | [M] @ 478,1180 |
| Definition pane | 506 wide (x=480..1491) | `#ffffff` | `#1e1e20` | [M] @ 900,600 |

Toolbar (px, row y=148): Back | Forward 127..230 (52 pt, joined pair); text size "A | A" 249..352 (52 pt, joined pair); search field 834..1481 (324 pt, focused with `focus-ring`, contains "computer" and a clear button) [M].

Scope bar items (11 pt, about 20 pt left inset): All, Dictionary (selected pill: fill `#878787` light / `#c4c5c7` dark, 16 pt high y=194..225, white / dark text), Thesaurus, Apple, Wikipedia [M] 10-15-Catalina-Light-Dictionary.png @ 300,194,1,32; 10-15-Catalina-Dark-Dictionary.png @ 300,194,1,32.

```
                 Dictionary (32 found)
 [<|>] [A|A]                          [Q computer            (x)]
 All (Dictionary) Thesaurus Apple Wikipedia
+ computer  (sel)   + com-put-er  | k@m'pyood@r |
| computer-aided    | noun
| computer animation|   an electronic device for storing and processing data, ...
| ...               |   - a person who makes calculations, ...
```

## Components used
`window`, `title-bar`, `window-controls`, `toolbar`, `toolbar-segmented-control` (back/forward, text size), `toolbar-search-field` (focused, with text and clear button), `focus-ring`, `scope-bar`, `sidebar` material with a plain `list-view` (28 pt rows, grey selection), `split-view`, `web-view`/`text-view` (definition, read-only).

## App-specific elements
- Word rows: 13 pt Regular, left inset 24.5 pt (x=161), pitch 28 pt; first row's highlight starts 14 pt below the scope bar (y=264); selection `#c8c8c7` / `#4f5052`; text `#1e1e1e`..`#242323` (light). [M] 10-15-Catalina-Light-Dictionary.png @ 470,236,1,84 and 161,284,115,23.
- Definition: headword "com\u00b7put\u00b7er" about 21 pt Regular at x=509 (14.5 pt inset), cap/x-height box y=288..325; pronunciation in grey to its right; part of speech "noun" 15 pt at x=512, y=366..384; definition paragraphs 14 pt at 17 pt line pitch, indented to x=536 (28 pt), sub-sense with a grey bullet at x=538; text black / white. [M] 10-15-Catalina-Light-Dictionary.png @ 509,288,460,38; 512,366,69,19; 536,411,664,60.

## Content in the screenshot
Search text "computer". Scope: All, Dictionary, Thesaurus, Apple, Wikipedia. Word list: computer (selected), computer-aided, computer animation, computer animations, computer conferencing, computer dating, computer-friendly, computer game, computer graphics, computer-literate, computer programer, computer programers, computer programmer, computer science, computer virus, computer viruses, computerese, computerisation, computerise, computerised. Definition: "com\u00b7put\u00b7er | k\u0259m\u02c8pyo\u035eod\u0259r |"; "noun"; "an electronic device for storing and processing data, typically in binary form, according to instructions given to it in a variable program."; "\u2022 a person who makes calculations, especially with a calculating machine."

## Not reproducible / assets needed
None (text only); the pronunciation needs a font with IPA glyphs.
