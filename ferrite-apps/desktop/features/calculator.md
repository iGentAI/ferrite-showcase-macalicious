# Feature inventory: Calculator

Main commit read: `e62c2ac9`, from GitHub only. Nothing was built or run.

Status: **missing**; **partial** (the note says what is absent); **built-unchecked** (in main's code, not yet seen running). No row is done: done needs a screenshot in a browser. Every status rests on main's source; a menu row's status includes its key equivalent. Scope is the hosted Ferrite desktop. Real-app wording, keys and the Scientific and Programmer layouts come from knowledge of macOS 10.15 (no Mac; captures show only the basic window) and are provisional. Services and the window list are generated lists, so each is one row.

Read: `demos/calculator/` (`app.ts`, `calculator.mdx`, `calculator.tsx`), `demos/desktop/desktop-menus.tsx`, the desktop README. The desktop registers **File** (Clear Tape, Save Tape As, Page Setup, Print Tape), **View**, **Convert**, **Speech** and **Window** (Show Paper Tape); "Shell" means the desktop's own row.

## Menus

| Menu | Item | Key | Status | Notes |
| --- | --- | --- | --- | --- |
| Calculator | About Calculator | | built-unchecked | Shell |
| Calculator | Services | | built-unchecked | The desktop's rows, on the text selected (`desktop-services.tsx`), read from the code; not run here |
| Calculator | Hide Calculator | ⌘H | built-unchecked | Shell |
| Calculator | Hide Others | ⌥⌘H | built-unchecked | Shell |
| Calculator | Show All | | built-unchecked | Shell |
| Calculator | Quit Calculator | ⌘Q | built-unchecked | Shell |
| File | Close | ⌘W | built-unchecked | Shell |
| File | Clear Tape | | built-unchecked | |
| File | Save Tape As… | ⇧⌘S | built-unchecked | Sheet with the drive's Save panel; a text file. `e2e/calculator-census-journey.mjs` |
| File | Page Setup… | ⇧⌘P | built-unchecked | Dimmed: "The browser's print dialog sets the page" |
| File | Print Tape… | ⌘P | built-unchecked | The browser's print dialog, through TextEdit's print frame |
| Edit | Undo | ⌘Z | done: [calculator-edit-menu.png](#project-artifact/art_778ce73f9cddf4bd/17) | |
| Edit | Redo | ⇧⌘Z | done: [calculator-edit-menu.png](#project-artifact/art_778ce73f9cddf4bd/17) | |
| Edit | Cut | ⌘X | done: [calculator-edit-menu.png](#project-artifact/art_778ce73f9cddf4bd/17) | |
| Edit | Copy | ⌘C | done: [calculator-edit-menu.png](#project-artifact/art_778ce73f9cddf4bd/17) | |
| Edit | Paste | ⌘V | done: [calculator-edit-menu.png](#project-artifact/art_778ce73f9cddf4bd/17) | |
| Edit | Delete | | done: [calculator-edit-menu.png](#project-artifact/art_778ce73f9cddf4bd/17) | |
| Edit | Select All | ⌘A | done: [calculator-selected.png](#project-artifact/art_778ce73f9cddf4bd/21) | |
| Edit | Speech ▸ Start Speaking | | built-unchecked | The display's selection or number; dimmed with the reason where the browser has no voice |
| Edit | Speech ▸ Stop Speaking | | built-unchecked | |
| View | Basic | ⌘1 | done: [calculator-view-menu.png](#project-artifact/art_778ce73f9cddf4bd/20) | |
| View | Scientific | ⌘2 | done: [calculator-scientific.png](#project-artifact/art_778ce73f9cddf4bd/19) | Window resizes |
| View | Programmer | ⌘3 | done: [calculator-programmer.png](#project-artifact/art_778ce73f9cddf4bd/15) | Window resizes |
| View | Show Thousands Separators | ⇧⌘T | done: [calculator-after-reload.png](#project-artifact/art_778ce73f9cddf4bd/16) | |
| View | Decimal Places ▸ 0 | | done: [calculator-view-menu.png](#project-artifact/art_778ce73f9cddf4bd/20) | Rounds; no padding (provisional) |
| View | Decimal Places ▸ 1 | | done: [calculator-view-menu.png](#project-artifact/art_778ce73f9cddf4bd/20) | |
| View | Decimal Places ▸ 2 | | done: [calculator-after-reload.png](#project-artifact/art_778ce73f9cddf4bd/16) | |
| View | Decimal Places ▸ 3 | | done: [calculator-view-menu.png](#project-artifact/art_778ce73f9cddf4bd/20) | |
| View | Decimal Places ▸ 4 | | done: [calculator-view-menu.png](#project-artifact/art_778ce73f9cddf4bd/20) | |
| View | Decimal Places ▸ 5 | | done: [calculator-view-menu.png](#project-artifact/art_778ce73f9cddf4bd/20) | |
| View | Decimal Places ▸ 6 | | done: [calculator-view-menu.png](#project-artifact/art_778ce73f9cddf4bd/20) | |
| View | Decimal Places ▸ 7 | | done: [calculator-view-menu.png](#project-artifact/art_778ce73f9cddf4bd/20) | |
| View | Decimal Places ▸ 8 | | done: [calculator-view-menu.png](#project-artifact/art_778ce73f9cddf4bd/20) | |
| View | Decimal Places ▸ 9 | | done: [calculator-view-menu.png](#project-artifact/art_778ce73f9cddf4bd/20) | |
| View | Decimal Places ▸ 10 | | done: [calculator-view-menu.png](#project-artifact/art_778ce73f9cddf4bd/20) | |
| View | Decimal Places ▸ 11 | | done: [calculator-view-menu.png](#project-artifact/art_778ce73f9cddf4bd/20) | |
| View | Decimal Places ▸ 12 | | done: [calculator-view-menu.png](#project-artifact/art_778ce73f9cddf4bd/20) | |
| View | Decimal Places ▸ 13 | | done: [calculator-view-menu.png](#project-artifact/art_778ce73f9cddf4bd/20) | |
| View | Decimal Places ▸ 14 | | done: [calculator-view-menu.png](#project-artifact/art_778ce73f9cddf4bd/20) | |
| View | Decimal Places ▸ 15 | | done: [calculator-view-menu.png](#project-artifact/art_778ce73f9cddf4bd/20) | The default |
| View | RPN Mode | ⌘R | built-unchecked | All three layouts; the window grows by the stack keys' row (provisional) |
| Convert | Recent Conversions | | built-unchecked | The last five; repeats one without a sheet |
| Convert | Area… | | built-unchecked | Sheet: category, From, To. Unit lists provisional. Every Convert row is dimmed with the reason in Programmer |
| Convert | Currency… | | built-unchecked | Sheet with the currencies of the European Central Bank's daily reference rates (30, the Mac's own list and source are not these), read and kept by the server (`/api/calculator/rates`), and “Last updated: <date>. European Central Bank reference rates.” With no rates it says why and Convert is dimmed; dimmed with the reason off the served desktop. Recent Conversions repeats a currency. Read against the bank's file directly: `e2e/weather-rates-batch13-journey.mjs`; the bank being down there is a stand-in in the browser's route for what `tests/weather_rates.rs` holds the server to. Screenshot not yet published |
| Convert | Energy or Work… | | built-unchecked | |
| Convert | Temperature… | | built-unchecked | |
| Convert | Length… | | built-unchecked | |
| Convert | Speed… | | built-unchecked | |
| Convert | Pressure… | | built-unchecked | |
| Convert | Weights and Masses… | | built-unchecked | |
| Convert | Power… | | built-unchecked | |
| Convert | Volume… | | built-unchecked | |
| Convert | Update Currency Exchange Rates… | | built-unchecked | Asks the bank now, at most once a minute for the whole application, and a sheet says what came of it; when the bank does not answer, the last rates stay in use under their own date (`tests/weather_rates.rs`). Same journey |
| Speech | Speaking Button Pressed | | built-unchecked | Web Speech; kept in `calculator.speakButtons`. A key typed as a function letter in Scientific is not said |
| Speech | Speak Result | | built-unchecked | Kept in `calculator.speakResults` |
| Window | Minimize | ⌘M | built-unchecked | Shell |
| Window | Show Paper Tape | ⌘T | built-unchecked | Off until the person opens it. A browser with its own tab strip keeps Control-T; the row works everywhere: `e2e/calculator-census-journey.mjs` |
| Window | Bring All to Front | | built-unchecked | Shell |
| Window | Window list | | built-unchecked | Shell |
| Help | Calculator Help | | built-unchecked | The desktop's row opens Help Viewer on a search for Calculator (`desktop-menus.tsx`) |

## Basic keypad

| Item | Status |
| --- | --- |
| 0 | built-unchecked |
| 1 | built-unchecked |
| 2 | built-unchecked |
| 3 | built-unchecked |
| 4 | built-unchecked |
| 5 | built-unchecked |
| 6 | built-unchecked |
| 7 | built-unchecked |
| 8 | built-unchecked |
| 9 | built-unchecked |
| Decimal point | built-unchecked |
| Add | built-unchecked |
| Subtract | built-unchecked |
| Multiply | built-unchecked |
| Divide | built-unchecked |
| Equals | built-unchecked |
| Equals pressed again repeats | built-unchecked |
| Percent | built-unchecked |
| Sign | built-unchecked |
| AC | built-unchecked |
| C | built-unchecked |
| Display scales long numbers | built-unchecked |
| Division by zero says "Not a number" | built-unchecked |
| Window dragged by the display | built-unchecked |

## Scientific keypad

| Item | Status |
| --- | --- |
| ( | done: [calculator-scientific.png](#project-artifact/art_778ce73f9cddf4bd/19) |
| ) | done: [calculator-scientific.png](#project-artifact/art_778ce73f9cddf4bd/19) |
| mc | done: [calculator-scientific.png](#project-artifact/art_778ce73f9cddf4bd/19) |
| m+ | done: [calculator-scientific.png](#project-artifact/art_778ce73f9cddf4bd/19) |
| m- | done: [calculator-scientific.png](#project-artifact/art_778ce73f9cddf4bd/19) |
| mr | done: [calculator-scientific.png](#project-artifact/art_778ce73f9cddf4bd/19) |
| 2nd | done: [calculator-scientific-second.png](#project-artifact/art_778ce73f9cddf4bd/18) |
| Rad / Deg | done: [calculator-scientific.png](#project-artifact/art_778ce73f9cddf4bd/19) |
| x² | done: [calculator-scientific.png](#project-artifact/art_778ce73f9cddf4bd/19) |
| x³ | done: [calculator-scientific.png](#project-artifact/art_778ce73f9cddf4bd/19) |
| xʸ | done: [calculator-scientific.png](#project-artifact/art_778ce73f9cddf4bd/19) |
| eˣ | done: [calculator-scientific.png](#project-artifact/art_778ce73f9cddf4bd/19) |
| 10ˣ | done: [calculator-scientific.png](#project-artifact/art_778ce73f9cddf4bd/19) |
| yˣ (2nd) | done: [calculator-scientific-second.png](#project-artifact/art_778ce73f9cddf4bd/18) |
| 2ˣ (2nd) | done: [calculator-scientific-second.png](#project-artifact/art_778ce73f9cddf4bd/18) |
| 1/x | done: [calculator-scientific.png](#project-artifact/art_778ce73f9cddf4bd/19) |
| √x | done: [calculator-scientific.png](#project-artifact/art_778ce73f9cddf4bd/19) |
| ∛x | done: [calculator-scientific.png](#project-artifact/art_778ce73f9cddf4bd/19) |
| ʸ√x | done: [calculator-scientific.png](#project-artifact/art_778ce73f9cddf4bd/19) |
| ln | done: [calculator-scientific.png](#project-artifact/art_778ce73f9cddf4bd/19) |
| log10 | done: [calculator-scientific.png](#project-artifact/art_778ce73f9cddf4bd/19) |
| logy (2nd) | done: [calculator-scientific-second.png](#project-artifact/art_778ce73f9cddf4bd/18) |
| log2 (2nd) | done: [calculator-scientific-second.png](#project-artifact/art_778ce73f9cddf4bd/18) |
| x! | done: [calculator-scientific.png](#project-artifact/art_778ce73f9cddf4bd/19) |
| sin | done: [calculator-scientific.png](#project-artifact/art_778ce73f9cddf4bd/19) |
| sin⁻¹ (2nd) | done: [calculator-scientific-second.png](#project-artifact/art_778ce73f9cddf4bd/18) |
| cos | done: [calculator-scientific.png](#project-artifact/art_778ce73f9cddf4bd/19) |
| cos⁻¹ (2nd) | done: [calculator-scientific-second.png](#project-artifact/art_778ce73f9cddf4bd/18) |
| tan | done: [calculator-scientific.png](#project-artifact/art_778ce73f9cddf4bd/19) |
| tan⁻¹ (2nd) | done: [calculator-scientific-second.png](#project-artifact/art_778ce73f9cddf4bd/18) |
| e | done: [calculator-scientific.png](#project-artifact/art_778ce73f9cddf4bd/19) |
| EE | done: [calculator-scientific.png](#project-artifact/art_778ce73f9cddf4bd/19) |
| sinh | done: [calculator-scientific.png](#project-artifact/art_778ce73f9cddf4bd/19) |
| sinh⁻¹ (2nd) | done: [calculator-scientific-second.png](#project-artifact/art_778ce73f9cddf4bd/18) |
| cosh | done: [calculator-scientific.png](#project-artifact/art_778ce73f9cddf4bd/19) |
| cosh⁻¹ (2nd) | done: [calculator-scientific-second.png](#project-artifact/art_778ce73f9cddf4bd/18) |
| tanh | done: [calculator-scientific.png](#project-artifact/art_778ce73f9cddf4bd/19) |
| tanh⁻¹ (2nd) | done: [calculator-scientific-second.png](#project-artifact/art_778ce73f9cddf4bd/18) |
| π | done: [calculator-scientific.png](#project-artifact/art_778ce73f9cddf4bd/19) |
| Rand | done: [calculator-scientific.png](#project-artifact/art_778ce73f9cddf4bd/19) |

## Programmer keypad

| Item | Status |
| --- | --- |
| Base 8 | done: [calculator-programmer-bits.png](#project-artifact/art_778ce73f9cddf4bd/13) |
| Base 10 | done: [calculator-programmer-bits.png](#project-artifact/art_778ce73f9cddf4bd/13) |
| Base 16 | done: [calculator-programmer.png](#project-artifact/art_778ce73f9cddf4bd/15) |
| Binary bit field | done: [calculator-programmer-bits.png](#project-artifact/art_778ce73f9cddf4bd/13) |
| ASCII display | done: [calculator-programmer.png](#project-artifact/art_778ce73f9cddf4bd/15) |
| Unicode display | done: [calculator-programmer.png](#project-artifact/art_778ce73f9cddf4bd/15) |
| AND | done: [calculator-programmer-bits.png](#project-artifact/art_778ce73f9cddf4bd/13) |
| OR | done: [calculator-programmer-bits.png](#project-artifact/art_778ce73f9cddf4bd/13) |
| NOR | done: [calculator-programmer-bits.png](#project-artifact/art_778ce73f9cddf4bd/13) |
| XOR | done: [calculator-programmer-bits.png](#project-artifact/art_778ce73f9cddf4bd/13) |
| << | done: [calculator-programmer-bits.png](#project-artifact/art_778ce73f9cddf4bd/13) |
| >> | done: [calculator-programmer-bits.png](#project-artifact/art_778ce73f9cddf4bd/13) |
| X<<Y | done: [calculator-programmer-bits.png](#project-artifact/art_778ce73f9cddf4bd/13) |
| X>>Y | done: [calculator-programmer-bits.png](#project-artifact/art_778ce73f9cddf4bd/13) |
| Byte flip | done: [calculator-programmer-bits.png](#project-artifact/art_778ce73f9cddf4bd/13) |
| Word flip | done: [calculator-programmer-bits.png](#project-artifact/art_778ce73f9cddf4bd/13) |
| RoL | done: [calculator-programmer-bits.png](#project-artifact/art_778ce73f9cddf4bd/13) |
| RoR | done: [calculator-programmer-bits.png](#project-artifact/art_778ce73f9cddf4bd/13) |
| 2's complement | done: [calculator-programmer-bits.png](#project-artifact/art_778ce73f9cddf4bd/13) |
| 1's complement | done: [calculator-programmer-bits.png](#project-artifact/art_778ce73f9cddf4bd/13) |
| A | done: [calculator-programmer-bits.png](#project-artifact/art_778ce73f9cddf4bd/13) |
| B | done: [calculator-programmer-bits.png](#project-artifact/art_778ce73f9cddf4bd/13) |
| C | done: [calculator-programmer-bits.png](#project-artifact/art_778ce73f9cddf4bd/13) |
| D | done: [calculator-programmer-bits.png](#project-artifact/art_778ce73f9cddf4bd/13) |
| E | done: [calculator-programmer-bits.png](#project-artifact/art_778ce73f9cddf4bd/13) |
| F | done: [calculator-programmer-bits.png](#project-artifact/art_778ce73f9cddf4bd/13) |
| FF | done: [calculator-programmer-bits.png](#project-artifact/art_778ce73f9cddf4bd/13) |
| 00 | done: [calculator-programmer-bits.png](#project-artifact/art_778ce73f9cddf4bd/13) |

## RPN

| Item | Status |
| --- | --- |
| Stack display | built-unchecked |
| Enter | built-unchecked |
| x↔y | built-unchecked |
| R↓ | built-unchecked |
| R↑ | built-unchecked |
| Drop | built-unchecked |

## Paper Tape

| Item | Status | Notes |
| --- | --- | --- |
| Window with lines | built-unchecked | Served desktop only |
| Starts closed | built-unchecked | Opens only from Window > Show Paper Tape or ⌘T; a calculation is recorded without opening it: `e2e/calculator-journey.mjs`, unit test `calculator.test.tsx` |
| Goes when Calculator's window closes | built-unchecked | Calculator quits with its window; minimizing leaves the tape up: `e2e/calculator-journey.mjs`, unit test `calculator.test.tsx` |
| Clear | built-unchecked | |
| Unsaved line shown in secondary colour | built-unchecked | |
| Live update between tabs | built-unchecked | `SERVER_CHANGE_EVENT` for `calculator` rereads the tape: unit test `calculator-menus.test.tsx`; the event itself is the desktop's, from another tab or browser. Not seen with two real tabs |

## Context menus

| Where | Item | Status |
| --- | --- | --- |
| Display | Copy | built-unchecked: unit test `calculator-menus.test.tsx`; the menu opened by a scratch browser check |
| Display | Speech ▸ Start Speaking | built-unchecked: unit test with a stand-in for the browser's voice; not heard |
| Display | Speech ▸ Stop Speaking | built-unchecked: the shared `SpeechItems` row; no test of its own |
| Tape | Copy | built-unchecked: unit test; the lines selected, or the whole tape; the menu opened by a scratch browser check |
| Tape | Clear | built-unchecked: unit test |

## Keys outside the menus

| Key | Status |
| --- | --- |
| Digit keys | built-unchecked |
| . | built-unchecked |
| , | built-unchecked |
| + | built-unchecked |
| - | built-unchecked |
| * | built-unchecked |
| / | built-unchecked |
| = | built-unchecked |
| Return | built-unchecked |
| % | built-unchecked |
| Option-minus | built-unchecked |
| Escape | built-unchecked |
| C | built-unchecked |
| Delete | built-unchecked |
| Letter keys in Programmer | done: [calculator-programmer.png](#project-artifact/art_778ce73f9cddf4bd/15) |
| Letter keys in Scientific | built-unchecked |

## Drag and drop, multi-selection

| Item | Status | Notes |
| --- | --- | --- |
| Drag a number onto the display | built-unchecked | Text that reads as one number replaces the display, other text is ignored: unit test with synthetic drag events |
| Drag the display's value out | built-unchecked | Select the number, then drag it; a press elsewhere on the display still moves the window: unit test with synthetic drag events |
| Select several tape lines | built-unchecked | Click, Shift-click, Command-click, arrows, Command-A and Command-C in the tape: unit test of the clicks, and Shift-click by a scratch browser check; the keys no test |

## Saved state

| Item | Status | Notes |
| --- | --- | --- |
| Paper tape survives reload | done: [calculator.png](#project-artifact/art_a7e016210b9b9bc1/83) | `/api/calculator/tape`; the display comes back too, and goes on being used |
| Display and memory in the last moment before a reload | built-unchecked | `pagehide` writes at once, and memory arriving after a first key is kept while the display stays the person's: unit test |
| A sum wholly in parentheses on the tape | built-unchecked | `(1+2)=` writes `( 1 + 2 ) = 3`; `2×(3+4) x² =` writes `2 × 49 = 98`: unit test. `(1+2) x² =` writes no line, as a function of a lone number does not |
| Very small sine and cosine in radians | built-unchecked | sin(1e-20) is 1e-20; only a nonzero multiple of π/2, to within 4 units of rounding, is made exact: unit test. So a tangent within those units of π/2 shows Not a number, past the 15 digits the display writes |
| Layout | done: [calculator-scientific-after-reload.png](#project-artifact/art_778ce73f9cddf4bd/12) | Desktop values, `calculator.layout`; the window's size follows |
| Paper Tape open or closed | built-unchecked | Desktop values, `calculator.tapeOpen`, read back from the server and across a reload and a quit: `e2e/calculator-journey.mjs` |
| RPN mode | built-unchecked | Desktop values, `calculator.rpn`; the stack, like a sum in progress, is not kept |
| Thousands separators | done: [calculator-after-reload.png](#project-artifact/art_778ce73f9cddf4bd/16) | Desktop values, `calculator.separators` |
| Decimal places | done: [calculator-after-reload.png](#project-artifact/art_778ce73f9cddf4bd/16) | Desktop values, `calculator.decimals` |
| Value on the display | done: [calculator-after-reload.png](#project-artifact/art_778ce73f9cddf4bd/16) | Desktop values, `calculator.saved`; not a sum in progress |
| Memory | done: [calculator-scientific-after-reload.png](#project-artifact/art_778ce73f9cddf4bd/12) | Desktop values, `calculator.saved` |
| Recent conversions | built-unchecked | Desktop values, `calculator.recentConversions` |

## Cross-app

| Item | Status | Notes |
| --- | --- | --- |
| Copy to other apps | done: [calculator-copy-to-notes.png](#project-artifact/art_778ce73f9cddf4bd/10) | Notes |
| Paste from other apps | done: [calculator-paste-from-notes.png](#project-artifact/art_778ce73f9cddf4bd/11) | Notes |
| Spotlight's result opens Calculator | built-unchecked | `spotlight-desktop.tsx` |
| Spotlight's result copies the value | built-unchecked | Same |
| Help Viewer page | built-unchecked | Stale row: Help Viewer has a Calculator guide (`help-viewer-guides.ts`) and Help > Calculator Help opens it (`desktop-menus.tsx`); read from the code, not run here |

## Open work ledger

No open item for Calculator. Spotlight's plurals and small-number precision are done.

## Calls made

- Currency's source is the European Central Bank's keyless daily file, through the egress handle `rates`, declared down to that file. The list of currencies is the bank's, not the Mac's.
- The engine stays on floating point; Programmer uses BigInt for 64 bits.
- RPN Mode has four registers and a row of four stack keys in every layout. No capture shows the real layout; both are provisional.
- The Scientific letter keys are s, o, t (sine, cosine, tangent), l, g (ln, log10), r (square root), !, ^, e, p (π) and E (EE), from memory of the real app and provisional.

## Build items, most used first

1. **Copy and Paste with an Edit menu.** Register Edit; ⌘C, ⌘V; Undo; selectable display. Check: paste 42 from Notes.
2. **View menu and saved settings.** Basic, separators, Decimal Places; desktop values rather than a new route; restore display and memory. Check: reload.
3. **Scientific layout.** Window resizes, keypad as listed, engine with tests against known values.
4. **Programmer layout.** Base, bit field, logic and shifts with BigInt, ASCII and Unicode display.
5. **RPN mode.** Built: `calculator-rpn.ts`.
6. **Convert menu.** Built: `calculator-convert.ts`, and `calculator-rates.ts` for currency.
7. **Paper Tape commands.** Save Tape As, Print Tape and ⌘T built; the tape starts closed and its state is kept; live update remains.
8. **Speech menu.** Built: `calculator-speech.tsx`.
9. **Help.** Help opens Help Viewer; `calculator.mdx` updated.
10. **Context menus.** Display and tape rows.
