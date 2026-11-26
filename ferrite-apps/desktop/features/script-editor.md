# Feature inventory: Script Editor

Main commit read: `e62c2ac9`, from GitHub only. Nothing was built or run.

Status: **missing**; **partial** (the note says what is absent); **built-unchecked** (in main's code, not yet seen running); **done** (a journey step and a screenshot show it). Every other status rests on main's source; a menu row's status includes its key equivalent. Scope is the hosted Ferrite desktop. Real-app wording and keys come from knowledge of macOS 10.15 (no Mac, no capture of these menus) and are provisional. Services, Open Recent, New from Template and the window list are generated lists, so each is one row.

Read: `demos/script-editor/` (`app.ts`, `script-editor.mdx`, `script-editor.tsx`), `demos/desktop/desktop-menus.tsx`, `demos/finder/finder-open.ts`, the desktop README's Scripts section. The desktop registers **File**, **Edit**, **View**, **Script**, **Font** and **Format**. "Shell" means the desktop's own row. JavaScript runs on the server (`/api/script-editor/run`, 5 seconds, one at a time); AppleScript runs only simple statements on the page.

## Menus

| Menu | Item | Key | Status | Notes |
| --- | --- | --- | --- | --- |
| Script Editor | About Script Editor | | built-unchecked | Shell |
| Script Editor | Preferences… | ⌘, | done: [script-editor-preferences.png](#project-artifact/art_a7e016210b9b9bc1/587) | The row, in `script-editor-preferences-journey`; the key is the shell's, not driven. One pane, Editing |
| Script Editor | Services | | built-unchecked | Shell: `ServicesItems` on the script's selected text. Batch 3 journey (`e2e/textedit-script-batch3-journey.mjs`) saw the rows, and ran none |
| Script Editor | Hide Script Editor | ⌘H | built-unchecked | Shell |
| Script Editor | Hide Others | ⌥⌘H | built-unchecked | Shell |
| Script Editor | Show All | | built-unchecked | Shell |
| Script Editor | Quit Script Editor | ⌘Q | built-unchecked | Shell |
| File | New | ⌘N | done: [script-editor-two-windows.png](#project-artifact/art_6a3da0a5b88d531a/11) | Another window, as the desktop's own row |
| File | New from Template | | done: [script-editor-templates.png](#project-artifact/art_a7e016210b9b9bc1/584) | Four JavaScript templates of this desktop's own. The template takes this window, as Duplicate does, since the desktop opens a new window empty; dimmed over unsaved changes |
| File | Open… | ⌘O | done: [script-editor-open-panel.png](#project-artifact/art_6a3da0a5b88d531a/5) | The drive's Open panel, `.js` files; the nav-bar pull-down stays |
| File | Open Recent | | done: [script-editor-open-recent.png](#project-artifact/art_6a3da0a5b88d531a/6) | |
| File | Open Dictionary… | ⇧⌘O | built-unchecked | A sheet asks for one of the apps the server's dictionary lists, then that app's Dictionary window opens. The sheet and key by unit test; the window in the batch journey below |
| File | Close | ⌘W | built-unchecked | Shell; asks to save (`closeWindow`) |
| File | Save | ⌘S | done: [script-editor-menu-file.png](#project-artifact/art_6a3da0a5b88d531a/8) | Into the script's file, read back from the drive; asks for a name without one or after the file was saved over elsewhere; the nav-bar Save… button stays |
| File | Duplicate | ⇧⌘S | done: [script-editor-duplicate.png](#project-artifact/art_6a3da0a5b88d531a/10) | The copy takes the window, as in TextEdit |
| File | Rename… | | done: [script-editor-rename.png](#project-artifact/art_6a3da0a5b88d531a/9) | |
| File | Move To… | | done: [script-editor-move-to.png](#project-artifact/art_6a3da0a5b88d531a/7) | |
| File | Revert To ▸ Last Saved | | done: [script-editor-find.png](#project-artifact/art_a7e016210b9b9bc1/321) | `e2e/script-editor-find-journey.mjs`; dimmed without changes, and the submenu without a file |
| File | Revert To ▸ Previous Save | | built-unchecked | The save before the last, from the versions the drive keeps; the window's changes are saved first, so the restore keeps them. Dimmed with its reason until a save kept one. A script's Description and bundle fields are in its file, so a version holds those it was saved with and a restore brings them back; the sheet shows the code alone. `script-editor-versions.test.tsx`, `e2e/versions-rest-batch10-journey.mjs` |
| File | Revert To ▸ Browse All Versions | | built-unchecked | A sheet of the versions by date, the chosen one beside the script, with Restore and Done; a sheet, not the Time Machine star field. Read back from the drive across a reload: `e2e/versions-rest-batch10-journey.mjs`, `script-editor-versions.test.tsx` |
| File | Export… | | done: [script-editor-export.png](#project-artifact/art_a7e016210b9b9bc1/585) | A new file in Documents/Scripts, read back from the drive; a name in use gets the next free name. The window keeps its own file |
| File | Share ▸ Mail | | built-unchecked | A new message holds the text in the window as a `.js` file, unsaved changes included: census `script-editor.file.share-mail` (chromium), no screenshot. The shared rows' Messages, Notes and Add to Photos come with it |
| File | Share ▸ AirDrop | | built-unchecked | Dimmed: a web page can't reach nearby devices, and the row says so. Census `script-editor.file.dimmed` |
| File | Page Setup… | ⇧⌘P | built-unchecked | Dimmed: the browser's print dialog sets the page, and the row says so. Census `script-editor.file.dimmed` |
| File | Print… | ⌘P | built-unchecked | The page handed to the browser's print dialog holds each run in the colour and weight it shows (unit test reads the page). The dialog itself and the key were not driven |
| Edit | Undo | ⌘Z | built-unchecked | On the text last in use, the script or the Description |
| Edit | Redo | ⇧⌘Z | built-unchecked | |
| Edit | Cut | ⌘X | built-unchecked | |
| Edit | Copy | ⌘C | built-unchecked | |
| Edit | Paste | ⌘V | built-unchecked | In the Description and in the script the clipboard's formats come in, rebuilt so nothing in them runs or loads; in the script they last until it next compiles. `small-rows-batch9-journey.mjs` (bold kept, then gone after Compile); `script-editor-edit-menu.test.tsx`. Where the browser refuses the menu's read, the row says so |
| Edit | Paste and Match Style | ⌥⇧⌘V | built-unchecked | The shared row; a unit test sees it, not run |
| Edit | Paste Reply | | built-unchecked | The last run's result at the insertion point; dimmed until there is one. Batch journey, chromium |
| Edit | Delete | | done: [script-editor-find.png](#project-artifact/art_a7e016210b9b9bc1/321) | |
| Edit | Select All | ⌘A | built-unchecked | |
| Edit | Complete | ⌥Esc | built-unchecked | The language's words, the dictionary's calls and the script's words: one goes in at once, several show a list under the insertion point (arrows, Return, Tab, Escape). Dimmed with Script Assistant off. Batch journey, chromium |
| Edit | Find ▸ Find… | ⌘F | done: [script-editor-find.png](#project-artifact/art_a7e016210b9b9bc1/321) | Bar above the script, with its count |
| Edit | Find ▸ Find and Replace… | ⌥⌘F | done: [script-editor-find.png](#project-artifact/art_a7e016210b9b9bc1/321) | The row and All ran in the browser; the key by unit test, because off a Mac Control-Option-F is the window manager's full screen |
| Edit | Find ▸ Find Next | ⌘G | done: [script-editor-find.png](#project-artifact/art_a7e016210b9b9bc1/321) | |
| Edit | Find ▸ Find Previous | ⇧⌘G | built-unchecked | Shared; not run here |
| Edit | Find ▸ Use Selection for Find | ⌘E | built-unchecked | Shared; not run here |
| Edit | Find ▸ Jump to Selection | ⌘J | built-unchecked | Shared; not run here |
| Edit | Spelling ▸ Show Spelling and Grammar | ⌘: | built-unchecked | The shared panel, on the text last used; finds an unknown word in the census `script-editor.edit.spelling`; the key by unit test |
| Edit | Spelling ▸ Check Document Now | ⌘; | built-unchecked | Selects the next unknown word: `script-editor-tools.test.tsx`, not run in a browser |
| Edit | Spelling ▸ Check While Typing | | built-unchecked | The browser's underlines in the script and the Description; starts off, `scriptEditor.spelling`. Census `script-editor.edit.spelling` |
| Edit | Substitutions ▸ Show Substitutions | | built-unchecked | The shared panel, which shows the Description; its Replace All acts there only, and is dimmed with another view shown: unit test, not run in a browser |
| Edit | Substitutions ▸ Smart Quotes | | built-unchecked | In the Description only, since a curly quote in the script is a syntax error. Census `script-editor.edit.substitutions` types both; `scriptEditor.substitutions` |
| Edit | Substitutions ▸ Smart Dashes | | built-unchecked | Same |
| Edit | Substitutions ▸ Text Replacement | | built-unchecked | `data-text-replacement` on the Description follows the row and the script says off: unit test; the replacing itself is Keyboard's, not run here |
| Edit | Transformations ▸ Make Upper Case | | done: [script-editor-find.png](#project-artifact/art_a7e016210b9b9bc1/321) | |
| Edit | Transformations ▸ Make Lower Case | | built-unchecked | Shared; not run here |
| Edit | Transformations ▸ Capitalize | | built-unchecked | Shared; not run here |
| Edit | Speech ▸ Start Speaking | | built-unchecked | Shared; not run here |
| Edit | Speech ▸ Stop Speaking | | built-unchecked | Shared; not run here |
| Edit | Start Dictation | | built-unchecked | The desktop's Edit footer: types what the browser's recognizer hears at the insertion point, dimmed with a reason with no field or no recognizer. `e2e/dictation-batch5-journey.mjs`, in other apps, with a stub recognizer. Census `script-editor.edit.dictation-emoji` |
| Edit | Emoji & Symbols | ⌃⌘Space | built-unchecked | The map was stale: `EditFooter`, enabled, in the same census row; opening the viewer was not driven here |
| View | Show/Hide Bundle Contents | ⌘0 | done: [script-editor-view-bundle.png](#project-artifact/art_6a3da0a5b88d531a/12) | |
| View | Show/Hide Accessory View | ⌥⌘0 | done: [script-editor-menu-view.png](#project-artifact/art_6a3da0a5b88d531a/13) | |
| View | Description | ⌘1 | done: [script-editor-menu-view.png](#project-artifact/art_6a3da0a5b88d531a/13) | Menu seen; the key is not driven by the journey, a unit test presses it |
| View | Result | ⌘2 | done: [script-editor-menu-view.png](#project-artifact/art_6a3da0a5b88d531a/13) | |
| View | Log | ⌘3 | done: [script-editor-menu-view.png](#project-artifact/art_6a3da0a5b88d531a/13) | |
| View | Show Tab Bar | | built-unchecked | As TextEdit's (`demos/textedit/textedit-tabs.tsx`), kept in `scriptEditor.tabs`. Batch 3 journey for the group; the row itself in TextEdit's |
| View | Show All Tabs | | built-unchecked | Batch 3 journey |
| View | Enter Full Screen | ⌃⌘F | built-unchecked | Shell |
| Script | Record | ⇧⌘R | done: [script-editor-menu-script.png](#project-artifact/art_6a3da0a5b88d531a/15) | Starts the toolbar's recording; see the toolbar's Record row for what it records |
| Script | Stop | ⌘. | done: [script-editor-menu-script.png](#project-artifact/art_6a3da0a5b88d531a/15) | Stops a recording; dimmed during a run on the server, saying why (unit test only) |
| Script | Run | ⌘R | done: [script-editor-menu-script.png](#project-artifact/art_6a3da0a5b88d531a/15) | |
| Script | Compile | ⌘K | done: [script-editor-menu-script.png](#project-artifact/art_6a3da0a5b88d531a/15) | Keeps the insertion point |
| Font | Show Fonts | ⌘T | built-unchecked | |
| Font | Bold | ⌘B | built-unchecked | |
| Font | Italic | ⌘I | built-unchecked | |
| Font | Underline | ⌘U | built-unchecked | |
| Font | Bigger | ⌘+ | built-unchecked | |
| Font | Smaller | ⌘- | built-unchecked | |
| Font | Show Colors | ⇧⌘C | built-unchecked | |
| Font | Outline | | built-unchecked | `TextEditFontExtraItems` on the selection; these rows also stand under Format ▸ Font and the script's context menu. A compilation sets the script in its styles again; the Description keeps them. Unit test for the row |
| Font | Styles… | | built-unchecked | TextEdit's sheet on the script's or the Description's styles and the shared favourites; the sheet opens in a unit test, Apply was not run |
| Font | Kern ▸ Use Default | | built-unchecked | As Outline |
| Font | Kern ▸ Use None | | built-unchecked | As Outline |
| Font | Kern ▸ Tighten | | built-unchecked | As Outline |
| Font | Kern ▸ Loosen | | built-unchecked | Census `script-editor.font.kern`: letter-spacing normal to 0.5px |
| Font | Ligatures ▸ Use Default | | built-unchecked | As Outline |
| Font | Ligatures ▸ Use None | | built-unchecked | As Outline |
| Font | Ligatures ▸ Use All | | built-unchecked | As Outline |
| Font | Baseline ▸ Use Default | | built-unchecked | As Outline |
| Font | Baseline ▸ Superscript | | built-unchecked | As Outline |
| Font | Baseline ▸ Subscript | | built-unchecked | As Outline |
| Font | Baseline ▸ Raise | | built-unchecked | As Outline |
| Font | Baseline ▸ Lower | | built-unchecked | As Outline |
| Font | Copy Style | ⌥⌘C | built-unchecked | Census `script-editor.font.copy-paste-style` for the rows; the keys by unit test |
| Font | Paste Style | ⌥⌘V | built-unchecked | Same; dimmed until a style was copied |
| Format | Font ▸ Show Fonts | ⌘T | built-unchecked | |
| Format | Font ▸ Bold | ⌘B | built-unchecked | |
| Format | Font ▸ Italic | ⌘I | built-unchecked | |
| Format | Font ▸ Underline | ⌘U | built-unchecked | |
| Format | Font ▸ Bigger | ⌘+ | built-unchecked | |
| Format | Font ▸ Smaller | ⌘- | built-unchecked | |
| Format | Font ▸ Show Colors | ⇧⌘C | built-unchecked | |
| Format | Text ▸ Align Left | ⌘{ | built-unchecked | |
| Format | Text ▸ Center | ⌘\| | built-unchecked | |
| Format | Text ▸ Justify | | built-unchecked | |
| Format | Text ▸ Align Right | ⌘} | built-unchecked | |
| Format | Text ▸ Writing Direction ▸ Natural | | built-unchecked | Census `script-editor.format.writing-direction`, in the Description, where it is kept across another view; in the script a compilation renders the lines again |
| Format | Text ▸ Writing Direction ▸ Left to Right | | built-unchecked | Same code as Right to Left; that row is what the census drives |
| Format | Text ▸ Writing Direction ▸ Right to Left | | built-unchecked | Same census row |
| Format | Text ▸ Show Ruler | | built-unchecked | The ruler over the script, with the tab stops of Preferences' Tab width; kept in `scriptEditor.ruler`. Its stops are shown, not dragged. Batch journey, chromium |
| Format | Make Plain Text | | built-unchecked | Asks first, then the view last used loses its styles; a script gets them back at its next compilation. Unit test, not run in a browser |
| Window | Minimize | ⌘M | built-unchecked | Shell |
| Window | Zoom | | built-unchecked | Shell |
| Window | Library | ⇧⌘L | built-unchecked | Opens the Library window; the Library accessory view stays. Batch journey, chromium |
| Window | Log History | ⌥⌘L | built-unchecked | Opens the Log History window. Batch journey, chromium |
| Window | Bring All to Front | | built-unchecked | Shell |
| Window | Window list | | built-unchecked | Each window is named for its script (`DesktopWindowName`), as Finder's are: the batch journey read "Untitled" among the Window menu's rows, with the Library's, Dictionary's and Log History's names |
| Help | Script Editor Help | | built-unchecked | The window's own row now, beside AppleScript Help: opens Help Viewer on a search for the app |
| Help | AppleScript Help | | built-unchecked | Opens Help Viewer on a search for AppleScript. Census `script-editor.help.applescript` |

## Toolbar and bars

| Item | Status | Notes |
| --- | --- | --- |
| Record | partial | While recording on the desktop, another application coming to the front and the appearance set to Light or Dark write lines at the end of the script, in its language (`tell application "Calculator"`, `activate`; `set dark mode to true`, or `Application("Calculator").activate();`, `Appearance.set`), Script Editor itself not among them, and Stop compiles them. `rows-batch22-journey` (Chromium): recorded in both languages, then Calculator quit and Light set, and Run opened Calculator and turned the desktop dark. Screenshot not published. **Why partial:** the window manager, the page's appearance and the folder Finder shows are all that report to it (`script-editor-record-finder-journey`: recorded in both languages, and Run takes Finder back). No other app reports what is done inside it (real Script Editor hears Apple events from recordable apps); that needs each app to send an event of its own, with a line the script's subset can run. A return to Automatic writes nothing. Outside the desktop, nothing is recorded and the log says so |
| Stop | built-unchecked | Stops a recording. During a run on the server it is dimmed, saying the run ends within 5 seconds: the server has no way to stop one (Calls made) |
| Run | built-unchecked | |
| Compile | built-unchecked | JavaScript is parsed, never run, and a syntax error refused (`script-editor-javascript-journey`). The error's line is selected: the first line that gives that error, as a parser reports no place. Batch journey, chromium. A block never closed is at the line that opens it |
| Accessory view toggle | built-unchecked | |
| Bundle contents toggle | built-unchecked | |
| Customize Toolbar | built-unchecked | View > Customize Toolbar…: a sheet of what the toolbar shows, with Use Default Set; a change shows at once, and is kept in `scriptEditor.hiddenTools`. Batch 3 journey across a reload, unit test in `script-editor-batch2.test.tsx`. Absent: dragging items, spaces, and icon and text modes |
| Language pop-up | built-unchecked | Changing it counts as a change to the document |
| Element pop-up | built-unchecked | |
| Open Script | built-unchecked | Kept beside the real app's |
| Save Script | built-unchecked | Kept beside the real app's |
| Description button | built-unchecked | |
| Result button | built-unchecked | |
| Log button | built-unchecked | |
| Library button | built-unchecked | Served only |

## Editor and panes

| Item | Status | Notes |
| --- | --- | --- |
| AppleScript formatting on compile | built-unchecked | |
| JavaScript syntax styles | built-unchecked | Keywords and comments, and strings, numbers, patterns and template strings each in a colour of its own, listed in Preferences > Formatting and kept per person. Colours only: nothing reads them to run or change a script. `small-rows-batch9-journey.mjs` reads the four colours, a chosen colour after a reload and a run's result. Limit, not a parser: a division after a postfix `++` is misread, and a template's substitutions count as its text. A Mac has one Values colour for all four, black by default; separate rows are a call made here |
| Tab key indents | done: [script-editor-find.png](#project-artifact/art_a7e016210b9b9bc1/321) | Shift-Tab still leaves the view |
| Line wrap setting | done: [script-editor-preferences.png](#project-artifact/art_a7e016210b9b9bc1/587) | `scriptEditor.wrapLines`, every window, kept across a reload |
| Tab width setting | done: [script-editor-preferences.png](#project-artifact/art_a7e016210b9b9bc1/587) | `scriptEditor.tabWidth` |
| Script Assistant | built-unchecked | Edit > Complete's list, turned off and on in Preferences > Editing, and on the Escape key when asked. Batch journey for the list, unit test for the setting |
| Description view | built-unchecked | Saved and kept across a reload ([script-editor-description.png](#project-artifact/art_a7e016210b9b9bc1/336)), written into an exported bundle as `description.html` (code; the journey's bundle had none), and in a `.js` file's last line, a comment, so a copy of the file has it: `e2e/small-rows-batch12-journey.mjs` |
| Result view | built-unchecked | |
| Log view | built-unchecked | |
| Log tab Messages | done: [script-editor-log-tabs.png](#project-artifact/art_a7e016210b9b9bc1/586) | What the script and the window wrote, served only |
| Log tab Events | built-unchecked | App calls without their answers; a unit test reads it, no real app call in the journey |
| Log tab Replies | built-unchecked | Every line, the tab shown first; the journey read it |
| Library view of server actions | built-unchecked | Served only |
| Bundle: Name | built-unchecked | Written to the exported bundle's `Contents/Info.plist`: unit test of the file's text; the journey read the file's name on the drive |
| Bundle: Identifier | built-unchecked | Same |
| Bundle: Version | built-unchecked | Same |
| Bundle: Copyright | built-unchecked | Same |
| Bundle: Resources list | built-unchecked | Files of the drive, by the add button's Open panel or a drop; the remove button; copied into `Contents/Resources` on Export. Kept with the script. The batch journey added one by the panel and found its copy on the drive; a drop and the remove button were not run |
| Bundle: Scripts list | built-unchecked | Same code, into `Contents/Resources/Scripts`, not itself run; `main.js` is the window's script |

## Running

| Item | Status | Notes |
| --- | --- | --- |
| JavaScript on the server | built-unchecked | |
| `console.log` in the Log | built-unchecked | |
| App calls in the Log | built-unchecked | |
| Error in the Result | built-unchecked | |
| 429 retried once | built-unchecked | |
| AppleScript simple statements | built-unchecked | On the page |
| AppleScript `tell` blocks | built-unchecked | `script-editor-applescript.ts` translates a script with a `tell application` block to the JavaScript the server runs: `make new`, `every`, `count`, `send`, dark mode, `activate`, `set`, `log`, `return`, `if`, `repeat`. A statement it does not know stops the run, naming it and selecting its line. Batch journey made a note and read it back |
| Run a saved script as an application | built-unchecked | Dimmed in Export's File Format, with why: an application needs a Mac to run. Unit test |

## Other windows and sheets

| Item | Status |
| --- | --- |
| Several script windows | done: [script-editor-two-windows.png](#project-artifact/art_6a3da0a5b88d531a/11); further windows come back with the desktop's after a reload |
| Tabs | built-unchecked: Window > Show Previous Tab, Show Next Tab, Move Tab to New Window and Merge All Windows; each tab is a window with its script. Batch 3 journey, across a reload. Absent as TextEdit's: dragging tabs; Mission Control shows each |
| Dictionary viewer | built-unchecked: a window per app, its commands in a browser, the command's call, summary and parameters below, and a search field. From the server's dictionary. Batch journey |
| Library window | built-unchecked: the apps with a dictionary, several selectable, Open Dictionary, remove, and an Add button for each removed. Batch journey |
| Log History window | built-unchecked: date, script and result of each run, its log below, Copy, Delete and Clear History on several. Batch journey |
| Template chooser | done: the real app's File > New from Template is this submenu, with no chooser window, [script-editor-templates.png](#project-artifact/art_a7e016210b9b9bc1/584) |
| Export sheet: Script | built-unchecked: a `.js` file, the pop-up's other row; the journey exported Text |
| Export sheet: Script Bundle | built-unchecked: a `.scptd` folder on the drive laid out as a bundle, which the batch journey found there. Not opened again as one script: Open takes `.js` files |
| Export sheet: Application | built-unchecked: dimmed with why, an application could not run outside Script Editor here. Unit test |
| Export sheet: Text | done: a `.txt` file, [script-editor-export.png](#project-artifact/art_a7e016210b9b9bc1/585) |
| Export sheet: Run Only | built-unchecked: dimmed with why, a script is kept as its text. Unit test |
| Save sheet with Replace question | built-unchecked |
| Preferences: General | built-unchecked: Default language, for windows opened after. Unit test. Show Script menu is a separate row |
| Preferences: Editing | built-unchecked: Script Assistant, its Escape key, Wrap lines, Indent wrapped lines, Tab width. Wrap and tab width were seen in [script-editor-preferences.png](#project-artifact/art_a7e016210b9b9bc1/587); the rest by unit test |
| Preferences: Formatting | built-unchecked: a colour well for language keywords, application keywords, variables, comments and JavaScript's strings, numbers, patterns and template strings, and Use Defaults; `scriptEditor.formatting`. Batch journey opened the pane, unit test reads the colour in the script view, `small-rows-batch9-journey.mjs` reads it after a reload |
| Preferences: History | built-unchecked: Enable log history, Maximum entries, Clear History. Unit test |
| Preferences: Plug-ins | built-unchecked: says why none can be installed: a plug-in is compiled code for a Mac. Unit test |
| Script menu in the menu bar | built-unchecked: on from Preferences > General, Show Script menu in menu bar, kept on the server. Lists `Documents/Scripts` by name: `.js`, `.applescript`, `.scpt` and `.scptd`, with folders as submenus; choosing one runs it on the server, and a row says what it gave, or why it stopped, where a Mac shows only an error's alert. Open Script Editor and Open Scripts Folder. `desktop-menu-extras.test.tsx` on a stand-in drive and run route; the real server in `e2e/text-tools-batch7-journey.mjs`. Absent, as this desktop has none: the computer's and an application's own scripts |

## Context menus

| Where | Item | Status | Notes |
| --- | --- | --- | --- |
| Editor | Script snippets | built-unchecked | A submenu per group, by language; a snippet's selection is put inside it (`script-editor-snippets.ts`). The groups are this desktop's, a list and no folder. Unit test |
| Editor | Cut | built-unchecked | The shared Edit rows; journey sees the menu |
| Editor | Copy | built-unchecked | Same |
| Editor | Paste | built-unchecked | Same |
| Editor | Font ▸ Show Fonts | built-unchecked | Unit test |
| Editor | Font ▸ Bold | built-unchecked | Census `script-editor.context.font`, by a secondary click on a selected word |
| Editor | Font ▸ Italic | built-unchecked | Unit test sees the row |
| Editor | Speech ▸ Start Speaking | built-unchecked | Same |
| Editor | Speech ▸ Stop Speaking | built-unchecked | Same |
| Log | Copy | built-unchecked | The text selected in the Log, or the whole tab with none selected; dimmed on an empty Log. Census `script-editor.log.copy`, with the clipboard's write recorded |
| Library | Open | built-unchecked | The Library window's context menu, on the selection. Same command as the button the batch journey ran; the menu itself was not driven |
| Library | Remove | built-unchecked | Same, with the unit test pressing the button; kept in `scriptEditor.libraryRemoved` |

## Keys outside the menus

| Key | Status |
| --- | --- |
| Arrows in the toolbar | built-unchecked |
| Arrows on a divider | built-unchecked |

## Drag and drop, multi-selection

| Item | Status | Notes |
| --- | --- | --- |
| Drop a file: inserts its path | built-unchecked | Any drive item, on the script view, where it is let go. Census `script-editor.drop.script-and-path` from a desktop icon |
| Drop a script on the window | built-unchecked | A `.js` file anywhere on the window but the script view opens as File > Open's does, asking over unsaved changes; others are refused with a sentence. Same census row. Two at once leave the last in the window |
| Drop a script on the Dock tile | built-unchecked | Census `script-editor.drop.dock` |
| Drop an app in the Library | built-unchecked | An item named as an app with a dictionary (`Notes.app` or `Notes`) puts it back; others are refused with a sentence. The naming by unit test; no drop was run, and the desktop's drive has no app items to drag but a file so named |
| Select several apps in the Library | built-unchecked | Shift-click in the batch journey; removed together in a unit test |
| Select several Log entries | built-unchecked | In the Log History window: Copy and Delete act on them all; Delete on one by unit test |

## Saved state

| Item | Status | Notes |
| --- | --- | --- |
| Saved script on the drive | done: [script-editor-open-panel.png](#project-artifact/art_6a3da0a5b88d531a/5) | Documents/Scripts, read back through the server |
| Unsaved text across a reload | done: [script-editor-draft-after-reload.png](#project-artifact/art_6a3da0a5b88d531a/17) | With language, name, file, Description and bundle fields, written at each change, a reload straight after one included. A script over about 60 KB keeps the last version that fit, and the window says so |
| Description in a saved script | built-unchecked | In the file, as a comment on its last line after the code, so the file still runs as it stands. A drive copy of the file, a new id, opens with it; nothing is kept beside the file: `e2e/small-rows-batch12-journey.mjs`. A file saved before this keeps its value among the person's until its next save (`script-editor-depth.test.tsx`). A plain text export holds the code alone |
| Bundle fields in a saved script | built-unchecked | The same line of the file; version and identifier read back from a copy: `e2e/small-rows-batch12-journey.mjs`. A Script Bundle export is the real bundle |
| Preferences | done: wrap and tab width after a reload, in `script-editor-preferences-journey`, [script-editor-preferences.png](#project-artifact/art_a7e016210b9b9bc1/587) | |
| Log history | built-unchecked | `scriptEditor.history`, read again after a reload in the batch journey |

## Cross-app

| Item | Status | Notes |
| --- | --- | --- |
| Scripts use Notes | built-unchecked | `actions.rs` |
| Scripts use Reminders | built-unchecked | |
| Scripts use Calendar | built-unchecked | |
| Scripts use Contacts | built-unchecked | |
| Scripts use Stickies | built-unchecked | |
| Scripts use the drive's files | built-unchecked | |
| Scripts send Messages | built-unchecked | |
| Scripts open apps | built-unchecked | `onDesktopEffects` |
| Scripts set the appearance | built-unchecked | |
| Automator's Run JavaScript shares the interpreter | built-unchecked | |
| Finder opens `.js` here | built-unchecked | `opens` in `app.ts`, and `appsForFile` puts Script Editor first for a `.js`, with TextEdit still in Open With: unit tests of the choice and of a request before and after the window is there. The double-click itself has not been run in a browser |
| Finder opens `.scpt` here | built-unchecked | Not offered, with the reason shown: dropped on the window it is refused with "Script Editor opens JavaScript scripts (.js)." A `.scpt` is compiled binary that only macOS's OSA can read back to text, which a web page has no way to call |

## Open work ledger

No open item for Script Editor. `script-editor-*` live runs belong to the Release thread.

## Calls made

- AppleScript cannot drive real apps here. Translate a useful subset of `tell application "Notes"` statements to the same server actions JavaScript uses, and keep saying what is not run.
- A stop for server runs needs a server path. The budget stays 5 seconds; Stop shows unavailable while running, with a reason.

## Batch journey

The rows that say "batch journey" ran on main `032e9894` with this change, in chromium against the served desktop and its real server and drive, with a throwaway journey that is not in the repository. It made a note through a `tell` block, read it back, refused `beep`, selected a syntax error's line, ran Complete and Paste Reply, opened the Library, a Dictionary and Log History, exported a bundle with a resource and read its files' names from `/api/files`, and read Log History after a reload: all 17 steps, no console errors. Its screenshots were not published, so these rows stay built-unchecked until a journey in `e2e/` keeps them.

## Build items, most used first

1. **File and Script menus with keys.** New, Open panel, Open Recent, Save, Duplicate, Rename, Move To; Run ⌘R, Compile ⌘K, Stop ⌘., Record ⇧⌘R.
2. **Unsaved script survives a reload.** Draft document as TextEdit's.
3. **Several windows and tabs.** With the shell; coordinate with the Finder worker.
4. **View menu.** Bundle, Accessory, Description, Result, Log; Show Tab Bar.
5. **Editor.** JavaScript colours, Tab indents, Find family.
6. **Dictionary and Library windows.** Viewer from the server's action list; Library window; Open Dictionary.
7. **Log tabs and Log History.**
8. **AppleScript subset.** Real `tell` over server actions; unknown statements report an error.
9. **Export.** Script text, Application as a saved desktop item, Print.
10. **Context menu snippets and Preferences.**
11. **Drag.** Finder path, `.js` and `.scpt` from Finder. Needs Finder worker.
12. **Help.** Help opens Help Viewer; `.mdx` updated.
