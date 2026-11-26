# AirPort Utility
- **Screenshots:** 10-15-Catalina-Light-Airport-Utility.png, 10-15-Catalina-Dark-AirPort-Utility.png. Both files show the same dark-looking window: the "Light" file also has a dark title bar (`#4d4e4f` at 1300,80), so no light-appearance rendering of this app exists in the library. The two PNGs are not byte-identical but are visually the same.
- **Window:** 696 x 532 pt [M] (image x=112..1503, y=76..1139). Plain title bar, 22 pt. Title "AirPort Utility".

## Layout
| Region | Size (pt) | Colour (both files) | Tag / evidence |
|---|---|---|---|
| Title bar | 22 (y=76..119) | dark title bar, top highlight `#8f8f8f`/`#7f8081` then `#4d4f4f` fading to about `#49494b` | [M] 10-15-Catalina-Light-Airport-Utility.png @ 1300,76,1,20 |
| Content | 510 high (y=120..1139), full width | vertical gradient: `#2e333c (sRGB #2d333d)` at y=130, `#3f454d (sRGB #3e454e)` at y=400, `#52575f (sRGB #515760)` at y=700, `#626971 (sRGB #616972)` at y=1000, `#6a7078 (sRGB #697079)` at y=1130 | [M] 10-15-Catalina-Light-Airport-Utility.png @ 1300,130 / 1300,400 / 1300,700 / 1300,1000 / 1300,1130 |

Fitted CSS [C], in sRGB values: `linear-gradient(to bottom, #2d333d 0%, #3e454e 27%, #515760 57%, #616972 86%, #697079 100%)`. The stored pixel values of these five stops are in the Content row above.

```
                    AirPort Utility
 [Other Wi-Fi Devices]
                      ( globe )
                    (o) Internet
```

## Components used
`window`, `title-bar`, `window-controls`, `push-button`-like dark pill ("Other Wi-Fi Devices"), `image-view` (globe), `label`.

## App-specific elements
All values below are measured on the original pixels [M] unless tagged otherwise. Positions are given in image px and as offsets in pt from the window frame (x 112..1503, y 76..1139). Both captures give identical bounding boxes for every element.

| Element | Image px | Size and position (pt) | Colours | Evidence |
|---|---|---|---|---|
| "Other Wi-Fi Devices" button, fill | x 160..427, y 161..198 | 134 x 19; 24 from the window's left edge, 42.5 below the window top | fill `#65686f (sRGB #646870)`; highlight rows `#83868b (sRGB #82868c)` (y=161) and `#6a6e74 (sRGB #696e75)` (y=162); dark outline `#2c3138 (sRGB #2b3139)` above (y=160) and `#282c33 (sRGB #272c34)` below (y=199) [M] | `10-15-Catalina-Light-Airport-Utility.png @ 300,150,1,60` |
| Button corner radius | bottom-left corner of the dark outline at x=159, y=199 | 3.625, on the outer edge of the dark outline (3.125 on the fill). Least-squares fit with `tools/corner_fit.py` [C]: rms 1.9 levels; 2.1 at 3.5 and at 3.75, 3.8 at 4, 7.6 at 2.5; the same in both files. The earlier "about 2.5" was a grid reading | - | `10-15-Catalina-Light-Airport-Utility.png @ 158,160,8,7`; fit corner `10-15-Catalina-Light-Airport-Utility.png @ 159,190,10,10` |
| Button title "Other Wi-Fi Devices" | ink x 176..417, y 170..190 | 120.5 wide; ink inset 8 from the fill's left edge, 5 from its right; 13 pt Regular [C] | `#e8e9ea` | `10-15-Catalina-Light-Airport-Utility.png @ 176,170,242,21` |
| Globe artwork with its ground shadow | x 681..937, y 240..516 | 128.5 x 138.5; top 82 below the window top; horizontally centred (bbox centre x=809, frame centre x=808) | image asset | `10-15-Catalina-Light-Airport-Utility.png @ 681,240,257,277` |
| Globe sphere without the shadow | y 241..505 | 132.5 high | image asset | `10-15-Catalina-Light-Airport-Utility.png @ 681,241,256,265` |
| Status dot | x 724..747, y 548..571 | 12 disc; top 236 below the window top, 16 below the globe artwork's bottom | fill `#76d572 (sRGB #4bd964)`, anti-aliased edge `#75cf71 (sRGB #4ed364)` | `10-15-Catalina-Light-Airport-Utility.png @ 736,560` |
| Label "Internet" | ink x 764..891, cap height y 550..573 | 64 wide; cap height 24 px, so 17 pt [C], Bold | `#ffffff` | `10-15-Catalina-Light-Airport-Utility.png @ 767,560` |
| Dot-to-label gap and alignment | x 748..763 | 8; dot plus label are centred as one unit (x 724..891, centre x=808) | - | `10-15-Catalina-Light-Airport-Utility.png @ 716,560,180,1` |

The "Light" and "Dark" files show the same dark-styled window. Inside the frame 63,577 pixels differ between the two files, by at most 13 levels per channel (noise in the gradient and artwork), and none of the bounding boxes above moves [M].
## Content in the screenshot
Title "AirPort Utility"; button "Other Wi-Fi Devices"; label "Internet".

## Not reproducible / assets needed
The globe artwork (image asset). No light-mode reference exists; if a light version is needed it must be designed [I].
