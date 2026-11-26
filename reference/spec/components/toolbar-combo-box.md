# Toolbar combo box (`toolbar-combo-box`)

- **Status:** present (added on 6 October 2026 by the audit of the demos: TextEdit's format bar shows it, and `combo-box` covers only the form a window's content has)
- **AppKit:** `NSComboBox` in a toolbar or a format bar (textured rounded bezel, small control size in TextEdit)
- **HIG:** https://web.archive.org/web/20200503142537/https://developer.apple.com/design/human-interface-guidelines/macos/fields-and-labels/combo-boxes/ ; https://web.archive.org/web/20200503121036/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/toolbars/
- **Appearances shown:** light, dark

## Purpose and behaviour
A text field joined to a button that opens a list of suggested values, drawn in the bezel of the bar's other controls. Any text can be typed; choosing an item fills the field [D]. TextEdit's format bar uses it for the font size: the field shows "12" and the list offers the common sizes.

## Anatomy
The textured rounded bezel of `toolbar-button`, undivided in colour: the same grey fill runs under the field and the button. A 1 pt divider, then the button with one down chevron. No accent-coloured cap, unlike `combo-box`.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| size | regular (22 pt, as the toolbar's other controls), small (the format bar's) | regular | `controlSize` | small only (TextEdit); regular is [I] |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal | yes, light + dark | `10-15-Catalina-Light-Text-Edit.png @ 544,126,98,40`; `10-15-Catalina-Dark-TextEdit.png @ 544,126,98,40`; again in `10-15-Catalina-Light-Dictation.png @ 683,93,98,40` and `10-15-Catalina-Dark-Dictation.png @ 659,87,98,40` |
| main window, not key (a sheet is attached) | yes, light + dark | `10-15-Catalina-Light-Print.png @ 869,158,98,40`; `10-15-Catalina-Dark-Print.png @ 783,128,98,40`: fill, border, divider, chevron and text read the same values as normal [M] |
| focused | no | [I] focus ring around the whole control, as `toolbar-search-field` |
| button pressed, list open | no | [I] the button's part of the bezel takes `toolbar-button`'s pressed fill; the list is the `combo-box` list |
| disabled | no | [I] text and chevron in `toolbar-button`'s disabled ink, bezel unchanged |
| inactive window | no | [I] as `toolbar-button` inactive |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Size, small | fill 43 x 15 (x 550..635, y 131..160); 44 x 16 with Aqua's hairline border (x 549..636, y 130..161). Dark Aqua draws no border: the fill has the same box | [M] | `10-15-Catalina-Light-Text-Edit.png` row y=146, column x=570; `10-15-Catalina-Dark-TextEdit.png` the same |
| Field | 24 (x 550..597) | [M] | row y=146 |
| Divider | 1 wide (x 598..599), the full height of the fill (y 131..160) | [M] | row y=146, column x=598, both captures |
| Button | 18 (x 600..635) | [M] | row y=146 |
| Chevron | ink x 610..623, y 142..150: 7 wide, 4.5 high, 5 after the divider and 6 before the trailing edge of the fill; its tip half a point left of the button's centre | [M] | `10-15-Catalina-Light-Text-Edit.png @ 608,140,18,14` |
| Chevron as SVG (pt) | arms of 3.13 at 45 degrees, stroke 1.3, butt caps, mitre join: `M 0.37 0.6 l 3.13 3.13 l 3.13 -3.13` in a 7 x 5 box whose top is 5.4 under the top of the fill | [C] | least-squares fit of a stroked chevron to the same pixels (stroke 1.3, arm 3.125, tip at x=36.5, y=11.625 of the crop) |
| Corner radius | as `toolbar-button`: 3.5 on the fill, 4 on Aqua's border | [I] | not fitted on this control; the comparison of the whole bezel differs in 0.8% of pixels with it |
| Size, regular | 22 high, the same 18 pt button and chevron, 60 wide by default | [I] | no capture shows it |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Fill, top to bottom | `#fcfdfc`, `#fbfbfb` (one device pixel each), then `#fafafa` to `#f3f3f3` | `#8a8c8d`, `#727475`, then `#6d6f71` to `#6a6c6d` over a bar of `#3c3f42` to `#383a3d`: white at 40%, 27.7% and 25.1% | [M] light; [C] dark alphas from [M] pixels | column x=570, y 131..160, both captures |
| Border | top `#c1c1c1` on `#d7d7d7`, side `#bdbdbd` on `#d3d3d3`, bottom `#9d9d9d` on `#cecece`; the row under it `#c4c4c4`: within two levels of `toolbar-button`'s border | none | [M] | column x=570 y 130, 161, 162; row y=146 x 549, 636 |
| Divider | `#dddede` on `#f6f6f6`: black at 10% | `#606163` on `#6b6d6f`: black at 10% | [C] from [M] pixels | row y=146, x 598..599 |
| Chevron | `#565656` on `#f6f6f6`: black at 65% | `#e9e8e9` on `#6b6d6f`: white at 85% | [C] from [M] pixels | row y=146, x 613 |
| Text | `#252525` on `#f6f6f6`: black at 85% | `#e9e9ea` on `#6b6d6f`: white at 85% | [C] from [M] pixels | `@ 558,136,18,20` light; `@ 558,138,18,16` dark |

### Text and icons
Small size: the digits of "12" are 13 px high (y 140..152), 6.5 pt, the cap height of the 9 pt system font (6.3 pt); 9 pt Regular [C]. Their ink starts 4 pt from the leading edge of the fill and their baseline is 11 pt under its top [M]. Regular size: 13 pt [I].

### Shadows and effects
As `toolbar-button`: one row under Aqua's border.

## Layout and spacing
In TextEdit's format bar the control follows the typeface pop-up after 3 pt and is followed by the colour well after 7 pt (see `apps/textedit.md`). The list opens under the control, leading edges aligned [I].

## Keyboard and accessibility
As `combo-box`: typing edits the field; Down Arrow opens the list; the arrows move through it and Return chooses; Escape closes it [D]. `AXComboBox`. ARIA: `<input role="combobox" aria-expanded aria-controls>` with a `listbox`.

## Browser notes
Reproducible. The divider and the chevron are translucent ink over the bezel's fill, so one value serves any bar. The chevron is an inline SVG.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Text-Edit.png` | 544,126,98,40 | the font size control, "12" |
| dark | `10-15-Catalina-Dark-TextEdit.png` | 544,126,98,40 | the same |
| light | `10-15-Catalina-Light-Print.png` | 869,158,98,40 | the same control under the Print sheet, its window main and not key: fill x 875..960, y 163..192, divider x 923..924, chevron and text as in the key window |
| dark | `10-15-Catalina-Dark-Print.png` | 783,128,98,40 | the same: fill x 789..874, y 133..162, divider x 837..838; the bar is a neutral `#3a3a3c` here |
| light | `10-15-Catalina-Light-Dictation.png` | 683,93,98,40 | at rest in a key window, as the first capture: fill x 689..774, y 98..127 |
| dark | `10-15-Catalina-Dark-Dictation.png` | 659,87,98,40 | the same: fill x 665..750, y 92..121 |
