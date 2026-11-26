# Keychain Access
- **Screenshots:** 10-15-Catalina-Light-Keychain-Access.png, 10-15-Catalina-Dark-Keychain-Access.png (dark: the search field has keyboard focus, so all lists show unemphasized selections)
- **Window:** 877 x 593 pt [M] (image x=112..1865, y=76..1261). Unified toolbar with hidden title, 38 pt (y=76..151).

## Layout
| Region | Size (pt) | Light | Dark | Tag / evidence |
|---|---|---|---|---|
| Toolbar | 38 | gradient `#f5f5f5` -> `#b9b9b9`, line `#a3a3a3` | dark gradient, line `#000000` | [M] Light-Keychain-Access @ 250,76,1,76; Dark @ 440,150,1,2 |
| Left column (opaque, not vibrant) | 174 wide (x=112..459) | `#ffffff` | `#1e1f21` | [M] @ 440,300 |
| "Keychains" pane title | 22 + 1 pt line (y=152..197) | `#efefef`, line `#c6c6c6` | `#2b2d2f`, line `#454749` | [M] @ 440,152,1,46 |
| Keychains list | y=198..704, rows 20 | white | `#1e1f21` | [M] @ 440,198,1,507 |
| "Category" pane title | 1 + 23 + 1 (y=705..754) | `#f0f0f0`, lines `#c7c7c7` | `#2b2d2f`, lines `#454749` | [M] @ 440,705,1,50 |
| Category list | y=755..1261, rows 20 | white | `#1e1f21` | [M] @ 440,755,1,38 |
| Divider | 1 (x=460) | `#d4d4d4` | `#2a2a2a` | [M] Light-Keychain-Access @ 460,500,2,1; Dark @ 460,500,2,1 |
| Item summary header | y=152..361 (105 pt) | `#ffffff` | `#1e1f21` | [M] @ 900,350,1,12 |
| Item table header (`table-header`) | 1 + 23 + 1 (y=362..411) | `#eeeeee`, lines `#c4c5c5` | `#2b2c2f`, lines `#444649` | [M] @ 900,362,1,50 |
| Item table (`table-view`) | y=412..1261, rows 18 | `#ffffff` / `#f5f5f5` | `#1e1f21` / `#292a2b` | [M] @ 900,412,1,90 |

Columns (separator x px -> width pt): Name 462..901 (220, sorted ascending, chevron at x=880..893); Kind 904..1147 (122); Date Modified 1150..1449 (150); Expires 1452..1751 (150); Keychain 1754..1865 [M] (row y=370: separators at x=902, 1148, 1450, 1752).

Toolbar (px, row y=114): "+" 268..317 (25 pt); Info "i" 334..383 (25 pt); search field 1479..1852 (187 pt) [M]. In dark the search field shows a `focus-ring`.

```
[o o o] [+] [i]                                              [Search]
+--- Keychains ---+ [key icon]  <key>
| [lock] login    |             Kind: public key, RSA, 2,048-bit
| [lock] Local It.|             Usage: Encrypt, Derive, Verify
| [lock] System   +------------------------------------------------------
| [fold] System R.| Name            ^ | Kind    | Date Modified | Expires | Keychain
+--- Category ----+ [k] <key>          public key   --            --       login   <- selected (grey)
| [..] All Items  | [k] <key>          private key  --            --       login
| [..] Passwords  | [/] Apple Persist. application password  Today, 8:59 AM  --  login
```

## Components used
`window`, `window-controls`, `toolbar` (title hidden), `toolbar-button`, `toolbar-search-field`, `focus-ring` (dark), `table-header` (also used as pane titles "Keychains" / "Category", centred text), `table-view` (three tables; emphasized and unemphasized selections), `split-view`, `image-view` (64 pt key icon), `label`.

## App-specific elements
- Left lists: 20 pt rows, 16 pt colour icon at 20 pt from the window edge (x=152..169), 11 pt label at 41 pt (x=194). Selected keychain "login" is Bold: white on `#2466d9 (sRGB #0164e1)` in light (list is first responder), `#e3e3e3` on `#464646` in dark. Selected category "All Items": `#dcdcdc` / `#464646`. [M] 10-15-Catalina-Light-Keychain-Access.png @ 112,216,100,1 and 440,755,1,38.
- Item summary: 64 pt icon with its left edge about 26 pt from the pane edge; name 11 pt Bold; "Kind:" / "Usage:" labels in Bold grey with regular values, 11 pt, line pitch 14 pt.
- Item rows: 16 pt icon at x=506..537, 11 pt text at x=546; middle-truncated names ("com.apple.ac...unt.cloudkit-token").

## Content in the screenshot
Keychains: login (selected), Local Items, System, System Roots. Category: All Items (selected), Passwords, Secure Notes, My Certificates, Keys, Certificates. Summary: "<key>", "Kind: public key, RSA, 2,048-bit", "Usage: Encrypt, Derive, Verify". Columns: Name, Kind, Date Modified, Expires, Keychain. Rows: "<key>" public key -- -- login (selected); "<key>" private key; "Apple Persistent State Encryption" application password "Today, 8:59 AM"; "BeaconStore" application password "Sep 29, 2019 at 6:20:00..."; then about 20 "com.apple.ac...*-token" application passwords dated "Today, 2:57 PM" (dark: "Today, 10:21 AM") or "Sep 29, 2019 at 6:21:.."; "com.apple.account.idms.token"; "com.apple.assistant" x2. Search placeholder "Search".

## Not reproducible / assets needed
Key, lock, note, certificate and password-pencil icons (colour artwork).
