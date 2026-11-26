# Search Field, in content (`search-field`)

- **Status:** present (small-size standard field in Automator; custom sidebar field in Music and Podcasts). The regular-size toolbar field is `toolbar-search-field` (owner: chrome).
- **AppKit:** `NSSearchField` (`NSSearchFieldCell.searchButtonCell`, `cancelButtonCell`, `placeholderString`, `recentsAutosaveName`, `sendsSearchStringImmediately`)
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/fields-and-labels/search-fields/
- **Appearances shown:** light, dark

## Purpose and behaviour
A text field optimised for searching a large collection: it shows a magnifying glass, may show placeholder text and a cancel button. Use it instead of a plain text field for search; do not give it an introductory label (except the toolbar item label "Search"); enable the cancel button, which clears the text and ends the search; search either while typing or on Return; consider privacy before showing recent searches. [D] (HIG, Search Fields)

The cancel button (x in a filled circle) appears only when the field contains text. When the field has a search menu the magnifier shows a small disclosure chevron. [D]

## Anatomy
```
(  Q  Placeholder ...............................  (x) )
   |  |                                             |
   |  text, starts after the glyph                  cancel button (only with text)
   magnifying glass, leading
```

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| controlSize | regular, small, mini | regular | `controlSize` | small (Automator); regular only in toolbars |
| placeholder alignment | leading when in content or focused; centred when unfocused in a toolbar | - | `centersPlaceholder` | leading |
| style | standard rounded bezel; app-custom filled field (Music, Podcasts sidebars) | standard | - | both |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| focused, empty (placeholder) | yes, light + dark | `10-15-Catalina-Light-Automator.png @ 415,213,456,48`; `10-15-Catalina-Dark-Automator.png @ 415,213,456,48` |
| unfocused, empty (custom sidebar field) | yes, light + dark | `10-15-Catalina-Light-Music.png @ 133,203,398,46`; `10-15-Catalina-Dark-Music.png @ 133,203,398,46` |
| with text and cancel button | in-content: `10-15-Catalina-Light-Podcasts.png @ 132,202,480,46` (owner apps measured it) | see `media-app-chrome` |
| disabled | not shown | [I] 50 % opacity |

## Measurements
### Geometry (pt)
| Property | Small (Automator) | Custom sidebar (Music) | Tag | Evidence |
|---|---|---|---|---|
| Height | 18 | 23 | [M] | Light Automator col 640: border y 219..254. Light Music col 400: y 203..248 |
| Corner radius | 4.25, on the outer edge of the border. Least-squares fit with `tools/corner_fit.py` to the focused field, whose border lies on the flat focus ring: best 4.25 (rms 2.0 levels; 2.9 at 4, 3.5 at 4.5, 7.3 at 3.5). The earlier value of 2.5 misread the grid | 3.75 (fit: rms 0.8 levels; 1.8 at 3.5, 1.9 at 4). The earlier value was 3.5 | [C] fit from [M] pixels | Light Automator grid `@ 412,210,16,14`: border top edge starts x=424, left edge reached y=223 (origin 421,219). Light Music grid `@ 130,200,10,10`: top edge starts x=137, left edge y=209 (origin 133,203). Fit corners `10-15-Catalina-Light-Automator.png @ 421,219,10,10` and `10-15-Catalina-Light-Music.png @ 133,203,10,10` |
| Border | 0.5 | 0.5 | [M] | Light Automator row 236 x=421; Light Music row 226 x=133 |
| Magnifier glyph | 10.5 x 10.5 overall, starts 6.5 from the left edge | 12.5 x 12.5 overall (lens ring 10 pt outer diameter, stroke 1), starts 6 from the left edge | [M] | Light Automator `@ 426,222,36,30`: ink x 434..454, y 228..248 (border x=421). Light Music grid `@ 142,212,32,30`: ring x 145..164, y 215..234; handle to 169,239 |
| Text / placeholder start | 23 from the left edge | 24.5 from the left edge | [M] | Light Automator: border 421, placeholder ink 467. Light Music: border 133, ink 182 |
| Regular size | 22 high, 13 pt text, glyph 11, text start 26 [I] | - | [I] | scaled from the small metrics by the regular / small control ratio; regular in-content field not shown |
| Cancel button | 14 pt circle, 4 pt from the right edge [I] | - | [I] | not shown in my samples |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Automator: fill | `#cfcfcf` (on a `#e4e4e4` pane) | `#3e3f41` (on `#2f3032`) | [M] | Automator row 236 x 422..432 |
| Automator: border (under the focus ring) | `#7294d4 (sRGB #6a94d9)` composite; unfocused not shown | `#4978a1 (sRGB #3a78a5)` composite | [M] | Automator row 236 x=421 |
| Automator: glyph | `#484848` | `#e2e2e2` | [M] | Automator row 236 x=434 |
| Automator: placeholder | `#9c9c9c` on `#cfcfcf` = `rgba(0,0,0,0.25)` | `#6e6e6f` on `#3e3f41` = `rgba(255,255,255,0.25)` | [M] / [C] | Automator `@ 470,222,120,30` |
| Music: fill | `#d2d3d3` on sidebar `#e8e9e9` = black @ 0.09 | `#3b3c3f` on `#2c2d30` = white @ 0.07 | [M] / [C] | Music col 400 y 204..247 |
| Music: border | `#c1c2c2` all sides | top `#4a4b4d`, bottom `#68696c`, sides `#434548` | [M] | Music col 400 y 203, 248; row 226 x=133 |
| Music: glyph | `#3a3b3b` | `#ffffff` | [M] | Music row 226 x=146 |
| Music: placeholder | `#989999` (black @ 0.27) | `#77787c` (white @ 0.31) | [M] / [C] | Music `@ 180,210,120,32` |
| Standard unfocused in-content bezel | white fill, `rgba(0,0,0,0.25)` border as `text-field`, radius 4 | `rgba(255,255,255,0.05)` fill | [I] | follows `text-field` and `toolbar-search-field`; not shown |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Font (small) | SF Pro Text 11 pt | same | [C] | cap height 15 px, Automator placeholder rows y 231..245 |
| Font (Music) | SF Pro Text 13 pt | same | [C] | Music placeholder rows y 215..235 |
| Magnifier shape (Music, 12.5 pt box) | ring: centre (5, 5), outer diameter 10, stroke 1; handle: 45 deg line from (8.4, 8.4) to (12, 12), stroke 1.4, round end | same | [M] / [C] | Light Music grid `@ 142,212,32,30` (glyph origin 145,215) |

### Shadows and effects
Focus: `focus-ring` hugging the rounded outline (Automator, both appearances).

## Layout and spacing
In a sidebar the field is inset 10.5 pt from the sidebar edge (Music: field x=133 in a window starting x=112). [M] No introductory label.

## Keyboard and accessibility
Command-F usually focuses it; Escape clears the text (first press) and ends the search; Return commits; Down Arrow opens the recents / suggestions menu. Role `AXTextField` with subrole `AXSearchField`; the cancel button is an `AXButton` "cancel". ARIA: `<input type="search">` inside `role="search"`. [D]

## Browser notes
Hide the engine's own decorations (`::-webkit-search-cancel-button`, `-webkit-appearance: none`) and draw the glyphs as SVG.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Automator.png | 415,213,456,48 | small search field, focused, placeholder "Name" |
| light | 10-15-Catalina-Light-Music.png | 133,203,398,46 | custom sidebar search field |
| dark | 10-15-Catalina-Dark-Automator.png | 415,213,456,48 | small search field, focused |
| dark | 10-15-Catalina-Dark-Music.png | 133,203,398,46 | custom sidebar search field |
