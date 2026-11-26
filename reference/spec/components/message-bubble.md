# Message bubble (`message-bubble`)

- **Status:** present (new component, not in seed.json; family: views)
- **AppKit:** custom drawing in Messages' transcript (a collection of bubble views); no public class
- **HIG:** none (app-specific pattern; closest: https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/window-anatomy/)
- **Appearances shown:** light, dark

## Purpose and behaviour
Shows one chat message in the Messages transcript. Sent messages are right-aligned and tinted (blue for iMessage); received messages are left-aligned and grey. The last bubble of a run has a tail pointing to the sender's side; a small status label ("Delivered") sits under the last sent bubble. Bubbles wrap at about 60 % of the transcript width.

## Anatomy
Rounded rectangle (ends fully round for one line) + tail at the bottom corner on the sender's side + text. Above the first bubble: centred service/time header in small grey text.

## Variants and parameters
| Parameter | Values | Shown |
|---|---|---|
| Direction | sent (trailing) / received (leading) | both |
| Service colour (sent) | iMessage blue / SMS green | blue |
| Lines | 1..n | 1 (received), 2 (sent) |
| Tail | with / without (only the last in a run) | with |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| Normal | yes | both appearances; the Messages window is inactive (a Preferences window is key) and the bubbles keep their colour |
| Selected / tapback / sending | no | [I] sending = 50 % opacity |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| One-line bubble height | 24 | [M] | 10-15-Catalina-Light-Messages.png @ 1500,420,1,48; dark bbox 10-15-Catalina-Dark-Messages.png @ 1326,412,316,48 |
| Two-line bubble height | 40 (line pitch 16) | [M] | 10-15-Catalina-Light-Messages.png @ 1900,298,1,80; text line tops y=313 and 345 |
| Corner radius | 12 (one-line bubble: body starts x=1322 on the middle rows, top row starts about x=1340) | [M] approx | rows y=420..438 of 10-15-Catalina-Light-Messages.png @ 1310,420,36,19 |
| Received bubble width for "New macOS, who dis?" | 154 body (x=1322..1629) + 4 tail overhang to x=1314 | [M] | bbox 10-15-Catalina-Light-Messages.png @ 1314,420,316,48 |
| Text padding | 11 leading (received: body x=1322, text x=1344); 9.5 leading on sent (bubble x=1648, text x=1667); top: cap top 7.5 below the bubble top | [M] | 10-15-Catalina-Light-Messages.png @ 1322,438,24,1 and 1648,330,22,1; sent text box @ 1667,313,467,24 |
| Sent bubble width (2 lines) | 266 incl. tail (x=1648..2180) | [M] | 10-15-Catalina-Light-Messages.png @ 1648,330,533,1 |
| Margins | received bubble body 17 pt from the transcript's left edge (x=1288); sent tail tip 13 pt from the window's right edge (x=2205) | [M] | same rows |
| Vertical gap between consecutive bubbles from different senders | 21 (sent bottom y=377, received top y=420) with the "Delivered" label in between | [M] | columns above |

### Colours and fills
| Part | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Sent fill (iMessage) | vertical gradient `#67b6f4 (sRGB #4bb7fa)` (top) to `#62b2f3 (sRGB #44b3f9)` (bottom); mid `#65b5f4 (sRGB #48b6fa)` | `#327fee (sRGB #057df6)` to `#317ceb (sRGB #077af3)` | [M] | 10-15-Catalina-Light-Messages.png @ 1900,298 / 1900,376; 10-15-Catalina-Dark-Messages.png @ 1900,290 / 1900,368 |
| Sent text | `#ffffff` | `#ffffff` | [M] | Light @ 1671,330; Dark @ 1681,320 |
| Received fill | `#e5e5ea` | `#555555` | [M] | Light @ 1332,440; Dark @ 1344,436 |
| Received text | `#000000` | `#ffffff` | [M] | Light @ 1345,444; Dark @ 1357,436 |
| Transcript background | `#ffffff` | `#1d1e1f` | [M] | Light @ 1700,600; Dark @ 1700,600 |
| Header / status text ("iMessage with", "Today, 3:26 PM", "Delivered") | `#8e8e93` | `#8f8f93` | [M] | 10-15-Catalina-Light-Messages.png @ 1700,245; lightest ink in 10-15-Catalina-Dark-Messages.png @ 1570,232,160,20; 10-15-Catalina-Dark-Messages.png @ 1650,258,212,20; 10-15-Catalina-Dark-Messages.png @ 2090,380,106,20 |

### Text and icons
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Bubble text | SF Pro Text 13 pt Regular (line box 24 px, pitch 32 px) | [C] | 10-15-Catalina-Light-Messages.png @ 1667,313,467,56 |
| Header / status | 11 pt, header first line Semibold, centred; "Delivered" right-aligned under bubble; cap height 16 px (T y=268..283), header stem 3 px | [C] size/weight from measured ink | 10-15-Catalina-Light-Messages.png @ 1560,238,320,54; 10-15-Catalina-Light-Messages.png @ 1663,266,12,24; 10-15-Catalina-Light-Messages.png @ 2080,384,120,33 (Delivered ink y=389..405) |

### Shadows and effects
None. The sent gradient is continuous across the whole transcript height in Messages (bubbles higher up are lighter); with two bubbles it is nearly flat.

## Layout and spacing
Bubbles hug their text; maximum width about 60 % of the transcript [I]. Tail side equals alignment side.

## Keyboard and accessibility
Transcript is an `AXGroup`/list of static text items. ARIA: `role="log"` with `aria-live="polite"`; each bubble a list item labelled with sender and time.

## Browser notes
The tail is a small curved shape; draw it with an inline SVG or two overlapping pseudo-elements. The transcript-wide gradient can be done with `background-attachment: fixed`.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Messages.png | 1300,230,900,250 | header, sent 2-line bubble, "Delivered", received bubble |
| dark | 10-15-Catalina-Dark-Messages.png | 1310,220,900,250 | same, dark |
