# Login window / fast user switching screen (`login-window`)

- **Status:** present (single-user password prompt reached through fast user switching)
- **AppKit:** loginwindow.app (system); not an app-level control
- **HIG:** https://web.archive.org/web/20200503171155/https://developer.apple.com/design/human-interface-guidelines/macos/app-architecture/security/
- **Appearances shown:** captured from a light and a dark session; the screen is identical in both (the login UI always uses the light-on-dark style)

## Purpose and behaviour
Choosing another user in the fast user switching menu rotates the screen to that user's login prompt: the avatar, the name, and a password field over the desktop picture, with Cancel below to return. There is no menu bar; only a clock, Wi-Fi and battery indicators at the top right. Return submits; a wrong password shakes the field [D].

## Anatomy
```
                                              100% [bat] (wifi) 3:37 PM

                         ( avatar 93 pt )
                           mhackett
                      [ Enter Password    ]


                             (x)
                           Cancel
```

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| mode | single user prompt; user list; name + password fields | - | Users & Groups > Login Options | single user prompt |
| bottom buttons | Cancel (switching); Sleep, Restart, Shut Down (boot login) | - | - | Cancel |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| empty password field (placeholder) | yes | 10-15-Catalina-Light-Fast-User-Switching.png @ 1520,1022,320,56; 10-15-Catalina-Dark-Fast-User-Switching.png @ 1520,1022,320,56 |
| typing (bullets, submit arrow at the field's right) | no | [I] white 8 pt bullets; a circled arrow appears at the right end |
| wrong password (shake), hint, Caps Lock indicator | no | [D] |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Avatar | circle about 93 diameter (px 1584..1769 at y=786; top y=690), centred horizontally | [M] | 10-15-Catalina-Light-Fast-User-Switching.png @ 1570,786,220,1; 1678,670,1,30 |
| Name | centred; ink px 1605..1756 x 919..945: cap/ascender top 115 pt below the avatar top; 13 px gap class below the avatar bottom (about 876) | [M] | 10-15-Catalina-Light-Fast-User-Switching.png @ 1605,919,152,27 |
| Password field | 160 x 28 (px 1520..1839 x 1022..1077), centred; top 38 pt below the name baseline | [M] | 10-15-Catalina-Light-Fast-User-Switching.png @ 1505,1050,350,1; 1800,1010,1,80 |
| Field corner radius | 6.5 (13 px from top y=1022 to full straight-edge fill at x=1520, y=1035) | [M] | corner grid 10-15-Catalina-Light-Fast-User-Switching.png @ 1520,1022,16,16 |
| Placeholder inset | 8 from the field's left edge (ink from px 1536) | [M] | 10-15-Catalina-Light-Fast-User-Switching.png @ 1536,1034,190,32 |
| Cancel button | ring 30 diameter (px 1650..1709 x 1862..1921), 1.5 pt white stroke, x glyph with 2 pt strokes inside; centred horizontally; ring centre 104 pt above the screen bottom | [M] | 10-15-Catalina-Light-Fast-User-Switching.png @ 1632,1892,96,1; 1679,1852,1,82 |
| "Cancel" label | centred; cap rows y=1944..1963: cap top 11 pt below the ring | [M] | 10-15-Catalina-Light-Fast-User-Switching.png @ 1638,1944,83,20 |
| Status items | clock text ink px 3200..3341 (right margin 9 pt), rows y=17..37; Wi-Fi and battery glyphs and "100%" to its left ("100%" ink px 3001..3069) | [M] | 10-15-Catalina-Light-Fast-User-Switching.png @ 3200,17,142,21; 3001,17,69,21 |

### Colours and fills
| Part | Value (both sessions) | Tag | Evidence |
|---|---|---|---|
| Background | the Catalina Evening picture, not blurred, no menu bar strip (top row `#69729c (sRGB #6871a0)` continues the sky) | [M] | 10-15-Catalina-Light-Fast-User-Switching.png @ 1000,0,1,60 |
| Name, labels, status text | `#ffffff` | [M] | 10-15-Catalina-Light-Fast-User-Switching.png @ 1605,919,152,27; 1638,1944,83,20; 3200,17,142,21 |
| Password field fill | `#817876 (sRGB #837876)`..`#8d807d (sRGB #90807c)` over dark rock (about `rgba(255,255,255,0.38)`) | [M] composite, [C] alpha (backdrop about `#3a2e2c (sRGB #3c2e2c)`) | 10-15-Catalina-Light-Fast-User-Switching.png @ 1557,1050,3,1; 1820,1050,20,1 |
| Placeholder text | `#b3aaa8 (sRGB #b5aaa8)`..`#bbb1ae (sRGB #bdb1ad)` (about `rgba(255,255,255,0.4)` on the field) | [M] | 10-15-Catalina-Light-Fast-User-Switching.png @ 1536,1050,13,1 |
| Cancel ring / glyph | `#ffffff` | [M] | 10-15-Catalina-Light-Fast-User-Switching.png @ 1650,1892,3,1; 1678,1892,4,1 |
| Cancel disc fill | `#3a3a40 (sRGB #3a3a41)` inside against `#090c14 (sRGB #080c15)`..`#16171d (sRGB #16171e)` outside (about `rgba(255,255,255,0.18)`) | [M] composite, [C] alpha | 10-15-Catalina-Light-Fast-User-Switching.png @ 1653,1892,24,1; 1632,1892,9,1 |

### Text and icons
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Name font | SF Pro Display about 19-20 pt Medium/Semibold (ascender-to-baseline 27 px), white, soft shadow | [C] size; [I] weight | 10-15-Catalina-Light-Fast-User-Switching.png @ 1605,919,152,27 |
| Placeholder font | 14 pt Regular ("Enter Password" 20 px cap class in the dark-session capture) | [C] | 10-15-Catalina-Dark-Fast-User-Switching.png @ 1538,1040,188,20 |
| "Cancel" font | 14 pt Regular (20 px) | [C] | 10-15-Catalina-Light-Fast-User-Switching.png @ 1638,1944,83,20 |
| Status text | 14-15 pt Regular (21 px) | [C] | 10-15-Catalina-Light-Fast-User-Switching.png @ 3200,17,142,21 |
| Avatar | user picture clipped to a circle (yin-yang here) | [M] | 10-15-Catalina-Light-Fast-User-Switching.png @ 1584,690,186,190 |

### Shadows and effects
Text has a soft dark shadow for legibility over the picture ([I] `0 1px 3px rgba(0,0,0,0.5)`).

## Layout and spacing
Everything is centred on the screen's vertical axis: avatar top at 345 pt (of 1050), name below, field at 511-539 pt, Cancel ring at 931-961 pt.

## Keyboard and accessibility
The password field has focus; Return submits; Esc cancels; VoiceOver can be toggled with Command-F5 on this screen [D]. ARIA: `form` with a labelled `input type="password"` and a `button` "Cancel".

## Browser notes
Straightforward; the Evening picture is an asset.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light session | 10-15-Catalina-Light-Fast-User-Switching.png | 1400,640,560,1360 | avatar, name, password field, Cancel |
| dark session | 10-15-Catalina-Dark-Fast-User-Switching.png | 1400,640,560,1360 | identical |
