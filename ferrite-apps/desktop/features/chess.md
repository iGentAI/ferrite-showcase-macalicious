# Feature inventory: Chess

Main commit read: `e62c2ac9`, from GitHub only. Nothing was run, so no row is done. Files read: `demos/chess/app.ts`, `chess.tsx`, `chess-live.tsx`, menus and sheets of `chess-account.tsx`, the start of `chess.mdx`, `demos/desktop/desktop-menus.tsx`.

Status: **missing**, **partial** (the note says what is absent), or **built-unchecked** (in main's code, not yet seen running). The real app's list comes from knowledge of macOS 10.15 Chess, not from a Mac. "Call" marks a decision made here.

Calls:
- The board's 3D view is original: squares in the chosen colours (no wood, no Apple artwork), turned pieces made from profiles in `chess-meshes.ts` and drawn with WebGL, no dependency added. It is what Chess opens on where WebGL runs on graphics hardware, as the real app shows only a 3D board; Preferences' View keeps the flat board too, and without it (no WebGL, or only a software renderer, which stalled the page for up to 1.3 s in `chess-account.browser.test`) the choice is dimmed and the board is flat. Board and piece styles apply to both.
- The ledger notes that Chess clocks were cut and survive only in an earlier version. They are added here as a feature to consider recovering, not landed blindly.
- A saved game is a PGN file on the person's drive, which is the format the real app reads and writes.
- Speech: Speak moves says each new move of the person's own games with the browser's speech, dimmed with the reason in a browser that has none. Listen for Spoken Commands is off until chosen, since recognition may send audio to the browser's vendor (the checkbox's help says so), listens only while the Chess window is key, and is dimmed with the reason in a browser with no recognizer. Resign is not speakable, so a misheard word cannot end a game.

## Menus

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 1 | Chess > About Chess | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/82), [Window menu](#project-artifact/art_3f7380b0451dc3ac/81) |
| 2 | Chess > Preferences… | done | A window of its own: View, Board, Pieces, the computer's usual strength, Show my side at the bottom, each kept on the server. Choosing it while the window is open but behind Chess brings it to the front, and so does ⌘,; `rows-batch23-journey`, no picture of that filed. [Preferences](#project-artifact/art_3f7380b0451dc3ac/52) |
| 3 | Chess > Services | built-unchecked | With no text selected "No Services Apply", as on a Mac; text selected in the window gets the desktop's services (`ServicesItems`) |
| 4 | Chess > Hide Chess | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/82), [Window menu](#project-artifact/art_3f7380b0451dc3ac/81) |
| 5 | Chess > Hide Others | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/82), [Window menu](#project-artifact/art_3f7380b0451dc3ac/81) |
| 6 | Chess > Show All | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/82), [Window menu](#project-artifact/art_3f7380b0451dc3ac/81) |
| 7 | Chess > Quit Chess | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/82), [Window menu](#project-artifact/art_3f7380b0451dc3ac/81) |
| 8 | Game > New Game… ⌘N | done | The row opens the sheet, with a clock to choose. `chess-rows-journey`. [Sheet](#project-artifact/art_3f7380b0451dc3ac/241) |
| 9 | Game > Games… | built-unchecked | Not on the real menu; kept |
| 10 | Game > Resign | built-unchecked | `chess-rows-journey` ends the game with it and tells the other player; no picture of it was kept |
| 11 | Game > Open… ⌘O | done | The drive's Open panel, for `.pgn` files; shows the game read-only, with Back and Forward. [Opened](#project-artifact/art_3f7380b0451dc3ac/38) |
| 12 | Game > Open Recent | built-unchecked | Submenu of the last ten saved games opened, with Clear Menu, kept per account. `chess-menu-rows.test.tsx` holds the list; `media-batch-journey` read the empty menu; opening one from it was not run |
| 13 | Game > Close Window ⌘W | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/82), [Window menu](#project-artifact/art_3f7380b0451dc3ac/81) |
| 14 | Game > Save ⌘S | done | Dimmed, saying games keep themselves on this desktop; read by the journey. [Saved](#project-artifact/art_3f7380b0451dc3ac/40) |
| 15 | Game > Save As… ⇧⌘S | done | Writes a PGN file to Downloads under a free name, says where, and Open reads it back. Dimmed with no moves. [Saved](#project-artifact/art_3f7380b0451dc3ac/40) |
| 16 | Game > Print… | built-unchecked | ⌘P and the row print the players, the position as the board faces and the moves, from a frame of their own. `media-batch-journey` read the page; the paper itself was not seen |
| 17 | Edit > Undo | built-unchecked | Acts on a text field; dimmed elsewhere, saying why, read by `media-batch-journey`. Shows ⌘Z, as Take Back Move does: on the board the key takes back |
| 18 | Edit > Redo | built-unchecked | The desktop's shared rows, on a text field; not run on one here |
| 19 | Edit > Cut | built-unchecked | The desktop's shared rows, on a text field; not run on one here |
| 20 | Edit > Copy | built-unchecked | The desktop's shared rows: a text field, or text selected in the Game Log; not run here |
| 21 | Edit > Paste | built-unchecked | The desktop's shared rows, on a text field; not run on one here |
| 22 | Edit > Select All | built-unchecked | The desktop's shared rows, on a text field; not run on one here |
| 23 | Moves > Take Back Move ⌘Z | done | Your last move and the computer's answer go, read back from the server and kept over a reload; playing Black, the computer's opening stays. Games against the computer only; dimmed otherwise, saying why. [Taken back](#project-artifact/art_3f7380b0451dc3ac/53) |
| 24 | Moves > Show Last Move ⌘L | done | [Points at the last move](#project-artifact/art_1d4436ba6fe5f30d/3); the status line names it. The menu row itself was not clicked, only ⌘L |
| 25 | Moves > Show Hint | done | Gives a clue first. Show Suggested Move then names and marks the legal move. The hosted Chrome journey checks both stages on the player's turn. |
| 26 | Moves > Force Computer Move | built-unchecked | Available on the computer's turn to shorten its search: chosen there and answered, dimmed on the player's turn. `small-apps-batch3-journey`. The time saved was not measured |
| 27 | Moves > Previous Move | done | Steps back. `chess-rows-journey`. [Moves](#project-artifact/art_3f7380b0451dc3ac/242) |
| 28 | Moves > Next Move | done | Steps on. `chess-rows-journey`. [Moves](#project-artifact/art_3f7380b0451dc3ac/242) |
| 29 | View > Rotate Board ⌘R | done | Kept across a reload; the arrows go as the squares stand, a drag moves by the squares' names, read from the server. [Turned](#project-artifact/art_1d4436ba6fe5f30d/6) |
| 30 | Window > Game Log | done | Opens and closes the log, kept over a reload. [Log](#project-artifact/art_3f7380b0451dc3ac/39) |
| 31 | View > Enter Full Screen | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/82), [Window menu](#project-artifact/art_3f7380b0451dc3ac/81) |
| 32 | Window > Minimize | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/82), [Window menu](#project-artifact/art_3f7380b0451dc3ac/81) |
| 33 | Window > Zoom | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/82), [Window menu](#project-artifact/art_3f7380b0451dc3ac/81) |
| 34 | Window > Bring All to Front | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/82), [Window menu](#project-artifact/art_3f7380b0451dc3ac/81) |
| 35 | Window > window list | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/82), [Window menu](#project-artifact/art_3f7380b0451dc3ac/81) |
| 36 | Help > Chess Help | built-unchecked | Opens Help Viewer on Chess's guide. `chess-rows-journey`. [Help](#project-artifact/art_3f7380b0451dc3ac/257) |

Menus: 36 rows; 23 done, 11 built-unchecked, 2 partial.

## Views and windows

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 37 | Board and complete rules | built-unchecked | |
| 38 | Title follows the game | done | Names the players and the side to move, after a reload too. `chess-rows-journey`. [Reloaded](#project-artifact/art_3f7380b0451dc3ac/243) |
| 39 | Status line | built-unchecked | |
| 40 | Promotion sheet | done | Makes the piece chosen, read from the board. `chess-rows-journey`. [Sheet](#project-artifact/art_3f7380b0451dc3ac/258) |
| 41 | Claim Draw | done | Draws the game on the third repetition. `chess-rows-journey`. [Claim](#project-artifact/art_3f7380b0451dc3ac/254) |
| 42 | New Game sheet: computer at four levels, or an account | done | `chess-rows-journey`. [Sheet](#project-artifact/art_3f7380b0451dc3ac/241) |
| 43 | Games sheet | done | `chess-rows-journey`. [Games](#project-artifact/art_3f7380b0451dc3ac/256) |
| 44 | Replay | done | Opens a finished game from its start, and Next Move plays its first move. `chess-rows-journey`. [Replay](#project-artifact/art_3f7380b0451dc3ac/259) |
| 45 | Invitations: Accept, Decline | built-unchecked | Accept runs in `chess-rows-journey` ([accepted](#project-artifact/art_3f7380b0451dc3ac/244)); Decline in `small-apps-batch3-journey`, the sender told and the server's list holding it declined. No screenshot of Decline |
| 46 | Open board `?game=` | built-unchecked | |
| 47 | 3D board | built-unchecked | Perspective board with turned pieces, with reflections and shadows; the same grid of squares is tilted under the canvas, so clicks, drags, keys and marks are the flat board's, read back from the server in `chess-rows-batch15-journey` (34 steps) in Chromium and in Playwright's WebKit, with the journey letting the page use the sandbox's software renderer: no run had graphics hardware, so its speed there is unmeasured. Rotate Board swings it; a drag on the frame or backdrop moves the camera, kept over a reload. Limits: seen correctly in Chromium only. In Playwright's WebKit on Linux the journey's steps pass but its screenshots paint the squares with no perspective, so the pieces stand off their squares; the likely cause is that build's unaccelerated painting, and Safari itself was not run. No keyboard path for the camera; touch and forced colours not run; the horizon is straight where the capture's curves. Call: the camera tilts from 0 to 70 degrees. A piece slides to its square, except one a drag has carried there. Only `.out/chs15` holds its screenshots: none is in the library yet. |
| 48 | Board and piece styles | done | Four flat boards and two sets of flat pieces, in place of the wooden and marble ones. [Preferences](#project-artifact/art_3f7380b0451dc3ac/52) |
| 49 | Game Log window | done | A floating panel at the stage's right edge: every move in notation, the computer's too; choosing one shows the board there. Floating, not the real app's ordinary window, because Chess's window is too wide to leave it beside. [Log](#project-artifact/art_3f7380b0451dc3ac/39) |
| 50 | Speech | built-unchecked | Speak moves as before. Preferences' Listen for Spoken Commands takes moves ("pawn e2 to e4", "knight to c3", "e takes d5", "castle kingside") and Take Back Move, Show Last Move, Show Hint, Rotate Board and New Game through the browser's recognizer (`desktop-speech.ts`); the status line answers. Stand-in: `chess-voice.test.tsx` and `chess-rows-batch15-journey` replace the recognizer with a stub given the words; nothing was really heard, and no real recognizer or microphone was run |
| 51 | Variants: Crazyhouse, Suicide, Losers | built-unchecked | New Game offers all three, with rules on the page and on the server. A Crazyhouse drop was run in a browser and read back from the server. Losers and Suicide were each played by two people in a browser: the server lists the game under its variant, the board refuses a move while a capture is there to make, the server refuses the same move with 409, and the capture is played and read back (`media-small-batch8-journey`). A game of either was not played to its end in a browser; that rests on the unit tests. Call: a pawn does not promote to a king in Suicide. [Dropped](#project-artifact/art_3f7380b0451dc3ac/93) |
| 52 | Clocks | done | Call: an addition, the real app has none. 1, 5, 10 or 30 minutes each. The server charges each move, starts an invitation's clock when it is accepted, and ends a game at 0:00, seen in a browser and held by `facetime_chess`. [Running](#project-artifact/art_3f7380b0451dc3ac/95), [out of time](#project-artifact/art_3f7380b0451dc3ac/94) |
| 53 | A server reply closes only its own sheet | done | [Games stays open](#project-artifact/art_c9443d16a033da1b/11), filed with the Music shots because the library is nearly full |
| 54 | Computer search in a Web Worker | built-unchecked | |

Views: 18 rows; 10 done, 7 built-unchecked, 1 partial.

## Context menus

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 55 | Board menu: Hint, Take Back, Rotate | built-unchecked | Take Back clicked in `chess-take-back-journey.mjs`; Rotate clicked in this menu in `small-apps-batch3-journey`, the board turned. [Board menu](#project-artifact/art_1d4436ba6fe5f30d/4) |
| 56 | Games list menu: Open, Delete, Export | done | A secondary click chooses the row and offers Open or Replay, Export… to Downloads, and Delete…. [Row menu](#project-artifact/art_3f7380b0451dc3ac/55) |

Context menus: 2 rows; 1 done, 1 built-unchecked.

## Keyboard shortcuts

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 57 | Arrow keys, Home, End, Return, Space, Escape on the board | built-unchecked | Home, End and Return ran in `chess-rows-journey` ([board](#project-artifact/art_3f7380b0451dc3ac/242)); each arrow, Space and Escape in `small-apps-batch3-journey` |
| 58 | ⌘N | built-unchecked | Opens New Game in `chess-depth-journey.mjs` and `small-apps-batch3-journey`, run in Chromium with Control, as the library maps ⌘ off a Mac |
| 59 | ⌘Z | done | Takes back, in `chess-take-back-journey.mjs`, run in Chromium with Control. [Taken back](#project-artifact/art_3f7380b0451dc3ac/53) |
| 60 | ⌘L | done | [Points at the last move](#project-artifact/art_1d4436ba6fe5f30d/3) |

Keys: 4 rows; 2 done, 2 built-unchecked.

## Drag and drop

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 61 | Drag a piece to move | done | [Dragged pawn](#project-artifact/art_1d4436ba6fe5f30d/2); `chess-depth-journey.mjs`: a legal drop reaches the server, an illegal drop changes nothing, a press released outside the board lifts nothing, click-to-move still works. Touch not run |
| 62 | Drop a PGN file from Finder | built-unchecked | Dropped on the board with real mouse input, its moves shown: `small-apps-batch3-journey` |

Drag: 2 rows; 1 done, 1 built-unchecked.

## Multi-selection

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 63 | Several games in the Games sheet: delete | done | Command-click, Shift-click, ⌘A, arrows and Delete. Delete asks first, and a game between people still in play stays until it is resigned or declined. The other player keeps their copy. [Several chosen](#project-artifact/art_3f7380b0451dc3ac/54) |

Multi-selection: 1 row; 1 done.

## Saved state

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 64 | Games on the server | done | The server holds a game's ending, read back. `chess-rows-journey`. [Reloaded](#project-artifact/art_3f7380b0451dc3ac/243) |
| 65 | The open game after a reload | done | Open again. `chess-rows-journey`. [Reloaded](#project-artifact/art_3f7380b0451dc3ac/243) |
| 66 | Preferences: style, level, rotation | done | Kept as the person's settings, over a reload. A game as Black shows Black at the bottom when asked; Rotate Board turns from there. New Game's strength is the same setting. [Preferences](#project-artifact/art_3f7380b0451dc3ac/52) |

Saved state: 3 rows; 3 done.

## Cross-app

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 67 | Notification on the opponent's move or invitation | done | The other player's move, resignation or lost time arrives as a notification. The banner was seen in a browser, and the inbox read in `facetime_chess`. [Banner](#project-artifact/art_3f7380b0451dc3ac/92) |
| 68 | Invite from Messages or Contacts | built-unchecked | Messages' Buddies > Invite to Chess… opens New Game on that person, and the other account receives the invitation (`chess-invite-journey`): [New Game](#project-artifact/art_3f7380b0451dc3ac/217), [received](#project-artifact/art_3f7380b0451dc3ac/218). From a card: Contacts' commands pull-down > Invite to Chess… does the same for a card with an account on this desktop, and is dimmed with its reason on one without (`open-items-batch6-journey`) |
| 69 | Spotlight finds a game | done | Lists it under Chess Games and opens it. `media-spotlight-journey`. [Spotlight](#project-artifact/art_3f7380b0451dc3ac/219) |
| 70 | Dock menu | done | Opens Games. `chess-rows-journey`. [Dock menu](#project-artifact/art_3f7380b0451dc3ac/255) |
| 71 | Open a PGN from Finder | built-unchecked | A double-click in Finder opens the game in Chess: `small-apps-batch3-journey` |

Cross-app: 5 rows; 3 done, 2 built-unchecked.

## Build items, most-used first

1. **Ledger: a reply closes only its own sheet,** with its missing test. Row 53.
2. **Drag a piece to move.** Row 61.
3. **Moves menu:** Take Back, Show Last Move, Hint, Force Computer Move, keys, ⌘N. Rows 8, 23-26, 55, 58-60.
4. **Rotate Board and Preferences:** level, styles, kept. Rows 2, 29, 48, 66.
5. **Game Log window.** Rows 30, 49.
6. **PGN:** Open, Open Recent, Save As, print, drop and open from Finder. Rows 11-12, 14-16, 62, 71.
7. **Games list:** row menu, delete, multi-select. Rows 56, 63.
8. **Notifications, invitations, Spotlight, Dock.** Rows 67-70.
9. **Clocks,** starting from the earlier version, reviewed anew. Row 52.
10. **Variants.** Row 51.
11. **Dimmed rows with reasons.** Rows 17-22, 36, 47, 50.

## Counts (by hand)

71 rows: 44 done, 24 built-unchecked, 3 partial.
