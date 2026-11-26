# Feature inventory: Spotlight

Main commit read: `e62c2ac9` (29 October 2026), from GitHub only. Nothing was run. Open ledger items are carried in the rows marked "Ledger".

Sources read: `demos/spotlight/spotlight-desktop.tsx`, `spotlight.mdx`; `demos/desktop/desktop-overlays.tsx`; the desktop README's Spotlight section; the open work ledger, version 3; `desktop-overlays-census-journey.mjs`. Not read: `src/apps/spotlight/` on the server, `spotlight-journey.mjs`. Rows about them come from the ledger or the README. The real app's list comes from knowledge of macOS 10.15.

Status key: **missing**, **partial** (the note says what is absent), **built-unchecked** (in main's code, not seen running for this inventory). Nothing is done until it is checked in a browser with a screenshot.

**Counts: 57 rows: 40 done, 17 built-unchecked.**

## Opening and closing (7: 6 done, 1 built-unchecked)

| Item | Status | Main |
| --- | --- | --- |
| Menu bar extra | done | [Opens it](#project-artifact/art_a7e016210b9b9bc1/468): `e2e/spotlight-more-journey.mjs` |
| ⌘Space | done | Bound where a page gets the key, and Control-Option-Space on a Mac, where the system takes it; the menu bar extra's tooltip says so: `e2e/spotlight-keys-journey.mjs` |
| Escape clears, then closes | done | [Cleared by the first](#project-artifact/art_a7e016210b9b9bc1/468), closed by the second, same journey |
| A press beside it closes | done | [Closed](#project-artifact/art_a7e016210b9b9bc1/471), same journey |
| Drag the window; its place is kept | done | Moves by its field, or by its text field while that is empty, within reach; kept per account across closing it and a reload, read back from the server. Holding its menu bar item down for a second puts it back: `e2e/spotlight-place-journey.mjs` |
| Resize to see more results | built-unchecked | The bottom edge makes the results taller or shorter, up to 720 points and clear of the Dock, kept the same way: `e2e/spotlight-place-journey.mjs`. Moved low, the window stops where its edge stays above the Dock, across a reload too: `e2e/cross-batch7-journey.mjs` |
| Query is still there when reopened at once | done | Kept for a minute when it closes without opening anything: `e2e/spotlight-keys-journey.mjs` |

## What it finds (24: 16 done, 8 built-unchecked)

| Item | Status | Main |
| --- | --- | --- |
| Applications | done | [By name; the exact name is the Top Hit](#project-artifact/art_a7e016210b9b9bc1/463): `e2e/spotlight-more-journey.mjs` |
| Contacts | done | [A card in its group or as the Top Hit, naming the app that opens it](#project-artifact/art_a7e016210b9b9bc1/644): `e2e/spotlight-rows-journey.mjs` |
| Mail Messages | done | [Listed](#project-artifact/art_a7e016210b9b9bc1/644), same journey. The capped note (`mailNote`, newest 200) was not driven |
| Events | done | [Listed](#project-artifact/art_a7e016210b9b9bc1/644), same journey |
| Reminders | done | [Listed](#project-artifact/art_a7e016210b9b9bc1/644), same journey |
| Notes | done | [Listed](#project-artifact/art_a7e016210b9b9bc1/644), same journey. Titles only when locked was not driven |
| Stickies | done | [Listed](#project-artifact/art_a7e016210b9b9bc1/644), same journey |
| Documents (TextEdit) | done | [Listed, previewed with its words](#project-artifact/art_a7e016210b9b9bc1/643), same journey |
| Files and folders | built-unchecked | Found by names, tags and words. The note under the results says how many text files went unsearched: driven in `e2e/spotlight-people-journey.mjs` with the search's reply answered by the journey, since a drive past 100 text files takes minutes to make; screenshot not yet published |
| Bookmarks & History | done | [A bookmark listed](#project-artifact/art_a7e016210b9b9bc1/644), same journey. History was not driven |
| Music | done | [A song, with its artist and album](#project-artifact/art_a7e016210b9b9bc1/645), same journey |
| Photos | done | [An album listed](#project-artifact/art_a7e016210b9b9bc1/645), same journey |
| Definition | done | [One word, three letters or more; Return opens Dictionary on it](#project-artifact/art_a7e016210b9b9bc1/462), same journey |
| Calculator | done | [Answered, and Return copies it and opens Calculator](#project-artifact/art_a7e016210b9b9bc1/475), same journey |
| Conversion | built-unchecked | [Units answered](#project-artifact/art_a7e016210b9b9bc1/469), same journey. Currency: `100 usd to eur`, `$5 in yen`, `20 pounds to euros` answer at the European Central Bank's daily rates, from the server, to the hundredth, with the rates' date and source in the preview, and “Exchange rates aren't available” when they cannot be read: `e2e/weather-rates-batch13-journey.mjs`, `spotlight-currency.test.ts`. An amount with no target currency (`100 usd`) lists nothing, where a Mac lists several. Screenshot not yet published |
| Search the Web | done | [Offered for the words](#project-artifact/art_a7e016210b9b9bc1/645), same journey. Hand-off is below |
| Messages | built-unchecked | The person's own conversations, the newest 30, each as far as its document goes (100 messages): listed with the newest message that holds the words. Return opens a one-to-one conversation in Messages. Another member finds it, someone else finds nothing, and after Delete Conversation it is not found: `e2e/spotlight-people-journey.mjs` and `spotlight/sources.rs` tests; screenshot not yet published. Shared rooms are not searched. A group's conversation opens through `openItem`, as a one-to-one does |
| FaceTime recent calls | built-unchecked | The newest call with each person, saying how it went: same journey. Return opens FaceTime and rings nobody; FaceTime does not take `openItem` yet |
| Books | built-unchecked | The books of the person's library, by title and author: same journey. Return opens Books; Books does not take `openItem` yet |
| Help topics | built-unchecked | Help's topics by title, up to five, previewed with their summary; a double-click opens Help Viewer on a search for the topic: same journey. Search Results' Other turns them off. They are never the Top Hit |
| System Preferences panes | done | [By name; Return opens the pane](#project-artifact/art_a7e016210b9b9bc1/474), same journey |
| Kinds of file: Images, PDF, Movies, Presentations | built-unchecked | [Images](#project-artifact/art_819e645e9197a100/61), PDF Documents, Movies and Music Files are groups of their own: `e2e/spotlight-keys-journey.mjs`. Presentations, by the name (`.key`, `.ppt`, `.pptx`, `.pps`, `.ppsx`, `.odp`) since the drive has no kind for them: unit test `spotlight-desktop.test.tsx`, not driven |
| Fonts, Developer | done | [Font Book's families, and Return selects one there](#project-artifact/art_a7e016210b9b9bc1/465); [a program under Developer](#project-artifact/art_a7e016210b9b9bc1/464), same journey |
| Suggestions: Weather, News, Stocks, Maps | built-unchecked | [Capitals, or a word before “stock”, ask Stocks for a quote](#project-artifact/art_a7e016210b9b9bc1/466), from a stub of the quotes route in the journey since it must not depend on a feed; Search Maps hands the words to Maps. News: stories of the channels the person follows that hold the words, up to three, from what the News module serves, opening at the publisher in Safari: `e2e/cross-batch7-journey.mjs` (its feeds answered by a stand-in, since the real ones are publishers outside the app), `spotlight-suggestions.test.ts`. Weather: `weather in Paris`, `Paris weather`, or `weather` for the person's first place, with days, source and time in the preview, and Return shows the place in Maps, where a Mac opens weather.com: `e2e/weather-rates-batch13-journey.mjs`, from Open-Meteo. Search Results' Siri Suggestions turns these off |

## Using the results (14: 8 done, 6 built-unchecked)

| Item | Status | Main |
| --- | --- | --- |
| Up and Down | done | [The next result selected](#project-artifact/art_a7e016210b9b9bc1/473): `e2e/spotlight-more-journey.mjs` |
| ⌘Up, ⌘Down between groups | done | Same journey and picture; Control where Command is Control |
| Return opens the result | built-unchecked | [A contact shows its own card, not the first in the list](#project-artifact/art_819e645e9197a100/43), through `useOpenItemRequests` in `desktop-open-item.ts`: `e2e/spotlight-journey.mjs`, and a note, open or not, a sticky note and a word in `e2e/spotlight-open-journey.mjs`. A file opens in its app. Calendar, on an event 40 days from the one shown, in `calendar-reminders-batch4-journey`. A reminder, a mail message, a photo album, a font and a song, each with Return, in `e2e/dictation-batch5-journey.mjs` |
| A drive file above Search the Web | built-unchecked | Results come before the web and Maps rows in the list: `e2e/dictation-batch5-journey.mjs` reads a file's place above Search the Web |
| ⌘Return shows in Finder | done | [The file selected in its folder](#project-artifact/art_819e645e9197a100/44), `e2e/spotlight-journey.mjs`. An application shows the Applications folder, unit-untested and not driven |
| Double click opens | done | [A text file in TextEdit](#project-artifact/art_a7e016210b9b9bc1/472): `e2e/spotlight-more-journey.mjs` |
| Top hit and completion | done | [The exact name, then the start of a name, then the start of a word, first and selected](#project-artifact/art_a7e016210b9b9bc1/463), out of its own group: same journey and `spotlight-suggestions.test.ts`. A title holding the text inside a word is no Top Hit. No stemming, fuzzy match or learning from what is opened |
| Preview by kind | built-unchecked | [A picture shows itself](#project-artifact/art_819e645e9197a100/61) and a text file its words: `e2e/spotlight-keys-journey.mjs`. A contact shows its card, every number and address: `e2e/spotlight-people-journey.mjs`. A kept place shows its map tile with a mark: unit test `spotlight-found.test.tsx`, not driven, since it asks OpenStreetMap |
| ⌘I Get Info, ⌘L Dictionary, ⌘B web | done | ⌘I on a selected file opens its Info. ⌘L and ⌘B take what was typed, whatever is selected, as on a Mac: Dictionary's field and Safari's tab are read back in `e2e/spotlight-keys-journey.mjs` |
| Drag a result into an app or Finder | built-unchecked | A file takes the shared desktop drag and Spotlight closes out of its way: `e2e/spotlight-keys-journey.mjs`. An event is an `.ics` and a contact a `.vcf`, written from the stored document when it lands: the event dropped on Finder read from the drive in `calendar-reminders-batch4-journey`, the contact in `spotlight-drag.test.ts`. Other kinds have no file form and do not drag |
| Show All in Finder | done | The search in a Finder window: `e2e/spotlight-keys-journey.mjs` |
| ⌘C copies a result | done | Unless text is selected in the field, which is the field's: `e2e/spotlight-keys-journey.mjs` |
| Picked result resets on a new query | built-unchecked | The pick clears as the query changes and the first result is selected: `e2e/spotlight-people-journey.mjs`; screenshot not yet published |
| Indexing under way is shown | built-unchecked | Asks up to 12 times, enough for 100 text files, and the note under the results says it is still reading: same journey, with the search's reply answered by the journey; screenshot not yet published |

## Hand-offs (6: 6 done)

| Item | Status | Main |
| --- | --- | --- |
| Web search and bookmarks to Safari | done | Through `desktop-open-url.ts`: an open window takes the address as a new tab, and a closed one opens with it, so nothing rewrites Safari's list behind it. `e2e/spotlight-journey.mjs` reads the tab back from the server. A bookmark goes the same way, not driven |
| Text file to TextEdit | done | [Opened](#project-artifact/art_a7e016210b9b9bc1/472): `e2e/spotlight-more-journey.mjs` |
| Other file to Finder, selected | done | [Selected in its folder](#project-artifact/art_a7e016210b9b9bc1/461), same journey |
| Picture and PDF to Preview | done | [A picture](#project-artifact/art_a7e016210b9b9bc1/460), and a PDF, opened in Preview by Return, same journey |
| Sum: copies and opens Calculator | done | [Answered](#project-artifact/art_a7e016210b9b9bc1/475); Calculator opens, same journey. The copy's failure is ignored |
| Definition opens Dictionary | done | [On the word](#project-artifact/art_a7e016210b9b9bc1/462), same journey |

## Settings and data (3: 3 done)

| Item | Status | Main |
| --- | --- | --- |
| Per-person index; other accounts see none | done | [A second account's Spotlight lists none of it for the same word](#project-artifact/art_a7e016210b9b9bc1/642), and its search on the server returns nothing: `e2e/spotlight-rows-journey.mjs`; also `tests/system_apps_b16.rs` |
| Spotlight pane's Search Results choices take effect | done | [Boxes switched off in the pane](#project-artifact/art_a7e016210b9b9bc1/476), kept on the server, and [what they cover is left out](#project-artifact/art_a7e016210b9b9bc1/470) across a reload: `e2e/spotlight-more-journey.mjs` |
| Privacy list takes effect | done | [A folder dragged to the list keeps its files out](#project-artifact/art_a7e016210b9b9bc1/477), across a reload, and − brings them back: `e2e/spotlight-privacy-journey.mjs` |

## Server and journey items from the ledger (3: 1 done, 2 built-unchecked)

| Item | Status | Main |
| --- | --- | --- |
| Markup scanner and script text | built-unchecked | Script and style contents, comments and attribute values are no words, a `>` in a quoted value or a comment does not end the tag, and a lone `<` stays text: `strip_markup` and its tests in `spotlight/sources.rs`. Server only |
| Rust tests for stale entries | built-unchecked | A renamed file's old name and an edited or removed bookmark's words are not found: `a_renamed_file_and_a_changed_bookmark_are_found_by_what_they_say_now` in `spotlight/sources.rs`. Nothing is kept to go stale but the words of a file's content, which go by content |
| Journey checks the window's results | done | `e2e/spotlight-journey.mjs` looks for the contact, sticky note, `Spring plan.txt` and bookmark inside their groups |

## Build items, most used first

1. **S1 Ledger fixes in the window.** Hand web searches to Safari through `desktop-open-url.ts`; clear the pick on a new query; keep asking while indexing or show it; say when text files went unsearched; correct the "Opens in" text.
2. **S2 Open the item.** Return opens the contact, note, event, message or photo itself through C2's `openItem`, with each app's worker taking the request; ⌘Return reveals in Finder.
3. **S3 Preview by kind.** Picture, file text, contact card, event, message, as `spotlight-preview.tsx` already does for the demo.
4. **S4 Ranking and kinds.** Top Hit, ordering, kinds of file as groups, Show All in Finder.
5. **S5 Keys and window.** A stand-in opening key shown in the extra's tooltip, moving and resizing, ⌘I, ⌘L, ⌘B, ⌘C, dragging a result (C1).
6. **S6 Sources and settings.** System Preferences panes, Fonts, Search Results and Privacy take effect.
7. **S7 Server and tests.** Markup scanner; Rust tests for renames and bookmarks; journey asserts items in their groups. Ledger assigned these to the server and front end threads, so check they have not moved before starting.
