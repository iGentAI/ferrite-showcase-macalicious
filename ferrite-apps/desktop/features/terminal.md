# Feature inventory: Terminal

The inventory was first read from main at `e62c2ac9`. The statuses below were set by building items 1 to 5 and 8.

**Status words.**

- **done** ran in a real Chromium, and the linked screenshot, a version of the library document Screenshots: Terminal, shows it.
- **built-unchecked** is in the tree but has no screenshot of this version. The note says what did run: *unit test* (vitest, on the stand-in drive where files are involved), *desktop's row* (the desktop supplies the row and Terminal did nothing to it) or *no test*.
- **missing** is not built, or not in this version. The note names the build item it belongs to.
- **partial** is built in part. The note says what is absent.

**What shipped.** This is a first version: window, emulator, screen, line editor, tabs, split panes, Find and selection, with a prompt that runs commands, one or several on a line with `;`, `&&` and `||`, joined by pipes, redirected to and from files, from `pwd`, `cd`, `ls`, `cat`, `echo`, `clear`, `history`, `help`, `exit`, `mkdir`, `rmdir`, `touch`, `rm`, `mv`, `cp`, `grep`, `head`, `tail`, `wc`, `sort` and `uniq`. It reads and changes the drive; `rm` erases for real. The session's first lines and `help` say so. A larger shell was built and did not pass review; each family of its commands comes back in its own change. Rows of that larger shell read "not in this version". Screenshot versions 1 to 27 were taken on that larger build: a row linking them shows the window, tabs, split or selection, which did not change, and no row relies on them for a command that has gone.

**How the browser check ran.** `e2e/terminal-journey.mjs` ran on a `vite` server of this tree on port 3020 that forwarded `/api/*` to the running desktop on 8787, so `/api/files` was the real server. It makes one file and one folder of its own, with unique names, and deletes them by id; it changes nothing else. `pack-site` was not run. The Linux Chromium read Command as Control, so the keys were checked with Control and the Mac reading of Command only in unit tests with a stubbed `navigator.platform`.

Terminal has no entry among the 102 of `reference/spec/apps`, so no measured spec exists. The look follows AppKit and the library's conventions and is labelled provisional. Wording and keys come from knowledge of macOS 10.15 (no Mac) and are provisional. Services, the window list and each New Window or New Tab profile list are generated lists, so each is one row.

## Calls made

A browser and a Ferrite application cannot give anyone a real process, and running shells on the server would be outside the platform. So:

- **Terminal is a Terminal emulator with a built-in shell.** The screen layer is a real VT100/xterm emulation. The shell is a small prompt in the page that reads the person's real drive (`/api/files`).
- **The window says what it is.** The first lines of a session state that it is a simulated shell, a first version, and what is not here yet.
- **Commands change real files.** `touch`, `mkdir`, `cp`, `mv`, `rmdir`, and `>` and `>>` write to the person's drive, and `rm` erases for good, without the Trash, as on a Mac.
- **Library first.** The emulator lives in `demos/terminal`, with no dependency.
- **New Remote Connection and Secure Keyboard Entry** have no meaning here: dimmed with a reason.
- The real app selects rectangles, not several separate ranges, so only rectangular selection is listed.

## Menus

| Menu | Item | Key | Status |
| --- | --- | --- | --- |
| Terminal | About Terminal | | built-unchecked: desktop's row |
| Terminal | Preferences… | ⌘, | built-unchecked: browser step in `terminal-census-journey` (8 of 8 rows in Firefox 157 and Playwright's WebKit 27.2 on Linux), no screenshot; its own window, once `app.ts` says `preferences: "own"` |
| Terminal | Secure Keyboard Entry | | done: [app menu](#project-artifact/art_716ee2a8c8b4ca59/9), dimmed with its reason |
| Terminal | Services | | built-unchecked: desktop's row |
| Terminal | Hide Terminal | ⌘H | built-unchecked: desktop's row |
| Terminal | Hide Others | ⌥⌘H | built-unchecked: desktop's row |
| Terminal | Show All | | built-unchecked: desktop's row |
| Terminal | Quit Terminal | ⌘Q | built-unchecked: desktop's row |
| Shell | New Window | ⌘N | done: [two windows](#project-artifact/art_716ee2a8c8b4ca59/25), from the menu |
| Shell | New Tab | ⌘T | done: [tabs](#project-artifact/art_716ee2a8c8b4ca59/7), from the menu |
| Shell | New Command… | ⇧⌘N | built-unchecked: unit test and browser step; runs in a new window, inside a shell or ending with the command. Off a Mac from the menu only, as ⌃⇧N is New Window |
| Shell | New Remote Connection… | ⇧⌘K | done: [Shell menu](#project-artifact/art_716ee2a8c8b4ca59/24), dimmed with its reason |
| Shell | Import… | ⌘O | built-unchecked: dimmed with its reason where there is no drive, unit test; opening a `.terminal` from the drive, no test. A Mac's file gives only its name, its colours being archived objects |
| Shell | Export Text As… | ⌘S | built-unchecked: browser step reads the file back with `grep` from the drive |
| Shell | Export Settings As… | | built-unchecked: unit test of the file written and read back; the Save sheet is Export Text's |
| Shell | Show Inspector | ⌘I | built-unchecked: unit test; dimmed with its reason off a desktop |
| Shell | Edit Title | ⇧⌘I | built-unchecked: unit test and browser step, read back after a reload |
| Shell | Edit Background Color | ⌥⌘I | built-unchecked: unit test that the Colors panel opens; a colour from it, no test |
| Shell | Print Selection | ⌥⌘P | built-unchecked: dimmed with nothing selected, unit test; printing a selection, no test |
| Shell | Print | ⌘P | built-unchecked: unit test that the browser's printing is given the text. The browser's own dialog, not a Mac's sheet |
| Shell | Send Hard Reset | ⌃⌥⌘R | built-unchecked: unit test |
| Shell | Send Soft Reset | ⌥⌘R | built-unchecked: emulator unit test; menu item no test |
| Shell | Send Signal ▸ INT | | built-unchecked: no test; stops the running command |
| Shell | Send Signal ▸ TERM | | built-unchecked: no test; does the same as INT, as no process exists to tell apart |
| Shell | Send Signal ▸ HUP | | built-unchecked: no test; does the same as INT |
| Shell | Send Signal ▸ KILL | | built-unchecked: no test; does the same as INT |
| Shell | Close | ⌘W | built-unchecked: browser step (from the menu), unit test (key) |
| Shell | Close Window | ⇧⌘W | done: [dark](#project-artifact/art_716ee2a8c8b4ca59/2), one window left after it, from the menu |
| Shell | Use Settings as Default | | built-unchecked: unit test; the tab's changes go into its profile, which becomes the default |
| Edit | Undo | | built-unchecked: unit test; dimmed with its reason, as the line has its own keys |
| Edit | Redo | | built-unchecked: dimmed with the same reason, no test of its own |
| Edit | Cut | | built-unchecked: dimmed with the same reason, no test of its own |
| Edit | Copy | ⌘C | done: [clipboard](#project-artifact/art_716ee2a8c8b4ca59/6), by Control-C with text selected |
| Edit | Copy Special ▸ Plain Text | ⌥⌘C | built-unchecked: no test |
| Edit | Copy Special ▸ Background Color | | built-unchecked: unit test; copies the colour as `#rrggbb` |
| Edit | Paste | ⌘V | done: [clipboard](#project-artifact/art_716ee2a8c8b4ca59/6), by Control-V; from the menu, dimmed with its reason where the browser has no clipboard to read: unit test |
| Edit | Paste Escaped Text | ⌃⌘V | built-unchecked: no test |
| Edit | Paste Selection | ⇧⌘V | built-unchecked: unit test |
| Edit | Select All | ⌘A | done: [selection](#project-artifact/art_716ee2a8c8b4ca59/23) |
| Edit | Select Between Marks | ⇧⌘A | built-unchecked: no test |
| Edit | Clear to Previous Mark | ⌘L | built-unchecked: emulator unit test |
| Edit | Clear to Start | ⌘K | built-unchecked: unit test |
| Edit | Clear Scrollback | ⌥⌘K | built-unchecked: unit test |
| Edit | Clear Screen | ⌃⌘L | built-unchecked: emulator unit test |
| Edit | Find ▸ Find… | ⌘F | done: [tabs](#project-artifact/art_716ee2a8c8b4ca59/7), the match selected; past a wide character: unit test. Absent: text across an automatic wrap is not found, since each row is searched alone |
| Edit | Find ▸ Find Next | ⌘G | built-unchecked: no test |
| Edit | Find ▸ Find Previous | ⇧⌘G | built-unchecked: no test |
| Edit | Find ▸ Use Selection for Find | ⌘E | built-unchecked: no test |
| Edit | Find ▸ Jump to Selection | ⌘J | built-unchecked: no test |
| Edit | Marks ▸ Mark | ⌘U | built-unchecked: emulator unit test |
| Edit | Marks ▸ Unmark | ⌥⌘U | built-unchecked: emulator unit test |
| Edit | Marks ▸ Jump to Previous | ⌘↑ | built-unchecked: no test |
| Edit | Marks ▸ Jump to Next | ⌘↓ | built-unchecked: no test |
| Edit | Marks ▸ Bookmark | ⌘⇧M | built-unchecked: no test; Mark as Bookmark, with no key, as ⇧⌘M is Show Marks here. It marks the line as Mark does: a bookmark's name is absent |
| Edit | Use Option as Meta Key | ⌥⌘O | built-unchecked: no test |
| Edit | Speech ▸ Start Speaking | | built-unchecked: the selection, or else the whole text, through the browser's `speechSynthesis`; no test, not heard |
| Edit | Speech ▸ Stop Speaking | | built-unchecked: no test |
| Edit | Start Dictation | | built-unchecked: the desktop's Edit footer: types what the browser's recognizer hears at the insertion point, dimmed with a reason with no field or no recognizer. `e2e/dictation-batch5-journey.mjs`, in other apps, with a stub recognizer |
| Edit | Emoji & Symbols | ⌃⌘Space | built-unchecked: the desktop's Edit footer (`desktop-menus.tsx`) |
| View | Show/Hide Tab Bar | ⇧⌘T | built-unchecked: no test |
| View | Show All Tabs | ⇧⌘\ | built-unchecked: dimmed with its reason, no test |
| View | Show/Hide Marks | ⇧⌘M | built-unchecked: no test |
| View | Show Alternate Screen | ⌥⌘Y | built-unchecked: dimmed with its reason, no test |
| View | Allow Mouse Reporting | ⌘R | partial: shown dimmed, saying no program in this shell reads the mouse: unit test. Absent, and without a reader nothing could use it: reports of the mouse to a program. The wheel scrolls the scrollback, and sends arrow keys on the alternate screen |
| View | Split Pane | ⌘D | done: [tabs and split](#project-artifact/art_716ee2a8c8b4ca59/3), from the menu |
| View | Close Split Pane | ⇧⌘D | done: [tabs](#project-artifact/art_716ee2a8c8b4ca59/7), one pane after it, from the menu |
| View | Bigger | ⌘+ | built-unchecked: unit test |
| View | Smaller | ⌘- | built-unchecked: unit test |
| View | Default Font Size | ⌘0 | built-unchecked: unit test |
| View | Scroll to Top | ⌘Home | built-unchecked: no test |
| View | Scroll to Bottom | ⌘End | built-unchecked: no test |
| View | Page Up | ⌘PgUp | built-unchecked: no test |
| View | Page Down | ⌘PgDn | built-unchecked: no test |
| View | Line Up | ⌥⌘PgUp | built-unchecked: no test |
| View | Line Down | ⌥⌘PgDn | built-unchecked: no test |
| View | Enter Full Screen | ⌃⌘F | built-unchecked: desktop's row |
| Window | Minimize | ⌘M | built-unchecked: desktop's row |
| Window | Zoom | | built-unchecked: desktop's row |
| Window | Tile Window to Left | | built-unchecked: the desktop's row, Tile Window to Left of Screen (`desktop-menus.tsx`) |
| Window | Tile Window to Right | | built-unchecked: the desktop's row, Tile Window to Right of Screen (`desktop-menus.tsx`) |
| Window | Cycle Through Windows | ⌘\` | built-unchecked: the desktop's row (`desktop-menus.tsx`) |
| Window | Return to Default Size | | done: [dark](#project-artifact/art_716ee2a8c8b4ca59/2), the 536×334 frame |
| Window | Show Previous Tab | ⌃⇧Tab | built-unchecked: unit test |
| Window | Show Next Tab | ⌃Tab | built-unchecked: unit test |
| Window | Move Tab to New Window | | done: [moved tab](#project-artifact/art_716ee2a8c8b4ca59/13) |
| Window | Merge All Windows | | done: [merged](#project-artifact/art_716ee2a8c8b4ca59/12) |
| Window | Bring All to Front | | built-unchecked: desktop's row |
| Window | Window list | ⌘1 to ⌘9 | built-unchecked: desktop's row |
| Help | Terminal Help | | built-unchecked: opens the Terminal guide in Help Viewer (`requestHelp`), `small-apps-batch3-journey` |
| Help | Search man Page Index… | | built-unchecked: asks for a word in a sheet and lists `man -k` of it in a Man Page window. `man -k` by unit test; the sheet no test. The screen's context menu runs the same on the selected word: its dimmed state by unit test |

## Window and screen

| Item | Status | Notes |
| --- | --- | --- |
| Title "name — zsh — 80×24" | done: [open](#project-artifact/art_716ee2a8c8b4ca59/1) | Opens at 80×24 with a 536×334 frame in this font |
| Resize shows the size | done: [two windows](#project-artifact/art_716ee2a8c8b4ca59/25) | The window behind shows 98×29 |
| Resize sends rows to the program | built-unchecked | Stale row: `less`, `man` and `top` repaint at the new size through `onResize` (`terminal-pager.ts`, `terminal-mac-commands.ts`); read from the code, no test here |
| Resize sends columns to the program | built-unchecked | Same |
| Tabs | done: [tabs](#project-artifact/art_716ee2a8c8b4ca59/7) | |
| Split panes | done: [tabs and split](#project-artifact/art_716ee2a8c8b4ca59/3) | One session in two views, as on a Mac |
| Several windows | done: [two windows](#project-artifact/art_716ee2a8c8b4ca59/25) | Through `DesktopWindow`, with `windows` in `app.ts` |
| Proxy icon of the working directory | built-unchecked | The folder in the title drags the working folder when it is on the drive; `small-apps-batch3-journey` dropped it on a Finder window and read the copy from the drive. Finder copies a drag from another app, where a Mac on one volume moves it. ⌘-click's path menu is absent. Home and above do not drag |
| Cursor movement | built-unchecked | Emulator unit test of every sequence |
| SGR text styles | built-unchecked | Emulator unit test; reached in this version only by `cat` of a file holding them |
| 256 colours | built-unchecked | Same |
| True colour | built-unchecked | Same |
| Alternate screen | built-unchecked | Emulator unit test |
| Scroll regions | built-unchecked | Emulator unit test |
| Line wrap | built-unchecked | Emulator unit test, wrapping anew on resize included |
| Narrowing the window with the cursor far above the last line | built-unchecked | Lines with no room under the cursor wait under the screen, and come back when the window widens or gets taller or the screen scrolls; erasing to the screen's end drops them, as it erases what shows. A shorter window keeps the cursor on its line too. `terminal-emulator.test.ts`, not driven in a browser. While they wait, Find, a selection and Select All do not reach them |
| Narrowing the window on the alternate screen | built-unchecked | The shell's text is wrapped anew at the new width on return, with the cursor on its character, and lines that had no room wait under the screen as above. `terminal-emulator.test.ts`; `less` with the window dragged narrower in `e2e/text-tools-batch7-journey.mjs` |
| Erasing half of a wide character | built-unchecked | Erase, delete and insert blank the other half: `terminal-emulator.test.ts`, each by literal cells |
| Pasting control characters | built-unchecked | As zsh: they stay in the line and are drawn in caret notation (`^[`, `^G`, `<009b>`), a tab to its stop, and none acts on the screen until the person presses Return and a command prints it. A paste holding the bracketed-paste end marker has it removed, so it cannot end itself and run what follows. `terminal-line-editor.test.ts`, `terminal.test.tsx`, `rows-batch19-journey` in Chromium |
| Scrollback of 10,000 lines | built-unchecked | Emulator unit test |
| Selection by word | done: [word selection](#project-artifact/art_716ee2a8c8b4ca59/22) | |
| Selection by line | done: [line selection](#project-artifact/art_716ee2a8c8b4ca59/20) | |
| Rectangular selection with ⌥ | done: [rectangle selection](#project-artifact/art_716ee2a8c8b4ca59/21) | |
| Cursor styles | built-unchecked | Emulator unit test; only the block is drawn in a browser check |
| Cursor blink | built-unchecked | Emulator unit test of the mode; the animation has no test |
| ⌘-click a URL opens Safari | built-unchecked | No test. Through `openUrl`; Control-click off a Mac |

## Inspector, preferences and sheets

| Item | Status |
| --- | --- |
| Inspector: Info | built-unchecked: unit test and browser step; title, processes, working directory, Columns and Rows steppers that resize the window (those steppers no test) |
| Inspector: Settings | built-unchecked: unit test; the tab's profile, Background, Text, font size, Use Settings as Default. Named Profile as a Mac 10.15 names the tab |
| Preferences: General | built-unchecked: browser step that it opens; unit test of the startup profile. Shells open with: a line saying only the simulated zsh runs here |
| Profile Basic | done: [open](#project-artifact/art_716ee2a8c8b4ca59/1), [dark](#project-artifact/art_716ee2a8c8b4ca59/2); colours provisional |
| Profile Grass | built-unchecked: unit test of its colours through the window's custom properties; colours provisional, no reference exists |
| Profile Homebrew | built-unchecked: as Grass |
| Profile Man Page | built-unchecked: as Grass; Open man Page uses it |
| Profile Novel | built-unchecked: as Grass |
| Profile Ocean | built-unchecked: unit test and browser step, a new window takes `#224fbc`; colours provisional |
| Profile Pro | built-unchecked: as Grass; opaque, a window of a page has nothing to show through |
| Profile Red Sands | built-unchecked: unit test, chosen in the Inspector; colours provisional |
| Profile Silver Aerogel | built-unchecked: as Grass; opaque |
| Profile Solid Colors | built-unchecked: as Grass |
| Profile tab: Text | built-unchecked: unit test of a colour shown at once. Font, size, five colours, cursor style and blink. Absent: the ANSI colours and text effects, which stay the palette's |
| Profile tab: Window | built-unchecked: unit test of Dimensions. Title, what the title shows, Columns and Rows for a new window. Absent: scrollback limit, fixed at 10,000 rows, and the title's Arguments, Shell command and TTY, as no process has them |
| Profile tab: Tab | built-unchecked: no test of its own. Tab title, active process. Absent: Show activity indicator |
| Profile tab: Shell | built-unchecked: unit test of Run command and When the shell exits. Ask before closing: Always, Never or Only if a command is running; its sheet by unit test, the pop-up no test |
| Profile tab: Keyboard | built-unchecked: no test of its own. Use Option as Meta key. Absent: the key table, which the pane says |
| Profile tab: Advanced | built-unchecked: no test of its own. Audible and visual bell; Declare terminal and Text encoding shown dimmed, with what they are fixed at |
| Preferences: Window Groups | built-unchecked: unit test of saving from the Window menu and opening it again; the pane lists and removes them, and General can open one at startup (those no test) |
| Preferences: Encodings | built-unchecked: unit test; the list is dimmed with its reason, only UTF-8 ticked |
| Sheet: terminate running processes? | built-unchecked: Close Tab, Close and Close Window from Terminal's own rows, the tab's close button and the red button ask while a command runs, by the profile's Ask before closing: unit test for a tab, and Shell > Close over `sleep` by a scratch browser check. The desktop's Quit does not ask, as it closes the app without Terminal's rows |
| Sheet: man page | built-unchecked: stale row: the real app shows it as a window, not a sheet; Open man Page opens one in the Man Page profile. Read from the code, no test here |
| Sheet: New Command | built-unchecked: unit test and browser step; the profile is one of its controls |

## Shell

| Item | Status | Notes |
| --- | --- | --- |
| Prompt | done: [first version](#project-artifact/art_716ee2a8c8b4ca59/28) | |
| Emacs line-editing keys | built-unchecked | Unit test of the line editor |
| History with ↑ | built-unchecked | Unit test: what was typed on the live line stays across Up and Down |
| History search with ⌃R | built-unchecked | Unit test, a line with an emoji included |
| Tab completion | built-unchecked | Unit test: commands, and paths with spaces escaped. A name with a newline is not offered |
| Quotes | done: [first version](#project-artifact/art_716ee2a8c8b4ca59/28) | Single, double and backslash. Unit test of each |
| Globbing | done: [terminal-patterns.png](#project-artifact/art_a7e016210b9b9bc1/425) | `*`, `?`, `[...]` and `[!...]` on the drive's names when the command runs, sorted; a hidden name only when the pattern starts with a dot. No match ends the line with `no matches found`, as in zsh. Absent and refused: a pattern in a redirection, braces, and zsh's `**` and `(#...)`: `**` reads as `*` |
| Pipes | done: [terminal-pipes.png](#project-artifact/art_716ee2a8c8b4ca59/32) | Each command runs when the one before has ended, holding at most 16 million characters of its output in the page, so `yes \| head` would not end; no such endless command exists here yet. Only the last command touches the shell, as in zsh |
| Redirection | done: [terminal-redirection.png](#project-artifact/art_716ee2a8c8b4ca59/33) | `<`, `>`, `>>`, `2>`, `2>>`, `2>&1`, on the real drive. What goes to a file is written when the command has ended, so `sort a > a` keeps `a` whole (a Mac empties it first), and Control-C leaves the file as it was. One redirection of each stream; zsh's several at once, `>\|`, `>&` and `&>` are refused |
| Here-documents and here-strings | built-unchecked | `<<`, `<<-`, `<<'END'` kept as written, and `<<<`, with the `heredoc>` prompt; unit test, no browser step |
| `&&` | done: [terminal-line-list.png](#project-artifact/art_716ee2a8c8b4ca59/30) | |
| `\|\|` | done: [terminal-line-list.png](#project-artifact/art_716ee2a8c8b4ca59/30) | |
| `;` | done: [terminal-line-list.png](#project-artifact/art_716ee2a8c8b4ca59/30) | A line that starts or ends wrongly is refused whole, as a parse error. Tab after a connector with two backslashes before it, or one inside quotes, can offer files or names wrongly; what runs is not affected |
| Variables | done: [terminal-variables.png](#project-artifact/art_a7e016210b9b9bc1/424) | `$NAME`, `${NAME}`, also inside double quotes, and `NAME=value`, per tab and for the session; `PWD` and `OLDPWD` follow `cd`. A value is not split into words, as in zsh, and the last command of a pipeline sets the shell's variables, as in zsh. Absent, and refused: `NAME=value command`, `NAME=value > file`, `${NAME:-x}`, `$1`, `$$`. Limits: `~` does not follow `$HOME`, and `~` is not expanded after `=`. `terminal-variables-journey` |
| Parameter modifiers | done | `${#a}`, `${a:-b}`, `${a:=b}`, `${a:+b}`, `${a#p}`, `${a##p}`, `${a%p}`, `${a%%p}`, `${a/p/q}`, `${a//p/q}`: unit test. Absent: `${a:?b}`, and a modifier's text holding a reference or a quote; refused with a message |
| `$?` | done: [terminal-variables.png](#project-artifact/art_a7e016210b9b9bc1/424) | Each command of a line sees the one before's |
| Brace expansion | done | `{a,b}`, nested, `{1..3}` and `{a..c}`: unit test. Over 4,096 words on one word is refused with a message |
| Aliases | built-unchecked | `alias`, `alias name=value`, `unalias`, `unalias -a`; at the head of each command, not looping on one of itself. Per shell; `.zshrc` keeps them for each new one. Unit test |
| Command substitution | built-unchecked | `$(...)`, nested and inside quotes, in a shell of its own; unquoted, split into words. Absent: backticks, refused. Unit test |
| Arithmetic | built-unchecked | `$((...))` with `+ - * / %`, comparisons, `&& \|\| !`, parentheses and names. Unit test |
| `if`, `for`, `while`, `until` | built-unchecked | On one line or over several, with zsh's `for>` and `then>` prompts, and a redirection after `done` or `fi`. Absent: `case`, functions, refused with a message. A loop takes a browser turn each round, so Control-C stops one that never ends. Unit test |
| A quote or backslash over the line end | built-unchecked | `quote>`, `dquote>` and `>` prompts. Unit test |
| `ls` | built-unchecked: [first version](#project-artifact/art_716ee2a8c8b4ca59/28) shows an earlier version | Drive, read back in the journey. `-1 -A -B -C -F -G -O -R -S -T -a -b -d -f -g -h -k -l -m -n -o -p -q -r -s -t -v -w -x`, with `total` over a long or `-s` listing; `-H -L -P -W -e` are taken and change nothing, as the drive has no links, whiteouts or access lists. `-n` writes the 501 and 20 that `id` says; `-O` writes `uchg` for a locked file, else `-`; `-s` counts what a file holds, in 512-byte blocks or `-k`'s 1024, as the drive allots no blocks. Refused, because the drive keeps none of it: `-i` (inode), `-u` (access time), `-c` (status time), `-U` (creation time), `-@` (extended attributes). Unit test; `-n`, `-s`, `-i` in `e2e/books-text-batch8-journey.mjs` |
| `cd` | done: [first version](#project-artifact/art_716ee2a8c8b4ca59/28) | Drive; `cd -` and `~`: unit test |
| `pwd` | done: [first version](#project-artifact/art_716ee2a8c8b4ca59/28) | |
| `help` | done: [first version](#project-artifact/art_716ee2a8c8b4ca59/28) | Not a Mac command: says what this version has and has not |
| `mkdir` | done: [terminal-file-commands.png](#project-artifact/art_716ee2a8c8b4ca59/29) | `-p` |
| `rmdir` | done: [terminal-file-commands.png](#project-artifact/art_716ee2a8c8b4ca59/29) | To the Trash, so what another window put there can be recovered |
| `rm` | built-unchecked: [terminal-file-commands.png](#project-artifact/art_716ee2a8c8b4ca59/29) shows the earlier options | `-f`, `-i`, `-r`, `-R`, `-v`; erases for real; `-i` asks and reads the answer: unit test |
| `mv` | built-unchecked: [terminal-file-commands.png](#project-artifact/art_716ee2a8c8b4ca59/29) shows the earlier options | `-f`, `-i`, `-n`, `-v`, to `~/.Trash`; the last of `-f -i -n` decides: unit test |
| `cp` | built-unchecked: [terminal-file-commands.png](#project-artifact/art_716ee2a8c8b4ca59/29) | `-R`, `-r`, `-a`, `-f`, `-i`, `-n`, `-p`, `-v`, and `-H -L -P`, which change nothing with no links; merges into a folder of the same name; `-i` by unit test. `-p` and `-a` keep the mode and the date, through a folder too, and a plain `cp` dates the copy now, read from the server (`e2e/books-text-batch8-journey.mjs`, and a drive test) |
| `touch` | built-unchecked: [terminal-file-commands.png](#project-artifact/art_716ee2a8c8b4ca59/29) shows a new file | Stale row: a file that is there gets a new modification time through `files.touch`; `-c`. Read from the code, no test here |
| `cat` | built-unchecked: journey step, its own file, for files | Files, pipes, `-`, and lines typed until Control-D, written back as each ends; `-b -n -s -u`: unit test; over 16 MB it says the file is too large |
| `chmod` | built-unchecked | Octal and `u+x`, `go-w`, `a=r`; `-R -f -v`. The drive keeps no permissions, so the mode is kept with the desktop's settings by the file's id, and stays after a rename and a reload. The execute bit lets `./file` run and the write bit lets `>` write; the rest is what `ls -l` and `test` show. A copy starts with the default mode. Unit test, no browser step |
| `echo` | done | `-n`, and `\a \b \c \e \f \n \r \t \v \\`, as zsh's reads them: unit test |
| `grep` | built-unchecked: [terminal-pipes.png](#project-artifact/art_716ee2a8c8b4ca59/32) shows the earlier options | `-c -E -F -H -h -i -l -n -o -q -R -r -v -w -x -e`, each by unit test; `-r` on the drive and several `-e` in `e2e/text-tools-batch7-journey.mjs`. `-r` goes down a folder, naming each file from where it started; with no file named it warns and reads the pipe or the keyboard, as a Mac's does. A file holding a NUL byte says `Binary file … matches`. Patterns are translated to JavaScript's, so a back-reference or a repetition a POSIX engine reads differently may match differently. A pattern that repeats a group that itself repeats or has alternatives, such as `(a+)+`, or has more than four open-ended repeats, such as `a*a*a*a*a*b`, is refused, because matching runs on the page; a slow pattern with fewer repeats on a very long line is not bounded, and no worker stops it |
| `head` | built-unchecked: [terminal-pipes.png](#project-artifact/art_716ee2a8c8b4ca59/32) shows the earlier options | `-n`, `-N`, `-c`, and the keyboard when no file is named: unit test |
| `tail` | built-unchecked: [terminal-pipes.png](#project-artifact/art_716ee2a8c8b4ca59/32) shows the earlier options | `-n`, `-N`, `+N`, `-c`, and `-f`, which looks each second until Control-C: unit test |
| `wc` | done: [terminal-pipes.png](#project-artifact/art_716ee2a8c8b4ca59/32) | `-c -l -m -w` |
| `sort` | built-unchecked: [terminal-pipes.png](#project-artifact/art_716ee2a8c8b4ca59/32) shows the earlier options | `-f -n -o -r -u -t`, one `-k M[,N]`; `-o` by unit test. Compares by character, not by locale |
| `uniq` | built-unchecked: [terminal-pipes.png](#project-artifact/art_716ee2a8c8b4ca59/32) shows the earlier options | `-c -d -i -u`, and an output file: unit test |
| `sed` | built-unchecked: [terminal-tools.png](#project-artifact/art_a7e016210b9b9bc1/313) shows the earlier commands | `-n -E -e -i`, a backup with `-i.bak` and none with `-i ''`, as on a Mac; line, `$`, pattern addresses, ranges, `!`; `s y d p q = a i c`: unit test of `-i` and `a i c`. Known limits: a simulated shell's tool, so POSIX corners outside this list are not chased; the same file named twice with `q` can read `$` early. `e2e/terminal-tools-journey.mjs` |
| `tr` | built-unchecked: [terminal-tools.png](#project-artifact/art_a7e016210b9b9bc1/313) shows pipes | `-C -c -d -s`; pipes and the keyboard: unit test |
| `less` | done: [terminal-pager.png](#project-artifact/art_a7e016210b9b9bc1/428) | The alternate screen; Space, `b`, `j`, `k`, arrows, `g`, `G`, `/`, `n`, `N`, `q`. Files and pipes; into a pipe or a file it writes the text whole. Absent: options, refused, and reading the keyboard |
| `more` | built-unchecked: unit test | As `less`, and it returns at once when the text fits |
| `date` | done: [terminal-mac.png](#project-artifact/art_a7e016210b9b9bc1/88) | |
| `whoami` | done: [terminal-mac.png](#project-artifact/art_a7e016210b9b9bc1/88) | |
| `hostname` | built-unchecked | Unit test |
| `uname` | built-unchecked | Unit test |
| `ps` | built-unchecked: [terminal-mac.png](#project-artifact/art_a7e016210b9b9bc1/88) shows it before the titles | The desktop's windows, with steady numbers, each with the title its bar shows (a bar names its window by `aria-labelledby`, which the desktop's window scan does not read). `terminal-kill-top.test.ts`; TextEdit's title in `e2e/text-tools-batch7-journey.mjs` |
| `top` | done: [terminal-top.png](#project-artifact/art_a7e016210b9b9bc1/429) | Activity Monitor's figures for the desktop's modules on the alternate screen, read again every 5 seconds; `q` quits. There are no processes to list: these are server modules. Into a pipe it writes them once. No options |
| `kill` | built-unchecked: unit test and browser steps in `terminal-kill-top-journey`, no screenshot of its own | Quits the application a `ps` number's window belongs to, every window of it, as Force Quit does: unsaved work goes the same way. `-TERM -9 -s NAME -0 -l`; other signals and Terminal itself are refused |
| `env` | built-unchecked: [terminal-tools.png](#project-artifact/art_a7e016210b9b9bc1/313) shows the list | Lists every exported variable, or runs a command with `NAME=value`s added for it alone: unit test. `-i` is refused |
| `export` | done: [terminal-variables.png](#project-artifact/art_a7e016210b9b9bc1/424) | `export`, `export NAME`, `export NAME=value`, and `unset` |
| `which` | built-unchecked: [terminal-tools.png](#project-artifact/art_a7e016210b9b9bc1/313) shows an earlier version | `-a -s`. An alias, zsh's own command (`cd: shell built-in command`) or the program under `/bin`, which that path now runs; `-a` all of them. A command that only refuses (`vim`) is not found. `type` answers the same way. Unit test; `e2e/books-text-batch8-journey.mjs` |
| `man` | done: [terminal-man.png](#project-artifact/art_a7e016210b9b9bc1/427) | This shell's own pages, one for every command that works here; `man intro` says what the shell is. Commands that only refuse have none. `man -k` and `apropos`: unit test, not in the screenshot |
| `clear` | built-unchecked | Unit test of the line editor's prompt after it; no browser step |
| `reset` | done | Sends the terminal's full reset: unit test |
| `history` | built-unchecked | No test of its own; the line editor's history is unit-tested |
| `exit` | built-unchecked | Unit test, at its status |
| `open` | built-unchecked: [terminal-open-folder.png](#project-artifact/art_a7e016210b9b9bc1/89) | `-a` and folders seen; files, links and `dict://word` not run in a browser |
| `pbcopy` | done: [terminal-mac.png](#project-artifact/art_a7e016210b9b9bc1/88) | Reads a pipe, not the keyboard |
| `pbpaste` | done: [terminal-mac.png](#project-artifact/art_a7e016210b9b9bc1/88) | |
| `say` | built-unchecked | Browser's `speechSynthesis`; not heard |
| `osascript` | built-unchecked | JavaScript only, on the Script Editor module's server; other languages refused |
| `defaults` | done: [terminal-mac.png](#project-artifact/art_a7e016210b9b9bc1/88) | Read back after a reload by the journey |
| `mdfind` | built-unchecked | Spotlight's search; lists kind and title, not paths; not run |
| `node` | done: [terminal-mac.png](#project-artifact/art_a7e016210b9b9bc1/88) | On the Script Editor module's server |
| `sh script.sh` | built-unchecked | Also `bash`, `zsh`, `sh -c`, what a pipe gives `sh`, and `./file` once `chmod +x`. A shell of its own, with `$0`, `$1`, `$#`, `$@`, `$*` and `shift`; `#` starts a comment; `exit` ends the script. A simulated shell: no process starts. Unit test, no browser step |
| `source` | built-unchecked | Also `.`; what it sets stays, and an `exit` in it ends the shell. Unit test, no browser step |
| `.zshrc` | built-unchecked | `~/.zshrc` is a file to write and read, and runs when a shell starts. The home folder is no folder of the drive, so it is kept with the desktop's settings, in at most 4,096 bytes as JSON, and Finder does not show it. `rm` and `mv` of it are refused; `> ~/.zshrc` empties it. Unit test and `terminal-scripts-journey` |
| `test`, `[`, `[[`, `true`, `false`, `:`, `read`, `printf`, `sleep`, `seq`, `basename`, `dirname`, `type`, `shift` | built-unchecked | What scripts use. `[[` reads as `[`, without zsh's patterns; `printf` has `%s %d %f %%`. Unit test |
| Background jobs (`&`, `jobs`, `fg`, `bg`, `wait`) | built-unchecked | `&` runs a pipeline behind the prompt in a scope of its own, writing to the same screen, and the prompt says when it ended; `fg` waits and Control-C under it stops it. `bg` only says the job already runs, since nothing here is suspended, and `kill %1` is not read. Unit test, no browser step |
| A line taller than the screen | built-unchecked | The screen holds the rows around the cursor and nothing scrolls while it is edited; entering it leaves the whole line behind it once. `terminal-line-editor.test.ts` on the real emulator; typed, edited at its start and entered in `e2e/text-tools-batch7-journey.mjs`. Its rows on the screen are separate lines while it is edited, so a selection across them copies line breaks until it is entered |
| `.command` files | built-unchecked | Opened from Finder in a new window, which runs the file with `sh` and ends with it, also `.tool`; `.terminal` opens as a profile. `finder-open.ts` names them Terminal's, so TextEdit does not take them as text. Census row `terminal.command-file` |
| `sudo` refuses clearly | done: [terminal-mac.png](#project-artifact/art_a7e016210b9b9bc1/88) | |
| `ssh` refuses clearly | built-unchecked | Unit test |
| `brew` refuses clearly | built-unchecked | Unit test |
| `git` refuses clearly | built-unchecked | Unit test |
| `vim` refuses clearly | built-unchecked | Says to use TextEdit, as `vi` and `emacs` do (`REFUSALS` in `terminal-mac-commands.ts`) |
| `nano` | built-unchecked | Refuses and says to use TextEdit, as `vim` does: there is no full-screen editor here |

## Context menus

| Where | Item | Status |
| --- | --- | --- |
| Screen | Copy | built-unchecked: unit test that it is dimmed with nothing selected; copying from it, no test |
| Screen | Paste | built-unchecked: unit test that it shows; dimmed with its reason where the browser refuses the clipboard |
| Screen | Paste Selection | built-unchecked: as Copy |
| Screen | Clear | built-unchecked: unit test; named Clear to Start, which is what it does |
| Screen | Split Pane | built-unchecked: unit test |
| Screen | Open man Page | built-unchecked: unit test that it is dimmed without a one-word selection; opening a page from it, no test. A new window of the Man Page profile runs `man`, and closes when it ends cleanly |
| Screen | Search man Page Index | built-unchecked: unit test; dimmed with its reason, as this shell's manual has no index |
| Screen | Inspect | built-unchecked: unit test that it shows; opens the Inspector |
| Screen | Look Up | built-unchecked: unit test that it is dimmed with nothing selected; Dictionary from it, no test |
| Screen | Services | built-unchecked: no test; Look Up in Dictionary, Open URL and Search the Web for the selection. Absent: the desktop's text services, which read a selection made in a page's text |
| Tab | Close Tab | built-unchecked: no test of its own; Close Other Tabs shares its menu |
| Tab | Close Other Tabs | built-unchecked: unit test |
| Tab | Move Tab to New Window | built-unchecked: unit test |
| Dock | Windows list | built-unchecked: the desktop's rows (`DockWindowRows`), no test of Terminal's |
| Dock | New Window | built-unchecked: no test; registered as the app's Dock rows |
| Dock | New Tab | built-unchecked: no test; registered as the app's Dock rows |

## Keys outside the menus

| Key | Status | Notes |
| --- | --- | --- |
| ⌃C | built-unchecked | Unit test: at the prompt it starts a new line; running, it stops `cat`; copies while text is selected off a Mac |
| ⌃D | built-unchecked | At a prompt ends the shell: no test of its own; the line editor's end-of-file is unit-tested |
| ⌃Z | built-unchecked | Stale note: with no job to suspend zsh does nothing at the prompt, and this shell has none; the line stays (`terminal-shell.test.ts`). A running program is not suspended, as this shell has no job control |
| ⌃L | built-unchecked | Browser step |
| ⌃A | done: [keys](#project-artifact/art_716ee2a8c8b4ca59/16) | |
| ⌃E | done: [keys](#project-artifact/art_716ee2a8c8b4ca59/16) | |
| Option as Meta | built-unchecked | No test |
| Menu fallback for ⌘T, which Chromium keeps | done: [tabs](#project-artifact/art_716ee2a8c8b4ca59/7) | New Tab from the menu |
| Menu fallback for ⌘N, which Chromium keeps | done: [two windows](#project-artifact/art_716ee2a8c8b4ca59/25) | New Window from the menu |
| Menu fallback for ⌘W, which Chromium keeps | built-unchecked | Browser step: Close from the menu |

## Drag and drop

| Item | Status | Notes |
| --- | --- | --- |
| Drop a file: types its escaped path | built-unchecked | From Finder, with a space after it; a file off the drive is refused with a reason. Census row `terminal.drop` |
| Drop a folder on the Dock tile: a shell there | built-unchecked | The Dock hands Terminal the folder and a new window opens there, key when Terminal was running: `e2e/desktop-overlay-journey.mjs` runs `pwd` in it, and `desktop-menu-tracking.test.tsx`. With Terminal shut, the folder becomes the first window: `terminal-open-folder.test.tsx`, unit test only |
| Drag text within the window | built-unchecked | A first press on the selected text starts a drag; a drop anywhere on a screen goes in as a paste. A second or third press still selects a word or line: unit test. A real drag in Chromium landed the word at the prompt, by a scratch browser check; no screenshot in the library |
| Drag text out | built-unchecked | As `text/plain`, for whatever takes a browser's drop |
| Drag a tab to another window | built-unchecked | Let go over another Terminal window, not on its text, and the tab moves there; a window left with no tab goes. No test: not run in a browser |
| Tear off a tab | built-unchecked | Let go off every Terminal window, and the tab takes a new window, as Move Tab to New Window does. A real drag in Chromium made the second window, by a scratch browser check; no screenshot in the library |

## Saved state

| Item | Status | Notes |
| --- | --- | --- |
| Open windows on reload | built-unchecked | Browser step in `terminal-census-journey` with one window of two tabs; several windows have a unit test only, no screenshot; a window's frame by the desktop's own record. Closing the last window, or quitting, forgets them, unless General's Close windows when quitting is off |
| Tabs on reload | built-unchecked | Browser step: two tabs back, with their contents |
| Titles on reload | built-unchecked | Browser step: the Inspector's title back; a program's title too (no test) |
| Working directory on reload | built-unchecked | Browser step; a folder that has gone since runs `cd ~` (no test) |
| Scrollback on reload | built-unchecked | Browser step and unit test: text, styles and marks, with `Restored session:` after them as on a Mac. At most 60 KB across all tabs, the oldest lines of the longest tab first; what a full-screen program showed is not kept. A command that was running does not run on |
| History per account | built-unchecked | Browser step and unit test: ↑ finds the line after a reload; every new session starts with the account's last 500 lines |
| Profiles | built-unchecked | Unit test; with the person's settings, as `terminal.settings` |
| Preferences | built-unchecked | Unit test; the same value |
| Default profile | built-unchecked | Unit test and browser step |
| `.zshrc` | built-unchecked | See above. Kept per account with the desktop's settings |

## Cross-app

| Item | Status | Notes |
| --- | --- | --- |
| Finder: New Terminal at Folder | built-unchecked | Services on a folder in Finder: `e2e/finder-services-journey.mjs` |
| `open` launches apps | done: [terminal-mac.png](#project-artifact/art_a7e016210b9b9bc1/88) | `open -a TextEdit` |
| `open` opens files | built-unchecked | Not run in a browser |
| `pbcopy` writes the clipboard | done: [terminal-mac.png](#project-artifact/art_a7e016210b9b9bc1/88) | |
| `pbpaste` reads the clipboard | done: [terminal-mac.png](#project-artifact/art_a7e016210b9b9bc1/88) | |
| Dock tile | done: [open](#project-artifact/art_716ee2a8c8b4ca59/1) | Follows from `app.ts`; the journey opens Terminal from it |
| Activity Monitor lists it | built-unchecked | Follows from `app.ts`; not opened |
| Spotlight finds "Terminal" | built-unchecked | Follows from `app.ts`; not searched |

## Open work ledger

Adding `demos/terminal` makes `demos/desktop/desktop-library.test.ts` fail until `ferrite-apps/desktop/src/apps/catalogue.rs` lists `terminal`. That file is outside this work's paths.

## Build items, most used first

1. **Window, emulator, prompt.** Built. New `demos/terminal`: window, screen layer, scrollback, line editor with history; `echo`, `pwd`, `clear`, `exit`, `help`; `app.ts`; docs page, visual file with pixel checks only.
2. **Files on the drive.** Built: `ls`, `cd`, `cat`, tab completion, `mkdir`, `rmdir`, `touch`, `rm`, `mv`, `cp`. To come: `-i`, with the keyboard read.
3. **Shell syntax and text tools.** Pipes, redirection, `grep`, `head`, `tail`, `wc`, `sort` and `uniq` built. Not in this version: patterns, variables, `sed`, `less`; `.zshrc`. Each family one change.
4. **Copy, Paste, Select, Find, menu bar.** Built. Shell, Edit, View and Window; selection; Paste Escaped; Clear family; Find; marks.
5. **Tabs and split pane.** Built. ⌘T, ⌘D, Next Tab, Move Tab to New Window; several windows with the shell's help.
6. **Saved sessions and history.** Not built. New server module; restored windows, tabs, directories, scrollback.
7. **Profiles and Preferences.** Not built, except Bigger, Smaller and Default Font Size. Ten profiles, Text, Window, Shell tabs; Inspector; Edit Title; default.
8. **Mac commands.** Built: `open`, `pbcopy`, `pbpaste`, `say`, `osascript`, `node`, `mdfind`, `defaults`, `ps`, `date`, `uname`, `id`, `whoami`, `hostname`, and refusals of what needs a real computer. To come: `top`, `kill`, `man`, which need the shell's host and `less`.
9. **Full-screen programs.** Partly built in the emulator: alternate screen, Send Signal and Reset. Mouse reporting is left out; `less`, small `nano`, Show Alternate Screen and the terminate sheet are not here.
10. **Drag and context menu.** Not built. Path from Finder, folder on the Dock tile, context menu, New Terminal at Folder. Needs Finder worker.
11. **Export.** Not built. Export Text As, Print, settings import and export, New Command, `.command` from Finder.
12. **Help.** Not built. Help opens Help Viewer with a Terminal book. Items dimmed so far state their reasons.
