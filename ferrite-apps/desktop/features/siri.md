# Feature inventory: Siri

Main commit read: `e62c2ac9` (29 October 2026), from GitHub only. Nothing was run.

Sources read: `demos/desktop/desktop-siri.tsx`, `desktop-overlays.tsx`, `desktop.tsx`; `ferrite-apps/desktop/src/apps/siri/commands.rs`; `demos/siri/siri.mdx` (first half); `e2e/siri-journey.mjs`, `desktop-overlays-census-journey.mjs`; the open work ledger, version 3. Not read: `siri/mod.rs`, `siri/model.rs`. The real app's list comes from knowledge of macOS 10.15.

Status key: **missing**, **partial** (the note says what is absent), **built-unchecked** (in main's code, not seen running for this inventory). Nothing is done until it is checked in a browser with a screenshot.

Free-form answers need an Anthropic key only the owner holds. The owner's decision is to show them as unavailable and carry on, so they are not a build item. The ledger has no other open Siri item.

**Counts: 53 rows: 35 done, 15 built-unchecked, 3 partial.**

## The window (14: 9 done, 4 built-unchecked, 1 partial)

| Item | Status | Main |
| --- | --- | --- |
| Menu bar extra | done | [Opens the window](#project-artifact/art_a7e016210b9b9bc1/648): `e2e/siri-rows-journey.mjs` |
| Dock tile on the served desktop | done | [Opened from its tile](#project-artifact/art_a7e016210b9b9bc1/631), same journey |
| Close button | done | [In the window's corner](#project-artifact/art_a7e016210b9b9bc1/631), and pressed the window goes, same journey |
| Type to Siri | done | [Every request here was typed](#project-artifact/art_a7e016210b9b9bc1/630), same journey |
| Orb listens where the browser recognises speech | built-unchecked | `siri.listen` |
| Speaks answers to spoken requests | built-unchecked | |
| Help lists examples | done | [In a card](#project-artifact/art_a7e016210b9b9bc1/634), same journey |
| Example buttons ask | done | [Five before anything is asked](#project-artifact/art_a7e016210b9b9bc1/631), and one pressed makes its note, read back from the server, same journey |
| Hold ⌘Space, or a stand-in key | done | [Holding Spotlight's key opens Siri](#project-artifact/art_a7e016210b9b9bc1/479), Control-Option-Space where the system takes ⌘Space, unless Siri is off: `e2e/siri-more-depth-journey.mjs` |
| Move the window | done | [By any part that is no control](#project-artifact/art_a7e016210b9b9bc1/481), kept per account and across a reload, same journey |
| Pin a result to Today | built-unchecked | [Add to Today under an answer keeps its words](#project-artifact/art_a7e016210b9b9bc1/350), at the end of Today until removed, whole, and refused with a reason when the setting has no room, on the server: `e2e/siri-depth-journey.mjs`. A pin that only reads (the time, the date, the calendar, reminders) is asked again when Today shows it and each minute after, keeping its words if no answer comes; any other pin stays as it was, since asking again could repeat an action, and is never asked: `e2e/small-rows-batch9-journey.mjs` |
| Earlier answers scroll back | done | [Words of up to 20 earlier answers](#project-artifact/art_a7e016210b9b9bc1/317), while the window stays open: `e2e/siri-reach-journey.mjs`, [with the rows of their cards, which still open](#project-artifact/art_a7e016210b9b9bc1/480): `e2e/siri-more-depth-journey.mjs` |
| "Hey Siri" | built-unchecked | While the page is open, once turned on in Siri's pane, off by default and dimmed with its reason where the browser has no recognizer: the browser's recognizer listens for the phrase, the words after it go to Siri as a spoken request, and with none Siri opens and listens. It gives way to Siri's orb and Start Dictation and comes back after; a browser's refusal turns it off and the pane says why. It listens through the browser's service, which may send what it hears to its maker, so it is only ever on by the person's choice, and the checkbox says so. `e2e/rows-batch17-journey.mjs`, `desktop-speech.test.ts`. Stand-in: a stub replaces the recognizer, so nothing was heard; a real microphone prompt, a real browser's restarts and how it treats a page in the background were not run. Not in a page that is closed or asleep |
| Voice feedback choice | built-unchecked | `siriSpeaks`: the pane's Off keeps a spoken answer on the screen. Not driven: a headless browser has no speech |

## What it understands (29: 19 done, 9 built-unchecked, 1 partial)

From `commands.rs`, rule by rule.

| Item | Status | Main |
| --- | --- | --- |
| Open an app by name | done | Calculator opens, and [one the desktop lacks is refused](#project-artifact/art_a7e016210b9b9bc1/640): `e2e/siri-rows-journey.mjs` |
| Dark, light and auto appearance | done | [Dark mode on](#project-artifact/art_a7e016210b9b9bc1/641), and off again, each read from the page, same journey. Auto was not driven here |
| The time | done | [Answered](#project-artifact/art_a7e016210b9b9bc1/630), same journey |
| The date | done | [“What is today's date”, the month and day checked](#project-artifact/art_a7e016210b9b9bc1/635), same journey |
| Sums in words | done | [“What is 6 times 7”](#project-artifact/art_a7e016210b9b9bc1/632), same journey. Numbers spelled out, “six times seven” or “twenty-one plus three hundred and five”, too: `e2e/spotlight-people-journey.mjs` and `siri/commands.rs` tests |
| Greetings | done | [Answered, with things to ask](#project-artifact/art_a7e016210b9b9bc1/636), same journey |
| Reminders: add, complete, list | done | [Listed in a card](#project-artifact/art_a7e016210b9b9bc1/633); added and completed, each read back from the server, same journey |
| Calendar: add and read a day | done | [The day read back](#project-artifact/art_a7e016210b9b9bc1/629), the event read from the server, same journey |
| Notes: make and list | done | [Listed](#project-artifact/art_a7e016210b9b9bc1/637), the note read from the server, same journey |
| Stickies: add | done | [Said](#project-artifact/art_a7e016210b9b9bc1/638), and read from the server, same journey |
| Messages to the shared room | built-unchecked | "Tell everyone" |
| Contacts: find and read a number | done | [The card with the number](#project-artifact/art_a7e016210b9b9bc1/639), same journey |
| Message one person | built-unchecked | Opens Messages on the account named on the person's card, or the name as it is said, with the words ready for the person to send; two cards of one name ask which: `desktop-siri-message.test.ts`, not driven |
| FaceTime someone | built-unchecked | “FaceTime Ada” or “audio call Ada” places the call from FaceTime, by the same names: `desktop-siri-message.test.ts`, not driven |
| Find files | done | By name or words inside, through Spotlight's search. Journey `siri-more`, [file card](#project-artifact/art_819e645e9197a100/50) |
| Open questions | built-unchecked | Who or what something is: “Who was Ada Lovelace?” says the article's first sentence and shows its introduction, credited, from Wikipedia through Dictionary's egress (`siri-journey` against the real site; unit tests). Anything else without a model provider says none is set up, and lists what it can do: a free answer to any question needs a model, which needs the owner's key |
| Search the web | done | Opens in Safari. Journey `siri-more` |
| Weather | built-unchecked | “What's the weather in Paris?”, “will it rain in Rome tomorrow”, or “weather” for the person's first place: said from the server, with a card of today's high and low, the days ahead, and “Open-Meteo, as of <time> local time”. With no place named or chosen and no location granted it asks where; with the source down it says so: `e2e/weather-rates-batch13-journey.mjs`, `desktop-siri-answers.test.ts`. It does not ask the browser for the location itself, as a Mac's asks Location Services; the widget's Use My Location does. Screenshot not yet published |
| Mail: read, send, draft | built-unchecked | Reading: “check my mail” says how many unread messages the inbox has among those Mail's list reads, who the newest is from and its subject, each opening in Mail: `e2e/spotlight-people-journey.mjs`, `desktop-siri-read-mail.test.ts`; it does not read a message's text aloud. Draft: a new message to an address or to a person in Contacts, with its subject from “about…”, `e2e/siri-depth-journey.mjs`. Send: with “saying…” Siri holds the message on its card, addressed to the card's account, and Send or “send it” sends it, read from the other person's Inbox; Cancel sends nothing, and a refusal says the server's words and keeps the message: `e2e/desktop-batch3-journey.mjs` |
| Music: play, pause, next | built-unchecked | Play, pause, next and previous on the page's player; with nothing loaded it opens Music and says so: `e2e/siri-reach-journey.mjs`. “play <name>” finds a real song through Spotlight, shows it in Music and plays it, its time moving, and “pause the music” pauses it: `e2e/small-rows-batch12-journey.mjs` |
| Settings other than appearance: Do Not Disturb, others | done | Do Not Disturb on and off, journey `siri-more`. [Mute, volume, brightness and hiding the Dock](#project-artifact/art_a7e016210b9b9bc1/482), written where their panes keep them and read back from the server: `e2e/siri-more-depth-journey.mjs`. Wi-Fi and Bluetooth: it says a page cannot change them |
| Find photos | built-unchecked | Filters Spotlight's results to photos; unit test only |
| Directions, places | done | A place opens in Maps through its search, `e2e/siri-reach-journey.mjs`. “Directions to”, “take me to” and the like ask Maps for a route to the first place found, Directions showing: `e2e/siri-depth-journey.mjs`, with the place search answered by the journey (it goes to a service outside the app) |
| Files by date or kind | done | PDFs, pictures, movies, sound files or files, from today, yesterday, this or last week or month, newest first, read from the drive: `e2e/siri-depth-journey.mjs` |
| Open a Preferences pane | done | By the pane's name. Journey `siri-more` |
| Time elsewhere | done | Any city the browser has a time zone for, answered on the desktop. Journey `siri-more` |
| Definitions | built-unchecked | Uses Spotlight's dictionary lookup, which needs outside access; not driven |
| Stocks | done | A symbol's or a company's quote, [with a card leading on the price](#project-artifact/art_a7e016210b9b9bc1/351), that opens Stocks, or says it could not get one: `e2e/siri-depth-journey.mjs`, the company search and the quote answered by the journey (they go to a service outside the app) |
| Follow-ups ("change it to 5") | built-unchecked | “What about Tokyo”, “and tomorrow” and “how about MSFT” take the request before them, and “open it” opens what the answer listed: `e2e/siri-depth-journey.mjs`. The window keeps what Siri last made while it is open: “change it to 5” moves that reminder or event (a bare hour keeps its side of noon), and other words become its title, or a note's or sticky's text, on the app's own document. With nothing made in this conversation it says it cannot. `e2e/cross-batch7-journey.mjs`, `siri/change.rs` unit tests |

## Answers (6: 5 done, 1 built-unchecked)

| Item | Status | Main |
| --- | --- | --- |
| A card with its items | done | [Reminders in a card](#project-artifact/art_a7e016210b9b9bc1/633), same journey |
| Open button on a card | done | [Open Reminders](#project-artifact/art_a7e016210b9b9bc1/633), pressed it opens Reminders, same journey |
| A row opens its item | done | Files open in their app, contacts in Contacts; Notes through `openItem`. Journey `siri-more`, [file card](#project-artifact/art_819e645e9197a100/50) |
| Rich cards by kind | built-unchecked | [A stock's price](#project-artifact/art_a7e016210b9b9bc1/351), a city's time and a word lead their cards. One person's card leads on the name with every number and address: `e2e/spotlight-people-journey.mjs`. “Where is…” shows the first place on a map tile: `desktop-siri-read-mail.test.ts`, not driven, since it asks a service outside the app |
| Drag a result out | done | [A file in a card, dropped on an app's tile, opens there](#project-artifact/art_a7e016210b9b9bc1/478), Siri closing out of its way: `e2e/siri-more-depth-journey.mjs`. Only files drag |
| Copy an answer | done | [The Copy button under an answer](#project-artifact/art_a7e016210b9b9bc1/317), `e2e/siri-reach-journey.mjs` |

## Settings and data (4: 2 done, 1 built-unchecked, 1 partial)

| Item | Status | Main |
| --- | --- | --- |
| Another account sees none of it | done | [That account's Siri says it has no notes](#project-artifact/art_a7e016210b9b9bc1/647), and its notes on the server hold none of it: `e2e/siri-rows-journey.mjs`. Only notes were compared |
| One key per request: a retry acts once | done | The same request sent twice with one key, from the page's script, makes [one sticky](#project-artifact/art_a7e016210b9b9bc1/649), counted on the server and in Stickies, same journey |
| Siri pane: enable, language, voice, shortcut | partial | Enable and Show in menu bar take effect. Language is chosen in the pane among the six the recognizer is asked for by name; `rows-batch28-journey` reads the choice from the server and the `lang` asked of a stub recognizer and a stub of speech synthesis, so nothing was heard or spoken. In a language other than English the pane says Siri still understands and answers in English, as the server's commands are English. Voice: the pop-up lists the accents this browser has voices for, dimmed with why when it has none (headless Chromium on Linux has none). **Limits:** a browser promises a voice's language, not its gender, so there is no Female or Male here. Keyboard Shortcut: Hold Command Space, Hold Option Space and Press Left Command Key Twice open Siri (`siri-shortcut-journey`, `desktop-siri-settings.test.ts`; real key holds on a real Mac not run). A page never sees Fn, so that choice is left out and the pane says so; a Mac keeps Command-Space for itself, so there Control-Option-Space held stands in |
| Dictation pane takes effect | built-unchecked | Edit > Start Dictation listens with the recogniser Siri uses (`desktop-speech.ts`), where the browser has one, and types at the insertion point: `e2e/dictation-batch5-journey.mjs`. Keyboard > Dictation has On and Off, and a language. Dictation starts Off, as on a Mac: with it off, Start Dictation and the pane's On ask "Do you want to enable Dictation?" with Cancel and Enable Dictation, and enabling from the menu starts listening in the field. The language is what the recognizer is asked for. `rows-batch28-journey` reads both, with a stub of speech recognition, so nothing real was heard. **Limit:** the Shortcut pop-up stays dimmed, as a page cannot see the Fn key |

## Build items, most used first

1. **X1 More commands.** Web search, Preferences panes, Do Not Disturb, Music controls, photo and file search, definitions, stocks, time elsewhere, a Mail draft. Each uses the existing module and is tested in `commands.rs` as today.
2. **X2 Answers that open.** A card row opens its item through C2's `openItem`; rich cards by kind; copy; drag out with C1; pin to Today with N2.
3. **X3 Conversation.** Earlier answers scroll back; simple follow-ups about the last item.
4. **X4 Reach and settings.** Stand-in key, moving the window, Siri pane takes effect.
