# Feature inventory: Stickies

Main commit read: `e62c2ac9`, from GitHub only. Nothing was built or run.

Status: **missing**; **partial** (the note says what is absent); **built-unchecked** (in the code, not yet seen running); **done** with its screenshot. Every status rests on main's source; a menu row's status includes its key equivalent. Scope is the hosted Ferrite desktop. Real-app wording and keys come from knowledge of macOS 10.15 (no Mac) and are provisional. Services is a generated list, so it is one row.

Read: `demos/stickies/` (`app.ts`, `stickies.mdx`, `stickies.tsx`), `demos/desktop/desktop.tsx`, `demos/desktop/desktop-menus.tsx`, `demos/spotlight/spotlight-desktop.tsx`, `automator/actions.rs`, `e2e/stickies-census-journey.mjs`.

**Main finding:** the desktop's Stickies window holds the first stored note and opens every other stored note as a further window of the app (`DesktopWindow`), at its saved frame, with no change to the desktop host. The desktop's own File > Close Window closes a window without removing its note, and on the app's first window closes every note's window (they all reopen with the app); Stickies' own File > Close asks and removes the note. The desktop registers **File**, **Edit**, **Font**, **Color** and **Window** rows; "Shell" means the desktop's own row. The rows below carry `done: <screenshot>` where `e2e/stickies-depth-journey.mjs` ran them.

## Menus

| Menu | Item | Key | Status | Notes |
| --- | --- | --- | --- | --- |
| Stickies | About Stickies | | built-unchecked | Shell |
| Stickies | Services | | done: [stickies-services.png](#project-artifact/art_a7e016210b9b9bc1/527) | Make New Sticky Note, stored and shown; the rest of the list is the desktop's |
| Stickies | Hide Stickies | ⌘H | built-unchecked | Shell |
| Stickies | Hide Others | ⌥⌘H | built-unchecked | Shell |
| Stickies | Show All | | built-unchecked | Shell |
| Stickies | Quit Stickies | ⌘Q | built-unchecked | Shell |
| File | New Note | ⌘N | done: [stickies-many-notes.png](#project-artifact/art_778ce73f9cddf4bd/35) | Dimmed at 100 notes, the server's limit |
| File | Close | ⌘W | done: [stickies-close-alert.png](#project-artifact/art_778ce73f9cddf4bd/28) | Asks, then removes the note; an empty note goes without asking. Save in the alert is absent: Export is not built |
| File | Save All | ⌘S | done: [stickies-file-menu.png](#project-artifact/art_a7e016210b9b9bc1/84) | Notes save themselves, so it only keeps the keyboard |
| File | Import Text… | ⇧⌘I | done: [stickies-imported.png](#project-artifact/art_a7e016210b9b9bc1/86) | A new note from a drive text file: RTF reads as its text, formats dropped; a file longer than a note is refused |
| File | Export Text… | | built-unchecked: [stickies-export.png](#project-artifact/art_a7e016210b9b9bc1/85) | File Format picks Plain Text or RTF with the note's formats: unit test of the RTF and the name; the pop-up no test. RTFD shows dimmed, saying Export Text writes one file and a note's pictures stay in the note; an exported RTF or text has no pictures. No key: ⌘E is Use Selection for Find here |
| File | Page Setup… | ⇧⌘P | built-unchecked | TextEdit's sheet: paper, orientation and scale, kept for the person, which both Print rows take. `preview-books-batch4-journey` read `@page` in the frame after a reload |
| File | Print Active Note | ⌘P | built-unchecked | The browser's print dialog |
| File | Print All Notes | | built-unchecked | The browser's print dialog, a page each |
| Edit | Undo | ⌘Z | built-unchecked | |
| Edit | Redo | ⇧⌘Z | built-unchecked | |
| Edit | Cut | ⌘X | built-unchecked | |
| Edit | Copy | ⌘C | built-unchecked | |
| Edit | Paste | ⌘V | built-unchecked | The menu puts the clipboard's words in the note, the key a picture too, kept on the server: `e2e/small-rows-batch12-journey.mjs`. Where a browser refuses a menu its clipboard the row dims and says the key still pastes, which the journey checked with the read made to reject in Chromium, not in a refusing browser |
| Edit | Paste and Match Style | ⌥⇧⌘V | built-unchecked | Menu row; the key is not answered |
| Edit | Delete | | built-unchecked | |
| Edit | Select All | ⌘A | built-unchecked | |
| Edit | Find ▸ Find… | ⌘F | done: [stickies-find.png](#project-artifact/art_778ce73f9cddf4bd/37) | |
| Edit | Find ▸ Find Next | ⌘G | done: [stickies-find-next-note.png](#project-artifact/art_778ce73f9cddf4bd/39) | Goes on in the next note that holds the text, expanding it if collapsed |
| Edit | Find ▸ Find Previous | ⇧⌘G | done: [stickies-find-previous.png](#project-artifact/art_778ce73f9cddf4bd/41) | |
| Edit | Find ▸ Use Selection for Find | ⌘E | done: [stickies-use-selection.png](#project-artifact/art_778ce73f9cddf4bd/40) | |
| Edit | Find ▸ Jump to Selection | ⌘J | built-unchecked | |
| Edit | Spelling ▸ Show Spelling and Grammar | ⌘: | done: [stickies-spelling.png](#project-artifact/art_a7e016210b9b9bc1/522) | Change, Find Next, Ignore, Learn; opens beside the note. `e2e/stickies-tools-journey.mjs` |
| Edit | Spelling ▸ Check Document Now | ⌘; | built-unchecked | The journey selects the next word and types over it; no screenshot of it |
| Edit | Spelling ▸ Check While Typing | | built-unchecked | The browser's own underline; the setting is read back after a reload in the journey; saved per person |
| Edit | Substitutions ▸ Show Substitutions | | done: [stickies-substitutions.png](#project-artifact/art_a7e016210b9b9bc1/523) | Replace All included |
| Edit | Substitutions ▸ Smart Quotes | | done: [stickies-substitutions.png](#project-artifact/art_a7e016210b9b9bc1/523) | Typed quotes; pasted text keeps its own |
| Edit | Substitutions ▸ Smart Dashes | | done: [stickies-substitutions.png](#project-artifact/art_a7e016210b9b9bc1/523) | Saved per person; off after a reload in the journey |
| Edit | Substitutions ▸ Smart Links | | built-unchecked | The server keeps no links in a note, so a link lasts until the note is built again |
| Edit | Substitutions ▸ Text Replacement | | built-unchecked | Keyboard's rules; the setting decides, whatever Check While Typing says |
| Edit | Transformations ▸ Make Upper Case | | done: [stickies-transformed.png](#project-artifact/art_778ce73f9cddf4bd/33) | |
| Edit | Transformations ▸ Make Lower Case | | built-unchecked | The journey runs it from the note's context menu |
| Edit | Transformations ▸ Capitalize | | built-unchecked | |
| Edit | Speech ▸ Start Speaking | | built-unchecked | Browser's `speechSynthesis` |
| Edit | Speech ▸ Stop Speaking | | built-unchecked | |
| Edit | Start Dictation | | built-unchecked | The desktop's Edit footer: types what the browser's recognizer hears at the insertion point, dimmed with a reason with no field or no recognizer. `e2e/dictation-batch5-journey.mjs`, in other apps, with a stub recognizer |
| Edit | Emoji & Symbols | ⌃⌘Space | built-unchecked | The desktop's Edit footer (`desktop-menus.tsx`) |
| Font | Show Fonts | ⌘T | built-unchecked | |
| Font | Bold | ⌘B | built-unchecked | |
| Font | Italic | ⌘I | built-unchecked | |
| Font | Underline | ⌘U | built-unchecked | |
| Font | Outline | | done: [stickies-font-extras.png](#project-artifact/art_a7e016210b9b9bc1/528) | `e2e/stickies-font-journey.mjs`; kept after a reload |
| Font | Styles… | | built-unchecked | Stale row: the row was there and did nothing. It opens TextEdit's Styles sheet on the note's styles; Apply gives one to the selection. Sheet by unit test and a scratch browser check, Apply no test |
| Font | Bigger | ⌘+ | built-unchecked | |
| Font | Smaller | ⌘- | built-unchecked | |
| Font | Kern ▸ Use Default | | built-unchecked | |
| Font | Kern ▸ Use None | | built-unchecked | |
| Font | Kern ▸ Tighten | | built-unchecked | |
| Font | Kern ▸ Loosen | | done: [stickies-font-extras.png](#project-artifact/art_a7e016210b9b9bc1/528) | Kept after a reload |
| Font | Ligature ▸ Use Default | | built-unchecked | The row reads Ligatures, as TextEdit's |
| Font | Ligature ▸ Use None | | done: [stickies-font-extras.png](#project-artifact/art_a7e016210b9b9bc1/528) | Kept after a reload |
| Font | Ligature ▸ Use All | | built-unchecked | |
| Font | Baseline ▸ Use Default | | built-unchecked | |
| Font | Baseline ▸ Superscript | | done: [stickies-font-extras.png](#project-artifact/art_a7e016210b9b9bc1/528) | Kept after a reload |
| Font | Baseline ▸ Subscript | | built-unchecked | |
| Font | Baseline ▸ Raise | | built-unchecked | |
| Font | Baseline ▸ Lower | | built-unchecked | |
| Font | Show Colors | ⇧⌘C | built-unchecked | |
| Font | Copy Style | ⌥⌘C | done: [stickies-font-extras.png](#project-artifact/art_a7e016210b9b9bc1/528) | |
| Font | Paste Style | ⌥⌘V | done: [stickies-font-extras.png](#project-artifact/art_a7e016210b9b9bc1/528) | In any note; dimmed until a style is copied |
| Font | Text ▸ Align Left | ⌘{ | built-unchecked | |
| Font | Text ▸ Center | ⌘\| | built-unchecked | |
| Font | Text ▸ Justify | | built-unchecked | |
| Font | Text ▸ Align Right | ⌘} | built-unchecked | |
| Color | Yellow | ⌘1 | done: [stickies-color-keys.png](#project-artifact/art_778ce73f9cddf4bd/23) | |
| Color | Blue | ⌘2 | done: [stickies-color-keys.png](#project-artifact/art_778ce73f9cddf4bd/23) | |
| Color | Green | ⌘3 | done: [stickies-color-keys.png](#project-artifact/art_778ce73f9cddf4bd/23) | |
| Color | Pink | ⌘4 | done: [stickies-color-keys.png](#project-artifact/art_778ce73f9cddf4bd/23) | |
| Color | Purple | ⌘5 | done: [stickies-color-keys.png](#project-artifact/art_778ce73f9cddf4bd/23) | |
| Color | Gray | ⌘6 | done: [stickies-color-keys.png](#project-artifact/art_778ce73f9cddf4bd/23) | |
| Window | Minimize | | built-unchecked | Shell sends it to the Dock; the shell's row shows ⌘M, which Stickies keeps for Collapse |
| Window | Collapse / Expand | ⌘M | done: [stickies-collapsed.png](#project-artifact/art_778ce73f9cddf4bd/26) | Saved on the note |
| Window | Zoom | | built-unchecked | Fits the note to its text and back, as the zoom box does, kept on the server and across a reload (`mail-notes-batch7-journey`); dimmed while the note is collapsed |
| Window | Floating Window | ⌥⌘F | done: [stickies-floating.png](#project-artifact/art_778ce73f9cddf4bd/36) | A panel to the window manager; saved per person |
| Window | Translucent | ⌥⌘T | done: [stickies-translucent.png](#project-artifact/art_778ce73f9cddf4bd/32) | Saved on the note |
| Window | Use as Default | | done: [stickies-defaults.png](#project-artifact/art_778ce73f9cddf4bd/30) | Colour, font family and size; saved per person |
| Window | Arrange By ▸ Color | | done: [stickies-arranged-color.png](#project-artifact/art_778ce73f9cddf4bd/24) | |
| Window | Arrange By ▸ Content | | done: [stickies-arranged.png](#project-artifact/art_778ce73f9cddf4bd/29) | |
| Window | Arrange By ▸ Date | | done: [stickies-arranged-date.png](#project-artifact/art_778ce73f9cddf4bd/25) | The order made: no note keeps a date |
| Window | Bring All to Front | | built-unchecked | Shell |
| Window | List of notes | | done: [stickies-window-menu.png](#project-artifact/art_778ce73f9cddf4bd/34) | Shell, named after the notes |
| Help | Stickies Help | | built-unchecked | The desktop's row opens Help Viewer on a search for Stickies (`desktop-menus.tsx`). The demo's own menu bar, off the desktop, keeps it dimmed |

## Notes

| Item | Status | Notes |
| --- | --- | --- |
| Several notes on the desktop | done: [stickies-many-notes.png](#project-artifact/art_778ce73f9cddf4bd/35) | Each its own window |
| Stored notes reopen when Stickies launches | done: [stickies-frames-after-reload.png](#project-artifact/art_778ce73f9cddf4bd/38) | |
| Saved position reopens | done: [stickies-frames-after-reload.png](#project-artifact/art_778ce73f9cddf4bd/38) | |
| Saved size reopens | done: [stickies-after-reload.png](#project-artifact/art_778ce73f9cddf4bd/27) | Moves and resizes are saved on the note |
| Move by the band | done: [stickies-many-notes.png](#project-artifact/art_778ce73f9cddf4bd/35) | |
| Resize by the edges | built-unchecked | |
| Close box | done: [stickies-close-alert.png](#project-artifact/art_778ce73f9cddf4bd/28) | Removes the note after the alert |
| Collapse box | built-unchecked | |
| Double click on the band collapses | built-unchecked | |
| Zoom box | built-unchecked | As tall as the text needs, and back with a second click: `stickies.note.zoom` in the census on a note whose text overflows, and a unit test with a stand-in for the browser's `scrollHeight` |
| Strip on the front note | built-unchecked | |
| Boxes on the front note | built-unchecked | |
| First line bold as title | built-unchecked | |
| Text styles | built-unchecked | |
| Created tooltip | built-unchecked | On the note's text, for a note made from now on: the date is a desktop value, `stickies.times`, as the server keeps no dates. The rule, unit test; a new note's date, no test |
| Modified tooltip | built-unchecked | The same value, to the minute: unit test, and read in a scratch browser check |
| Picture in a note | built-unchecked | Dropped from Finder or pasted: redrawn to at most 40,000 bytes of WebP and kept in the note's formatted text, whose server check takes only a raster picture held in its own markup (`valid_html`, unit test). Paste: code read, not driven. Up to about two large pictures: past that the note says it has no room. A GIF keeps its first frame. Read back from the server and drawn after a reload: `small-apps-batch3-journey` |
| Conflict notice | built-unchecked | |
| Not-saved mark on the close box | built-unchecked | |
| Fonts panel | built-unchecked | |
| Colors panel | built-unchecked | |

## Context menus

| Where | Item | Status |
| --- | --- | --- |
| Note | Yellow | built-unchecked |
| Note | Blue | built-unchecked |
| Note | Green | built-unchecked |
| Note | Pink | built-unchecked |
| Note | Purple | built-unchecked |
| Note | Gray | built-unchecked |
| Note | Font ▸ Show Fonts | built-unchecked |
| Note | Font ▸ Bold | built-unchecked |
| Note | Font ▸ Italic | built-unchecked |
| Note | Font ▸ Underline | built-unchecked |
| Note | Font ▸ Bigger | built-unchecked |
| Note | Font ▸ Smaller | built-unchecked |
| Note | Font ▸ Show Colors | built-unchecked |
| Note | Cut | done: [stickies-context-menu.png](#project-artifact/art_778ce73f9cddf4bd/22) |
| Note | Copy | built-unchecked: seen enabled in [stickies-context-menu.png](#project-artifact/art_778ce73f9cddf4bd/22); what reaches the clipboard not checked |
| Note | Paste | built-unchecked: seen enabled, same screenshot; pasted text not checked |
| Note | Look Up | built-unchecked: seen enabled, same screenshot; a result not checked |
| Note | Spelling and Grammar ▸ Show Spelling and Grammar | built-unchecked |
| Note | Spelling and Grammar ▸ Check Document Now | built-unchecked |
| Note | Substitutions ▸ Show Substitutions | done: [stickies-substitutions.png](#project-artifact/art_a7e016210b9b9bc1/523) |
| Note | Speech ▸ Start Speaking | built-unchecked |
| Note | Speech ▸ Stop Speaking | built-unchecked |
| Note | Services | done: [stickies-services.png](#project-artifact/art_a7e016210b9b9bc1/527). Look Up, Search the Web and the text services the desktop's other apps take, Make New Sticky Note acting (`stickies-drop-journey`, `mail-notes-batch7-journey`). The row was stale: nothing it named is absent |

## Keys outside the menus

| Key | Status | Notes |
| --- | --- | --- |
| Control-Option-arrows move the note | built-unchecked | Window manager |
| Control-Option-Shift-arrows resize the note | built-unchecked | Window manager |
| Control-Option-W closes the note | built-unchecked | Window manager |

## Drag and drop

| Item | Status | Notes |
| --- | --- | --- |
| Drop text from another app into a note | built-unchecked | Browser's own, no app code |
| Drag text out of a note | built-unchecked | Browser's own |
| Drop a picture from Finder | built-unchecked | On a line of its own at the end of the note. A file that is neither text nor picture is refused with the no-drop cursor: `small-apps-batch3-journey` |
| Drop a text file from Finder | done: [stickies-dropped.png](#project-artifact/art_a7e016210b9b9bc1/526) | On a line of its own at the end of the note, not at the pointer; refused with an alert past the note's length. `e2e/stickies-drop-journey.mjs` |

The real app has no multi-selection between notes, so nothing is listed for it.

## Saved state

| Item | Status | Notes |
| --- | --- | --- |
| Text survives reload | built-unchecked | `/api/stickies/data`, 20,000 characters |
| Formats survive reload | built-unchecked | |
| Colour survives reload | built-unchecked | |
| Collapsed survives reload | built-unchecked | Saved on the note, read back from the server; not reopened in the journey |
| Translucent | done: [stickies-after-reload.png](#project-artifact/art_778ce73f9cddf4bd/27) | |
| Survive a server restart | built-unchecked | Census row |
| Per-account isolation | built-unchecked | Census row |
| Live update between windows | built-unchecked | Census row |
| Defaults from Use as Default | done: [stickies-after-reload.png](#project-artifact/art_778ce73f9cddf4bd/27) | A person's desktop value. Absent: a note's first text entered through an input method takes the plain font, not the default |

## Cross-app

| Item | Status | Notes |
| --- | --- | --- |
| Services > Make Sticky | done: [stickies-services.png](#project-artifact/art_a7e016210b9b9bc1/527) | Named Make New Sticky Note |
| Spotlight finds notes | done: [spotlight-open-sticky.png](#project-artifact/art_6a3da0a5b88d531a/73) | Brings the note it found to the front. Opening a note whose window the desktop closed is built, not exercised |
| Scripts and workflows use `stickies.list` | built-unchecked | `actions.rs` |
| Scripts and workflows use `stickies.add` | built-unchecked | `actions.rs` |
| Look Up by key | built-unchecked | |
| Look Up from a menu | built-unchecked | Row offered in the Edit and context menus; not chosen in the journey |
| Export to a drive text file | done: [stickies-export.png](#project-artifact/art_a7e016210b9b9bc1/85) | File > Export Text…; the file read back by the journey |

## Open work ledger

Nothing open for Stickies alone; `stickies-*` live runs belong to the Release thread.

## Calls made

- The first window is the app's: the desktop host opens it, and other notes are its further windows. No host change was needed.
- Close on macOS asks to save and deletes the note. The alert here offers Cancel and Remove Note, since Export is not built.

## Build items, most used first

1. **Many notes on the desktop.** Built. Check: three notes, move, reload.
2. **Window menu.** Built: Collapse, Floating, Translucent, Use as Default, Arrange By, Zoom; keys; saved.
3. **Color keys and defaults.** Built.
4. **File commands.** Save All, Import and Export Text on the drive, Print Active, Print All.
5. **Find across notes.** Built: ⌘F, Next, Previous, Use Selection; Next and Previous go on in other notes.
6. **Pictures and drops.** Picture or text file from Finder; server allowlist change. Needs Finder worker's drag.
7. **Context menu and Edit completions.** Built: Look Up, Cut, Copy, Paste, Transformations, Speech. Absent: Spelling and date tooltips (the server keeps no dates).
8. **Font completions.** Copy and Paste Style, Outline, Styles, Kern, Baseline.
9. **Make Sticky service** from selected text, shared with the shell; Spotlight opens the found note.
10. **Help.** Help opens Help Viewer.
