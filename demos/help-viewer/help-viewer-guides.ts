import { type HelpSection, type HelpTopic, mentions } from "./help-viewer-data";

/*
 * Short guides to the desktop's applications, written for this desktop: each is a book in Help
 * Viewer on the served desktop, beside the server's, and what the application's Help menu opens.
 * The text says what the application's menus do here: `e2e/help-guides-journey.mjs` opens every
 * "Choose <menu> > <row>" in the application's own menus and reads the key it names.
 */

/** What a link on a page does: opens an application, or a pane of System Preferences. */
export type HelpAction = { label: string; app: string } | { label: string; pane: string };

type Pages = readonly (readonly [title: string, summary: string, ...body: string[]])[];

function guide(name: string, summary: string, ...topics: Pages): HelpSection {
  return book(`guide:${name.toLowerCase().replaceAll(" ", "-")}`, `${name} Help`, summary, topics);
}

const macBook = (id: string, title: string, summary: string, ...topics: Pages) =>
  book(`mac:${id}`, title, summary, topics);

function book(id: string, source: string, summary: string, topics: Pages): HelpSection {
  return {
    id,
    title: source,
    summary,
    topics: topics.map(([title, text, ...body], at) => ({
      id: `${id}:${at + 1}`,
      title,
      summary: text,
      body,
      source,
    })),
  };
}

export const APP_GUIDES: readonly HelpSection[] = [
  guide(
    "Notes",
    "Write notes, keep them in folders and find them again.",
    [
      "Write a note",
      "Choose File > New Note, or press Command-N, and start typing.",
      "To link some text, select it and choose Edit > Add Link, or press Command-K.",
    ],
    [
      "Keep notes in folders",
      "Choose File > New Folder, or press Shift-Command-N, then name the folder.",
      "Drag a note onto a folder to move it there.",
    ],
    [
      "Add a picture or a text file to a note",
      "Drag a picture, or a text file of up to 50 KB, from Finder into the note.",
    ],
    ["Find text in a note", "Press Command-F, then type what you want to find."],
  ),
  guide(
    "TextEdit",
    "Write and format documents, and find words in them.",
    [
      "Find and replace text",
      "Choose Edit > Find > Find, or press Command-F, and type what you want to find.",
      "To change what you find, choose Find and Replace, or press Option-Command-F.",
    ],
    [
      "Open a document you used recently",
      "Choose File > Open Recent, then choose the document.",
      "To empty the list, choose Clear Menu at its end.",
    ],
    ["Send a document", "Choose File > Share, then choose Mail or Messages."],
  ),
  guide(
    "Terminal",
    "Open shell windows and tabs, and clear what they show.",
    [
      "Open a window or a tab",
      "Choose Shell > New Window, or press Command-N. Choose Shell > New Tab, or press Command-T, for a tab in the same window.",
    ],
    [
      "Clear the window",
      "Press Command-K to clear to the start. Press Option-Command-K to clear the scrollback.",
    ],
  ),
  guide(
    "Calculator",
    "Basic, scientific and programmer calculations, with a paper tape.",
    [
      "Change the calculator's layout",
      "Choose View > Scientific, or press Command-2, for the scientific keys. Choose View > Programmer, or press Command-3, for bases and bits.",
    ],
    [
      "See your calculations on the tape",
      "Choose Window > Show Paper Tape, or press Command-T.",
      "To empty the tape, choose File > Clear Tape.",
    ],
  ),
  guide("Finder", "Browse the files on your desktop's drive.", [
    "Open another Finder window",
    "Choose File > New Finder Window, or press Command-N. Each window shows its own folder.",
  ]),
  guide(
    "Safari",
    "Browse the web and keep pages to read later.",
    [
      "Open another Safari window",
      "Choose File > New Window, or press Command-N. Each window has its own tabs.",
    ],
    [
      "Choose what the Share menu lists",
      "The Share menu of every app lists the services turned on in the Extensions pane of System Preferences.",
    ],
  ),
  guide(
    "Stickies",
    "Keep short notes on the desktop.",
    ["Make a note", "Choose File > New Note, or press Command-N."],
    ["Make text bold", "Select the text, then choose Font > Bold, or press Command-B."],
  ),
  guide(
    "Dictionary",
    "Look up words in the dictionary, the thesaurus and Wikipedia.",
    [
      "Look up a word",
      "Type the word in the search field. To search again without losing this entry, choose File > New Window, or press Command-N.",
    ],
    ["Find a word in an entry", "Press Command-F, then type the word."],
  ),
  guide(
    "Mail",
    "Write, find and keep messages, and bring in mailboxes.",
    [
      "Write a message",
      "Choose File > New Message, or press Command-N.",
      "To send a file with it, choose File > Attach Files, or press Shift-Command-A.",
    ],
    [
      "Find text in a message",
      "Choose Edit > Find > Find, or press Command-F.",
      "Choose Edit > Find > Find Next, or press Command-G, to go to the next match.",
    ],
    [
      "See only some of your mail",
      "Choose View > Filter > Enable Message Filter, or press Command-L, to list unread mail only.",
      "The same submenu has Flagged, With Attachments and From VIPs.",
    ],
    [
      "Keep messages as files",
      "Choose File > Save As, or press Shift-Command-S. One message is saved as an .eml file, and several as an mbox.",
    ],
    [
      "Bring in a mailbox",
      "Choose File > Import Mailboxes, then choose an mbox file from your computer. It becomes a mailbox of its name under On My Mac.",
    ],
  ),
  guide(
    "Messages",
    "Talk with the other accounts of this desktop, and keep what was said.",
    ["Start a conversation", "Choose File > New Message, or press Command-N."],
    [
      "See who a conversation is with",
      "Choose Buddies > Show Info, or press Command-I.",
      "Choose Buddies > Add to Contacts to open Contacts on a card for the other person.",
    ],
    [
      "Move between conversations",
      "Press Command-1 to Command-9 to go to one of the conversations the Buddies menu lists.",
      "Choose Buddies > Next Conversation or Buddies > Previous Conversation to step through them.",
    ],
    [
      "Keep a transcript",
      "Choose File > Save Transcript to download a text file of who said what, with the messages the window has loaded.",
    ],
    [
      "Change the size of the text",
      "Choose View > Make Text Bigger, or press Command-Equals. Choose View > Make Text Normal Size, or press Command-0, to go back.",
    ],
  ),
  guide(
    "Contacts",
    "Keep cards for the people you know, in groups.",
    [
      "Add a card",
      "Choose File > New Card, or press Command-N.",
      "To change a card later, choose Card > Edit Card, or press Command-L.",
    ],
    [
      "Put cards in groups",
      "Choose File > New Group, or press Shift-Command-N, then type the group's name in the sidebar.",
      "Choose File > New Smart Group, or press Option-Command-N, for a group that fills itself by rules.",
    ],
    [
      "Bring cards in and take them out",
      "Choose File > Import, or press Command-O, to read a vCard from your computer.",
      "Choose File > Export > Export vCard to write the card shown or the names selected.",
    ],
    [
      "Merge cards of one person",
      "Choose Card > Look for Duplicates. It finds cards of one name, whatever the case.",
    ],
  ),
  guide(
    "Calendar",
    "Keep events in calendars, see them by day, week, month or year, and subscribe to others.",
    [
      "Add an event",
      "Choose File > New Event, or press Command-N. A browser may keep Control-N for itself: then use the menu.",
      "To change a selected event, choose Edit > Edit Event, or press Command-E.",
    ],
    [
      "Change what you see",
      "Choose View > By Day, or press Command-1. Choose View > By Week, or press Command-2. Choose View > By Month, or press Command-3. Choose View > By Year, or press Command-4.",
      "Choose View > Go to Date, or press Shift-Command-T, to jump to a day.",
    ],
    [
      "Add a calendar",
      "Choose File > New Calendar, and type its name in the sheet.",
      "Choose File > New Calendar Subscription, or press Option-Command-S, and give the calendar's address in the sheet.",
    ],
    [
      "Bring in events",
      "Choose File > Import to read an .ics file from your computer, or File > Import from Drive to choose one on your drive.",
    ],
  ),
  guide(
    "Reminders",
    "Keep lists of things to do, with dates, flags and sub-reminders.",
    [
      "Add a reminder",
      "Choose File > New Reminder, or press Command-N.",
      "Choose Edit > Flag, or press Shift-Command-F, to flag the one selected.",
    ],
    [
      "Add lists and groups",
      "Choose File > New List, or press Shift-Command-N.",
      "Choose File > New Group, and type a name, to gather lists in a group.",
    ],
    [
      "Put a reminder under another",
      "Choose Edit > Indent, or press Command-Right Bracket. Choose Edit > Outdent, or press Command-Left Bracket, to take it out again.",
    ],
    ["See what you have finished", "Choose View > Show Completed. The same row hides them again."],
    [
      "Write a list out and read one in",
      "Choose File > Import to read an .ics file into the list shown. The Export row under it writes the list shown as an .ics file.",
    ],
  ),
  guide(
    "Photos",
    "Import your pictures, sort them into albums and look through them by date.",
    [
      "Bring in pictures",
      "Choose File > Import, or press Shift-Command-I, to review the files first and then import them.",
    ],
    [
      "Make an album",
      "Choose File > New Album, or press Command-N, then name it in the sheet.",
      "Choose File > New Smart Album, or press Option-Command-N, for one that keeps itself full from rules. Choose File > New Folder, or press Shift-Command-N, to gather albums.",
    ],
    [
      "Look through your library",
      "Choose View > Years, or press Command-1. Choose View > Months, or press Command-2. Choose View > Days, or press Command-3. Choose View > All Photos, or press Command-4.",
    ],
    [
      "Change a picture",
      "Choose Image > Rotate Left, or press Command-R. Choose Image > Enhance, or press Command-E.",
      "Choose Image > Get Info, or press Command-I, to see what is known about it.",
    ],
  ),
  guide(
    "Music",
    "Add your own songs, make playlists and control what plays.",
    [
      "Add songs",
      "Choose File > Import, or press Command-O, and choose the files.",
      "Choose Song > Song Info, or press Command-I, to see and change what is known about a song.",
    ],
    [
      "Make a playlist",
      "Choose File > New > Playlist, or press Command-N.",
      "Choose File > New > Playlist from Selection, or press Shift-Command-N, for one holding the songs you selected. Choose File > New > Smart Playlist, or press Option-Command-N, for one that fills itself by rules.",
    ],
    [
      "Listen to music",
      "Press Space to pause and play again.",
      "Choose Controls > Next, or press Command-Right Arrow. Choose Controls > Previous, or press Command-Left Arrow. Choose Controls > Increase Volume, or press Command-Up Arrow.",
    ],
    [
      "See what is coming",
      "Choose View > Show Up Next, or press Control-Command-U. Choose Window > Switch to MiniPlayer, or press Shift-Command-M, for a small window.",
    ],
    ["Find every key", "Choose Help > Keyboard Shortcuts for a sheet of the menus' keys."],
  ),
  guide(
    "Podcasts",
    "Follow shows by their feeds and play their episodes.",
    ["Add a show by its address", "Choose File > Add a Show by URL. A sheet reads the feed first."],
    [
      "Get the newest episodes",
      "Choose View > Refresh, or press Command-R, to read every followed feed again.",
    ],
    [
      "Move through an episode",
      "Choose Controls > Skip Forward or Controls > Skip Back. Preferences set how far each one goes.",
      "Controls > Playback Speed lists the seven speeds, with the current one checked.",
    ],
    ["Search", "Choose Edit > Find, or press Command-F, to give the search field the keyboard."],
  ),
  guide(
    "News",
    "Read the stories of the channels you follow, from their public feeds.",
    [
      "Choose your channels",
      "Open Discover Channels in the sidebar, and use Follow beside a channel.",
      "Choose Story > Block Channel to stop seeing a channel's stories.",
    ],
    [
      "Keep a story",
      "Choose Story > Save Story, or press Command-S. Saved Stories in the sidebar lists it.",
    ],
    [
      "Read the whole story",
      "News shows a feed's summary. Choose Story > Open in Safari to read the story at its source.",
    ],
    [
      "Get the latest stories",
      "Choose View > Reload, or press Command-R. Choose View > Go to Today to see the leads of the channels you follow.",
    ],
  ),
  guide(
    "Home",
    "Keep a home, its rooms, scenes and automations. The accessories are simulated.",
    [
      "What Home does here",
      "This desktop has no HomeKit, so Home finds no accessories and switches nothing in the world. What you add is a simulated record kept on the server.",
      "Sharing a home needs another person's Apple ID, so Invite is dimmed in Home Settings.",
    ],
    [
      "Add accessories and rooms",
      "Choose File > Add Accessory, then name it and choose its room. Choose File > New Room for a room.",
      "Secondary-click a tile for its settings, or drag it onto a room in the Rooms view.",
    ],
    [
      "Make a scene and run it",
      "Choose File > Add Scene, then click its tile to run it. Secondary-click the tile to choose what it does to each accessory.",
    ],
    [
      "Automate a scene",
      "Choose View > Automation, or press Command-3, and click Add Automation. An automation runs at a time of day, or when an accessory is switched, while the Home window is open.",
    ],
  ),
  guide(
    "Network Utility",
    "Real DNS and registry lookups, and what a web service cannot do.",
    [
      "Look up a name",
      "Lookup asks a public DNS-over-HTTPS resolver. Choose the record type above the field, type a name, and press Return.",
    ],
    [
      "Find who holds a domain",
      "Whois asks a registry over RDAP, for names under .com, .net and .org, and for addresses ARIN manages.",
    ],
    [
      "What is not the real thing",
      "A web service has no sockets. Ping shows an HTTPS round trip, labelled as such, to the hosts the application declares. Traceroute, Finger and Port Scan say why they cannot run. Info and Netstat show only what the browser can say.",
    ],
    [
      "Keep what a tool printed",
      "Choose File > Save Output, or press Command-S, for a text file. Choose File > Print, or press Command-P, to print it.",
    ],
  ),
  guide(
    "Stocks",
    "Follow a watchlist of symbols with live quotes, and set price alerts.",
    [
      "Add a symbol",
      "Choose Edit > Find, or press Command-F, and type a name or symbol. Add puts it on your watchlist.",
    ],
    [
      "Remove a symbol",
      "Select it, then press the Delete key or choose Edit > Delete.",
      "Choose Edit > Edit Watchlist to show a remove button and a drag grip on every row.",
    ],
    [
      "Change a chart's range",
      "Press Command-1 to Command-7, or choose one of the range rows in the View menu, while a symbol is shown.",
    ],
    [
      "Be told about a price",
      "Choose Add Price Alert in a watchlist row's menu. The server checks the alert against the real quote, and tells you in Notification Center.",
    ],
    ["Get new quotes", "Choose View > Refresh, or press Command-R."],
  ),
  guide(
    "Maps",
    "Find places on OpenStreetMap's map, get directions and keep the places you like.",
    [
      "Find a place",
      "Choose Edit > Find, or press Command-F, type what you want and press Return.",
      "Choose View > Go to Current Location, or press Command-L, to see where your browser is.",
    ],
    [
      "Get directions",
      "Choose View > Directions, or press Command-R, to open the panel. It shows a route's time, length and steps, by car or on foot.",
    ],
    [
      "Mark a place",
      "Choose Edit > Drop Pin, or press Shift-Command-D, to drop a pin in the middle of the map. Choose Edit > Remove Pin to take it away.",
    ],
    [
      "Keep places",
      "The heart on a place's card adds it to your Favorites. New Guide and the card's Add to Guide keep places in a named list.",
    ],
    [
      "Take the map with you",
      "Choose File > Export as PDF for a PDF of the map as shown, with its pins and route.",
      "Map is the only type here: Transit and Satellite are dimmed, and each says why.",
    ],
  ),
  guide(
    "TV",
    "Watch open films, YouTube links and your own home videos.",
    [
      "Change section",
      "Press Command-1 to Command-5, or choose a section in the View menu.",
      "Choose Edit > Find, or press Command-F, to search your library.",
    ],
    [
      "Control a video",
      "Press Space to play and pause. Press the Left Arrow or Right Arrow key to skip ten seconds.",
      "Choose Controls > Stop, or press Command-Period, to end playback and keep your place.",
    ],
    [
      "Make a playlist",
      "Choose File > New Playlist, or press Command-N, then name it in the sheet. The Library shows it.",
    ],
    [
      "Add a home video",
      "Choose File > Import, or press Command-O, and choose a movie on your drive. It joins Home Videos in the Library.",
    ],
  ),
  guide(
    "Books",
    "Read EPUB and PDF books, and mark your place and the passages you like.",
    [
      "Add a book",
      "Choose File > Add to Library, or press Command-O, and choose an EPUB or a PDF from your computer. It is kept on your drive, in Documents.",
      "Choose Store > Featured or Store > Top Charts to find open books to get.",
    ],
    [
      "Mark what you read",
      "In a book's window, select some text. The Edit menu then has Add Highlight, or press Control-Command-H, and Add Note, or press Control-Command-N.",
    ],
    [
      "Move through a book",
      "Press the Left Arrow or Right Arrow key to turn the page. In a book's window, the Controls menu has Go to Page and Table of Contents.",
    ],
    [
      "Sort your library",
      "Choose File > New Collection, or press Shift-Command-N, to gather books. Choose View > List to see titles, authors and dates, and View > Sort By to order them.",
    ],
  ),
  guide(
    "Preview",
    "Open, mark up and export pictures and PDFs from your drive.",
    [
      "Open a file",
      "Choose File > Open, or press Command-O, to choose a file on your drive.",
      "Choose File > New from Clipboard, or press Command-N, for a new document from a copied picture.",
    ],
    [
      "Mark up a file",
      "Choose View > Show Markup Toolbar, or press Shift-Command-A.",
      "Choose File > Save, or press Command-S, to save a picture in its format.",
    ],
    [
      "Move through a PDF",
      "Choose View > Thumbnails to see its pages in the sidebar, or View > Contact Sheet for a grid of every page.",
      "Choose Go > Next, or press Command-Down Arrow, for the next page.",
    ],
    [
      "Find words in a PDF",
      "Choose Edit > Find > Find, or press Command-F. A picture has no text to find, so the row is dimmed for one.",
    ],
    [
      "Write another copy",
      "Choose File > Export for a JPEG, PNG or TIFF of the file. Choose File > Duplicate, or press Shift-Command-S, for a copy beside it.",
    ],
  ),
  guide(
    "QuickTime Player",
    "Play movies, record your camera, microphone or screen, and trim what you made.",
    [
      "Record",
      "Choose File > New Movie Recording, or press Option-Command-N, for the camera. Choose File > New Audio Recording, or press Control-Option-Command-N, for the microphone. Choose File > New Screen Recording, or press Control-Command-N, for the screen.",
    ],
    [
      "Open a movie",
      "Choose File > Open File, or press Command-O, for a file on your drive. Choose File > Open Location, or press Command-L, to play what an http or https address gives.",
    ],
    [
      "Trim and split a movie",
      "With a movie open, choose Edit > Trim, or press Command-T, and drag the two handles. Choose Edit > Split Clip, or press Command-Y, to split at the playhead.",
    ],
    [
      "Turn a movie",
      "With a movie open, choose Edit > Rotate Left, or press Shift-Command-L. Choose Edit > Flip Horizontal, or press Option-Command-H, to swap its sides.",
    ],
    ["Loop a movie", "With a movie open, choose View > Loop, or press Option-Command-L."],
  ),
  guide(
    "Photo Booth",
    "Take pictures and movie clips with your camera, with effects.",
    [
      "Take a picture",
      "Click the shutter, or press Command-T. A countdown of three comes first.",
      "Option-click the shutter to skip the countdown, and Shift-click it to skip the flash.",
    ],
    [
      "Take four pictures, or a clip",
      "Use the mode buttons at the left of the bar under the picture: one picture, four quick pictures kept as one, or a movie clip.",
    ],
    [
      "Choose a camera",
      "The Camera menu lists your browser's cameras and microphones. Choose Camera > Enable Screen Flash to turn the flash on and off.",
    ],
    [
      "Look back at your pictures",
      "Choose View > Start Slideshow to see them over the whole page. Choose View > Show Photo Preview to go back to the camera.",
      "Choose Edit > Delete All to clear the strip. It asks first, and they go to Photos' Recently Deleted.",
    ],
  ),
  guide(
    "Voice Memos",
    "Record sound from your microphone, and trim and keep what you recorded.",
    [
      "Record",
      "Choose File > New Recording, or press Command-N, or click the round red button. Your browser asks to use the microphone the first time.",
      "A recording stops by itself at ten minutes, and says so.",
    ],
    [
      "Play a recording",
      "Select it, then press Space to play and stop. The Left Arrow and Right Arrow keys move the playhead a second.",
    ],
    ["Shorten a recording", "Choose Edit > Trim Recording, or press Command-T."],
    [
      "Keep and delete recordings",
      "Choose Edit > Rename to name a recording, and File > Duplicate for a copy on your drive.",
      "Choose Edit > Delete to put one in your drive's Trash, which Recently Deleted lists.",
    ],
  ),
  guide(
    "FaceTime",
    "Call other accounts of this desktop with sound and picture.",
    [
      "Mute a call or pause your picture",
      "Choose Video > Mute, or press Shift-Command-M. Choose Video > Pause Video to stop your picture.",
    ],
    [
      "Choose a camera or microphone",
      "Choose Video > Camera or Video > Microphone. Each lists what your browser offers, with the one in use chosen.",
    ],
    ["Keep the call in view", "Choose Window > Always on Top to keep FaceTime over other windows."],
    [
      "Stop taking calls",
      "Choose FaceTime > Turn FaceTime Off, or press Command-K.",
      "The Blocked pane of Preferences lists who may not call you, the same list as in Messages.",
    ],
  ),
  guide(
    "Find My",
    "See where the people who share with you and your browsers are.",
    [
      "Change list",
      "Choose View > People, or press Command-1. Choose View > Devices, or press Command-2.",
      "Choose View > Go to Current Location, or press Command-L, to centre the map on this browser.",
    ],
    [
      "Share your location",
      "Choose File > Share My Location, and name an account of this desktop in the sheet.",
    ],
    [
      "Find a device",
      "Each browser of your account is a device. Select one to see its card, where Play Sound asks that browser to sound, and Directions opens Maps with a route to it.",
    ],
    [
      "What it cannot do",
      "Mark As Lost, Erase and Notify When Found are dimmed, as a web page cannot lock another browser.",
    ],
  ),
  guide(
    "Chess",
    "Play the computer or another account, and keep your games.",
    [
      "Start a game",
      "Choose Game > New Game, or press Command-N. The sheet asks for the computer at one of four levels, or an account, and a clock if you want one.",
      "Choose Game > Games to see your other games.",
    ],
    [
      "Make a move",
      "Drag a piece to its square.",
      "Choose Moves > Take Back Move, or press Command-Z, to take back your last move and the computer's answer.",
    ],
    [
      "Get some help",
      "Choose Moves > Show Hint for a clue, then Show Suggested Move for the move itself. Choose Moves > Show Last Move, or press Command-L, to see the last move.",
    ],
    [
      "Change what you see",
      "Choose View > Rotate Board, or press Command-R. Choose Window > Game Log for every move in notation.",
    ],
    [
      "Keep a game as a file",
      "Choose Game > Save As, or press Shift-Command-S, to write a PGN file to Downloads. Choose Game > Open, or press Command-O, to read one back.",
    ],
  ),
  guide(
    "Automator",
    "Build workflows out of actions, and run them on the server.",
    [
      "Start a workflow",
      "Choose File > New, or press Command-N. Choose Edit > Find > Search Library, or press Option-Command-F, to find an action to add.",
    ],
    [
      "Run a workflow",
      "Choose Workflow > Run, or press Command-R. Choose Workflow > Step, or press Option-Command-R, to run the next action and pause.",
      "Choose Workflow > Stop, or press Command-Period, to end a stepped run between actions.",
    ],
    [
      "Save a workflow",
      "Choose File > Save, or press Command-S. It is kept on the server under the name in the name field.",
    ],
    [
      "Change an action",
      "Choose Action > Move Up or Action > Move Down to change its place, and Action > Delete to take it out.",
    ],
    [
      "What it cannot do",
      "Workflow > Record is dimmed, as a web page cannot see other applications.",
    ],
  ),
  guide(
    "Script Editor",
    "Write, run and keep scripts.",
    [
      "Start a script",
      "Choose File > New, or press Command-N, for another window. File > New from Template lists scripts to start from.",
    ],
    [
      "Run a script",
      "Choose Script > Compile, or press Command-K, to check it. Choose Script > Run, or press Command-R, to run it, and Script > Stop, or press Command-Period, to stop.",
    ],
    [
      "See what a script did",
      "Choose View > Result, or press Command-2. Choose View > Log, or press Command-3. Choose View > Description, or press Command-1, for your own notes.",
    ],
    [
      "See what an app understands",
      "Choose File > Open Dictionary, or press Shift-Command-O, and choose one of the apps it lists.",
    ],
    [
      "Keep a script",
      "Choose File > Save, or press Command-S. Choose File > Export for a new file in Documents.",
    ],
  ),
  guide(
    "Font Book",
    "See the fonts you have, gather them in collections, and turn them off and on.",
    [
      "Add fonts",
      "Choose File > Add Fonts, or press Command-O.",
      "Choose File > Validate Font to check the font selected.",
    ],
    [
      "Gather fonts",
      "Choose File > New Collection, or press Command-N, and name it in the sidebar. Choose File > New Smart Collection, or press Option-Command-N, for one that fills itself by rules.",
    ],
    [
      "See a font",
      "Choose View > Sample, or press Command-1. Choose View > Repertoire, or press Command-2. Choose View > Custom, or press Command-3, and type your own text.",
    ],
    ["Turn a font off", "Select a family, then press Shift-Command-D. The same key turns it on."],
    [
      "Find duplicates",
      "Choose Edit > Look for Enabled Duplicates, or press Command-L. Choose Edit > Resolve Duplicates, or press Shift-Command-L, to deal with them.",
    ],
  ),
  guide(
    "App Store",
    "Get the desktop's other apps, and see the ones you have.",
    [
      "Find an app",
      "Choose Edit > Find, or press Command-F, and type its name. Discover, Create, Work, Play, Develop and Categories in the sidebar list apps too.",
    ],
    ["Get an app", "Click Get, then Install. The app joins the Dock, and Open opens it."],
    [
      "Go back to a page",
      "Choose Store > Back, or press Command-Left Bracket. Choose Store > Forward, or press Command-Right Bracket.",
    ],
    [
      "See what you got",
      "Choose Store > Purchased to open your account page, where each app has Uninstall. Choose Store > Show Updates to open Updates.",
    ],
  ),
  guide(
    "Activity Monitor",
    "See the desktop's applications, the server's modules and what this page can measure.",
    [
      "Change view",
      "The control in the toolbar shows Applications, Ferrite, CPU, Memory, Energy, Disk and Network. Each says what a web page cannot be told.",
    ],
    [
      "Look at one application",
      "Select it, then choose View > Inspect Process, or press Command-I.",
      "Choose Edit > Find, or press Option-Command-F, to search by name.",
    ],
    [
      "Keep a graph on screen",
      "Choose Window > CPU Usage, or press Command-2. Choose Window > CPU History, or press Command-3.",
    ],
    [
      "Change how often it looks",
      "Choose View > Update Frequency, then 1, 2 or 5 seconds. The choice is kept.",
    ],
  ),
  guide(
    "Console",
    "Read the messages the desktop's server logs, and log files of your drive.",
    [
      "Find a message",
      "Choose Edit > Find, or press Command-F. The pop-ups beside a search say where its words are looked for.",
      "Errors and Faults in the scope bar lists only those.",
    ],
    ["Look at one message", "Select it, then choose Action > Get Info, or press Command-I."],
    [
      "Start again",
      "Choose Action > Clear, or press Command-K, to hide what was shown. Choose Action > Reload, or press Command-R, to bring it back.",
    ],
    [
      "Choose how much you see",
      "Choose Action > Include Debug Messages for more. It starts off, and the choice is kept.",
    ],
    [
      "Read a log file",
      "Choose File > Open, or press Command-O, and choose a file on your drive. It gets a row under Log Files in the sidebar.",
    ],
  ),
  guide(
    "Keychain Access",
    "Keep passwords and secure notes in a keychain sealed under your own password.",
    [
      "Add a password",
      "Choose File > New Password Item, or press Command-N. Choose File > New Secure Note Item, or press Shift-Command-N, for a note.",
    ],
    [
      "Use a password",
      "Select the item, then choose Edit > Copy Password to Clipboard, or press Shift-Command-C. Choose File > Get Info, or press Command-I, to see or change it.",
    ],
    [
      "Lock the keychain",
      "Choose File > Lock All Keychains, or press Control-Command-L. Locking forgets the key, and the keychain asks for your password again.",
    ],
    [
      "Move items to another browser",
      "Choose File > Export Items, or press Shift-Command-E. The items are sealed under a file password of their own and downloaded. Choose File > Import Items, or press Shift-Command-I, to open the file.",
    ],
  ),
  guide(
    "System Information",
    "See what this desktop and your browser report about themselves.",
    [
      "Look something up",
      "Select a row of the outline, such as Browser, Ferrite Application, Hardware, Network or Software. Where a web page cannot read a figure, the report says so.",
      "Choose Edit > Find, or press Command-F, to go to the next category holding your words.",
    ],
    ["Get new figures", "Choose File > Refresh Information, or press Command-R."],
    [
      "Keep the report",
      "Choose File > Save, or press Command-S, to write it to your drive. Choose File > Print, or press Command-P, to print the report alone.",
    ],
  ),
  guide(
    "System Preferences",
    "Change how the desktop looks and works.",
    [
      "Find a setting",
      "Choose View > Search, or press Command-F, and type what you want to change.",
      "Choose View > Show All Preferences, or press Command-L, to see every pane.",
    ],
    [
      "Go back to a pane",
      "Choose View > Back, or press Command-Left Bracket. Choose View > Forward, or press Command-Right Bracket.",
    ],
    [
      "Open a pane from the Dock",
      "Right-click System Preferences in the Dock. Its menu lists the panes.",
    ],
  ),
  guide(
    "Storage Management",
    "See what fills your drive, and free some of it.",
    [
      "See what takes room",
      "Documents, Photos, Music, Movies and Other Files in the sidebar list what they hold. Large Files lists files of 5 MB or more, largest first.",
      "Applications lists each app and what it keeps on the server.",
    ],
    [
      "Free some room",
      "Recommendations offers Review Large Files and Empty Trash.",
      "Select files, then choose Edit > Delete. It asks first.",
    ],
    [
      "What it cannot do",
      "Store in iCloud and Optimize Storage say why they do not apply: this desktop has no iCloud, and nothing is downloaded to remove.",
    ],
  ),
];

/** The other rows of a Mac's Help menu, by the words they ask with: books of no one application. */
const MAC_BOOKS: Readonly<Record<string, HelpSection>> = {
  macOS: macBook(
    "macos",
    "macOS Help",
    "How to get around this desktop, which runs in your browser.",
    [
      "Open an application",
      "Click its tile in the Dock, or find it in Launchpad.",
      "Click Spotlight in the menu bar, type its name and press Return.",
    ],
    [
      "Get help in any application",
      "The Help menu has a search field. Type in it to list the rows of the application's menus and topics of help.",
      "Choose a row, and its menu opens with an arrow beside it. Press Return to read about your words here.",
    ],
    [
      "Change your settings",
      "Open System Preferences from the Dock. A note under each pane says what takes effect.",
    ],
    [
      "Find your files",
      "Finder shows the files on your drive, which the server keeps for your account.",
      "Storage Management shows what fills the drive.",
    ],
    [
      "Press the right keys",
      "These guides name the Mac's keys. In a browser on another kind of computer, press Control where a guide says Command.",
    ],
  ),
  "What’s New": macBook(
    "whats-new",
    "See What’s New in macOS",
    "What macOS 10.15 brought that this desktop has.",
    [
      "Music, TV and Podcasts",
      "macOS 10.15 has three applications where iTunes used to be, and so has this desktop.",
      "Music plays your own songs and open music, TV plays open films, YouTube links and your home videos, and Podcasts follows shows by their feeds.",
    ],
    [
      "Find My",
      "Find My keeps people and devices in one window. Choose View > People or View > Devices in it. On this desktop a device is a browser of your account.",
    ],
    [
      "Reminders",
      "Reminders keeps lists in groups, and a reminder can sit under another: choose Edit > Indent in it.",
    ],
  ),
  Tips: macBook(
    "tips",
    "Tips for Your Mac",
    "Short ways to do more on this desktop.",
    [
      "Search the menus",
      "Press Shift-Command-? in any window to open the Help menu's search field, and type the name of a command.",
    ],
    [
      "See all your windows",
      "Press F3 or Control-Up Arrow for Mission Control. Press Control-Down Arrow for the windows of the application in front alone. On a Mac the operating system may take these keys, and the Dock's tile for Mission Control says them.",
    ],
    [
      "Switch applications",
      "Press Option-Tab. A web page cannot have Command-Tab, which the operating system takes.",
    ],
    [
      "Get windows out of the way",
      "Press Command-H to hide the application in front, or Command-M to minimize its window to the Dock.",
    ],
    [
      "Work things out in Spotlight",
      "Open Spotlight and type a sum such as 12*12, or a conversion such as 212 f to c. Return copies the answer.",
    ],
  ),
};

/** The links a page of those books has, by topic id. */
const MAC_ACTIONS: Readonly<Record<string, HelpAction>> = {
  "mac:macos:3": { label: "Open System Preferences", app: "system-preferences" },
  "mac:macos:4": { label: "Open Storage Management", app: "storage-management" },
  "mac:whats-new:2": { label: "Open Find My", app: "find-my" },
  "mac:whats-new:3": { label: "Open Reminders", app: "reminders" },
};

const byTitle = (a: HelpSection, b: HelpSection) => a.title.localeCompare(b.title);

/** Every book the desktop itself carries: the Mac's own, then the applications' by name. */
export const DESKTOP_BOOKS: readonly HelpSection[] = [
  ...Object.values(MAC_BOOKS),
  ...[...APP_GUIDES].sort(byTitle),
];

/**
 * The server's books and the desktop's as one list. A server's book of a guide's title keeps its
 * id, a place it may be remembered by, and holds both's topics, so the Book pop-up names it once.
 */
export function withDesktopBooks(fetched: readonly HelpSection[]): HelpSection[] {
  const titled = new Map(fetched.map((book) => [book.title, book]));
  return [
    ...fetched.filter((book) => !DESKTOP_BOOKS.some((own) => own.title === book.title)),
    ...DESKTOP_BOOKS.map((own) => {
      const theirs = titled.get(own.title);
      if (!theirs) return own;
      return { ...own, id: theirs.id, topics: [...(own.topics ?? []), ...(theirs.topics ?? [])] };
    }),
  ];
}

const name = (book: HelpSection) => book.title.replace(/ Help$/, "");

/** The links on pages that have a pane to go to, by topic id. */
const PANE_ACTIONS: Readonly<Record<string, HelpAction>> = {
  "use-the-dock": { label: "Open Dock preferences", pane: "dock" },
  "find-things-with-spotlight": { label: "Open Spotlight preferences", pane: "spotlight" },
  "guide:safari:2": { label: "Open Extensions preferences", pane: "extensions" },
};

/**
 * The links a page of help has: to its pane, on a guide's page to the guide's application, whose
 * id is the guide's, and on a page of the Mac's own books to the application it speaks of.
 */
export function actionsOf(topicId: string): readonly HelpAction[] {
  const pane = PANE_ACTIONS[topicId];
  const own = MAC_ACTIONS[topicId];
  const app = /^guide:([a-z-]+):/.exec(topicId)?.[1];
  const book = APP_GUIDES.find((each) => each.id === `guide:${app}`);
  return [
    ...(app && book ? [{ label: `Open ${name(book)}`, app }] : []),
    ...(own ? [own] : []),
    ...(pane ? [pane] : []),
  ];
}

/** The book a Help menu's row asks for: an application by its name, or one of the Mac's own. */
export const guideNamed = (name: string): HelpSection | undefined =>
  MAC_BOOKS[name] ?? APP_GUIDES.find((book) => book.title === `${name} Help`);

/** The books' topics whose title or summary contains the text, whatever its case. */
export function searchGuides(query: string): HelpTopic[] {
  const text = query.trim().toLowerCase();
  if (text === "") return [];
  return DESKTOP_BOOKS.flatMap((book) => book.topics ?? []).filter((topic) =>
    mentions(topic, text),
  );
}
