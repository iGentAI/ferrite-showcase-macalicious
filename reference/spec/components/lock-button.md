# Authorization Lock (`lock-button`)

- **Status:** present
- **AppKit:** `SFAuthorizationView` (SecurityInterface framework); states `SFAuthorizationViewLockedState`, `SFAuthorizationViewInProgressState`, `SFAuthorizationViewUnlockedState`; `setString(_:)`, `setAutoupdate(_:)`
- **HIG:** https://web.archive.org/web/20200503171155/https://developer.apple.com/design/human-interface-guidelines/macos/app-architecture/security/
- **Appearances shown:** light, dark (locked state only)

Short file names: `L-DT` / `D-DT` = `10-15-Catalina-Light-System-Preferences-Date-and-Time.png` / Dark.

## Purpose and behaviour
The lock is the system-provided way to gate settings that need administrator rights. The HIG's security guidance is to use system authentication rather than inventing a scheme and to request authorization only when it is needed. [D] (HIG, Security) Clicking the closed lock presents the system authentication dialog; on success the lock opens, the pane's controls become enabled and the text changes to "Click the lock to prevent further changes." Clicking the open lock locks the pane again. While locked, every protected control in the pane is drawn disabled (as in the Date & Time screenshots). [D] (`SFAuthorizationView` reference)

## Anatomy
A padlock image (artwork, 22 x 27.5 pt visible) followed by a single line of status text. The image is the click target together with the text.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| state | locked, authenticating, unlocked | locked | `authorizationState` | locked only |
| text | "Click the lock to make changes." / "Authenticating…" / "Click the lock to prevent further changes." | by state | `setString` | first only |
| size | pane footer (large icon + text); small icon only (Finder Get Info, bottom right) | pane footer | - | both (`10-15-Catalina-Light-Finder-Get-Info.png`, lower right, belongs to `inspector-panel`) |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| locked | yes, light + dark | `L-DT @ 163,1041,453,55`; `D-DT @ 163,1041,453,55`; also Users & Groups, Security & Privacy, Startup Disk (sysB screenshots, viewed) |
| unlocked | not shown in any screenshot | [I] same image with the shackle swung open (artwork taller by the raised shackle), text "Click the lock to prevent further changes." |
| authenticating | not shown | [I] the lock animates its shackle while the dialog is up |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Lock artwork (visible bounds, locked) | 22 x 27.5 | [M] | `L-DT @ 163,1041,44,55` |
| Body width | 22 (full artwork width) | [M] | `L-DT` row y=1075: body x 163..206 |
| Left margin (window edge to artwork) | 25.5 | [M] | `L-DT`: artwork x=163, window frame x=112 |
| Bottom margin (artwork bottom to window bottom) | 18 | [M] | `L-DT`: artwork bottom y=1095, frame bottom y=1131 |
| Text start | 14 after the artwork (36 from the artwork's left edge) | [M] | `L-DT`: artwork right x=206, text ink x=235 |
| Text | 13 pt regular, one line; ink rows y 1066..1089 (cap top to descender) | [C] | `L-DT @ 235,1066,381,24` |
| Text vertical position | ink rows y 1066..1089 against artwork rows y 1041..1095: the text's descender line is 3 pt above the artwork's bottom | [M] | same crops |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Text | `#767676` on `#ececec` (`rgba(0,0,0,0.50)`, secondary label) | `#a1a2a2` on `#2f3031` (`rgba(255,255,255,0.55)`) | [M], [C] | `L-DT @ 614,1084`; `D-DT @ 614,1084` |
| Lock body (gold) | `#f4ca7f (sRGB #fbc972)` main face, edges `#ecb866 (sRGB #f5b755)`, `#cb8f46 (sRGB #d58d33)`, `#ac6c2d (sRGB #b66917)`, outline `#723411 (sRGB #7b3000)` | identical artwork | [M] | `L-DT` row y=1075 x 163..206; `D-DT` row y=1075 |
| Lock shackle (steel) | greys with white highlight (`#ffffff` 30 px in the artwork box) | identical | [M] | palette of `L-DT @ 163,1041,44,55` |

The lock is the same bitmap in both appearances; only the anti-aliased outer pixels differ with the background (`#b6a298 (sRGB #baa196)` vs `#422f25 (sRGB #452e23)` at x=163, y=1075). [M]

### Shadows and effects
None outside the artwork.

## Layout and spacing
Bottom-left corner of a preference pane, on the window background below any tab view or box; the help button occupies the bottom-right corner on the same row (`L-DT @ 1366,1058,42,43`). The text is vertically centred on the lower part of the lock body. [M] positions above.

## Keyboard and accessibility
Focusable with Full Keyboard Access; Space activates. Role `AXButton` with the status string as title. Web: a `<button>` containing the image and text, `aria-pressed` reflecting the unlocked state. [D]

## Browser notes
The padlock is skeuomorphic artwork (gold body, steel shackle) and must be an image asset for locked and unlocked states; the authentication dialog itself is `dialog` / `sheet` territory.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-System-Preferences-Date-and-Time.png` | 163,1041,453,55 | locked, with text |
| dark | `10-15-Catalina-Dark-System-Preferences-Date-and-Time.png` | 163,1041,453,55 | locked, with text |
