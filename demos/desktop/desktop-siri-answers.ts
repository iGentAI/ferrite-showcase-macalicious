import { CONTACTS_CARDS_URL, cardsFromServer } from "../contacts/contacts-server";
import { askMapsDirections, askMapsSearch } from "../maps/maps-open";
import { searchPlaces } from "../maps/maps-server";
import { dayName, degrees, sourceText, weatherFor } from "../maps/maps-weather";
import { webAddressFor } from "../safari/safari-web";
import { definitionOf } from "../spotlight/spotlight-desktop";
import { GRID_BANDS } from "../system-preferences/catalogue";
import { requestPane } from "../system-preferences/pane-request";
import { requestDesktopEffects } from "./desktop-effects";
import type { DriveEntry } from "./desktop-files";
import { setDoNotDisturb } from "./desktop-live";
import { quotesFromServer } from "./desktop-notifications";
import { openItem } from "./desktop-open-item";
import { openUrl } from "./desktop-open-url";
import { askToReach } from "./desktop-reach";
import { sessionFetch, withDeadline } from "./desktop-server";
import type { SiriAnswer, SiriAnswerCard, SiriMailDraft } from "./desktop-siri";
import { settingAnswer } from "./desktop-siri-settings";

/**
 * The requests Siri answers on the desktop itself: what only the browser knows (time zones) or what
 * the desktop does (opening a page, a Preferences pane, Do Not Disturb), and looking something up in
 * the person's things. Everything else goes to the server's Siri module.
 */

const answer = (text: string, card: SiriAnswerCard | null = null): SiriAnswer => ({
  text,
  card,
  effects: [],
  via: "commands",
  understood: true,
});

const clean = (text: string) =>
  text
    .trim()
    .replace(/[.?!]+$/, "")
    .replace(/^(please |hey siri,? |siri,? )/i, "");

/** The IANA zone whose city is `place`, as the browser knows them. */
function zoneOf(place: string): string | undefined {
  const wanted = place.trim().toLowerCase().replace(/\s+/g, "_");
  return Intl.supportedValuesOf("timeZone").find(
    (zone) => zone.slice(zone.lastIndexOf("/") + 1).toLowerCase() === wanted,
  );
}

const titled = (text: string) => text.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());

/** A Preferences pane by the name a person says: "Dock", "desktop and screen saver". */
function paneOf(name: string) {
  const wanted = name
    .trim()
    .toLowerCase()
    .replace(/\s+and\s+/g, " & ");
  return GRID_BANDS.flat().find((pane) => pane.name.toLowerCase() === wanted);
}

interface FoundThing {
  kind: string;
  app: string;
  id: string;
  title: string;
}

async function found(query: string, only: string): Promise<readonly FoundThing[]> {
  const body = await withDeadline(async (signal) => {
    const response = await sessionFetch(
      `/api/spotlight/search?q=${encodeURIComponent(query)}${only}`,
      { credentials: "same-origin", signal },
    );
    if (!response.ok) throw new Error(`The search answered ${response.status}.`);
    return (await response.json()) as { results?: readonly FoundThing[] };
  });
  return body?.results ?? [];
}

const cardOf = (title: string, app: string, things: readonly FoundThing[]): SiriAnswerCard => ({
  title,
  app,
  items: things.slice(0, 8).map((thing) => ({ text: thing.title, id: thing.id })),
});

const MENTION = "(?:called |named |about |of )?";

const getJson = (url: string) =>
  withDeadline(async (signal) => {
    const response = await sessionFetch(url, { credentials: "same-origin", signal });
    if (!response.ok) throw new Error(`The server answered ${response.status}.`);
    return (await response.json()) as unknown;
  });

const PLAY = /^(?:play|resume)(?: (?:the |my )?music)?$/i;
const SONG_WAIT_MS = 250;
const SONG_WAITS = 40;
/** Each request of Music's: a song still waiting for the player gives way to a later one. */
let musicAsked = 0;
const PAUSE = /^(?:pause|stop)(?: (?:the |my )?music| playing)?$/i;
const NEXT = /^(?:next|skip)(?: (?:this )?(?:song|track))?$/i;
const PREVIOUS = /^(?:previous|last)(?: song| track)?$/i;

/** Music's controls, on the page's one player. It holds a queue once Music has opened. */
async function musicAnswer(text: string): Promise<SiriAnswer | null> {
  const command = [PLAY, PAUSE, NEXT, PREVIOUS].findIndex((pattern) => pattern.test(text));
  if (command < 0) return null;
  musicAsked += 1;
  const { musicPlayer } = await import("../music/music-player");
  const player = musicPlayer();
  if (!player.current()) {
    requestDesktopEffects([{ open: "music" }]);
    return answer("Music has nothing to play yet, so I opened it for you.");
  }
  if (command === 0) player.play();
  else if (command === 1) player.pause();
  else if (command === 2) player.next();
  else player.previous();
  if (command === 1) return answer("Paused.");
  const title = player.current()?.title;
  return answer(title ? `Playing “${title}”.` : "That was the end of the queue.");
}

/** The song by name, shown in Music and played as soon as the player knows it; a later Music request wins. */
async function songAnswer(text: string): Promise<SiriAnswer | null> {
  const name = text.match(/^play(?: the)?(?: song)? (.+?)(?: (?:in|on) music)?$/i)?.[1];
  if (!name) return null;
  musicAsked += 1;
  const asked = musicAsked;
  const results = await found(name, "").catch(() => null);
  const song = results?.find((thing) => thing.kind === "music");
  if (!song) return null;
  const { musicPlayer } = await import("../music/music-player");
  if (asked !== musicAsked) return answer(`I left “${song.title}” for what you asked since.`);
  const player = musicPlayer();
  openItem({ app: "music", id: song.id, title: song.title });
  requestDesktopEffects([{ open: "music" }]);
  for (let tries = SONG_WAITS; tries > 0 && !player.lookup(song.id); tries -= 1) {
    await new Promise((resolve) => setTimeout(resolve, SONG_WAIT_MS));
    if (asked !== musicAsked) break;
  }
  if (asked !== musicAsked) return answer(`I left “${song.title}” for what you asked since.`);
  if (!player.lookup(song.id)) {
    return answer(
      `“${song.title}” is in Music, but it isn’t ready to play. Try again in a moment.`,
    );
  }
  player.playQueue([song.id]);
  return answer(`Playing “${song.title}”.`);
}

const STOCK = [
  /^(?:what(?:'s|’s| is) |how(?:'s|’s| is) |show me )?(?:the )?(?:stock price (?:of|for) |stock of )([a-z.^ -]{1,30})$/i,
  /^(?:what(?:'s|’s| is) |how(?:'s|’s| is) |show me )?(?:the )?([a-z.^ -]{1,30}?) (?:stock|shares)(?: price| doing)?$/i,
];

const quoteOf = async (symbol: string) =>
  quotesFromServer(
    await getJson(`/api/stocks/quotes?symbols=${encodeURIComponent(symbol)}`).catch(() => null),
  ).find((each) => each.symbol === symbol);

/** The symbol a company goes by, as the Stocks module's search has it. */
async function symbolOf(company: string): Promise<string | undefined> {
  const reply = (await getJson(`/api/stocks/search?q=${encodeURIComponent(company)}`).catch(
    () => null,
  )) as { results?: readonly { symbol?: unknown }[] } | null;
  const first = reply?.results?.[0]?.symbol;
  return typeof first === "string" ? first : undefined;
}

async function stockAnswer(text: string): Promise<SiriAnswer | null> {
  const asked = STOCK.map((pattern) => text.match(pattern)?.[1]).find(Boolean);
  if (!asked) return null;
  const typed = asked.toUpperCase();
  const direct = /\s/.test(typed) ? undefined : await quoteOf(typed);
  const symbol = direct ? typed : ((await symbolOf(asked)) ?? typed);
  const quote = direct ?? (await quoteOf(symbol));
  if (!quote) return answer(`I couldn’t get a quote for ${typed}.`);
  const way = quote.change < 0 ? "down" : "up";
  const change = Math.abs(quote.change).toFixed(2);
  const line = `${symbol} is at ${quote.price.toFixed(2)}, ${way} ${change}.`;
  return answer(line, {
    title: "Stocks",
    app: "stocks",
    lead: quote.price.toFixed(2),
    detail: `${symbol}, ${way} ${change}`,
    items: [{ text: symbol, id: symbol }],
  });
}

/** Said with a draft on the screen: sends it, or lets it go. */
export const SEND_THE_DRAFT = /^(?:yes,? )?(?:send(?: it| that)?|please send it)[.!]?$/i;
export const CANCEL_THE_DRAFT =
  /^(?:no,? )?(?:cancel(?: it| that)?|don(?:'|’)t send(?: it)?)[.!]?$/i;

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** A message with its words said is written here for the person to send, as a Mac's Siri does. */
function draftAnswer(to: string, name: string, subject: string | undefined, said: string) {
  const draft: SiriMailDraft = { to, name, subject: subject ?? "", text: said, key: newKey() };
  return { ...answer(`Here’s your message to ${name}. Ready to send it?`), draft };
}

/** The answer to letting a draft go. */
export const draftLetGo = (): SiriAnswer => answer("OK, I won’t send it.");

/** Sends a draft through Mail's server. A refusal keeps the draft, and says what the server said. */
export async function sendDraft(draft: SiriMailDraft): Promise<SiriAnswer> {
  const refused = (why: string) => ({ ...answer(`I couldn’t send it: ${why}.`), draft });
  try {
    const response = await withDeadline((signal) =>
      sessionFetch("/api/mail/send", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "idempotency-key": draft.key },
        body: JSON.stringify({ to: [draft.to], subject: draft.subject, text: draft.text }),
        signal,
      }),
    );
    if (response.ok) return answer(`Your message to ${draft.name} was sent.`);
    const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
    return refused(
      typeof body?.error === "string" ? body.error : `the server answered ${response.status}`,
    );
  } catch {
    return refused("I can’t reach the desktop’s server right now");
  }
}

/**
 * A new message to someone: an address as it is said, or a person's account or first address in
 * Contacts. With its words said it is a draft Siri holds; otherwise a New Message in Mail.
 */
async function mailAnswer(text: string): Promise<SiriAnswer | null> {
  const asked = text.match(
    /^(?:e-?mail|mail|send (?:an? )?e-?mail to|write (?:an? )?e-?mail to) (.+?)(?: about (.+?))?(?:,? (?:saying|that says) (.+))?$/i,
  );
  const who = asked?.[1];
  if (!who) return null;
  const subject = asked?.[2]
    ? `${asked[2].slice(0, 1).toUpperCase()}${asked[2].slice(1)}`
    : undefined;
  const said = asked?.[3];
  const about = subject ? `, about ${asked?.[2]}` : "";
  if (who.includes("@")) {
    if (said) return draftAnswer(who, who, subject, said);
    askToReach({ app: "mail", to: who, name: who, subject });
    return answer(`Here’s a new message to ${who}${about}.`);
  }
  const cards = cardsFromServer(await getJson(CONTACTS_CARDS_URL).catch(() => null));
  if (!cards) return answer("I can’t reach your contacts right now.");
  const matches = cardsNamed(cards, who);
  if (matches.length > 1) {
    const names = matches.map((each) => `${each.first} ${each.last}`.trim()).join(", ");
    return answer(`Which ${titled(who)} do you mean: ${names}?`);
  }
  const card = matches[0];
  const to = card?.emails?.[0]?.value;
  if (!card || !(to || (said && card.user))) {
    return answer(`I don’t have an email address for ${titled(who)}.`);
  }
  const name = `${card.first} ${card.last}`.trim();
  if (said) return draftAnswer(card.user ?? to ?? "", name, subject, said);
  askToReach({ app: "mail", to: to ?? "", name, subject });
  return answer(`Here’s a new message to ${name}${about}.`);
}

/** The cards that are the person said: by whole name, or by one word of it. */
function cardsNamed<Card extends { first: string; last: string }>(
  cards: readonly Card[],
  who: string,
): Card[] {
  const wanted = who.toLowerCase();
  const named = (each: Card) => `${each.first} ${each.last}`.trim().toLowerCase();
  const exact = cards.filter((each) => named(each) === wanted);
  return exact.length > 0
    ? exact
    : cards.filter((each) => named(each).split(/\s+/).includes(wanted));
}

const MESSAGE =
  /^(?:send (?:an? )?(?:i?message|text)(?: message)? to|i?message|text(?= .+ (?:saying|that says) )) (.+?)(?:,? (?:saying|that says) (.+))?$/i;

/**
 * A new message to someone in Messages, with what was said in its field for the person to send: an
 * account named on their card in Contacts, or the name as it is said.
 */
async function messageAnswer(text: string): Promise<SiriAnswer | null> {
  const asked = text.match(MESSAGE);
  const who = asked?.[1];
  if (!who) return null;
  const said = asked?.[2];
  const cards = cardsFromServer(await getJson(CONTACTS_CARDS_URL).catch(() => null)) ?? [];
  const matches = cardsNamed(cards, who);
  if (matches.length > 1) {
    const names = matches.map((each) => `${each.first} ${each.last}`.trim()).join(", ");
    return answer(`Which ${titled(who)} do you mean: ${names}?`);
  }
  const card = matches[0];
  const name = card ? `${card.first} ${card.last}`.trim() : titled(who);
  askToReach({ app: "messages", to: card?.user ?? who, name, text: said });
  return answer(
    said
      ? `Here’s your message to ${name}, ready to send: “${said}”.`
      : `Here’s a new message to ${name}.`,
  );
}

const CALL = /^(?:facetime(?: (audio|video))?|(audio |video )?call) (.+)$/i;

const READ_MAIL =
  /^(?:(?:read|check|show)(?: me)?(?: my)?(?: new| unread| latest)? ?(?:e-?mails?|mail|inbox)|do i have (?:any )?(?:new |unread )?(?:e-?mail|mail)|(?:any )?new (?:e-?mails?|mail))$/i;

interface MailHeader {
  id: string;
  mailbox?: string;
  unread?: boolean;
  subject?: string;
  from?: { name?: string; full_name?: string };
}

/** What is new in the inbox: its unread messages among the newest Mail lists, each opening in Mail. */
async function readMailAnswer(text: string): Promise<SiriAnswer | null> {
  if (!READ_MAIL.test(text)) return null;
  const reply = (await getJson("/api/mail/messages").catch(() => null)) as {
    messages?: readonly MailHeader[];
  } | null;
  if (!reply?.messages) return answer("I can’t reach your mail right now.");
  const unread = reply.messages.filter((each) => each.mailbox === "inbox" && each.unread === true);
  const first = unread[0];
  if (!first) return answer("You have no new mail.");
  const sender = (each: MailHeader) => each.from?.full_name || each.from?.name || "someone";
  const subject = (each: MailHeader) => each.subject?.trim() || "(No Subject)";
  const said =
    unread.length === 1
      ? `You have one new message, from ${sender(first)}: “${subject(first)}”.`
      : `You have ${unread.length} new messages. The newest is from ${sender(first)}: “${subject(first)}”.`;
  return answer(said, {
    title: "Mail",
    app: "mail",
    items: unread
      .slice(0, 8)
      .map((each) => ({ text: `${sender(each)} · ${subject(each)}`, id: each.id })),
  });
}

/** A FaceTime call to someone: an account named on their card in Contacts, or the name as it is said. */
async function callAnswer(text: string): Promise<SiriAnswer | null> {
  const asked = text.match(CALL);
  const who = asked?.[3];
  if (!who) return null;
  const cards = cardsFromServer(await getJson(CONTACTS_CARDS_URL).catch(() => null)) ?? [];
  const matches = cardsNamed(cards, who);
  if (matches.length > 1) {
    const names = matches.map((each) => `${each.first} ${each.last}`.trim()).join(", ");
    return answer(`Which ${titled(who)} do you mean: ${names}?`);
  }
  const card = matches[0];
  const name = card ? `${card.first} ${card.last}`.trim() : titled(who);
  const kind = /audio/i.test(`${asked?.[1]}${asked?.[2]}`) ? "audio" : "video";
  askToReach({ app: "facetime", to: card?.user ?? who, name, kind });
  return answer(`Here’s a FaceTime ${kind === "audio" ? "audio " : ""}call to ${name}.`);
}

const WEATHER =
  /^(?:weather\b|(?:what(?:'s|’s| is)|how(?:'s|’s| is)|will it|is it going to|does it)\b.*\b(?:weather|forecast|rain|snow)\b)/i;

const ROUTE = [
  /^(?:get )?directions to (.+)$/i,
  /^(?:how do i get to|take me to|navigate to) (.+)$/i,
];

const PLACE = [
  /^(?:where is|where’s|where's) (.+)$/i,
  /^(?:show me |find )(.+?) (?:on the map|on a map|in maps)$/i,
];

/** Directions in Maps to the first place the search finds, or the search itself when it finds none. */
async function routeAnswer(place: string): Promise<SiriAnswer> {
  const reply = await searchPlaces(place);
  const to = reply.ok ? reply.value[0] : undefined;
  if (!to) {
    askMapsSearch(place);
    return answer(`Here’s ${titled(place)} in Maps.`);
  }
  askMapsDirections(to);
  return answer(`Here are directions to ${to.name}.`);
}

const KINDS: readonly [RegExp, string, (type: string) => boolean][] = [
  [/^(?:pdfs?|pdf files?)$/i, "PDFs", (type) => type === "application/pdf"],
  [/^(?:pictures?|images?)$/i, "pictures", (type) => type.startsWith("image/")],
  [/^(?:movies?|videos?)$/i, "movies", (type) => type.startsWith("video/")],
  [/^(?:songs?|sounds?|audio files?)$/i, "sound files", (type) => type.startsWith("audio/")],
  [/^(?:files?|documents?)$/i, "files", () => true],
];

const startOfDay = (at: number, daysAgo = 0) => {
  const day = new Date(at);
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - daysAgo);
  return day.getTime();
};

/** The span of a date a person says, from and until, as milliseconds. */
function spanOf(words: string | undefined, at: number): readonly [number, number] | undefined {
  const weekday = new Date(at).getDay();
  switch (words?.toLowerCase()) {
    case "today":
      return [startOfDay(at), at + 1];
    case "yesterday":
      return [startOfDay(at, 1), startOfDay(at)];
    case "this week":
      return [startOfDay(at, weekday), at + 1];
    case "last week":
      return [startOfDay(at, weekday + 7), startOfDay(at, weekday)];
    case "this month":
      return [startOfDay(at, new Date(at).getDate() - 1), at + 1];
    case "last month": {
      const first = new Date(at);
      first.setHours(0, 0, 0, 0);
      first.setDate(1);
      const until = first.getTime();
      first.setMonth(first.getMonth() - 1);
      return [first.getTime(), until];
    }
    default:
      return undefined;
  }
}

const KIND_OR_DATE =
  /^(?:find|show(?: me)?|list)(?: my| all)?(?: the)? ([a-z ]+?)(?: (?:from|modified|changed|made)?\s*(today|yesterday|this week|last week|this month|last month))?$/i;

/** Files of a kind, or from a date: read from the drive, newest first. */
async function kindAnswer(text: string): Promise<SiriAnswer | null> {
  const asked = text.match(KIND_OR_DATE);
  const kind = KINDS.find(([pattern]) => pattern.test(asked?.[1] ?? ""));
  if (!asked || !kind) return null;
  const [, label, takes] = kind;
  const span = spanOf(asked[2], Date.now());
  // "Find files" alone says nothing to look for: the server says so.
  if (label === "files" && !span) return null;
  const reply = (await getJson("/api/files/").catch(() => null)) as {
    entries?: readonly DriveEntry[];
  } | null;
  if (!reply?.entries) return answer("I can’t reach your files right now.");
  const files = reply.entries
    .filter(
      (entry) =>
        entry.kind === "file" &&
        entry.trashed_ms === undefined &&
        takes(entry.type ?? "") &&
        (!span || (entry.modified_ms >= span[0] && entry.modified_ms < span[1])),
    )
    .sort((a, b) => b.modified_ms - a.modified_ms);
  const when = asked[2] ? ` from ${asked[2].toLowerCase()}` : "";
  if (files.length === 0) return answer(`I couldn’t find any ${label}${when}.`);
  return answer(
    `I found ${files.length} ${files.length === 1 ? label.replace(/s$/, "") : label}${when}.`,
    cardOf(
      "Files",
      "finder",
      files.map((entry) => ({ kind: "files", app: "finder", id: entry.id, title: entry.name })),
    ),
  );
}

const AGAIN = /^(?:what|how) about (.+)$|^and (?:in |for )?(.+)$/i;

/** What a follow-up means, said in full, from the request before it; the request itself otherwise. */
export function followUp(request: string, before: string | null): string {
  const other = clean(request).match(AGAIN);
  const subject = other?.[1] ?? other?.[2];
  if (!subject || !before) return request;
  const asked = clean(before);
  const time = asked.match(/^(what(?:'s|’s| is)?(?: the)? time(?: is it)? in) .+$/i);
  if (time) return `${time[1]} ${subject}`;
  if (STOCK.some((pattern) => pattern.test(asked))) return `How is ${subject} stock doing`;
  if (/^define /i.test(asked)) return `Define ${subject}`;
  if (PLACE.some((pattern) => pattern.test(asked))) return `Where is ${subject}`;
  if (ROUTE.some((pattern) => pattern.test(asked))) return `Directions to ${subject}`;
  if (WEATHER.test(asked)) return `What’s the weather in ${subject}`;
  const day = /\b(today|tomorrow|yesterday)\b/i;
  if (day.test(asked) && day.test(subject)) return asked.replace(day, subject);
  return request;
}

/** Said of the answer before, with nothing in it to act on: says so rather than doing something else. */
export const CHANGES_THE_LAST = /^(?:change|move|make) (?:it|that)\b/i;

/** The place a weather request names: "weather in Paris", "will it rain in Rome tomorrow", "weather Oslo". */
export function weatherPlaceOf(text: string): string | undefined {
  const said = text.replace(/\s+(?:right now|now|today|tomorrow|this week)\s*$/i, "");
  const place =
    said.match(/\b(?:in|for|at)\s+(.+)$/i)?.[1] ??
    said.match(/^(?:weather|forecast)\s+(?!like\b)(.+)$/i)?.[1];
  return place?.trim() || undefined;
}

async function weatherAnswer(text: string): Promise<SiriAnswer> {
  const read = await weatherFor(weatherPlaceOf(text));
  if (read.kind === "no-place") {
    return answer(
      "I don’t know where you are. Ask about a place by name, or choose one in the Weather widget in Notification Center.",
    );
  }
  if (read.kind === "not-found") return answer(`I couldn’t find a place called “${read.name}”.`);
  if (read.kind === "problem") {
    return answer(`The weather isn’t available right now. ${read.problem}`);
  }
  const { place, forecast } = read;
  const today = forecast.days[0];
  const tomorrow = /\btomorrow\b/i.test(text) ? forecast.days[1] : undefined;
  const said = tomorrow
    ? `Tomorrow in ${place.name}: ${tomorrow.condition.toLowerCase()}, with a high of ${degrees(tomorrow.high_c)} and a low of ${degrees(tomorrow.low_c)}.`
    : `Right now in ${place.name} it’s ${degrees(forecast.temperature_c)}: ${forecast.condition.toLowerCase()}.`;
  return answer(said, {
    title: "Weather",
    app: "maps",
    lead: `${place.name} ${degrees(forecast.temperature_c)}, ${forecast.condition}`,
    detail: `${today ? `High ${degrees(today.high_c)}, low ${degrees(today.low_c)}. ` : ""}${sourceText(forecast)}.`,
    items: forecast.days.slice(1, 5).map((day) => ({
      text: `${dayName(day.date)}: ${degrees(day.high_c)} / ${degrees(day.low_c)}, ${day.condition}`,
    })),
  });
}

/** The answer to a request the desktop takes itself, having done what it asks; `null` otherwise. */
export async function answerHere(request: string): Promise<SiriAnswer | null> {
  const text = clean(request);
  let match: RegExpMatchArray | null;

  match = text.match(/^(?:search the web for|search the internet for|google) (.+)$/i);
  if (match?.[1]) {
    const query = match[1];
    return openUrl(webAddressFor(query), "siri")
      ? answer(`Searching the web for “${query}”.`)
      : answer(`I couldn’t open a search for “${query}”.`);
  }

  match = text.match(/^what(?:'s|’s| is)?(?: the)? time(?: is it)? in (.+)$/i);
  if (match?.[1]) {
    const place = match[1];
    const timeZone = zoneOf(place);
    if (!timeZone) return answer(`I don’t know the time in ${titled(place)}.`);
    const time = new Date().toLocaleTimeString("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
    });
    return answer(`It’s ${time} in ${titled(place)}.`, {
      title: titled(place),
      app: "siri",
      lead: time,
      items: [],
    });
  }

  match = text.match(/^(?:open|show)(?: me)?(?: the)? (.+?) (?:preferences|settings|pane)$/i);
  const pane = match?.[1] ? paneOf(match[1]) : undefined;
  if (pane) {
    requestPane(pane.id);
    requestDesktopEffects([{ open: "system-preferences" }]);
    return answer(`Here are the ${pane.name} preferences.`);
  }

  match = text.match(/^turn (on|off) do not disturb$/i);
  if (match?.[1]) {
    const on = match[1].toLowerCase() === "on";
    setDoNotDisturb(on);
    return answer(`Do Not Disturb is ${on ? "on" : "off"}.`);
  }

  const setting = settingAnswer(text);
  if (setting) return answer(setting);

  match = text.match(/^(?:define|what does (?=\S+ mean$))\s*(\S+?)(?: mean)?$/i);
  if (match?.[1]) {
    const word = match[1];
    const definition = await definitionOf(word).catch(() => undefined);
    return definition
      ? answer(`${definition.word}: ${definition.text}`, {
          title: "Dictionary",
          app: "dictionary",
          lead: definition.word,
          items: [{ text: definition.text, id: definition.word }],
        })
      : answer(`I couldn’t find a definition of “${word}”.`);
  }

  const kinds = await kindAnswer(text);
  if (kinds) return kinds;

  match = text.match(
    new RegExp(`^(?:find|show me|search for)(?: my)? (?:files?|documents?) ${MENTION}(.+)$`, "i"),
  );
  if (match?.[1]) {
    const query = match[1];
    const files = await found(query, "&only=files").catch(() => null);
    if (!files) return answer("I can’t reach your files right now.");
    return files.length === 0
      ? answer(`I couldn’t find any files about “${query}”.`)
      : answer(
          `I found ${files.length} ${files.length === 1 ? "file" : "files"}.`,
          cardOf("Files", "finder", files),
        );
  }

  match = text.match(new RegExp(`^(?:find|show me)(?: my)? photos? ${MENTION}(.+)$`, "i"));
  if (match?.[1]) {
    const query = match[1];
    const results = await found(query, "").catch(() => null);
    if (!results) return answer("I can’t reach your photos right now.");
    const photos = results.filter((thing) => thing.kind === "photos");
    return photos.length === 0
      ? answer(`I couldn’t find any photos of “${query}”.`)
      : answer(
          `I found ${photos.length} ${photos.length === 1 ? "photo" : "photos"}.`,
          cardOf("Photos", "photos", photos),
        );
  }

  if (WEATHER.test(text)) return weatherAnswer(text);

  const route = ROUTE.map((pattern) => text.match(pattern)?.[1]).find(Boolean);
  if (route) return routeAnswer(route);

  const place = PLACE.map((pattern) => text.match(pattern)?.[1]).find(Boolean);
  if (place) {
    askMapsSearch(place);
    const reply = await searchPlaces(place).catch(() => null);
    const first = reply?.ok ? reply.value[0] : undefined;
    return answer(
      `Here’s ${titled(place)} in Maps.`,
      first
        ? {
            title: "Maps",
            app: "maps",
            lead: first.name,
            detail: first.address.join(", "),
            map: { lat: first.lat, lon: first.lon },
            items: [],
          }
        : null,
    );
  }

  if (CHANGES_THE_LAST.test(text)) {
    return answer(
      "I can’t change that from here. Say the whole request again, with what you want.",
    );
  }

  const handled =
    (await readMailAnswer(text)) ??
    (await musicAnswer(text)) ??
    (await songAnswer(text)) ??
    (await stockAnswer(text)) ??
    (await mailAnswer(text)) ??
    (await messageAnswer(text)) ??
    (await callAnswer(text));
  if (handled) return handled;

  return null;
}
