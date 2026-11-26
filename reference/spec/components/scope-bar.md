# Scope bar and scope buttons (`scope-bar`)

- **Status:** present
- **AppKit:** a bar view under the toolbar holding `NSButton`s with `bezelStyle = .recessed` (toggle scopes) and `.roundRect` (actions such as Save and +); Finder's criteria rows use `NSRuleEditor`/`NSPredicateEditor`
- **HIG:** https://web.archive.org/web/20200503171957/https://developer.apple.com/design/human-interface-guidelines/macos/buttons/scope-buttons/ ; https://web.archive.org/web/20200503141343/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/window-anatomy/
- **Appearances shown:** light, dark

## Purpose and behaviour
A scope bar appears above the body, beneath the title bar, toolbar and tab bar, and lets the user narrow a search or filter content [D]. A recessed scope button toggles a scope on or off; a rounded (round-rect) scope button starts an action or adds search criteria [D]. Scope buttons are used only in scope bars [D]. In Finder, + adds a criteria row and Save stores a Smart Folder.

## Anatomy
```
 | Search:  This Mac  ["Macintosh SSD"]                         [Save] [+] |
   label    off scope   on scope (filled pill)                  round-rect buttons
```
Preview's find bar uses the same layout on the toolbar gradient: `Sort by:  Search Rank  [Page Order]      Found on 7 pages  [<][>]  [Done]`.

## Variants and parameters
| Parameter | Values | Shown in screenshots |
|---|---|---|
| surface | plain light bar (Finder search), toolbar-coloured bar (Preview find) | both |
| button | recessed toggle (off / on), round-rect action, round-rect segmented pair | all |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| scope off | yes | "This Mac": `10-15-Catalina-Light-Finder-Search.png @ 576,208,107,19` |
| scope on | yes | "Macintosh SSD": `@ 703,202,238,32`; Preview "Page Order": `10-15-Catalina-Light-Preview-Search.png @ 439,201,186,32` |
| hover (outline pill) / pressed | no | [I] off-scope gains a 1 pt outline pill on hover |
| disabled action | yes | previous/next arrows in `10-15-Catalina-Light-Preview-Search.png @ 2206,206,44,29` |
| inactive window | no | [I] on-pill at the unemphasised grey `#c8c8c8` light / `#505050` dark |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Finder scope bar height | 32 = 31 fill (y 186..247) + two 0.5 rows (y 248, 249) | [M] | `10-15-Catalina-Light-Finder-Search.png @ 1500,186,1,64` |
| Preview find bar height | 31 = 30 fill (y 186..245) + two 0.5 rows (y 246, 247) | [M] | `10-15-Catalina-Light-Preview-Search.png @ 1500,186,1,62` |
| On-scope pill | 16 high (y 202..233), width = text + 2 x 8 (119 for "Macintosh SSD" with quotes, 93 for "Page Order"), corner radius 3.75: a rounded rectangle, not a capsule (a capsule this high would have 8). Least-squares fit with `tools/corner_fit.py`: best 3.75 in the two Finder captures, where bar and pill are flat (light rms 1.1 levels; 3.0 at 3.5, 2.5 at 4; dark rms 1.7; 4.9 at 3.5, 3.9 at 4), and in light Preview (rms 1.3; 2.8 at 3.5, 2.4 at 4), where the bar is a shallow gradient that stays within 4 levels over the compared square and was taken as flat. Dark Preview is not fitted: its bar is translucent over the sidebar (6 levels across the compared rows) and its pill varies by 9 levels, so the tool's flat-background model does not apply; a trial fit there (3.75, rms 2.4) is invalid and is not evidence. The dark Preview pill takes 3.75 by inference from the other three captures [I]. The earlier text, "fully rounded ends (radius about 4)", was inferred | [M] size; [C] radius, fit from [M] pixels (Finder light and dark, Preview light); [I] radius in dark Preview | `10-15-Catalina-Light-Finder-Search.png @ 800,202,1,32`, `@ 703,218,238,1`; `10-15-Catalina-Light-Preview-Search.png @ 439,205,187,1`, `@ 520,201,1,32`; fit corners `10-15-Catalina-Light-Finder-Search.png @ 701,200,16,16`, `10-15-Catalina-Light-Preview-Search.png @ 436,199,16,16`, `10-15-Catalina-Dark-Finder-Search.png @ 701,200,16,16`; trial corner, not evidence: `10-15-Catalina-Dark-Preview-Search.png @ 436,199,14,14` |
| Label "Search:" leading inset | 7 from the content edge (ink x 457, content from 443) | [M] | `10-15-Catalina-Light-Finder-Search.png @ 457,209,90,19` |
| Gaps | label to first scope 15 (546 -> 576), off scope text to on pill 10.5 (682 -> 703) | [M] | same row |
| Text cap height | 14-15 px -> 11 pt, Bold | [C] | "Search:" rows y 209..227 with descender |
| Round-rect button "Save" | 42 x 18.5 with 1 pt border (x 2226..2309), "+" 18 x 18.5 (x 2314..2349), gap 2 | [M] width, [C] height | `10-15-Catalina-Light-Finder-Search.png @ 2200,218,170,1` |
| Trailing inset | 10 (button border ends x 2349, window right 2369) | [M] | same |
| + glyph | 8 x 8 (16 px), 1 pt strokes | [M] | `@ 2324,218,16,1` |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Finder scope bar fill | `#f0f0f0` | `#2b2c2f` | [M] | `10-15-Catalina-Light-Finder-Search.png @ 1500,200`; `10-15-Catalina-Dark-Finder-Search.png @ 1500,200` |
| Bottom rows | `#e1e1e1`, `#cecece` | `#3a3b3e`, `#4d4e51` | [M] | `@ 1500,248`, `@ 1500,249` in both |
| Label and off-scope text | `#717171` (label), `#787878` (off scope) | `#a7a8ab` | [M] | `10-15-Catalina-Light-Finder-Search.png @ 460,218`, `@ 582,218`; `10-15-Catalina-Dark-Finder-Search.png @ 460,218`, `@ 582,218` |
| On pill fill / text | `#9a9a9a` / `#ffffff` | `#b6b7ba` / bar colour `#2b2c2f` | [M] | `10-15-Catalina-Light-Finder-Search.png @ 710,218`, `@ 733,218`; `10-15-Catalina-Dark-Finder-Search.png @ 710,218`, `@ 733,218` |
| Round-rect button border / text | `#a8a8a8` / `#242424` | `#78797c` / `#f3f4f7` | [M] | `10-15-Catalina-Light-Finder-Search.png @ 2226,218`, `@ 2266,218`; `10-15-Catalina-Dark-Finder-Search.png @ 1880,218`, `@ 1920,218` |
| + glyph | `#252525` | `#e5e5e5` | [M] | `10-15-Catalina-Light-Finder-Search.png @ 2330,218`; `10-15-Catalina-Dark-Finder-Search.png @ 1984,218` |
| Preview find bar fill | `#d5d5d5` -> `#cccccc`, bottom rows `#9e9e9e`, `#868686` | `#323334` -> `#2e2e30`, bottom rows `#1f1f20`, `#000000` (over the sidebar; lighter over the page, see `title-bar`) | [M] | `10-15-Catalina-Light-Preview-Search.png @ 1500,186,1,62`; `10-15-Catalina-Dark-Preview-Search.png @ 300,186,1,62` |
| Preview on pill / on text; off text | `#868686` / `#ffffff`; `#7f8080` | pill composite `#c6c7c8`, text `#404244`; off text `#acadae` | [M] | 10-15-Catalina-Light-Preview-Search.png @ 500,205; 10-15-Catalina-Light-Preview-Search.png @ 300,213; 10-15-Catalina-Dark-Preview-Search.png @ 445,216; darkest selected ink in 10-15-Catalina-Dark-Preview-Search.png @ 464,207,140,25; 10-15-Catalina-Dark-Preview-Search.png @ 300,214 |
| Preview "Sort by:" label | accent blue `#1f5dcf (sRGB #005ad7)` | accent blue | [M] | `10-15-Catalina-Light-Preview-Search.png @ 124,196,110,40` |

### Text and icons
SF Pro Text 11 pt Bold for the label and scopes [C]; round-rect buttons 12 pt Regular [C] ("Save" cap height 16-17 px).

### Shadows and effects
None.

## Layout and spacing
Label and scopes are leading-aligned from the content area's edge (after the sidebar in Finder, from the window edge in Preview); action buttons trailing. Criteria rows added with + stack below at the same 32 pt module [I].

## Keyboard and accessibility
Scopes are a single-selection group: `AXRadioGroup` of `AXRadioButton`; ARIA `role="radiogroup"`. Save and + are `AXButton`.

## Browser notes
Reproducible.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Finder-Search.png` | 443,186,1927,64 | Finder scope bar |
| dark | `10-15-Catalina-Dark-Finder-Search.png` | 443,186,1581,64 | same |
| light | `10-15-Catalina-Light-Preview-Search.png` | 112,186,2294,62 | Preview find bar |
| dark | `10-15-Catalina-Dark-Preview-Search.png` | 112,186,2752,62 | same |
