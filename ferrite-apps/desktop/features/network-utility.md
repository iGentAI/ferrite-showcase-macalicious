# Feature inventory: Network Utility

**On the Ferrite desktop again**, by the owner's order: real macOS has it. It left `not-deployed.json`, and the server's catalogue lists it, preinstalled. Lookup and Whois ask real services through declared egress (`dns` and `rdap` in `ferrite.json`), Ping times labelled HTTPS requests, and every other pane says what it cannot be. The library's own pages keep the demo's made-up output. The real app has no drag and drop or multi-selection, so those have no rows.

Proven by `e2e/home-network-batch13-journey.mjs` (steps `net.*`) against `ferrite dev --egress allow` in Chromium, Firefox and WebKit, with no stand-in for the network: the run asks the real resolver and registries, so it needs the network. In the journey the frame's `print()` is replaced, because Firefox's print preview would hold the page until a person closes it. WebKit's download name is compared with its spaces as underscores, which is how Playwright's WebKit reports every download name.

**Status:** missing (not in code), partial (note says what is absent), built-unchecked (built, with no check on a real Mac). **Browser limit** marks what neither a page nor a Ferrite application can do: the app must say so. Real-app rows are from knowledge of macOS 10.15, not checked on a Mac. Row counts are by hand.

**Counts:** 40 built-unchecked, 4 partial, 0 missing, 44 rows.

## Network Utility menu

| Item | Status | Note |
| --- | --- | --- |
| About Network Utility | built-unchecked | |
| Preferences… | built-unchecked | Dimmed, saying Network Utility has no preferences, as on a Mac (from knowledge of macOS, not checked on a Mac). `rows-batch25-journey` |
| Services | built-unchecked | The shell's Services for text selected; "No Services Apply" without. `rows-batch25-journey` selected the text of a field in Network Utility's window and read Look Up in Dictionary, Search the Web, New Note With Selection and Make New Sticky Note; those rows were listed, not chosen |
| Hide Network Utility ⌘H | built-unchecked | `e2e/rows-batch17-journey.mjs`: goes at once with no tile of its own, and its Dock tile brings it back; the shared shell's Hide, so the first read's “minimizes” no longer holds |
| Hide Others ⌥⌘H | built-unchecked | Same journey: hides Calculator, leaves this window, and Show All brings it back |
| Show All | built-unchecked | |
| Quit ⌘Q | built-unchecked | |

## File menu

| Item | Status | Note |
| --- | --- | --- |
| Close Window ⌘W | built-unchecked | |
| Print… | built-unchecked | Journey: a frame holds a copy of the output and its `print()` is called with that text; `print()` is replaced there, so the print dialog itself is not driven |
| Save output | built-unchecked | Journey: `Network Utility Whois.txt` downloaded, its text read |

## Edit menu

| Item | Status | Note |
| --- | --- | --- |
| Undo, Redo | built-unchecked | Shared `EditRows`; not driven here |
| Cut, Copy, Paste | built-unchecked | Journey chooses Copy; the clipboard's text is not read back, and Cut and Paste are not driven |
| Select All | built-unchecked | Journey: the field's whole text selected |

## Window menu

| Item | Status | Note |
| --- | --- | --- |
| Minimize ⌘M | built-unchecked | |
| Zoom | built-unchecked | Dimmed with a reason |
| Bring All to Front | built-unchecked | |
| Window list | built-unchecked | |

## Help menu

| Item | Status | Note |
| --- | --- | --- |
| Network Utility Help | built-unchecked | Journey: opens its guide in Help Viewer |
| Search field | built-unchecked | `e2e/rows-batch17-journey.mjs`: the shared Help menu's field; Return opens Help Viewer on the words |

## Tabs

| Item | Status | Note |
| --- | --- | --- |
| Lookup | built-unchecked | Journey: real records from a public DNS-over-HTTPS resolver, through declared egress, not the machine's resolver |
| Info | built-unchecked | Journey: the browser's online flag and connection estimate, labelled. Browser limit: "This Browser (not an interface)"; no address or packet count |
| Netstat | built-unchecked | Journey: the declared way out, this page's requests and origins, each labelled as not the real thing. Browser limit |
| Ping | built-unchecked | Journey: four HTTPS requests to a declared host, labelled not ICMP; any other host is refused with nothing sent. Browser limit |
| Traceroute | partial | Journey: says why not, sends nothing. Browser limit |
| Whois | built-unchecked | Journey: real records over RDAP, not port 43: .com, .net, .org and IPv4 addresses ARIN holds. Others are refused in words; a redirect to another registry is reported, since egress does not follow it |
| Finger | partial | Journey: says why not, sends nothing. Browser limit |
| Port Scan | partial | Journey: says why not, sends nothing. Browser limit |

## Tool behaviour

| Item | Status | Note |
| --- | --- | --- |
| Recent lookups before the first | built-unchecked | |
| Records in `dig` order per question | built-unchecked | Journey reads them |
| Stop while running | built-unchecked | Journey: the output keeps what was printed and the run ends. Only a browser proves this: jsdom never showed the fault it fixes |
| Choose a record type or lookup server | built-unchecked | Record type, in the batch 13 journey. Server, in `e2e/rows-batch17-journey.mjs`: Cloudflare or Google Public DNS, each asked for real and named in the output, read through `dns.google`; any other is refused with nothing sent. Only the two the application declares: a page cannot name its own, as the real field can, since egress reaches declared hosts alone |
| Whois through RDAP at registries that answer without a redirect | built-unchecked | Journey |
| Round trip to a host, labelled as HTTPS and not ping | built-unchecked | Journey. The time includes the way to the server, and the text says so |

## Output

| Item | Status | Note |
| --- | --- | --- |
| Output text selectable | built-unchecked | |
| A new run replaces the output | built-unchecked | |

## Address field

| Item | Status | Note |
| --- | --- | --- |
| Return runs the tool | built-unchecked | Journey |
| Run is disabled when empty | built-unchecked | |

## Saved state

| Item | Status | Note |
| --- | --- | --- |
| Recent lookups per person | built-unchecked | `/api/network-utility/history`. Journey reads and forgets them through the route |
| Tab, address and output across a reload | built-unchecked | Journey. Each pane keeps its first 6,000 characters |

## Context menu

| Item | Status | Note |
| --- | --- | --- |
| Output and field (Copy, Paste, Select All) | built-unchecked | Journey opens it and reads its rows; choosing a row is not driven |

## Keyboard

| Item | Status | Note |
| --- | --- | --- |
| Arrow keys across tabs | built-unchecked | |
| ⌘W ⌘M ⌘H ⌥⌘H ⌘Q | built-unchecked | From the desktop |

## Cross-app

| Item | Status | Note |
| --- | --- | --- |
| Lookups can be forgotten from Storage Management | built-unchecked | Listed in its module; the journey forgets through the route, not its window |
| Lookups appear in Console's log | built-unchecked | Router logs writes and errors only; check what a lookup logs |

## Build items, most-used first

None left that a page can do: the partial rows are what a web service cannot be.
