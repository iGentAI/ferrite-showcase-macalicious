# Network Utility
- **Screenshots:** 10-15-Catalina-Light-Network-Utility.png, 10-15-Catalina-Dark-Network-Utility.png
- **Window:** 644 x 385 pt [M] (image x=112..1399, y=76..845). Plain title bar, 22 pt (y=76..119). Title "Network Utility". Not resizable content (fixed layout).

## Layout
| Region | Size (pt) | Light | Dark | Tag / evidence |
|---|---|---|---|---|
| Title bar | 22 | gradient `#f6f6f6` -> `#bdbdbd`, line `#a7a7a7` | dark gradient, line `#000000` | [M] Light-Network-Utility @ 250,76,1,44 |
| Top strip | 22 high (y=120..163) | `#ececec` | `#303032` | [M] Light @ 150,120,1,44; Dark @ 400,130 |
| Tab pane (`tab-view` content area), full window width, to the window bottom | starts with a 1 px line at y=164; 340.5 high | line `#d3d3d3`, fill `#e3e3e3` | fill `#363638` | [M] Light @ 150,164,1,36 and 113,300,59,1; Dark @ 160,600 |
| Tab control (`tab-view` tabs, centred on the pane's top edge) | 521.5 x 20 (x=235..1277; bezel y=145..184 including its 0.5 pt top and bottom edges, plus one shadow row at y=185), top 12.5 pt below the title bar | segments `#ffffff`, dividers `#e5e5e5`, selected blue gradient `#5a93f3 (sRGB #4a92fa)` -> `#2165f7 (sRGB #0361ff)` | segments `#646465`, selected `#2b66d3 (sRGB #1564db)` | [M] Light @ 220,150,1060,1 and 700,144,1,43; Dark @ 250,165 and 600,165 |
| Group boxes (`box`) | left x=172..797 (313 wide), right x=826..1349 (262 wide), top y=370, bottom y=785 (208 high) | fill `#dadada`, border `#d6d6d6`, darker top edge `#cbcbcb` | fill `#3c3c3e`, lighter border | [M] Light @ 166,600,16,1; 790,600,40,1; 400,360,1,13; 400,770,1,17; Dark @ 400,600 |

Tab segments (px on row y=150; dividers at x=328, 462, 560, 694, 870, 990, 1112): Info 235..327 (selected); Netstat 328..461; Ping 464..559; Lookup 562..693; Traceroute 696..869; Whois 872..989; Finger 992..1111; Port Scan 1114..1277 [M].

```
                         Network Utility
      [Info|Netstat|Ping|Lookup|Traceroute|Whois|Finger|Port Scan]

  Select a network interface for information.
   [ Wi-Fi (en0)                         ^v]
   Interface Information                    Transfer Statistics
  +--------------------------------------+ +----------------------------+
  | Hardware Address: 38:f9:d3:a6:8a:06  | |  Sent Packets: 376,836     |
  |       IP Address: 192.168.7.167      | |   Send Errors: 0           |
  |       Link Speed: 304.2 Mbit/s  ...  | |  Recv Packets: 45,010 ...  |
  +--------------------------------------+ +----------------------------+
```

## Components used
`window`, `title-bar`, `window-controls`, `tab-view` (real tab view: tabs straddle the top edge of a slightly darker full-width pane; accent-filled selected tab), `pop-up-button` (regular, accent chevron cap), `box` (titled group boxes with the title above the top-left corner), `label` (right-aligned keys with colons, left-aligned values).

## App-specific elements
All values below are measured on the original pixels [M]. Frame x 112..1399, y 76..845; the light and dark captures agree within 1 px on every row of this table.

| Element | Image px | Size and position (pt) | Evidence |
|---|---|---|---|
| Prompt "Select a network interface for information." | ink x 157..663, y 230..250 | 13 pt Regular [C]; ink starts 22.5 from the window's left edge; ink top 77 below the window top, 22.5 below the tab control's bottom edge (y=185) | `10-15-Catalina-Light-Network-Utility.png @ 157,230,507,21` |
| Pop-up button "Wi-Fi (en0)" (`pop-up-button`, regular) | x 173..796, y 284..323 | 312 wide, 20 high including its shadow row; left edge 30.5 from the window edge; top 104 below the window top, 17 below the prompt's ink bottom; accent cap fill starts at x=764 (16 wide) | `10-15-Catalina-Light-Network-Utility.png @ 173,284,624,40` |
| Box title "Interface Information" | ink x 196..445, y 344..364 | 13 pt Regular [C]; ink starts 12 right of the box's left edge (x=172); ink bottom 3 above the box top (y=370) | `10-15-Catalina-Light-Network-Utility.png @ 196,344,250,21` |
| Box title "Transfer Statistics" | ink x 849..1066, y 344..364 | ink starts 11.5 right of the box's left edge (x=826) | `10-15-Catalina-Light-Network-Utility.png @ 849,344,218,21` |
| Right group box | x 826..1349 | 262 wide; 25 from the window's right edge (the left box is 30 from the left edge) | `10-15-Catalina-Light-Network-Utility.png @ 1340,600,60,1` |
| Key/value rows | ink tops at y 398, 446, 494, 542, 590, 638 | 13 pt Regular [C]; row pitch 24; first row's ink top 14 below the box top | `10-15-Catalina-Light-Network-Utility.png @ 206,398,470,265` |
| Wrapped second line of the "Model:" value | ink top y 670 | 16 line pitch within a wrapped value | `10-15-Catalina-Light-Network-Utility.png @ 452,638,345,57` |
| Left box columns | key ink ends x 431..432; value ink starts x 452 | keys right-aligned 160 from the window's left edge; values start 10 after the key column | `10-15-Catalina-Light-Network-Utility.png @ 300,446,314,21` |
| Right box columns | key ink ends x 1024..1025; value ink starts x 1045 | keys right-aligned 456.5 from the window's left edge; values start 10 after | `10-15-Catalina-Light-Network-Utility.png @ 863,398,285,25` |
## Content in the screenshot
Tabs: Info, Netstat, Ping, Lookup, Traceroute, Whois, Finger, Port Scan. "Select a network interface for information." Pop-up "Wi-Fi (en0)". "Interface Information": Hardware Address: 38:f9:d3:a6:8a:06; IP Address: 192.168.7.167; Link Speed: 304.2 Mbit/s; Link Status: Active; Vendor: Apple; Model: Wireless Network Adapter (802.11 a/b/g/n/ac). "Transfer Statistics": Sent Packets: 376,836 (dark 894,806); Send Errors: 0 (dark 63); Recv Packets: 45,010 (dark 193,934); Recv Errors: 0; Collisions: 0.

## Not reproducible / assets needed
None.
