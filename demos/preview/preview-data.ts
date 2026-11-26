/**
 * The documents of the Preview demo. Nothing here is a real file: a PDF is its text, which the
 * demo sets on pages of its own, and an image is an address or the demo's placeholder picture.
 * The booklet is invented, and so is the ferry line it is about.
 */
import desktopArt from "./art/desktop.webp";

/** One page of a PDF document. */
export interface PreviewPage {
  /**
   * The line over the title of a page that opens a section: "Section 3". It belongs to the
   * banner, so it is shown, and searched, only on a page that has a title.
   */
  section?: string;
  /** The title of the section this page opens. A page with a title has the banner. */
  title?: string;
  /** The narrow column of a page that opens a section. */
  aside?: { heading: string; text: readonly string[] };
  /** The heading over the page's text. */
  heading: string;
  /** The paragraphs of the page. */
  text: readonly string[];
}

/** A PDF: pages of text, with thumbnails, a page count and search. */
export interface PreviewPdfDocument {
  kind: "pdf";
  /** The file's name with its extension, shown in the title bar and over the sidebar. */
  name: string;
  /** The pages, in order. */
  pages: readonly PreviewPage[];
}

/** An image: one picture that fills the window. */
export interface PreviewImageDocument {
  kind: "image";
  /** The file's name without its extension, shown in the title bar. */
  name: string;
  /** The image's address. Without one the demo shows its abstract placeholder picture. */
  src?: string;
  /** What the image shows, for assistive technology. */
  alt: string;
  /** Width divided by height. */
  aspect: number;
}

export type PreviewDocument = PreviewPdfDocument | PreviewImageDocument;

/** A page that holds the text searched for. */
export interface PreviewSearchResult {
  /** The page's number, from 1. */
  page: number;
  /** How many times the text occurs on the page. */
  count: number;
  /** The words around the first occurrence. */
  snippet: string;
}

/** How the pages found are ordered: as in the document, or the page with the most matches first. */
export type PreviewSort = "page" | "rank";

/** The colours of the Highlight button's menu. */
export const HIGHLIGHTS = ["yellow", "green", "blue", "pink", "purple"] as const;
export type PreviewHighlight = (typeof HIGHLIGHTS)[number];

/** Every string of a page that is shown, and so can be searched, in reading order. */
export const textOf = (page: PreviewPage): string[] => [
  ...(page.title !== undefined ? [...(page.section ? [page.section] : []), page.title] : []),
  ...(page.aside ? [page.aside.heading, ...page.aside.text] : []),
  page.heading,
  ...page.text,
];

/**
 * Where `query` occurs in `text`, in any letter case, as offsets into `text` itself. The
 * text is not lowercased to search it: a letter whose lowercase form is longer (İ) would
 * move every offset after it.
 */
function occurrences(text: string, query: string): [start: number, end: number][] {
  const needle = query.trim();
  if (needle === "") return [];
  const pattern = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu");
  return Array.from(text.matchAll(pattern), (match) => [
    match.index,
    match.index + match[0].length,
  ]);
}

/**
 * A string cut where the text searched for occurs, in any letter case: the pieces alternate
 * between text and match, starting with text (which may be empty).
 */
export function splitMatches(text: string, query: string): string[] {
  const pieces: string[] = [];
  let from = 0;
  for (const [start, end] of occurrences(text, query)) {
    pieces.push(text.slice(from, start), text.slice(start, end));
    from = end;
  }
  pieces.push(text.slice(from));
  return pieces;
}

const countIn = (text: string, query: string) => occurrences(text, query).length;

/** The sentence the first match is in, from its start. */
function snippetOf(texts: readonly string[], query: string): string {
  for (const text of texts) {
    const at = occurrences(text, query)[0]?.[0];
    if (at === undefined) continue;
    const stop = text.lastIndexOf(". ", at);
    return stop < 0 ? text : text.slice(stop + 2);
  }
  return "";
}

/** The pages of a document that hold `query`, in page order or by the number of matches. */
export function searchDocument(
  document: PreviewPdfDocument,
  query: string,
  sort: PreviewSort = "page",
): PreviewSearchResult[] {
  if (query.trim() === "") return [];
  const results: PreviewSearchResult[] = [];
  document.pages.forEach((page, index) => {
    const texts = textOf(page);
    const count = texts.reduce((sum, text) => sum + countIn(text, query), 0);
    if (count > 0) results.push({ page: index + 1, count, snippet: snippetOf(texts, query) });
  });
  // Array.prototype.sort is stable: pages with the same number of matches keep their order.
  return sort === "rank" ? results.sort((a, b) => b.count - a.count) : results;
}

/** The booklet the demo opens: twenty-two pages in six sections. */
export const islandFerry: PreviewPdfDocument = {
  kind: "pdf",
  name: "Island Ferry.pdf",
  pages: [
    {
      section: "Section 1",
      title: "A Crossing Every Morning",
      aside: {
        heading: "BEFORE THE BRIDGE",
        text: [
          "For ninety years the only way to the island was over the water, and the only timetable was the tide.",
          "This booklet follows the boats that made the crossing, and the people who kept them running.",
        ],
      },
      heading: "The Line",
      text: [
        "The island ferry began as a favour. A fisherman with room in his skiff took the schoolteacher across on Mondays and brought her back on Fridays, and by the end of the first winter half the village was waiting on the slip with her.",
        "What grew from that skiff was never a large company. At its busiest the line owned three boats and employed nineteen people, and it carried everything the island needed: flour, mail, bicycles, a piano, and once a small and very unwilling horse.",
      ],
    },
    {
      heading: "Two Slips",
      text: [
        "The mainland slip was built of granite setts in the first year and has been rebuilt twice since. The island slip was only ever timber, and every spring the crew spent a week replacing what the winter had taken.",
        "Between the two lies a little over a mile of water. On a still day the crossing takes eleven minutes. Against a spring tide it can take forty, and the timetable has always carried a note to say so.",
        "The note is still there, in the same words, on the board by the ticket window.",
      ],
    },
    {
      heading: "The Timetable",
      text: [
        "The first printed timetable was a single card, set by hand at the newspaper office and pinned up in the bakery. It listed four crossings a day and promised nothing on Sundays.",
        "Later cards added a late boat on market days and an early one for the school. The numbers changed with every season, but the card stayed the same size, because it had to fit the frame the baker had made for it.",
      ],
    },
    {
      section: "Section 2",
      title: "The First Boats",
      aside: {
        heading: "OARS, THEN SAIL",
        text: [
          "Nobody designed the early boats for passengers. They were working boats that happened to have a dry thwart.",
        ],
      },
      heading: "Wren",
      text: [
        "The skiff that started it all was called Wren. She was sixteen feet long, carried a lug sail the colour of strong tea, and leaked steadily from the day she was launched to the day she was retired.",
        "Passengers sat on the centre thwart with their feet on the catch. In rough weather they were handed a bailer and expected to use it.",
      ],
    },
    {
      heading: "A Proper Deck",
      text: [
        "The second boat, Curlew, was the first built for the crossing. She had a deck, a rail, a bench along each side and a canvas dodger that kept the spray off the mail sacks.",
        "She also had a bell. It hung by the mast and was rung twice on leaving each slip, a habit every later boat has kept.",
      ],
    },
    {
      heading: "Cargo",
      text: [
        "Curlew could carry a ton and a half if it was stowed with care. Stowing it was an art: sacks low and amidships, crates along the rail, anything alive as far from the helm as it would go.",
        "The line kept a ledger of what it carried. The entry for one August week lists eleven hundred loaves, four beehives and a church harmonium in three pieces.",
      ],
    },
    {
      heading: "Winter Crossings",
      text: [
        "From November to March the boats ran when they could. A red board hung on the mainland slip meant no crossing, and islanders learned to read it from their kitchen windows with a glass.",
        "The longest gap on record is nine days. On the tenth the boat went over loaded to the rail with bread, lamp oil and newspapers, and came back with every letter the island had written in the meantime.",
      ],
    },
    {
      heading: "The Lost Anchor",
      text: [
        "Curlew lost her anchor on a February night when the cable parted in a gale. It was found forty years later by a diver looking for something else, and now hangs on the wall of the waiting room.",
        "A brass plate under it gives the date and the name of the diver, and adds that he was allowed to travel free for the rest of his life.",
      ],
    },
    {
      section: "Section 3",
      title: "Fog & Bells",
      aside: {
        heading: "FINDING THE WAY",
        text: [
          "Wind and tide can be read from the slip. Fog cannot, and the channel between the ledges is forty yards wide.",
          "For most of the line's history the answer to fog was sound: a bell on each slip, a horn on the boat and a great deal of patience.",
        ],
      },
      heading: "The Channel",
      text: [
        "The crossing looks simple on a chart. A boat leaves the mainland slip, holds a little north of west until the island church lines up with the old lime kiln, and then turns for the timber slip. In clear weather a child could steer it.",
        "In fog the ledges on either side of the channel vanish, and the tide sets a boat towards them at two knots. More than one skipper has found the island by the sound of hens.",
        "The line's rule was written after a near miss in its fourth year. When the harbour pilot refused to guide the boat in fog, the company bought two bells and hired two boys to ring them.",
      ],
    },
    {
      heading: "Bell Boys",
      text: [
        "The bell boys were paid by the hour and only in fog, which made them the one part of the island that hoped for bad weather. Each rang a different pattern: three strokes and a pause on the mainland, two and a pause on the island.",
        "A skipper who could hear both bells knew roughly where he was. A skipper who could hear neither stopped the engine, let go the anchor and waited.",
        "The last bell boy retired at seventy-one. He said the work had been easy and the waiting had been hard.",
        "The bells themselves were cast in the same foundry, a year apart, and are a tone different in pitch. Nobody planned that, and nobody who worked the crossing would have had it otherwise.",
      ],
    },
    {
      heading: "The Horn",
      text: [
        "The first horn was worked by a foot bellows and sounded, the ledger says, like a cow in a well. It was replaced by a compressed air horn when the line bought its first motor boat.",
        "One long blast still means the boat is leaving. Three short ones mean she is going astern, and islanders within earshot look up to see why.",
      ],
    },
    {
      section: "Section 4",
      title: "The Engine Room",
      aside: {
        heading: "FROM SAIL TO MOTOR",
        text: [
          "The line was slow to give up sail. Wind was free, and the first engines were neither cheap nor willing.",
        ],
      },
      heading: "Paraffin",
      text: [
        "The first engine was a single cylinder paraffin motor that had to be warmed with a blowlamp for ten minutes before it would start. It was fitted to Curlew over one winter by the blacksmith and the schoolmaster.",
        "It gave her four knots in a calm and saved the crossing on days without wind. On days with wind the crew still set the sail and let the engine rest.",
      ],
    },
    {
      heading: "Kittiwake",
      text: [
        "Kittiwake was the first boat ordered with an engine. She was built on the mainland, thirty-four feet long, with a wheelhouse and a diesel that started on the first swing more often than not.",
        "Her builders sent a pilot to bring her round the head, and he handed her over at the slip with a list of eleven faults. The line fixed nine and learned to live with the other two.",
      ],
    },
    {
      heading: "The Engineer",
      text: [
        "With a diesel came an engineer. The first was a quiet man from a trawler who kept the engine room cleaner than most kitchens and would not allow a passenger past the door.",
        "He trusted his ears more than any gauge. It was said that he could tell a slack belt from the wheelhouse, and that the pilot of a passing coaster once hailed him to ask what he was listening to.",
      ],
    },
    {
      heading: "Spares",
      text: [
        "Parts came by post and took a fortnight, so the line kept two of everything that could break and three of everything that often did. The spares lived in a locked shed behind the ticket office.",
        "When the shed was cleared many years later it still held a complete spare cylinder head, wrapped in oiled paper and never used.",
      ],
    },
    {
      section: "Section 5",
      title: "People of the Line",
      aside: {
        heading: "NINETEEN NAMES",
        text: ["The wages book lists everyone the line ever employed. It is not a long book."],
      },
      heading: "Skippers",
      text: [
        "The line had seven skippers in ninety years. Two were brothers, one was the granddaughter of the fisherman who began it, and all of them had made the crossing as children before they were trusted with it.",
        "A skipper's first season was served as mate. The second was served under the eye of the one before, who sat on the after bench and said very little.",
      ],
    },
    {
      heading: "The Licence",
      text: [
        "For a time the harbour board required a licensed pilot aboard any boat that carried more than twelve passengers. The line had no pilot and could not afford one.",
        "Its answer was to send the mate to sit the examination. She passed, became the first pilot the island had produced, and for eleven years the ferry was the only boat in the harbour with a pilot at the ticket window.",
      ],
    },
    {
      heading: "Tickets",
      text: [
        "Tickets were sold from a window hardly wider than a hand. Singles were buff, returns were green, and a season ticket was a brass token stamped with a number.",
        "The clerk knew every regular by name and most by errand. A stranger was asked where they were staying, not from suspicion, but so that the pilot of the evening boat would know whether to wait.",
      ],
    },
    {
      heading: "The Waiting Room",
      text: [
        "The waiting room had a stove, a bench and a shelf of books left by passengers. A notice asked readers to return them, and most did, though rarely to the same shelf.",
        "The oldest book on the shelf was a manual for a harbour pilot, with the island's ledges drawn in pencil on the endpaper by someone who knew them well.",
      ],
    },
    {
      section: "Section 6",
      title: "The Line Today",
      aside: {
        heading: "AFTER THE BRIDGE",
        text: [
          "The bridge opened in the line's ninety-first year. The last timetable was printed that spring.",
        ],
      },
      heading: "The Last Crossing",
      text: [
        "On the last morning the boat went over full and came back fuller. The bell was rung twice at each slip, as it always had been, and then once more.",
        "Kittiwake was laid up that winter. She was not broken up: a trust of islanders bought her for the price of her engine and has kept her afloat since.",
      ],
    },
    {
      heading: "Summer Sailings",
      text: [
        "The trust runs the boat on summer weekends. Its volunteers are trained by a retired pilot, who insists that every one of them can find the timber slip with the wheelhouse windows papered over.",
        "The test is taken in daylight, with the pilot standing at the rail and a second pilot from the mainland harbour keeping watch from the bow. Nobody has yet touched a ledge.",
        "Those who pass are given a brass token. The pilot keeps the list of numbers, and the pilot who follows him will inherit it.",
      ],
    },
    {
      heading: "Visiting",
      text: [
        "The waiting room is open from May to September, with the anchor on its wall and the ledger in a glass case. The bells are rung at noon on the first Saturday of each month.",
        "The crossing still takes eleven minutes on a still day. The note about spring tides is still on the board.",
      ],
    },
  ],
};

/**
 * The image document of the demo: an original generated photograph under the captured
 * window's title.
 */
export const desktopPicture: PreviewImageDocument = {
  kind: "image",
  name: "Desktop",
  src: desktopArt,
  alt: "A turquoise bay with rocky islands at sunrise",
  aspect: 1.6,
};
