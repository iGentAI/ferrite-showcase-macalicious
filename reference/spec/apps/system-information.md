# System Information
- **Screenshots:** 10-15-Catalina-Light-System-Information.png, 10-15-Catalina-Dark-System-Information.png
- **Window:** 751 x 520 pt [M] (image x=112..1613, y=76..1115). Plain title bar only, 22 pt (y=76..119). Title "MacBook Pro".

## Layout
| Region | Size (pt) | Light | Dark | Tag / evidence |
|---|---|---|---|---|
| Title bar | 22 | gradient `#f7f7f7` -> `#bdbdbd`, line `#a7a7a7` | `#3c3d3e` -> `#363739`, line `#000000` | [M] Light-System-Information @ 250,76,1,44; Dark @ 430,100,1,20 |
| Category outline (`outline-view`, opaque) | 163 wide (x=112..437), rows 16 | `#ffffff` | `#1e1f20` | [M] @ 300,600 / Dark @ 430,160 |
| Divider | 1 | `#d5d5d5` | `#000000` [C] | [M] Light @ 438,600 |
| Report pane (`text-view`, read-only) | 587 wide (x=440..1613) | `#ffffff` | `#1e1f20` | [M] @ 500,600 |
| Path bar (`path-bar`) | 1 pt line + 20 (y=1074..1115) | line `#d5d5d5`, fill `#ececec` | dark | [M] Light @ 1000,1074,1,42 |

```
                     MacBook Pro
+ v Hardware  (sel) + Hardware Overview:
|     ATA           |
|     Apple Pay     |   Model Name:            MacBook Pro
|     Audio ...     |   Model Identifier:      MacBookPro15,1
|   v Network       |   ...
|     Firewall      |
+-------------------+----------------------------------------
 [mac] ismh15 > Hardware
```

## Components used
`window`, `title-bar`, `window-controls`, `outline-view` (two levels, emphasized selection with a white triangle), `disclosure-triangle`, `split-view`, `text-view`, `path-bar`.

## App-specific elements
- Outline rows: 16 pt pitch, selection 15 pt high and full pane width (`#2466d9 (sRGB #0164e1)` / `#1f5bc8 (sRGB #0159cf)`), 11 pt text; top-level labels at about 19 pt from the pane edge after the triangle (x=127..144), children at 35 pt (x=182). [M] 10-15-Catalina-Light-System-Information.png @ 430,120,1,30 and 182,160,39,16.
- Report: heading "Hardware Overview:" 11 pt Bold at x=471 (15.5 pt from the pane edge), cap top 12 pt below the title bar; key/value lines start 44 pt below the pane top at 13 pt pitch; keys at x=484 (22 pt inset), values in a second column at about x=810 (preview 405 pt); text black / white. [M] 10-15-Catalina-Light-System-Information.png @ 471,144,224,19 and 484,199,376,18.
- Path bar: 16 pt computer icon, "ismh15", chevron separator, "Hardware"; 11 pt.

## Content in the screenshot
Outline: Hardware (selected, expanded): ATA, Apple Pay, Audio, Bluetooth, Camera, Card Reader, Controller, Diagnostics, Disc Burning, Ethernet Cards, Fibre Channel, FireWire, Graphics/Displays, Memory, NVMExpress, PCI, Parallel SCSI, Power, Printers, SAS, SATA/SATA Express, SPI, Storage, Thunderbolt, USB; Network (expanded): Firewall, Locations, Volumes. Report: "Hardware Overview:"; Model Name: MacBook Pro; Model Identifier: MacBookPro15,1; Processor Name: 8-Core Intel Core i9; Processor Speed: 2.3 GHz; Number of Processors: 1; Total Number of Cores: 8; L2 Cache (per Core): 256 KB; L3 Cache: 16 MB; Hyper-Threading Technology: Enabled; Memory: 16 GB; Boot ROM Version: 1037.0.78.0.0 (iBridge: 17.16.10569.5.1,0) (dark: 17.16.10571.5.1,0); Serial Number (system): (blank); Hardware UUID: (blank); Activation Lock Status: Enabled. Path bar: "ismh15 > Hardware".

## Not reproducible / assets needed
Small computer icon in the path bar.
