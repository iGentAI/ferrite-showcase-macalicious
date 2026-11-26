# Feature inventory: Font Book

Main commit read: `2698563b`, with this batch over it. The rows that say "census" passed their row of `e2e/font-book-census-journey.mjs` in Chromium; a passing census row is not a screenshot, so they stay `built-unchecked`.

Status: **missing**; **partial** (the note says what is absent); **built-unchecked** (in main's code, not yet seen running). No row is done: done needs a screenshot in a browser. Every status rests on main's source; a menu row's status includes its key equivalent. Scope is the hosted Ferrite desktop. Real-app wording and keys come from knowledge of macOS 10.15 (no Mac, no capture of these menus) and are provisional. Services and the window list are generated lists, so each is one row.

Read: `demos/font-book/font-book.tsx` and `font-book-data.ts` whole, `app.ts`, `font-book.mdx`, the desktop README. No font is shipped; `FontFace` loads a chosen file for this page only.

## Menus

| Menu | Item | Key | Status | Notes |
| --- | --- | --- | --- | --- |
| Font Book | About Font Book | | built-unchecked | Shell |
| Font Book | Preferences… | ⌘, | built-unchecked | `font-book-preferences.tsx`, opened by census `font-book.preferences` |
| Font Book | Services | | built-unchecked | The desktop's `ServicesItems` (`desktop-menus.tsx`): the services that apply to a selection, else "No Services Apply" dimmed with its reason. Census `font-book.menu.font-book-services-no-services-apply` |
| Font Book | Hide Font Book | ⌘H | built-unchecked | Shell |
| Font Book | Hide Others | ⌥⌘H | built-unchecked | Shell |
| Font Book | Show All | | built-unchecked | Shell |
| Font Book | Quit Font Book | ⌘Q | built-unchecked | Shell |
| File | New Collection | ⌘N | done: [font-book-file-menu.png](#project-artifact/art_6a3da0a5b88d531a/27) | The name is edited in place |
| File | New Smart Collection… | ⌥⌘N | done: [font-book-smart-sheet.png](#project-artifact/art_a7e016210b9b9bc1/559) | Rules on family, style and PostScript names, language and kind, all or any; kept per person, among the desktop values. `e2e/font-book-smart-journey.mjs`. The journey runs the menu row; the key is built, not exercised |
| File | New Library | ⌥⌘L | built-unchecked | Census `font-book.libraries.new`: named in place, takes a font added while selected, kept across a reload. The key: `font-book-rows.test.tsx` |
| File | Add Fonts… | ⌘O | done: [font-book-file-menu.png](#project-artifact/art_6a3da0a5b88d531a/27) | |
| File | Restore Standard Fonts… | | built-unchecked | Census `font-book.restore`: asks, moves the added files to Documents/Fonts (Removed), read back from the drive, and turns every font on. The drive has no Library folder, so the fonts go there |
| File | Validate Font | | done: [font-book-validate.png](#project-artifact/art_a7e016210b9b9bc1/535) | `e2e/font-book-files-journey.mjs`. Reads the file's own bytes: type, table directory, required tables, header, checksums, and whether the browser can load it. A WOFF2's tables are compressed, so only its header is read. Not Apple's validator. A font this desktop only names has no file to check, and says so |
| File | Validate File… | | built-unchecked | Run in the journey on a file that is no font, which fails saying why; it adds nothing |
| File | Export Fonts… | | built-unchecked | A new folder on the drive with the selected fonts' files, read back from the drive in the journey. Dimmed for the library's fonts, which have no file. No screenshot of it |
| File | Close | ⌘W | built-unchecked | Shell |
| File | Print… | ⌘P | done: [font-book-print.png](#project-artifact/art_a7e016210b9b9bc1/339) | `e2e/font-book-print-journey.mjs`; the sheet offers the report, and the page handed to the browser is read back. The browser's dialog itself was not driven |
| Edit | Undo | ⌘Z | done: [font-book-edit-menu-custom-text.png](#project-artifact/art_6a3da0a5b88d531a/18) | Custom text only; dimmed elsewhere: nothing else can be undone |
| Edit | Redo | ⇧⌘Z | done: [font-book-edit-menu-custom-text.png](#project-artifact/art_6a3da0a5b88d531a/18) | Same |
| Edit | Cut | ⌘X | done: [font-book-edit-menu-custom-text.png](#project-artifact/art_6a3da0a5b88d531a/18) | Custom text only |
| Edit | Copy | ⌘C | done: [font-book-edit-menu-custom-text.png](#project-artifact/art_6a3da0a5b88d531a/18) | Custom text only |
| Edit | Paste | ⌘V | done: [font-book-edit-menu-custom-text.png](#project-artifact/art_6a3da0a5b88d531a/18) | Custom text only |
| Edit | Disable family | ⇧⌘D | done: [font-book-edit-menu.png](#project-artifact/art_6a3da0a5b88d531a/22) | Several families together too |
| Edit | Enable family | ⇧⌘D | done: [font-book-disabled-family.png](#project-artifact/art_6a3da0a5b88d531a/19) | Same row, titled Enable once off |
| Edit | Remove family | ⌫ | done: [font-book-remove-font.png](#project-artifact/art_6a3da0a5b88d531a/31) | A font you added; in your own collection, takes it out of that collection |
| Edit | Delete Collection | | done: [font-book-delete-collection.png](#project-artifact/art_6a3da0a5b88d531a/21) | Asks first |
| Edit | Edit Smart Collection… | | done: [font-book-smart-collection.png](#project-artifact/art_a7e016210b9b9bc1/558) | Also from the collection's context menu (not run). The standard smart collections stay fixed |
| Edit | Look for Enabled Duplicates | ⌘L | done: [font-book-duplicates.png](#project-artifact/art_a7e016210b9b9bc1/537) | Files on the drive of one name, or of one size under a name the drive numbered. Run from the menu; the key is built, not exercised |
| Edit | Resolve Duplicates | ⇧⌘L | built-unchecked | In the journey, from the row and from the sheet's button: extra files go to the Trash, a family turned off is left alone, and a family whose other format stays stays. The key is built, not exercised |
| Edit | Select All | ⌘A | done: [font-book-select-all.png](#project-artifact/art_6a3da0a5b88d531a/34) | The font list; the Custom view's text there |
| Edit | Find ▸ Search | ⌥⌘F | done: [font-book-edit-menu.png](#project-artifact/art_6a3da0a5b88d531a/22) | Off Apple platforms the window manager keeps Control-Option-F for full screen, so only the menu row works there |
| Edit | Start Dictation | | built-unchecked | The desktop's `EditFooter` (`desktop-menus.tsx`): types what the browser's recognizer hears, dimmed with a reason with no field or no recognizer. `e2e/dictation-batch5-journey.mjs`, in other apps, with a stub recognizer. Census `font-book.edit-footer` |
| Edit | Emoji & Symbols | ⌃⌘Space | built-unchecked | `EditFooter` opens the desktop's Character Viewer. Census `font-book.edit-footer` reads the row enabled; choosing it is not run here |
| View | Sample | ⌘1 | done: [font-book-view-menu.png](#project-artifact/art_6a3da0a5b88d531a/36) | |
| View | Repertoire | ⌘2 | done: [font-book-repertoire.png](#project-artifact/art_6a3da0a5b88d531a/35) | |
| View | Custom | ⌘3 | done: [font-book-view-menu.png](#project-artifact/art_6a3da0a5b88d531a/36) | |
| View | Show/Hide Font Info | ⌘I | done: [font-book-info.png](#project-artifact/art_6a3da0a5b88d531a/30) | |
| View | Fit | | done: [font-book-fit.png](#project-artifact/art_6a3da0a5b88d531a/26) | Sample and Custom, one font; widest line and all lines fit |
| View | Bigger | ⌘+ | done: [font-book-view-menu.png](#project-artifact/art_6a3da0a5b88d531a/36) | Menu shows ⌘=; ⌘+ works too; next size of the list |
| View | Smaller | ⌘- | done: [font-book-view-menu.png](#project-artifact/art_6a3da0a5b88d531a/36) | |
| View | Show/Hide Collections | | done: [font-book-panes-hidden.png](#project-artifact/art_6a3da0a5b88d531a/29) | |
| View | Show/Hide Fonts | | done: [font-book-panes-hidden.png](#project-artifact/art_6a3da0a5b88d531a/29) | |
| View | Show Toolbar | | built-unchecked | Kept across a reload; row and reload in the journey |
| View | Customize Toolbar… | | built-unchecked | A sheet, not the real app's drag palette, whose items are from memory: no reference screenshot shows it. Census `font-book.customize-toolbar`: take out, add, kept across a reload, Use Default Set. The arrow keys: `font-book-rows.test.tsx` |
| View | Enter Full Screen | ⌃⌘F | built-unchecked | Shell |
| Window | Minimize | ⌘M | built-unchecked | Shell |
| Window | Zoom | | built-unchecked | Shell |
| Window | Bring All to Front | | built-unchecked | Shell |
| Window | Window list | | built-unchecked | Shell; one window |
| Help | Font Book Help | | built-unchecked | `desktop-menus.tsx` opens Help Viewer with `requestHelp` when the desktop has it. Census `font-book.menu.help-font-book-help` |

## Toolbar

| Item | Status | Notes |
| --- | --- | --- |
| Sample | built-unchecked | |
| Repertoire | built-unchecked | |
| Custom | built-unchecked | |
| Info | built-unchecked | |
| Add Fonts | built-unchecked | Kept on the drive; the journey adds through ⌘O, not this button |
| Disable | built-unchecked | Saved |
| Enable | built-unchecked | Saved |
| Search | built-unchecked | |
| Search scope: Everything | built-unchecked | |
| Search scope: Family | built-unchecked | |
| Search scope: Style | built-unchecked | |
| Search scope: PostScript Name | built-unchecked | |

## Sidebar

| Item | Status | Notes |
| --- | --- | --- |
| All Fonts | built-unchecked | |
| Smart Collection English | built-unchecked | |
| Smart Collection Fixed Width | built-unchecked | |
| Smart Collection editor | done: [font-book-smart-sheet.png](#project-artifact/art_a7e016210b9b9bc1/559) | Your own collections; rules also survive a reload |
| Other language smart collections | built-unchecked | Census `font-book.language-collection`, in a browser whose language is Japanese: Japanese shows with its fonts, Arabic does not. One for each of the browser's languages among Arabic, Japanese, Simplified and Traditional Chinese |
| User library row | built-unchecked | Census `font-book.libraries.rows`: once a font is added |
| Computer library row | built-unchecked | Same |
| Collection Fun | built-unchecked | Fixed list |
| Collection Modern | built-unchecked | Fixed list |
| Collection PDF | built-unchecked | Fixed list |
| Collection Traditional | built-unchecked | Fixed list |
| Collection Web | built-unchecked | Fixed list |
| Add Collection | built-unchecked | Saved; the name is edited in place; the journey adds through File and ⌘N, not this button |
| Rename Collection | done: [font-book-rename-new-collection.png](#project-artifact/art_6a3da0a5b88d531a/28) | Your own collections; the five standard ones are fixed |
| Delete Collection | done: [font-book-delete-collection.png](#project-artifact/art_6a3da0a5b88d531a/21) | Same |

## Font list

| Item | Status | Notes |
| --- | --- | --- |
| Families | built-unchecked | |
| Styles under a family | built-unchecked | |
| Off mark on a disabled family | built-unchecked | |
| Grey fonts not downloaded | built-unchecked | Dimmed, with Download dimmed in the context menu below |
| Download a grey font | built-unchecked | A web page cannot: the desktop has no font server. The context menu's row is dimmed and the next says why. Census `font-book.download-dimmed` |

## Preview

| Item | Status | Notes |
| --- | --- | --- |
| Size combo box | built-unchecked | |
| Size slider | built-unchecked | |
| Font name heading | built-unchecked | |
| Sample lines | built-unchecked | A browser font stack |
| Repertoire grid | built-unchecked | Census `font-book.tables.repertoire`: an added font's characters from its `cmap`, for a real TrueType file. A font the desktop only names keeps the data's list |
| Custom text | built-unchecked | |
| Info: PostScript name | built-unchecked | Census `font-book.tables.info`: from the `name` table of an added font; made by rule for a font the desktop only names, which has no file |
| Info: Full name | built-unchecked | Same |
| Info: Family | built-unchecked | Same |
| Info: Style | built-unchecked | Same |
| Info: Language | built-unchecked | An added font's from its `cmap` and `OS/2`, by unit test (`font-book-tables.test.ts`); from the data otherwise |
| Info: Fixed width | built-unchecked | An added font's from `post`: census `font-book.tables.info` reads No; Yes, and the Fixed Width collection, by `font-book-rows.test.tsx` |
| Info: Enabled | built-unchecked | |
| Info: Collections | built-unchecked | |
| Info: Version | built-unchecked | Census `font-book.tables.info`. A font only named says it has no file; a WOFF2 says its tables are not readable (unit test) |
| Info: Copyright | built-unchecked | Same |
| Info: Designer | built-unchecked | Same; the real file names none, so its value by `font-book-rows.test.tsx` |
| Info: Location | built-unchecked | Census `font-book.tables.info`: Documents/Fonts on the drive |
| Several fonts at once | built-unchecked | Sample: [font-book-several-selected.png](#project-artifact/art_6a3da0a5b88d531a/33). Census `font-book.several`: Repertoire and Info show each, Custom sets its text in each |
| A chosen file's real faces | built-unchecked | `FontFace`, this page only |

## Sheets

| Item | Status |
| --- | --- |
| Validation result | done: [font-book-validate.png](#project-artifact/art_a7e016210b9b9bc1/535) |
| Duplicate fonts | done: [font-book-duplicates.png](#project-artifact/art_a7e016210b9b9bc1/537) |
| Install window for a font file | built-unchecked: census `font-book.finder.open`, a sheet with the font in its own face |
| Print: Catalog | built-unchecked: File > Print with Catalog driven and the print frame read, a line of each style in its own font: `e2e/media-small-batch8-journey.mjs`; fonts added from a file: the journey reads the added face loaded in the print frame |
| Print: Repertoire | built-unchecked: driven the same way, the family's characters in the frame |
| Print: Waterfall | done: [font-book-print.png](#project-artifact/art_a7e016210b9b9bc1/339) |
| Preferences: Install location | built-unchecked: User only; Computer shows dimmed with its reason, as this desktop keeps fonts on the person's drive |
| Preferences: Validate fonts | built-unchecked: census `font-book.preferences`, on by default, kept across a reload; Add Fonts asks before a file that does not pass (census `font-book.validate.before-install`) |
| Preferences: Automatic activation | built-unchecked: a web page cannot, as applications here do not ask for fonts; dimmed with that reason in the window. Alert me if system font files change is dimmed the same way |

## Context menus

| Where | Item | Status |
| --- | --- | --- |
| Font | Enable | done: [font-book-font-context-menu.png](#project-artifact/art_6a3da0a5b88d531a/32) |
| Font | Disable | done: [font-book-font-context-menu.png](#project-artifact/art_6a3da0a5b88d531a/32) |
| Font | Remove | done: [font-book-font-context-menu.png](#project-artifact/art_6a3da0a5b88d531a/32) |
| Font | Reveal in Finder | done: [font-book-reveal.png](#project-artifact/art_a7e016210b9b9bc1/534) |
| Font | Validate | built-unchecked: the row shows in [font-book-context-files.png](#project-artifact/art_a7e016210b9b9bc1/536); the journey validates from the File menu |
| Font | Export | built-unchecked: same |
| Font | New Collection from Selection | done: [font-book-font-context-menu.png](#project-artifact/art_6a3da0a5b88d531a/32) |
| Font | Add to Collection ▸ a collection | done: [font-book-font-context-menu.png](#project-artifact/art_6a3da0a5b88d531a/32) |
| Collection | Rename | done: [font-book-collection-context-menu.png](#project-artifact/art_6a3da0a5b88d531a/20) |
| Collection | Delete | done: [font-book-collection-context-menu.png](#project-artifact/art_6a3da0a5b88d531a/20) |
| Collection | New Collection | done: [font-book-collection-context-menu.png](#project-artifact/art_6a3da0a5b88d531a/20) |
| Collection | Export | built-unchecked: Export Collection…, for a collection holding fonts with files |
| Collection | Disable | done: [font-book-collection-context-menu.png](#project-artifact/art_6a3da0a5b88d531a/20) |
| Custom text | Cut | built-unchecked: the row is in the journey's menu, not run |
| Custom text | Copy | built-unchecked: same |
| Custom text | Paste | built-unchecked: same |

## Keys outside the menus

| Key | Status |
| --- | --- |
| Arrows in the sidebar | built-unchecked |
| Type-select in the sidebar | built-unchecked |
| Arrows in the font list | built-unchecked |
| Type-select in the font list | built-unchecked |
| Right Arrow opens a family | built-unchecked |
| Left Arrow closes a family | built-unchecked |
| Escape clears the search | built-unchecked |
| Arrow keys on the slider | built-unchecked |
| Page Up on the slider | built-unchecked |
| Page Down on the slider | built-unchecked |
| Home on the slider | built-unchecked |
| End on the slider | built-unchecked |

## Drag and drop, multi-selection

| Item | Status | Notes |
| --- | --- | --- |
| Drag a font to a collection | done: [font-book-drag-to-collection.png](#project-artifact/art_6a3da0a5b88d531a/24) | Your own collections take fonts; the standard ones refuse |
| Drag several fonts to a collection | done: [font-book-drag-several.png](#project-artifact/art_6a3da0a5b88d531a/25) | |
| Drop a font file from Finder | built-unchecked | Census `font-book.finder.drop`: a font installs; a text file is refused with the reason |
| Drag a font out to Finder | built-unchecked | Census `font-book.drag-out` drops on the desktop, read back from the drive; a font with no file drags nothing out (`font-book-rows.test.tsx`). Onto a Finder window is the same drop target's kind, not run |
| Shift-click a range of fonts | done: [font-book-several-selected.png](#project-artifact/art_6a3da0a5b88d531a/33) | |
| Command-click several fonts | done: [font-book-several-selected.png](#project-artifact/art_6a3da0a5b88d531a/33) | |

## Saved state

| Item | Status | Notes |
| --- | --- | --- |
| Collections | done: [font-book-collection-context-menu.png](#project-artifact/art_6a3da0a5b88d531a/20) | `/api/font-book/library`, families by id; the journey reads it back and reloads |
| Disabled families | done: [font-book-added-font-after-reload.png](#project-artifact/art_6a3da0a5b88d531a/23) | Same |
| Added fonts | done: [font-book-added-font-after-reload.png](#project-artifact/art_6a3da0a5b88d531a/23) | Documents/Fonts on the drive, read again on open; Remove sends the file to the Trash. Absent: adding a font while the window is still reading the drive's fonts can keep a second file of the same family |
| Size | done: [font-book-saved-view.png](#project-artifact/art_a7e016210b9b9bc1/323) | `e2e/font-book-saved-view-journey.mjs`; among the person's desktop values |
| View | done: [font-book-saved-view.png](#project-artifact/art_a7e016210b9b9bc1/323) | Same |
| Selected collection | done: [font-book-saved-view.png](#project-artifact/art_a7e016210b9b9bc1/323) | Same. Absent: which font in it was selected |
| Custom text | done: [font-book-saved-view.png](#project-artifact/art_a7e016210b9b9bc1/323) | Same. Up to 16 settings' worth, about 60 KB, in pieces; the journey brings back 9 KB. Over that the window says so and what was last kept stays |
| Preferences | built-unchecked | Census `font-book.preferences`: among the person's desktop values, kept across a reload |

## Cross-app

| Item | Status | Notes |
| --- | --- | --- |
| Added fonts in Notes' Fonts panel | built-unchecked | `demos/font-book/font-book-panel-fonts.ts` loads the drive's fonts for the whole page at the desktop's start and hands them to every panel (`setFontPanelFonts` of `demos/desktop/desktop-font-panel-fonts.ts`). Listed, chosen, the word's computed font, and loaded after a reload with Font Book shut: `small-apps-batch3-journey`. Absent: an added font's own bold and italic faces, one file being one Regular; the browser slants and thickens it. Mail's and Script Editor's panels list it too, not driven |
| Added fonts in TextEdit's Fonts panel | built-unchecked | Same; listed in the journey |
| Added fonts in Stickies' Fonts panel | built-unchecked | Same; listed in the journey |
| Disabled fonts leave the Fonts panel | built-unchecked | An added font turned off in Font Book leaves the panel in the journey, read from `/api/font-book/library`; a built-in one by name: `font-panel.test.tsx` |
| Finder opens a font file here | built-unchecked | Census `font-book.finder.open`: `app.ts`'s `opens`, a double-click in Finder |
| Export to the drive | done: [font-book-context-files.png](#project-artifact/art_a7e016210b9b9bc1/536) | Read back from the drive in the journey |

## Open work ledger

No open item for Font Book.

## Calls made

- Installed fonts are the person's own files, kept on their drive and loaded with `FontFace`. The desktop still serves no fonts.
- The drive has no Library folder, so added fonts live in Documents/Fonts, where Finder shows them.
- The standard collections (Fun, Modern, PDF, Traditional, Web) are fixed lists that are not saved, so they cannot be renamed, deleted or given fonts; their menu rows are dimmed with the reason.
- A drag follows the pointer, not the browser's own drag: the table view prevents the default of every press, and in Chromium that keeps the browser's drag from starting.
- Validation parses the sfnt tables in the page and reports real faults. A file the parser cannot check says "not checked", not "passed".
- Grey fonts have no download source, so they stay dimmed with the reason.
- A library is a collection the person made, listed with the libraries; its fonts live in Documents/Fonts like any other.
- The WOFF2 tables are Brotli-compressed and a page has no decoder, so Info says they are not readable rather than guess.

## Build items, most used first

1. **Menus and keys.** File, Edit, View: New Collection, Add Fonts, Disable, Sample ⌘1 and the rest, Search ⌥⌘F.
2. **Collections.** Rename, Delete, drag fonts, context menus; multi-selection; several previewed.
3. **Keep added fonts.** On the drive, reloaded on open, Remove; Fonts panel across the editors; disabled ones go.
4. **Smart Collection editor.** Rule rows, saved, edited.
5. **Real data from a font file.** Names, styles, glyph list, Info from tables; Repertoire from cmap.
6. **Drop files, open from Finder, Install window.** Needs Finder worker.
7. **Validation and duplicates.**
8. **Export, Print.** Catalog, Repertoire, Waterfall.
9. **Preferences and saved view.**
10. **Language collections, library rows.**
11. **Help and docs.** Help opens Help Viewer; `.mdx` updated.
