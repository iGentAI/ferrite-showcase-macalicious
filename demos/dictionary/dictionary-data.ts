/** The reference sources of the scope bar, without "All". */
export type DictionarySource = "dictionary" | "thesaurus" | "apple" | "wikipedia";

/** What the scope bar selects: one source, or all of them. */
export type DictionaryScope = "all" | DictionarySource;

/** One sense of a word, with the narrower senses that follow it behind a bullet. */
export interface DictionarySense {
  text: string;
  subsenses?: readonly string[];
  /** Sentences that use the word in this sense, shown in italics under it. */
  examples?: readonly string[];
}

/** A further part of speech of a headword, after the article's first. */
export interface DictionaryPart {
  part: string;
  senses: readonly DictionarySense[];
}

/** The dictionary's article on a word. */
export interface DictionaryArticle {
  /** The headword divided into syllables: "com·put·er". */
  syllables: string;
  /** The pronunciation, between the bars of the article's first line. */
  pronunciation?: string;
  /** The source's other accents: the pronunciation and recording of each, where it has them. */
  accents?: Readonly<Record<string, { pronunciation?: string; audio?: string }>>;
  /** The part of speech: "noun". */
  part: string;
  senses: readonly DictionarySense[];
  /** The address of a recording of the word, which the article's Listen button plays. */
  audio?: string;
  /** The word's other parts of speech, each after the first with its own senses. */
  more?: readonly DictionaryPart[];
}

/** The thesaurus's article on a word. */
export interface DictionaryThesaurus {
  part: string;
  /** An example of the word in use. */
  example?: string;
  synonyms: readonly string[];
  antonyms?: readonly string[];
  /** The word's synonyms in its other parts of speech. */
  more?: readonly DictionaryThesaurus[];
}

/** A line under an article that names where its text comes from. */
export interface DictionaryCredit {
  text: string;
  href: string;
}

/** A headword with what each source says about it. */
export interface DictionaryEntry {
  word: string;
  dictionary?: DictionaryArticle;
  thesaurus?: DictionaryThesaurus;
  /** The Apple dictionary's paragraph. */
  apple?: string;
  /** The encyclopedia's summary. */
  wikipedia?: string;
  /** The encyclopedia's article, which the summary links to. */
  wikipediaUrl?: string;
  /** Where the entry's texts come from, listed under it. */
  credits?: readonly DictionaryCredit[];
  /**
   * What the entry says while it has nothing to show: that it is being looked up, or that no
   * source knows the word. An entry with a status is listed in every scope.
   */
  status?: string;
}

/** The scope bar's items, in its order. */
export const SCOPES: readonly { id: DictionaryScope; title: string }[] = [
  { id: "all", title: "All" },
  { id: "dictionary", title: "Dictionary" },
  { id: "thesaurus", title: "Thesaurus" },
  { id: "apple", title: "Apple" },
  { id: "wikipedia", title: "Wikipedia" },
];

/** The sources in the order an entry shows them under "All". */
export const SOURCES: readonly { id: DictionarySource; title: string }[] = [
  { id: "dictionary", title: "Dictionary" },
  { id: "thesaurus", title: "Thesaurus" },
  { id: "apple", title: "Apple" },
  { id: "wikipedia", title: "Wikipedia" },
];

const article = (
  syllables: string,
  part: string,
  ...senses: (string | DictionarySense)[]
): DictionaryArticle => ({
  syllables,
  part,
  senses: senses.map((sense) => (typeof sense === "string" ? { text: sense } : sense)),
});

const word = (text: string, dictionary: DictionaryArticle): DictionaryEntry => ({
  word: text,
  dictionary,
});

/**
 * The demo's vocabulary. The first article is the one of the reference screenshots, word for
 * word; the 32 headwords that start with "computer" are the ones its list and its title
 * ("32 found") show, the twelve below the capture's edge being made up to that number. Every
 * other text is written for the demo and is no dictionary's.
 */
export const defaultEntries: readonly DictionaryEntry[] = [
  {
    word: "computer",
    dictionary: {
      syllables: "com·put·er",
      pronunciation: "kəmˈpyo͞odər",
      part: "noun",
      senses: [
        {
          text: "an electronic device for storing and processing data, typically in binary form, according to instructions given to it in a variable program.",
          subsenses: ["a person who makes calculations, especially with a calculating machine."],
        },
      ],
    },
    thesaurus: {
      part: "noun",
      example: "the figures are worked out by computer",
      synonyms: ["PC", "laptop", "desktop", "workstation", "terminal", "machine"],
    },
    wikipedia:
      "A computer is a machine that carries out sequences of arithmetic or logical operations by following a program. Modern computers are built from integrated circuits and range from the controllers inside appliances to the machines of data centres.",
  },
  word(
    "computer-aided",
    article("com·put·er-aid·ed", "adjective", "done or made with the help of a computer."),
  ),
  word(
    "computer animation",
    article(
      "com·put·er an·i·ma·tion",
      "noun",
      "the making of moving pictures with a computer, frame by frame or from a description of how things move.",
    ),
  ),
  word(
    "computer animations",
    article("com·put·er an·i·ma·tions", "plural noun", "plural form of computer animation."),
  ),
  word(
    "computer conferencing",
    article(
      "com·put·er con·fer·enc·ing",
      "noun",
      "the holding of a discussion among people in different places through linked computers.",
    ),
  ),
  word(
    "computer dating",
    article(
      "com·put·er dat·ing",
      "noun",
      "the matching of people who might like each other by comparing what they told a computer about themselves.",
    ),
  ),
  word(
    "computer-friendly",
    article(
      "com·put·er-friend·ly",
      "adjective",
      "suited to being read or handled by a computer.",
      "at ease with computers.",
    ),
  ),
  word(
    "computer game",
    article(
      "com·put·er game",
      "noun",
      "a game played on a computer, against it or against other players.",
    ),
  ),
  word(
    "computer graphics",
    article(
      "com·put·er graph·ics",
      "plural noun",
      "pictures made or changed by a computer.",
      "the study and practice of making them.",
    ),
  ),
  word(
    "computer-literate",
    article(
      "com·put·er-lit·er·ate",
      "adjective",
      "knowing enough about computers to use them without help.",
    ),
  ),
  word(
    "computer programer",
    article("com·put·er pro·gram·er", "noun", "variant spelling of computer programmer."),
  ),
  word(
    "computer programers",
    article("com·put·er pro·gram·ers", "plural noun", "plural form of computer programer."),
  ),
  word(
    "computer programmer",
    article(
      "com·put·er pro·gram·mer",
      "noun",
      "a person who writes the instructions a computer follows.",
    ),
  ),
  {
    word: "computer science",
    dictionary: article(
      "com·put·er sci·ence",
      "noun",
      "the study of what can be computed and of how computers and their programs are built.",
    ),
    wikipedia:
      "Computer science is the study of computation, information and automation. It reaches from theory, such as algorithms and the limits of what can be computed, to the design of hardware and software.",
  },
  word(
    "computer virus",
    article(
      "com·put·er vi·rus",
      "noun",
      "a program that copies itself into other programs and from one computer to the next, usually doing harm on the way.",
    ),
  ),
  word(
    "computer viruses",
    article("com·put·er vi·rus·es", "plural noun", "plural form of computer virus."),
  ),
  word(
    "computerese",
    article(
      "com·put·er·ese",
      "noun",
      "the words and turns of phrase of people who work with computers, as heard by everyone else.",
    ),
  ),
  word(
    "computerisation",
    article("com·put·er·i·sa·tion", "noun", "British spelling of computerization."),
  ),
  word("computerise", article("com·put·er·ise", "verb", "British spelling of computerize.")),
  word(
    "computerised",
    article("com·put·er·ised", "adjective", "British spelling of computerized."),
  ),
  word(
    "computerises",
    article("com·put·er·is·es", "verb", "third person singular present of computerise."),
  ),
  word("computerising", article("com·put·er·is·ing", "verb", "present participle of computerise.")),
  word(
    "computerist",
    article("com·put·er·ist", "noun", "a person who uses computers, especially for pleasure."),
  ),
  word("computerists", article("com·put·er·ists", "plural noun", "plural form of computerist.")),
  word(
    "computerization",
    article(
      "com·put·er·i·za·tion",
      "noun",
      "the change from doing a piece of work by hand to doing it with computers.",
    ),
  ),
  word(
    "computerize",
    article(
      "com·put·er·ize",
      "verb",
      "to do, keep or run with a computer.",
      "to supply with computers.",
    ),
  ),
  word("computerized", article("com·put·er·ized", "adjective", "done, kept or run by a computer.")),
  word(
    "computerizes",
    article("com·put·er·iz·es", "verb", "third person singular present of computerize."),
  ),
  word("computerizing", article("com·put·er·iz·ing", "verb", "present participle of computerize.")),
  word(
    "computerlike",
    article("com·put·er·like", "adjective", "working or behaving the way a computer does."),
  ),
  word("computernik", article("com·put·er·nik", "noun", "a person who is very keen on computers.")),
  word(
    "computerphobia",
    article("com·put·er·pho·bi·a", "noun", "a strong dislike or fear of using computers."),
  ),
  {
    word: "aqua",
    dictionary: article(
      "aq·ua",
      "noun",
      "a light blue-green colour, like shallow sea water.",
      "water, in the names of preparations.",
    ),
    thesaurus: {
      part: "noun",
      example: "walls painted in aqua",
      synonyms: ["turquoise", "blue-green", "aquamarine", "teal"],
    },
    apple:
      "Aqua is the look of the Mac's interface: translucent bars and menus, rounded controls and buttons that take the accent colour. Dark Aqua is its dark appearance.",
  },
  {
    word: "compute",
    dictionary: article(
      "com·pute",
      "verb",
      "to work out by arithmetic.",
      "to make sense: the figures do not compute.",
    ),
    thesaurus: {
      part: "verb",
      example: "the program computes the totals",
      synonyms: ["calculate", "work out", "reckon", "figure", "tally"],
    },
  },
  {
    word: "desktop",
    dictionary: article("desk·top", "noun", "the top of a desk.", {
      text: "the area of a computer's screen behind its windows, where files and folders can be kept.",
      subsenses: ["a computer made to stay on a desk."],
    }),
    apple:
      "The desktop is the space behind your windows. It shows a picture you choose and the icons of the disks, files and folders you keep there; stacks group them by kind.",
  },
  {
    word: "dictionary",
    dictionary: article(
      "dic·tion·ar·y",
      "noun",
      "a book or program that lists the words of a language and says what they mean.",
      "a list of the terms of one subject with their explanations.",
    ),
    thesaurus: {
      part: "noun",
      example: "look the word up in a dictionary",
      synonyms: ["lexicon", "wordbook", "glossary", "vocabulary"],
    },
    apple:
      "Dictionary looks words up in the sources you choose in its preferences. Type in the search field and pick a source in the bar under the toolbar.",
    wikipedia:
      "A dictionary is a listing of the words of one or more languages, usually in alphabetical order, with their meanings and often their pronunciation, origin and use.",
  },
  {
    word: "dock",
    dictionary: article(
      "dock",
      "noun",
      "a place in a harbour where ships are loaded, unloaded or repaired.",
    ),
    apple:
      "The Dock is the row of icons at the edge of the screen. It holds the applications you use most, the ones that are open, minimized windows, stacks of files and the Trash.",
  },
  {
    word: "finder",
    dictionary: article("find·er", "noun", "a person or thing that finds something."),
    apple:
      "The Finder is the application that shows your disks, folders and files. It is always open; its windows have a sidebar of places and four ways to view a folder.",
  },
  {
    word: "menu",
    dictionary: article(
      "men·u",
      "noun",
      "a list of the dishes of a meal or a restaurant.",
      "a list of commands or choices shown by a computer.",
    ),
    thesaurus: {
      part: "noun",
      example: "choose a command from the menu",
      synonyms: ["list", "bill of fare", "choices", "options"],
    },
  },
  {
    word: "window",
    dictionary: article(
      "win·dow",
      "noun",
      "an opening in a wall or roof that lets in light and air, usually filled with glass.",
      "a framed area of a computer's screen that shows one document or application.",
    ),
    thesaurus: {
      part: "noun",
      example: "she looked out of the window",
      synonyms: ["casement", "pane", "opening", "light"],
    },
    wikipedia:
      "In computing, a window is an area of the screen with its own frame, in which one program shows its content. Windows can usually be moved, resized, layered and closed.",
  },
];

/** Whether an entry has something to show in a scope, or a status that it shows in any. */
export const inScope = (entry: DictionaryEntry, scope: DictionaryScope): boolean =>
  entry.status !== undefined ||
  (scope === "all" ? SOURCES.some((source) => entry[source.id] !== undefined) : !!entry[scope]);

// The list's order: letter by letter, with a space or a hyphen before every letter, so that
// "computer virus" comes before "computerese", as in the capture.
const sortKey = (text: string) => text.toLowerCase().replaceAll("-", " ");

/**
 * The headwords that start with what was typed and have something to show in the scope, in
 * the list's order. An empty search finds nothing.
 */
export function search(
  entries: readonly DictionaryEntry[],
  query: string,
  scope: DictionaryScope,
): DictionaryEntry[] {
  const start = sortKey(query.trim());
  if (start === "") return [];
  return entries
    .filter((entry) => sortKey(entry.word).startsWith(start) && inScope(entry, scope))
    .sort((a, b) => (sortKey(a.word) < sortKey(b.word) ? -1 : 1));
}
