# Desktop Stacks (`desktop-stack`)

- **Status:** present
- **AppKit:** Finder (View > Use Stacks, introduced in macOS 10.14)
- **HIG:** https://web.archive.org/web/20200503170015/https://developer.apple.com/design/human-interface-guidelines/macos/system-capabilities/finder/
- **Appearances shown:** light, dark

## Purpose and behaviour
With Stacks on, Finder groups the desktop's files into piles by kind (or date/tag). Each stack takes one grid cell and is labelled with the group name ("Images", "PDF Documents"). Clicking a stack expands it in place: its files fill the cells below and the stack's icon turns into a "collapse" placeholder with a down triangle; clicking again collapses it. Scrubbing over a closed stack with two fingers flips through its files [D] (Apple Support: "Use Stacks on Mac").

## Anatomy
- Closed stack: the newest file's thumbnail (56 pt wide) drawn over two more white-bordered sheets fanned by a few degrees, label below (as `desktop-icon`).
- Open stack: a placeholder icon (rounded rectangle with a centred down triangle, over two fanned sheets) in the stack's cell, followed in the next cells by the stack's files as ordinary `desktop-icon`s.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| group by | kind, date last opened/added/modified/created, tags | kind | View > Group Stacks By | kind |
| state | closed, open | closed | - | both |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| closed | yes | "Images": 10-15-Catalina-Light-Desktop-Stacks.png @ 3170,518,120,165; 10-15-Catalina-Dark-Desktop-Stacks.png @ 3170,518,120,165 |
| open (placeholder + expanded files) | yes | "PDF Documents": 10-15-Catalina-Light-Desktop-Stacks.png @ 3080,740,280,650; 10-15-Catalina-Dark-Desktop-Stacks.png @ 3080,740,280,650 |
| hovered / scrubbing | no | [D] top thumbnail changes to the file under the scrub position |
| selected | no | [I] as `desktop-icon` |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Cell | one `desktop` grid cell (112 pt vertical pitch); stacks follow the volume icons | [M] | 10-15-Catalina-Light-Desktop-Stacks.png @ 3080,209,280,1175 (label rows 209 SSD, 433 Time Machine, 659 Images, 883 PDF Documents, 1106 and 1330 the expanded PDFs) |
| Closed stack artwork | front thumbnail with 2 pt white border about 55 x 55 (px 3174..3285 x 518..627 including the fanned sheets) | [M] | 10-15-Catalina-Light-Desktop-Stacks.png @ 3174,518,112,110 |
| Fanned sheets | front sheet 50 x 50 pt (white frame x 3180..3279, y 523..622) around a 45 x 45.5 pt picture (x 3185..3274, y 528..618), so a 2.5 pt white border. Two sheets behind it show 1 to 3 pt at the edges. The first is rotated 7.9 degrees anticlockwise: its top edge rises 5 px over 36 px (first white pixel y=523 at x=3236, y=518 at x=3272). The second is rotated the other way; too little of it is visible to fix its angle (its bottom edge drops about 5 px over the 12 px that show, x 3190..3202), so use the same 8 degrees mirrored | [M] front sheet and first angle; [C] angle from the slope; [I] second angle | 10-15-Catalina-Light-Desktop-Stacks.png @ 3175,530,105,1; 10-15-Catalina-Light-Desktop-Stacks.png @ 3236,505,37,20; 10-15-Catalina-Light-Desktop-Stacks.png @ 3170,518,120,115 |
| Open placeholder | rounded rectangle about 55 x 40 (px 3171..3283 x 755..846 including the fanned sheets), 2 pt outline, radius about 3; centred down triangle about 20 x 14 | [M] box (dark); [I] sub-dimensions | 10-15-Catalina-Dark-Desktop-Stacks.png @ 3170,755,114,92 |
| Label | as `desktop-icon` (12 pt bold white, cap-top 12 pt below the tile) | [M] | 10-15-Catalina-Light-Desktop-Stacks.png @ 3187,659,84,22 ("Images") |

### Colours and fills
| Part | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Closed stack sheets | white photo borders `#ffffff` | same | [M] | 10-15-Catalina-Light-Desktop-Stacks.png @ 3174,518,112,110 (white rows 518..627) |
| Open placeholder | 55 x 40 pt box (x 3174..3283, y 759..838) with a 2 pt outline `#728ba3 (sRGB #6c8ba6)`..`#778da5 (sRGB #728da7)`, a lighter body `#acc4dd (sRGB #a7c4e0)` (the wallpaper beside it is `#95acc1 (sRGB #90acc3)`), and a darker triangle `#768c9e (sRGB #718ca0)` 12 pt tall (y 788..811), 11 pt wide at mid-height (x 3219..3240). No pure white | white (`#ffffff`-range) 2 pt outline and white triangle, clear body (rows 755..846) | [M] | 10-15-Catalina-Light-Desktop-Stacks.png @ 3150,800,150,1; 10-15-Catalina-Light-Desktop-Stacks.png @ 3227,740,1,120; 10-15-Catalina-Dark-Desktop-Stacks.png @ 3170,755,114,92 |

### Text and icons
As `desktop-icon`. Group names seen: "Images", "PDF Documents".

### Shadows and effects
Front thumbnail and sheets have the usual soft icon shadow [I].

## Layout and spacing
Expanding a stack pushes later items down the column (and into the next column to the left when the column is full). Expanded files keep the grid pitch.

## Keyboard and accessibility
Select with arrows; Command-O or Return-equivalent click toggles expansion [I]. ARIA: `button` with `aria-expanded` controlling a group of items.

## Browser notes
Build the pile from three absolutely positioned thumbnails with `transform: rotate()`; the placeholder is a simple SVG.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Desktop-Stacks.png | 3080,480,280,900 | closed "Images" stack, open "PDF Documents" stack and its two files |
| dark | 10-15-Catalina-Dark-Desktop-Stacks.png | 3080,480,280,420 | same, dark (white placeholder outline) |
