# Feature inventory: TextEdit

Main commit read: `e62c2ac9`, from GitHub only. Nothing was built or run.

Status: **missing**; **partial** (the note says what is absent); **built-unchecked** (in main's code, not yet seen running). No row is done: done needs a screenshot in a browser. Every status rests on main's source; a menu row's status includes its key equivalent. Scope is the hosted Ferrite desktop. Real-app wording and keys come from knowledge of macOS 10.15 (no Mac; only the Print menu is captured) and are provisional. Services, Open Recent and the window list are generated lists, so each is one row.

Read: `demos/textedit/` (`app.ts`, `textedit.mdx`, `textedit.tsx`, `textedit-drive.tsx`), `demos/notes/notes-edit-menu.tsx`, `demos/desktop/desktop-menus.tsx`, `demos/finder/finder-open.ts`, `demos/spotlight/spotlight-desktop.tsx`, `e2e/textedit-census-journey.mjs`, the desktop README. The desktop registers **File**, **Edit** and **Format**; "Shell" means the desktop's own row. `textedit.mdx`'s "Not built" list is out of date.

## Menus

| Menu | Item | Key | Status | Notes |
| --- | --- | --- | --- | --- |
| TextEdit | About TextEdit | | built-unchecked | Shell |
| TextEdit | Preferences… | ⌘, | done: [textedit-preferences-new-document.png](#project-artifact/art_6a3da0a5b88d531a/78) | New Document and Open and Save tabs |
| TextEdit | Services | | built-unchecked | Shell: `ServicesItems` on the text selected when the menu bar was pressed (Look Up, Safari, New Note, New Email, Sticky Note), else No Services Apply |
| TextEdit | Hide TextEdit | ⌘H | built-unchecked | Shell |
| TextEdit | Hide Others | ⌥⌘H | built-unchecked | Shell |
| TextEdit | Show All | | built-unchecked | Shell |
| TextEdit | Quit TextEdit | ⌘Q | built-unchecked | Shell |
| File | New | ⌘N | built-unchecked | A new window on the desktop, leaving the document where it is (`newWindow`, `textedit-windows.ts`), with the keyboard in its text. Off the desktop, in the library's demo, it still replaces the one window after asking. `textedit-commands.test.tsx`; the batch's browser journey |
| File | Open… | ⌘O | built-unchecked | A window that holds nothing takes the file; otherwise it gets a window of its own, and a file already open brings its window to the front. One file at a time: see Open several in the Open panel. `textedit-commands.test.tsx`; the batch's browser journey |
| File | Open Recent | | built-unchecked | |
| File | Open Recent ▸ Clear Menu | | built-unchecked | TextEdit's list only: a file opened or changed afterwards comes back |
| File | Close | ⌘W | built-unchecked | Shell |
| File | Save… | ⌘S | built-unchecked | |
| File | Duplicate | ⇧⌘S | built-unchecked | |
| File | Rename… | | built-unchecked | |
| File | Save As… | ⌥⇧⌘S | built-unchecked | |
| File | Move To… | | built-unchecked | A sheet with a Where pop-up of the drive's folders. The file keeps its id and stays the document's. Dimmed without a file. `textedit-commands.test.tsx` |
| File | Revert To ▸ Last Saved | | built-unchecked | Asks first. Goes back to the text kept at the last open or File > Save, not what autosave wrote since, and writes it into the file. Kept in the person's desktop values, for the file opened last, up to 16 values' worth (64 KB); past that, or without a file, dimmed with the reason. `textedit-commands.test.tsx` |
| File | Revert To ▸ Previous Save | | built-unchecked | Goes back at once to the newest kept version older than the last save, File > Save's first, and keeps what it replaced, so nothing is asked. Dimmed with the reason while none is kept. `textedit-versions.test.tsx`, `e2e/versions-batch9-journey.mjs` |
| File | Revert To ▸ Browse All Versions | | built-unchecked | A sheet, not the Mac's Time Machine star field: the versions the drive keeps with their dates, the chosen one's text beside the document's, Restore and Done. Restore makes it the file's bytes on the drive and keeps what it replaced. Dimmed with the reason only while the document has no file. `e2e/versions-batch9-journey.mjs` reads each result back from the drive across reloads; `drive.rs` and `tests/files.rs` for the store |
| File | Share ▸ Mail | | built-unchecked | The document's file, through `FileShareItems`. Dimmed with the reason while the document has no file. `textedit-commands.test.tsx` |
| File | Share ▸ Messages | | built-unchecked | Same |
| File | Share ▸ AirDrop | | partial | Dimmed, with the reason: a web page cannot reach nearby devices |
| File | Show Properties | ⌥⌘P | built-unchecked | A floating panel of the desktop (a `panel` managed window), as the Mac has, with no OK or Cancel: Author, Organization, Copyright, Title, Subject, Keywords and Comment apply as typed, kept in the draft and an RTF file's `\info`. The row reads Hide Properties while the panel is up. One panel follows the front document and keeps its place; it goes when TextEdit is not in front, and is not reopened by a reload. `e2e/textedit-rows-batch12-journey.mjs`, `textedit-properties.test.tsx`. Dimmed for plain text and an HTML file, which has no place for them. Real panel title and layout are from memory of macOS, not a capture |
| File | Page Setup… | ⇧⌘P | built-unchecked | A sheet: paper (US Letter, A4), orientation and scale, saved per account, as `@page` and `zoom` on the printed page. Format For is dimmed, with the reason: the browser's print dialog chooses the printer. `textedit-commands.test.tsx`, `textedit-print.test.ts` |
| File | Print… | ⌘P | partial | The ruler's indents and tab width reach the page (`e2e/textedit-print-journey.mjs`), and so do the sheet's Paper Size, Orientation and Copies (`textedit-print.test.ts`). Pages From and To print those pages, read by Chromium to a PDF in `e2e/textedit-rows-batch12-journey.mjs`, but a page is the sheet's preview's, 46 paragraphs, not where the paper breaks, since the browser tells a page nothing of that. Two-Sided leaves a blank back after a copy of an odd number of those pages, so each copy starts on a new sheet (three PDF pages for two copies of one page in that journey), and says so; CSS's own `break-after: right` makes no blank page in Chromium. The count is the preview's, so a document that wraps past it or holds page breaks can be a page out. A page cannot ask the printer for both sides, so the browser's own dialog must be told. Not printed on paper; the sheet's printer list is the demo's |
| File | Export as PDF… | | built-unchecked | Asks where on the drive and writes a PDF there, on Page Setup's paper, orientation and scale, with no print dialog. Each page is a picture of the page, as Preview's PDFs are, so the text in it cannot be selected. `textedit-pdf.ts`, `textedit-pdf.test.ts`; read by `pypdf` in the batch's browser journey. The Print sheet's PDF button still uses the browser's dialog |
| Edit | Undo | ⌘Z | built-unchecked | |
| Edit | Redo | ⇧⌘Z | built-unchecked | |
| Edit | Cut | ⌘X | built-unchecked | |
| Edit | Copy | ⌘C | built-unchecked | |
| Edit | Paste | ⌘V | built-unchecked | Where the browser refuses a menu the clipboard, the row is dimmed and a row under it says the key still pastes (`EditorEditItems`) |
| Edit | Paste and Match Style | ⌥⇧⌘V | built-unchecked | |
| Edit | Delete | | built-unchecked | |
| Edit | Complete | ⌥Esc | built-unchecked | A list at the insertion point: the document's words, then the SCOWL word list's, shortest first. Arrows move, Return or Tab inserts, Escape dismisses. In plain text the list's place is worked out from the font, not measured. `textedit-commands.test.tsx` |
| Edit | Select All | ⌘A | built-unchecked | |
| Edit | Insert ▸ Line Break | | done: [textedit-rich-link.png](#project-artifact/art_a7e016210b9b9bc1/284), `e2e/textedit-rich-journey.mjs` | |
| Edit | Insert ▸ Paragraph Break | | done: [textedit-rich-link.png](#project-artifact/art_a7e016210b9b9bc1/284), `e2e/textedit-rich-journey.mjs` | |
| Edit | Insert ▸ Page Break | | done: [textedit-rich-link.png](#project-artifact/art_a7e016210b9b9bc1/284), `e2e/textedit-rich-journey.mjs` | Takes effect when printed |
| Edit | Attach Files… | ⇧⌘A | built-unchecked | The drive's Open panel. A PNG or JPEG goes into the text; any other file is attached as a link to the drive file, which a double click opens. Dimmed in plain text. `textedit-commands.test.tsx`; the batch's browser journey |
| Edit | Add Link… | ⌘K | built-unchecked | Web addresses only. Kept in an RTF file as a `HYPERLINK` field, read back from TextEdit's and Word's. `textedit-picture.test.ts` |
| Edit | Find ▸ Find… | ⌘F | done | [Find bar counting matches](#project-artifact/art_6a3da0a5b88d531a/1) |
| Edit | Find ▸ Find and Replace… | ⌥⌘F | done | [All three replaced, one Undo step each](#project-artifact/art_6a3da0a5b88d531a/2) |
| Edit | Find ▸ Find Next | ⌘G | built-unchecked | The bar's Next seen |
| Edit | Find ▸ Find Previous | ⇧⌘G | built-unchecked | |
| Edit | Find ▸ Use Selection for Find | ⌘E | built-unchecked | |
| Edit | Find ▸ Jump to Selection | ⌘J | built-unchecked | |
| Edit | Spelling ▸ Show Spelling and Grammar | ⌘: | built-unchecked: [textedit-spelling.png](#project-artifact/art_a7e016210b9b9bc1/516) | A floating panel: Change, Find Next, Ignore, Learn and guesses, from a SCOWL word list read when first needed. `demos/desktop/text-tools.tsx`, `e2e/textedit-spelling-journey.mjs`. Learned words are not known to the browser's own underlines; when one desktop value is full, Learn says so and removes none. Change does nothing if the word has moved, and says so. In the desktop's menu bar, the text's context menu and the menu bar `TextEditMenuBar` exports, which has Lists and Table as well |
| Edit | Spelling ▸ Check Document Now | ⌘; | built-unchecked | Selects the next word not in the list, going round once. `checkDocumentNow`, `e2e/textedit-spelling-journey.mjs` |
| Edit | Spelling ▸ Check While Typing | | built-unchecked | The browser's own underlines, by `spellCheck` on the view, saved as the Preferences row |
| Edit | Spelling ▸ Check Grammar | | built-unchecked | Off at first, kept on the server for every editor, here and in Preferences. On, Check Document Now and the panel also stop at a repeated word, a and an by the next word's sound, a sentence after a full stop in lower case, and a space before punctuation, saying why and offering the change (`demos/desktop/text-grammar.ts`, `e2e/textedit-rows-batch12-journey.mjs`). A short list of rules, not Apple's grammar checker, and no green underline while typing: the browser draws only its own spelling marks |
| Edit | Spelling ▸ Correct Automatically | | built-unchecked | Off at first, kept on the server, here and in Preferences. On a space, punctuation or Return, a word from a list of 90 known misspellings (`textedit-corrections.ts`) becomes what it stands for, keeping a leading capital; one Undo gives it back. Names, unknown words, all capitals, words the person taught and parts of addresses stay. No guess from the word list, so anything unlisted stays misspelt; a word split across two styles is left. Rich and plain views. `e2e/textedit-rows-batch12-journey.mjs` (rich view in Chromium), `textedit-corrections.test.ts`. Other apps' row stays dimmed |
| Edit | Substitutions ▸ Show Substitutions | | built-unchecked | A floating panel with the same checks and Replace All, which keeps to a selection when there is one. `SubstitutionsPanel` |
| Edit | Substitutions ▸ Smart Copy/Paste | | built-unchecked | A space where a pasted word meets another, in plain text and in rich text, across styles and across the paste's own nodes. One Undo takes the paste and its spaces, and one Redo brings them back (`editors-edit-journey`, `text-substitutions.test.ts`) |
| Edit | Substitutions ▸ Smart Quotes | | built-unchecked | As typed, with one Undo. Pasted and existing text changes only through Replace All. Not compared with a real Mac |
| Edit | Substitutions ▸ Smart Dashes | | built-unchecked | Two hyphens as typed, with one Undo; pasted text as for Smart Quotes |
| Edit | Substitutions ▸ Smart Links | | built-unchecked | A web address followed by a space, in rich text. Off by default, as in Catalina |
| Edit | Substitutions ▸ Data Detectors | | built-unchecked | A check, off as a new account starts, kept on the server; the same in Show Substitutions and Preferences. With it on, a secondary click on a date offers Create Event, on an address Show in Maps, on an email address New Mail Message, on a flight or parcel number its tracking page, and each Copy; a phone number's Call with FaceTime stays dimmed, as FaceTime here cannot ring a number. What counts is Messages' detectors, in English, and nothing is underlined in the text. `textedit-detectors.test.ts`, `e2e/text-tools-batch7-journey.mjs` |
| Edit | Substitutions ▸ Text Replacement | | built-unchecked | Keyboard's rules, which this turns off for TextEdit's text, whatever Check Spelling While Typing says |
| Edit | Transformations ▸ Make Upper Case | | built-unchecked | |
| Edit | Transformations ▸ Make Lower Case | | built-unchecked | |
| Edit | Transformations ▸ Capitalize | | built-unchecked | |
| Edit | Speech ▸ Start Speaking | | built-unchecked | `speechSynthesis`; dimmed without it |
| Edit | Speech ▸ Stop Speaking | | built-unchecked | |
| Edit | Start Dictation | | built-unchecked | The desktop's Edit footer: types what the browser's recognizer hears at the insertion point, with a floating panel, Done and Escape; dimmed with a reason with no field or no recognizer. `e2e/dictation-batch5-journey.mjs`, with a stub recognizer, nothing real heard |
| Edit | Emoji & Symbols | ⌃⌘Space | built-unchecked | Shell: `toggleCharacterViewer`. A short list of characters, not the Mac's whole set |
| Format | Font ▸ Show Fonts | ⌘T | built-unchecked | |
| Format | Font ▸ Bold | ⌘B | built-unchecked | |
| Format | Font ▸ Italic | ⌘I | built-unchecked | |
| Format | Font ▸ Underline | ⌘U | built-unchecked | |
| Format | Font ▸ Outline | | done: [textedit-rich-link.png](#project-artifact/art_a7e016210b9b9bc1/284), `e2e/textedit-rich-journey.mjs` | Selected text only; lost in an RTF file |
| Format | Font ▸ Styles… | | built-unchecked | A sheet, not the Mac's floating panel: the document's styles or the person's favorites (saved per account), each drawn in itself, with Add to Favorites, Remove and Apply. Apply is dimmed, with the reason, at an insertion point. Absent: a style's own name; here it is named by its font. `textedit-commands.test.tsx` |
| Format | Font ▸ Bigger | ⌘+ | built-unchecked | |
| Format | Font ▸ Smaller | ⌘- | built-unchecked | |
| Format | Font ▸ Kern ▸ Use Default | | done: [textedit-rich-link.png](#project-artifact/art_a7e016210b9b9bc1/284), `e2e/textedit-rich-journey.mjs` | Selected text only; lost in an RTF file |
| Format | Font ▸ Kern ▸ Use None | | done: [textedit-rich-link.png](#project-artifact/art_a7e016210b9b9bc1/284), `e2e/textedit-rich-journey.mjs` | Same |
| Format | Font ▸ Kern ▸ Tighten | | done: [textedit-rich-link.png](#project-artifact/art_a7e016210b9b9bc1/284), `e2e/textedit-rich-journey.mjs` | Same |
| Format | Font ▸ Kern ▸ Loosen | | done: [textedit-rich-link.png](#project-artifact/art_a7e016210b9b9bc1/284), `e2e/textedit-rich-journey.mjs` | Same |
| Format | Font ▸ Ligatures ▸ Use Default | | built-unchecked | Same rows, same code; not chosen in the journey |
| Format | Font ▸ Ligatures ▸ Use None | | done: [textedit-rich-link.png](#project-artifact/art_a7e016210b9b9bc1/284), `e2e/textedit-rich-journey.mjs` | Selected text only; lost in an RTF file |
| Format | Font ▸ Ligatures ▸ Use All | | done: [textedit-rich-link.png](#project-artifact/art_a7e016210b9b9bc1/284), `e2e/textedit-rich-journey.mjs` | Same |
| Format | Font ▸ Baseline ▸ Use Default | | done: [textedit-rich-link.png](#project-artifact/art_a7e016210b9b9bc1/284), `e2e/textedit-rich-journey.mjs` | Selected text only |
| Format | Font ▸ Baseline ▸ Superscript | | done: [textedit-rich-link.png](#project-artifact/art_a7e016210b9b9bc1/284), `e2e/textedit-rich-journey.mjs` | The glyphs keep their size. Survives RTF |
| Format | Font ▸ Baseline ▸ Subscript | | done: [textedit-rich-link.png](#project-artifact/art_a7e016210b9b9bc1/284), `e2e/textedit-rich-journey.mjs` | Same |
| Format | Font ▸ Baseline ▸ Raise | | done: [textedit-rich-link.png](#project-artifact/art_a7e016210b9b9bc1/284), `e2e/textedit-rich-journey.mjs` | One pixel; lost in an RTF file |
| Format | Font ▸ Baseline ▸ Lower | | done: [textedit-rich-link.png](#project-artifact/art_a7e016210b9b9bc1/284), `e2e/textedit-rich-journey.mjs` | Same |
| Format | Font ▸ Show Colors | ⇧⌘C | built-unchecked | |
| Format | Font ▸ Copy Style | ⌥⌘C | done: [textedit-rich-link.png](#project-artifact/art_a7e016210b9b9bc1/284), `e2e/textedit-rich-journey.mjs` | Menu row driven; this window only |
| Format | Font ▸ Paste Style | ⌥⌘V | done: [textedit-rich-link.png](#project-artifact/art_a7e016210b9b9bc1/284), `e2e/textedit-rich-journey.mjs` | Same |
| Format | Text ▸ Align Left | ⌘{ | built-unchecked | |
| Format | Text ▸ Center | ⌘\| | built-unchecked | |
| Format | Text ▸ Justify | | built-unchecked | |
| Format | Text ▸ Align Right | ⌘} | built-unchecked | |
| Format | Text ▸ Writing Direction ▸ Natural | | done: [textedit-direction.png](#project-artifact/art_a7e016210b9b9bc1/618) | Set on the paragraphs (`dir="auto"`), kept in the draft and the file; on Undo and Redo through steps of its own. `e2e/textedit-direction-journey.mjs` |
| Format | Text ▸ Writing Direction ▸ Left to Right | | done: [textedit-direction.png](#project-artifact/art_a7e016210b9b9bc1/618) | Same |
| Format | Text ▸ Writing Direction ▸ Right to Left | | done: [textedit-direction.png](#project-artifact/art_a7e016210b9b9bc1/618) | Same |
| Format | Text ▸ Show/Hide Ruler | ⌘R | done: [textedit-view.png](#project-artifact/art_a7e016210b9b9bc1/78) | Saved per account as the Preferences row; read back after a reload |
| Format | Text ▸ Copy Ruler | ⌃⌘C | built-unchecked | The row ran in `e2e/textedit-direction-journey.mjs`, the key did not. The paragraph's direction, alignment and line spacing, in this window only. Indents and tabs belong to the document here, so neither is copied |
| Format | Text ▸ Paste Ruler | ⌃⌘V | built-unchecked | Same; on Undo and Redo |
| Format | Text ▸ Spacing… | | built-unchecked | A sheet: line height multiple (1.0, 1.2, 1.5, 2.0), and space before and after in points, on the selected paragraphs, on Undo and Redo through steps of their own. RTF `\sb` and `\sa`, and the draft. Absent: exact line heights and inter-line spacing, which the view does not hold. `textedit-commands.test.tsx`, `textedit-spacing.test.ts` |
| Format | Lists… | | done: [textedit-lists.png](#project-artifact/art_a7e016210b9b9bc1/446) | A sheet: style and where a counted list starts, kept in the file and the draft. `e2e/textedit-lists-journey.mjs`. Absent: prefix and suffix |
| Format | Table… | | built-unchecked: [textedit-table.png](#project-artifact/art_a7e016210b9b9bc1/457) shows an earlier version | A sheet, not the Mac's floating panel: rows, columns, column width, border, cell background, nesting, Merge Cells and Split Cell, side by side. Tab and Shift-Tab go between cells, and Tab in the last adds a row. Each of these changes is one step of Undo and Redo (`textedit-table-widths.test.ts`, `e2e/text-tools-batch7-journey.mjs`). Column Width sets the columns of the selected cells in points, empty sharing what the others leave; kept in the file (RTF `\cellx`), the draft and the PDF, read back across a reload in the batch's journey; Print's stylesheet takes it too, not printed in a test; not written to `.docx` or `.odt`. Kept in the file (RTF `\trowd`) and the draft; a row in plain text is its cells a tab apart, a place a cell above covers left empty. Nesting's + makes a two by two table in the cell holding the caret, after what the cell holds; − takes a table out of its cell and leaves what its cells held there. RTF `\itap` and `\nestcell`. A drag from one cell to another selects the rectangle between them, and Merge Cells merges any rectangle, across rows too: kept in RTF `\clvmgf` and `\clvmrg`, in `.docx` `vMerge`, in `.odt` `number-rows-spanned` and the draft, and in a PDF as one box, its rows not parted by a page; Split Cell, Tab, the sheet's size and its Column Width follow the grid. `textedit-table-merge.test.ts`, `e2e/textedit-table-journey.mjs`, `e2e/books-text-batch8-journey.mjs`. Not handled, no text lost: an HTML table whose `tfoot` comes before its `tbody` shows the footer rows first; Merge Cells past 1000 columns narrows the table to 1000; rows built directly under a table by a script, which no parser or paste produces, are not moved into a section |
| Format | Make Plain Text | ⇧⌘T | done: [textedit-plain-warning.png](#project-artifact/art_a7e016210b9b9bc1/82) | Asks first, with Cancel and OK |
| Format | Make Rich Text | ⇧⌘T | built-unchecked | |
| Format | Prevent Editing | | done: [textedit-prevent-editing.png](#project-artifact/art_a7e016210b9b9bc1/79) | Kept with the draft across a reload; "Allow Editing" while on |
| Format | Wrap to Page | ⇧⌘W | done: [textedit-view-wrapped.png](#project-artifact/art_a7e016210b9b9bc1/81) | A US Letter page with the ruler on it; saved per account. A menu row in Chromium, where the browser keeps the key |
| Format | Allow Hyphenation | | built-unchecked | CSS `hyphens`; saved per account, so for every document, where a Mac saves it per document |
| View | Actual Size | ⌘0 | built-unchecked | Run by the same journey; saved per account |
| View | Zoom In | ⇧⌘. | done: [textedit-view-zoomed.png](#project-artifact/art_a7e016210b9b9bc1/80) | 50% to 400%, the ruler with it |
| View | Zoom Out | ⇧⌘, | built-unchecked | |
| View | Show Tab Bar | | built-unchecked | Also Hide Tab Bar, dimmed with two tabs or more, as on a Mac. Per window, kept in `textedit.tabs`. `e2e/textedit-script-batch3-journey.mjs`, `textedit-tabs-desktop.test.tsx` |
| View | Show All Tabs | | built-unchecked | A picture of each tab, a copy of what it shows; choosing one selects it, Escape leaves. Batch 3 journey |
| View | Enter Full Screen | ⌃⌘F | built-unchecked | Shell |
| Window | Minimize | ⌘M | built-unchecked | Shell |
| Window | Zoom | | built-unchecked | Shell |
| Window | Show Previous Tab | ⌃⇧⇥ | built-unchecked | Batch 3 journey, the row; a browser keeps ⌃⇥ for itself, so the keys were not driven |
| Window | Show Next Tab | ⌃⇥ | built-unchecked | Batch 3 journey, the row |
| Window | Move Tab to New Window | | built-unchecked | Batch 3 journey, read back from the server |
| Window | Merge All Windows | | built-unchecked | Batch 3 journey, read back from the server and after a reload |
| Window | Bring All to Front | | built-unchecked | Shell |
| Window | Window list | | built-unchecked | Each window's document, "— Edited" included, through `DesktopWindowName`; the Dock's minimized tile and Mission Control take the same name. The batch's browser journey |
| Help | TextEdit Help | | built-unchecked | Shell: `requestHelp` opens Help Viewer on a search for TextEdit |

## Title bar and windows

| Item | Status | Notes |
| --- | --- | --- |
| Several document windows | built-unchecked | On the desktop, up to as many as the desktop opens. The first window's document is the server's draft; each other keeps its own among the desktop values under its window id, at most 32 KB and eight windows, with a banner past that. A window whose file holds everything keeps only which file. The desktop brings the windows back after a reload, seen with two windows in the batch's browser journey. `textedit-windows.ts`, `textedit-commands.test.tsx`. Quit: a further window comes back with its document when TextEdit opens again, with Close windows when quitting off, and otherwise when no one was asked and it held text no file holds; batch 3 journey for the second, `textedit-tabs-desktop.test.tsx` for the first. Revert To keeps the file opened last only. Lifting the limit needs a draft per window in `src/apps/textedit` |
| Tabs | built-unchecked | Each tab is a desktop window with its own document, on one frame, and only the selected one shows (`textedit-tabs.tsx`). Groups are kept in `textedit.tabs` across a reload; the + button, a click, closing a tab and moving the front tab are all in the batch 3 journey. Absent: dragging a tab out or between windows; Mission Control shows each tab, and Minimize minimizes one tab, where a Mac takes the group; tabs quit with TextEdit come back as windows |
| Name in the title | built-unchecked | |
| "Edited" suffix | built-unchecked | |
| Dot on the close button | built-unchecked | |
| Proxy icon shown | built-unchecked | |
| Proxy icon drag | built-unchecked | A document with a file: the icon drags out as the file does in Finder (`beginDesktopDrag`). `textedit-commands.test.tsx` |
| Proxy icon ⌘-click path menu | built-unchecked | Command-click or a secondary click on the title: the file and the folders it is in; a row shows that item in Finder. `textedit-commands.test.tsx`; the batch's browser journey |
| Title click: rename | built-unchecked | A click (not a drag, and not the first of a double click, which zooms) on the title of a document with a file opens a popover: Name renames on Return or leaving the field. An untitled document's title takes no click. `textedit-commands.test.tsx` |
| Title click: tags | built-unchecked | The same popover: a token field writing the drive's tags |
| Title click: locked | built-unchecked | The same popover: Locked sets the drive's own flag, as Finder's Get Info does, and the server then refuses to rename, move, trash or save over the file. The title says — Locked, the document cannot be edited, and a key pressed asks Unlock, Duplicate or Cancel. `rows-batch25-journey` saw the flag on the server and the title; a key pressed raised the sheet, the file did not take the key, and Unlock cleared the flag on the server. `textedit-commands.test.tsx`. Where moves the file, as File > Move To… does |

## Format bar

| Item | Status |
| --- | --- |
| Paragraph style Default | built-unchecked |
| Paragraph style Bold | built-unchecked |
| Paragraph style Italic | built-unchecked |
| Paragraph style Underlined | built-unchecked |
| Paragraph style Show Styles… | built-unchecked |
| Font family | built-unchecked |
| Typeface | built-unchecked |
| Font size | built-unchecked |
| Text colour | built-unchecked |
| Highlight Yellow | built-unchecked |
| Highlight Green | built-unchecked |
| Highlight Blue | built-unchecked |
| Highlight Pink | built-unchecked |
| Highlight Purple | built-unchecked |
| Highlight No Color | built-unchecked |
| Bold | built-unchecked |
| Italic | built-unchecked |
| Underline | built-unchecked |
| Align left | built-unchecked |
| Center | built-unchecked |
| Justify | built-unchecked |
| Align right | built-unchecked |
| Line spacing | built-unchecked |
| Lists | built-unchecked |

## Ruler

| Item | Status | Notes |
| --- | --- | --- |
| First-line indent | built-unchecked | Per paragraph: on the selection's paragraphs, in the view, the draft, an RTF file's `\fi` and Copy Ruler. Before there is an insertion point, the document's ruler. Batch 3 journey for the head indent; `textedit-ruler.test.ts`. A Word or OpenDocument file and Export as PDF keep to the document's ruler |
| Head indent | built-unchecked | As First-line indent; batch 3 journey across a reload, read back from the server's draft |
| Tail indent | built-unchecked | As First-line indent, by `textedit-ruler.test.ts` |
| Left tab stops | built-unchecked | Stops of a paragraph's own, each at its place, kept in `data-tabs` and an RTF file's `\tx`. Each tab stands in its own inline element whose `tab-size` is set to where it ends, measured after each change (`textedit-tab-stops.ts`). A stop dragged off the ruler goes. `automator-textedit-batch5-journey`. Centred, right-aligned and right-to-left paragraphs and table cells keep one width |
| Add a tab stop by click | built-unchecked | A click on the ruler adds a left stop on the nine-point ticks, for the selection's paragraphs (`automator-textedit-batch5-journey`) |
| Centre tab | built-unchecked | From the ruler's menu, which is not offered while the ruler is inert (a held document, a sheet up; `e2e/textedit-rows-batch12-journey.mjs`); the text centres on the stop on screen and in the PDF (unit test), and `\tqc` in RTF (`automator-textedit-batch5-journey`) |
| Right tab | built-unchecked | From the ruler's menu; the text ends at the stop on screen, in the print frame and in the PDF (unit test), and `\tqr` in RTF (`automator-textedit-batch5-journey`) |
| Decimal tab | built-unchecked | From the ruler's menu; the point stands at the stop as you type, in the print frame and in the PDF (unit test), and `\tqdec` in RTF (`automator-textedit-batch5-journey`). The point is `.` only |

## Panels, sheets and dialogs

| Item | Status | Notes |
| --- | --- | --- |
| Fonts panel | built-unchecked | Dims fonts the computer lacks |
| Colors panel | built-unchecked | |
| Open panel on the drive | built-unchecked | `DriveOpenPanel` |
| Open option: Ignore rich text commands | built-unchecked | A checkbox in the drive's Open panel, for the file opened then: an RTF or HTML file opens as its code. `textedit-commands.test.tsx` |
| Save sheet: name | built-unchecked | |
| Save sheet: place | built-unchecked | |
| Save format RTF | built-unchecked | |
| Save format plain text | built-unchecked | |
| Save format RTFD | built-unchecked | "Rich Text With Graphics Document (.rtfd)" in File Format: a folder of the drive named `.rtfd`, holding `TXT.rtf` with `\NeXTGraphic` attachments and each PNG or JPEG as a file. A save writes `TXT.rtf` from the version read, adds the pictures it lacks and removes those it no longer names. The window's file is the folder, so rename, move, tags and Locked act on the whole. Opens from File > Open…; a bundle a Mac wrote reads the same way (`textedit-rtfd.test.ts`, on a sample written here, not on a Mac's file). `rows-batch25-journey` read the folder's two files, `TXT.rtf`'s `\NeXTGraphic` and the picture's bytes, saw a later edit go into `TXT.rtf` with one picture still, and reopened it after a reload with its picture and later text. Limits: Finder shows and enters it as a folder, until `finder.tsx` opens it (see the batch's handback); File > Revert To's kept versions are not offered for it; attachments other than pictures stay links or names |
| Save format HTML | built-unchecked | "Web Page (.html)" in the Save sheet's File Format, on the drive. The paragraphs as the view holds them. `textedit-commands.test.tsx` |
| Save format Web Archive | built-unchecked | An XML property list; both that and the binary one Safari writes open, as their main page (other resources dropped). `textedit-office.test.ts`, binary sample from Python's `plistlib`. Not opened in a real Safari |
| Save format Word | built-unchecked | `.docx`, written and read: fonts, sizes, styles, colours, alignment, spacing, lists, tables, links and PNG and JPEG pictures, in Save and in the autosave after it. Read back in `textedit-office.test.ts`, a deflated sample from Python's `zipfile`, and by `python-docx` on a file from the browser journey. Not opened in real Word. Ruler indents and document properties are not written, as for HTML, and Show Properties is dimmed |
| Save format ODT | built-unchecked | `.odt`, the same content. `textedit-office.test.ts`, and read by `odfpy` on a file from the browser journey. Not opened in LibreOffice |
| Encoding pop-up | built-unchecked | Plain Text Encoding in the Save sheet (plain text) and the Open panel, with eleven encodings, and Preferences' Opening and Saving files. A file keeps its encoding when written again. A character it cannot hold stops the save and says so. Automatic reads a byte order mark, else UTF-8. `textedit-encodings.test.ts`, `textedit-commands.test.tsx` |
| Rename sheet | built-unchecked | |
| Print sheet | built-unchecked | Settings do not reach the paper (File > Print…) |
| Save changes? sheet | built-unchecked | |
| File changed elsewhere sheet | built-unchecked | The drive answers 412 to a save made from an old version. The refused save writes nothing and the window keeps its text, so no save is lost. A save whose text the file already holds (the document's own autosave crossing a reload, its reply gone with the page) asks nothing and takes the file's version. A write keeps the window's record at once, so a further window a reload brings back holds the version the write made (`textedit-commands.test.tsx`). A restored document with changes still to write reads the file first: holding this very text, it takes the file's version and writes nothing; holding another text at a newer version, the sheet asks with no save sent, also when that text is this window's own earlier write in flight at the reload with more typed after it, since the two look alike from here (`textedit-documents.test.tsx`). With General's Ask to keep changes on, the restored document reads nothing first, so its Save can still meet the 412. A write that ends after Revert To took the window moves the version on, so the reverted text's save is not refused |
| Encoding alert | built-unchecked | |

## Document

| Item | Status | Notes |
| --- | --- | --- |
| Rich text | built-unchecked | |
| Plain text in Menlo | built-unchecked | |
| RTF in 7-bit and Windows-1252 | built-unchecked | |
| RTF in other code pages | built-unchecked | Read in the code page the file or its font declares, where `TextDecoder` knows it: the writer's `\uN` keeps what is typed afterwards. A code page the browser does not decode is still refused with an alert. `textedit-rtf.test.ts`, `textedit-spacing.test.ts` |
| UTF-8 text files | built-unchecked | |
| Autosave into the file | built-unchecked | |
| Version history | built-unchecked | The drive keeps what a save in place replaced: up to 20 versions of a file and 200 of a drive, counted in the person's storage (Storage Management counts them under Other Files), left out of Finder and Spotlight, kept in the Trash and freed when the file is erased. The oldest give way before any save or upload is refused. While autosave writes, about one version per 5 minutes stays, and each File > Save stays; the Mac thins by hour, day and month instead. `e2e/versions-batch9-journey.mjs`, `drive.rs` tests |
| Tables | built-unchecked: [textedit-table.png](#project-artifact/art_a7e016210b9b9bc1/457) shows an earlier version | See Format > Table… |
| Clickable links | built-unchecked | A click opens the link, as on a Mac, unless it is a drag that selects text in it; an attachment takes Command-click or a double click. Batch 3 journey: the click, in Safari |
| Inline pictures | built-unchecked | PNG and JPEG, held in the text: through Attach Files, a drop, a paste, RTF `\pict`, Word and ODT files. A larger document than a window keeps shows the banner. GIF and WebP are attached instead. `textedit-picture.test.ts`; the batch's browser journey |
| Attachments | built-unchecked | A link to the drive file with its name, one character to the caret, kept in the draft and the file (RTF `HYPERLINK "drive:<id>"`). It holds no copy, as a Mac's does in an `.rtfd`: a file deleted from the drive says so when it is opened. `textedit-picture.test.ts` |
| Open HTML as rendered | built-unchecked | `documentFromText` through `htmlToContent`. Pictures and anything but the view's own elements are dropped. Preferences can show the code instead |
| Page view with margins | built-unchecked | Format > Wrap to Page: a US Letter page with inch margins, whatever Page Setup says |
| Spell check while typing | built-unchecked | Browser's own underline, no app code |
| Find bar | done | [Find bar](#project-artifact/art_6a3da0a5b88d531a/1) |

## Context menus

| Where | Item | Status |
| --- | --- | --- |
| Text | Look Up | done: [textedit-context-look-up.png](#project-artifact/art_6a3da0a5b88d531a/76) |
| Text | Search with Google | done: [textedit-context-google.png](#project-artifact/art_6a3da0a5b88d531a/75) |
| Text | Cut | done: [textedit-context-menu.png](#project-artifact/art_6a3da0a5b88d531a/77) |
| Text | Copy | done: [textedit-context-menu.png](#project-artifact/art_6a3da0a5b88d531a/77) |
| Text | Paste | done: [textedit-context-menu.png](#project-artifact/art_6a3da0a5b88d531a/77) |
| Text | Font ▸ Show Fonts | done: [textedit-context-menu.png](#project-artifact/art_6a3da0a5b88d531a/77) |
| Text | Font ▸ Bold | done: [textedit-context-menu.png](#project-artifact/art_6a3da0a5b88d531a/77) |
| Text | Font ▸ Italic | done: [textedit-context-menu.png](#project-artifact/art_6a3da0a5b88d531a/77) |
| Text | Font ▸ Underline | done: [textedit-context-menu.png](#project-artifact/art_6a3da0a5b88d531a/77) |
| Text | Spelling ▸ Show Spelling | built-unchecked | Under Spelling and Grammar, as in the Edit menu. `e2e/textedit-spelling-journey.mjs` |
| Text | Spelling ▸ Check Document | built-unchecked | Same submenu |
| Text | Substitutions ▸ Show Substitutions | built-unchecked: [textedit-context-tools.png](#project-artifact/art_a7e016210b9b9bc1/517) | `e2e/textedit-spelling-journey.mjs` |
| Text | Speech ▸ Start Speaking | built-unchecked |
| Text | Speech ▸ Stop Speaking | built-unchecked |
| Text | Services | built-unchecked | The desktop's services for the selection, or No Services Apply with none. `ServicesItems`: `desktop-services.test.tsx` |

## Keys outside the menus

| Key | Status | Notes |
| --- | --- | --- |
| Tab in plain text inserts a tab | built-unchecked | `insertsTab` |
| Arrows in the format bar | built-unchecked | |
| Arrows on a ruler marker | built-unchecked | |

## Drag and drop, multi-selection

| Item | Status | Notes |
| --- | --- | --- |
| Drag text within the document | built-unchecked | Browser's own, no app code |
| Drop a file on the window to open it | done | [Text file opened by a drop](#project-artifact/art_6a3da0a5b88d531a/4); in plain text a picture is refused, and in rich text it goes into the text (next rows). On the desktop a window with a document gives the file a window of its own |
| Drop a file to insert an attachment | built-unchecked | In rich text, a drive file TextEdit does not open. `textedit-commands.test.tsx` |
| Drop a file on the Dock tile | built-unchecked | `e2e/cross-app-journey.mjs`: the tile accepts a text file and the file opens |
| Drop a picture into a document | built-unchecked | In rich text, a PNG or JPEG, from the drive or from a drag that brings its bytes, at the insertion point rather than at the pointer. `textedit-commands.test.tsx` |
| Drag the proxy icon out | built-unchecked | As Proxy icon drag |
| Open several in the Open panel | built-unchecked | File > Open passes `multiple`: this window takes the first file if it holds nothing, and each other gets a window. `mail-notes-batch4-journey` opens two. |
| Disjoint selection with ⌘ | built-unchecked | Rich text, in Chromium. ⌘-drag (Ctrl-drag off a Mac) adds a range, and over a selected part takes that part out; a plain click, an arrow or Select All ends it. The browser holds the range made last; the others are kept by the editor (`textedit-disjoint.tsx`) and drawn with a CSS custom highlight, which needs Firefox 140 or newer and does not touch the document. Every Format command, Add Link and Spacing run at each range (⌘B and Font > Underline driven; the rest share that one path and were not driven), and one Undo and Redo take the whole change. Copy and Cut give each range on its own line, in document order: the separator is our call, not compared with a real Mac. Typing, Backspace, Return, ⌘V and Edit > Delete go to every range and leave an insertion point at each that the next key also reaches; a typing run is one Undo. Limits: plain text has none, as a text area has one range and no highlight; Edit > Paste of unformatted text, Transformations, Replace, spelling corrections and input-method composition act on the browser's range and end the selection, as their `execCommand` looks like any other insertion; Firefox and WebKit not driven. `e2e/rows-batch18-journey.mjs`, `textedit-disjoint.test.ts` |

## Saved state

| Item | Status | Notes |
| --- | --- | --- |
| Open draft survives a reload | built-unchecked | 256 KB, with a banner past that |
| Documents are drive files | built-unchecked | |
| Conflict: Keep Mine | done: [textedit-conflict.png](#project-artifact/art_a7e016210b9b9bc1/273) | `e2e/textedit-conflict-journey.mjs`, and `e2e/textedit-keep-mine-journey.mjs` for another window saving while Keep Mine is on its way: its text takes the window and the version is offered again, across a reload too. Each version that lost survives a reload in a record of its own, per session, until the person chooses; when storage refuses it the banner says a reload loses it. A re-login gives a new session, and the copy under the old one stays unread in that browser's storage |
| Recents | built-unchecked | |
| Preferences | done: [textedit-preferences-new-document.png](#project-artifact/art_6a3da0a5b88d531a/78) | Saved per account, read back after a reload |
| Window frame per document | built-unchecked | The desktop keeps a frame per window (`desktop.windows`), so a window comes back where it was after a reload. A window moved with a file keeps its frame with the file (`textedit.frames`, the newest 16), and the file opens there. Batch 3 journey, read back from the server; a tab stands on its group's frame |

## Cross-app

| Item | Status | Notes |
| --- | --- | --- |
| Finder opens text files here | built-unchecked | `appForFile`: rtf, txt, text, md, html, csv, log, json, xml |
| Spotlight finds drive text files | built-unchecked | |
| Spotlight opens a found drive file | built-unchecked | `requestOpenFile` |
| Spotlight finds saved documents | built-unchecked | A saved document is a drive file: Spotlight finds it and opens it in TextEdit. Batch 3 journey |
| Share a document | built-unchecked | File > Share |
| Look Up by key | built-unchecked | |
| Look Up from a menu | built-unchecked | Edit menu |
| Clipboard with other apps | built-unchecked | Browser clipboard |

## Open work ledger

Nothing open for TextEdit. `textedit-*` live runs belong to the Release thread; Courier in RTF files is done in `8eb60ff5`.

## Calls made

- Disjoint selections are the editor's own, one range being all a browser editing host holds in Chromium and WebKit: see the row. Typing keeps an insertion point at each range; NSTextView's own behaviour after the first key was not compared with a real Mac.
- Word and ODT are kept as HTML while open, like a web page, so their ruler indents and properties are not written.
- An attachment other than a picture is a link to its drive file, in an `.rtfd` as elsewhere.
- Finder's Open With chooser belongs to the Finder inventory.

## Build items, most used first

1. **Tabs.** Several windows are built; the tab bar and its Window and View rows need the desktop to group windows.
2. **Find and Replace bar.** ⌘F family on rich and plain text; undoable replace.
3. **Preferences window.** New Document, Open and Save tabs, saved per account.
4. **Context menu** on text with Look Up, Search with Google (Safari), Cut, Copy, Paste, Font, Speech.
5. **Ruler commands.** Show/Hide, Copy and Paste Ruler, per-paragraph indents and tabs, Spacing….
6. **Links, Add Link…, pictures and attachments.** Drop from Finder, RTFD on the drive. Needs Finder worker's drag.
7. **Open files by drag.** Drop on window and Dock tile, Open several, Clear Menu.
8. **Tables and Lists panels.**
9. **Format extras.** Plain text warning, Prevent Editing, Wrap to Page, Hyphenation, Writing Direction, Copy Style, Styles…, Outline, Kern, Baseline.
10. **More formats.** Built, but for RTFD, which the drive cannot hold.
11. **Edit completions.** Spelling panel, Substitutions, Transformations, Speech, Complete, Paste and Match Style, Insert ▸.
12. **File completions.** Print settings, Move To, Revert To, Show Properties, Page Setup, Share: built; Export as PDF to the drive remains.
13. **View zoom and title-bar popover.** Actual Size, Zoom; click title to rename, tag, lock; path menu.
14. **Help and docs.** Help opens Help Viewer; correct `textedit.mdx`; Spotlight opens the found document.
