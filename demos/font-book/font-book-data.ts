/**
 * The fonts and collections of the Font Book demo.
 *
 * The family names are those of fonts that ship with macOS 10.15; the end of the list is the
 * part the reference screenshots show. No font is included: every family is previewed in a
 * stack of fonts the browser may have, which starts with the family's own name, so a Mac draws
 * the real face and other platforms a stand-in of the same kind.
 */

/** What a family is for, which decides its sample text and the fonts that stand in for it. */
export type FontKind = "sans" | "serif" | "mono" | "script" | "display" | "symbol" | "cjk";

/** The writing system of a family: the language its sample is set in. */
export type FontScript =
  | "Latin"
  | "Arabic"
  | "Simplified Chinese"
  | "Traditional Chinese"
  | "Japanese"
  | "Symbols";

/** One face of a family, as CSS can ask for it. */
export interface FontStyle {
  /** Identifies the style in the font list: the family's id, a slash and the style's name. */
  id: string;
  /** The style's name as Font Book lists it: "Regular", "Bold Italic". */
  name: string;
  /** CSS `font-weight`, read from the name. */
  weight: number;
  /** Whether the name says Italic or Oblique. */
  italic: boolean;
  /** CSS `font-stretch`, read from the name. */
  stretch: "condensed" | "normal" | "expanded";
}

/** One family of the font list. */
export interface FontFamily {
  /** Identifies the family in the font list. */
  id: string;
  /** The family's name. */
  name: string;
  /** Its faces; the first is the one shown when the family itself is selected. */
  styles: readonly FontStyle[];
  /** What the family is for. */
  kind: FontKind;
  /** Its writing system. */
  script: FontScript;
  /** CSS `font-family` for the preview: the family's own name, then stand-ins of its kind. */
  stack: string;
  /** False for a font macOS lists and has not downloaded: its row is grey. */
  available: boolean;
  /** True for a font the system needs, which cannot be disabled. */
  required: boolean;
  /** The lines of the Sample view, when they are not the script's own. */
  sample?: string;
  /** Line height of the sample as a multiple of the size, when it is not the default. */
  leading?: number;
  /** The characters of the Repertoire view, when they are not the script's own. */
  repertoire?: readonly [first: number, last: number][];
}

/** A row of the sidebar. */
export interface FontCollection {
  /** Identifies the collection in the sidebar. */
  id: string;
  /** Its name, which is also the first part of the window's title. */
  name: string;
  /** The glyph before the name. */
  icon: "library" | "smart" | "collection";
  /** The ids of the families of a collection that is a plain list. */
  families?: readonly string[];
  /** The rule of a smart collection, or of the library: the families it accepts. */
  matches?: (family: FontFamily) => boolean;
}

/** The fonts that stand in for a family of each kind where the family itself is missing. */
const FALLBACKS: Record<FontKind, string> = {
  sans: "Helvetica, Arial, sans-serif",
  serif: '"Times New Roman", Times, serif',
  mono: '"Courier New", Courier, monospace',
  script: '"Brush Script MT", cursive',
  display: "Impact, fantasy",
  symbol: '"Apple Symbols", "Segoe UI Symbol", "DejaVu Sans", sans-serif',
  cjk: '"PingFang SC", "Hiragino Sans", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif',
};

const WEIGHTS: readonly [pattern: RegExp, weight: number][] = [
  [/ultra ?light/i, 200],
  [/extra ?black/i, 900],
  [/(extra|ultra) ?bold|heavy/i, 800],
  [/(semi|demi) ?bold|demi/i, 600],
  [/black/i, 900],
  [/bold/i, 700],
  [/medium/i, 500],
  [/thin/i, 100],
  [/light/i, 300],
];

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/\+/g, "plus")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** A style from its name: the weight, slant and width the name states. */
export function fontStyle(familyId: string, name: string): FontStyle {
  return {
    id: `${familyId}/${slug(name)}`,
    name,
    weight: WEIGHTS.find(([pattern]) => pattern.test(name))?.[1] ?? 400,
    italic: /italic|oblique/i.test(name),
    stretch: /condensed/i.test(name)
      ? "condensed"
      : /extended|wide/i.test(name)
        ? "expanded"
        : "normal",
  };
}

interface FamilyOptions {
  script?: FontScript;
  available?: boolean;
  required?: boolean;
  sample?: string;
  leading?: number;
  repertoire?: readonly [number, number][];
}

/** A family from its name, its style names (separated by commas) and its kind. */
export function fontFamily(
  name: string,
  styles: string,
  kind: FontKind,
  options: FamilyOptions = {},
): FontFamily {
  const id = slug(name);
  return {
    id,
    name,
    styles: styles.split(", ").map((style) => fontStyle(id, style)),
    kind,
    script: options.script ?? (kind === "symbol" ? "Symbols" : "Latin"),
    stack: `${/^[A-Za-z]+$/.test(name) ? name : `"${name}"`}, ${FALLBACKS[kind]}`,
    available: options.available ?? true,
    required: options.required ?? false,
    sample: options.sample,
    leading: options.leading,
    repertoire: options.repertoire,
  };
}

const FOUR = "Regular, Italic, Bold, Bold Italic";
const TWELVE =
  "Regular, Italic, Ultra Light, Ultra Light Italic, Medium, Medium Italic, Demi Bold, Demi Bold Italic, Bold, Bold Italic, Heavy, Heavy Italic";

/** Not downloaded: macOS lists these and draws them grey. */
const SC = { script: "Simplified Chinese", available: false } as const;
const TC = { script: "Traditional Chinese", available: false } as const;
const JA = { script: "Japanese", available: false } as const;

/**
 * The sample of Zapf Dingbats: six rows of the Unicode dingbats (U+2701 and on), as the
 * capture has six rows of the font's glyphs. Which glyphs a row holds is not the capture's.
 */
const DINGBATS = [
  "✁✂✃✄✆✇✈✉✌✍✎✏✐",
  "✑✒✓✔✕✖✗✘✙✚✛✜✝✞✟",
  "✠✡✢✣✤✥✦✧★✩✪✫✬✭",
  "✮✯✰✱✲✳✴✵✶✷✸✹✺✻",
  "✼✽✾✿❀❁❂❃❄❅❆❇❈❉❊",
  "❶❷❸❹❺➅➆➇➈➉❤❥❦❧",
].join("\n");

/**
 * The dingbats block without the code points Zapf Dingbats lacks, which are also the ones a
 * browser draws as colour emoji.
 */
const DINGBAT_RANGES: readonly [number, number][] = [
  [0x2701, 0x2704],
  [0x2706, 0x2709],
  [0x270c, 0x2727],
  [0x2729, 0x274b],
  [0x274d, 0x274d],
  [0x274f, 0x2752],
  [0x2756, 0x2756],
  [0x2758, 0x275e],
  [0x2761, 0x2767],
  [0x2776, 0x2794],
  [0x2798, 0x27af],
  [0x27b1, 0x27be],
];

/** Miscellaneous symbols, without the ones a browser draws as colour emoji. */
const SYMBOL_RANGES: readonly [number, number][] = [
  [0x2600, 0x2613],
  [0x2616, 0x2647],
  [0x2654, 0x267e],
];

/** Every family, in the order of the font list: by name. */
export const families: readonly FontFamily[] = [
  fontFamily("Al Bayan", "Plain, Bold", "serif", { script: "Arabic" }),
  fontFamily(
    "American Typewriter",
    "Regular, Light, Semibold, Bold, Condensed, Condensed Light, Condensed Bold",
    "serif",
  ),
  fontFamily("Andale Mono", "Regular", "mono"),
  fontFamily("Apple Chancery", "Chancery", "script"),
  fontFamily("Apple Symbols", "Regular", "symbol", { required: true }),
  fontFamily("Arial", FOUR, "sans"),
  fontFamily("Arial Black", "Regular", "sans"),
  fontFamily("Arial Narrow", FOUR, "sans"),
  fontFamily("Arial Rounded MT Bold", "Regular", "sans"),
  fontFamily("Athelas", FOUR, "serif"),
  fontFamily(
    "Avenir",
    "Book, Roman, Book Oblique, Oblique, Light, Light Oblique, Medium, Medium Oblique, Heavy, Heavy Oblique, Black, Black Oblique",
    "sans",
  ),
  fontFamily("Avenir Next", TWELVE, "sans"),
  fontFamily("Avenir Next Condensed", TWELVE, "sans"),
  fontFamily(
    "Baskerville",
    "Regular, Italic, SemiBold, SemiBold Italic, Bold, Bold Italic",
    "serif",
  ),
  fontFamily("Big Caslon", "Medium", "serif"),
  fontFamily("Bodoni 72", "Book, Book Italic, Bold", "serif"),
  fontFamily("Bradley Hand", "Bold", "script"),
  fontFamily("Brush Script MT", "Italic", "script"),
  fontFamily("Chalkboard", "Regular, Bold", "script"),
  fontFamily("Chalkboard SE", "Light, Regular, Bold", "script"),
  fontFamily("Chalkduster", "Regular", "display"),
  fontFamily("Charter", "Roman, Italic, Bold, Bold Italic, Black, Black Italic", "serif"),
  fontFamily("Cochin", FOUR, "serif"),
  fontFamily("Comic Sans MS", "Regular, Bold", "script"),
  fontFamily("Copperplate", "Regular, Light, Bold", "display"),
  fontFamily("Courier", "Regular, Oblique, Bold, Bold Oblique", "mono", { required: true }),
  fontFamily("Courier New", FOUR, "mono"),
  fontFamily("Didot", "Regular, Italic, Bold", "serif"),
  fontFamily("DIN Alternate", "Bold", "sans"),
  fontFamily("DIN Condensed", "Bold", "sans"),
  fontFamily(
    "Futura",
    "Medium, Medium Italic, Bold, Condensed Medium, Condensed ExtraBold",
    "sans",
  ),
  fontFamily("Geneva", "Regular", "sans", { required: true }),
  fontFamily("Georgia", FOUR, "serif"),
  fontFamily(
    "Gill Sans",
    "Regular, Italic, Light, Light Italic, SemiBold, SemiBold Italic, Bold, Bold Italic, UltraBold",
    "sans",
  ),
  fontFamily("Helvetica", "Regular, Oblique, Light, Light Oblique, Bold, Bold Oblique", "sans", {
    required: true,
  }),
  fontFamily(
    "Helvetica Neue",
    "Regular, Italic, UltraLight, UltraLight Italic, Thin, Thin Italic, Light, Light Italic, Medium, Medium Italic, Bold, Bold Italic, Condensed Bold, Condensed Black",
    "sans",
    { required: true },
  ),
  fontFamily("Herculanum", "Regular", "display"),
  fontFamily("Hoefler Text", "Regular, Italic, Black, Black Italic, Ornaments", "serif"),
  fontFamily("Impact", "Regular", "display"),
  fontFamily("Iowan Old Style", "Roman, Italic, Bold, Bold Italic, Black, Black Italic", "serif"),
  fontFamily("Lucida Grande", "Regular, Bold", "sans", { required: true }),
  fontFamily("Luminari", "Regular", "display"),
  fontFamily("Marion", "Regular, Italic, Bold", "serif"),
  fontFamily("Marker Felt", "Thin, Wide", "script"),
  fontFamily("Menlo", FOUR, "mono", { required: true }),
  fontFamily("Monaco", "Regular", "mono", { required: true }),
  fontFamily("Noteworthy", "Light, Bold", "script"),
  fontFamily("Optima", "Regular, Italic, Bold, Bold Italic, ExtraBlack", "sans"),
  fontFamily("Palatino", FOUR, "serif"),
  fontFamily("Papyrus", "Regular, Condensed", "display"),
  fontFamily("Phosphate", "Inline, Solid", "display"),
  fontFamily("PT Mono", "Regular, Bold", "mono"),
  fontFamily("PT Sans", FOUR, "sans"),
  fontFamily("PT Serif", FOUR, "serif"),
  fontFamily("Rockwell", FOUR, "serif"),
  fontFamily("Savoye LET", "Plain", "script"),
  fontFamily("SignPainter", "HouseScript, HouseScript Semibold", "script"),
  fontFamily(
    "Skia",
    "Regular, Light, Bold, Black, Extended, Condensed, Light Extended, Light Condensed, Black Extended, Black Condensed",
    "sans",
  ),
  fontFamily("Snell Roundhand", "Regular, Bold, Black", "script"),
  fontFamily("Symbol", "Regular", "symbol", {
    required: true,
    sample: "ΑΒΓΔΕΖΗΘΙΚΛΜ\nΝΞΟΠΡΣΤΥΦΧΨΩ\nαβγδεζηθικλμ\nνξοπρστυφχψω\n∀∂∃∅∇∈∉∑√∞∫≈≠≤≥",
    repertoire: [
      [0x391, 0x3a1],
      [0x3a3, 0x3a9],
      [0x3b1, 0x3c9],
      [0x2200, 0x222b],
    ],
  }),
  fontFamily("Tahoma", "Regular, Bold", "sans"),
  fontFamily("Times", FOUR, "serif", { required: true }),
  fontFamily("Times New Roman", FOUR, "serif"),
  fontFamily("Toppan Bunkyu Midashi Gothic", "Extrabold", "cjk", JA),
  fontFamily("Toppan Bunkyu Midashi Mincho", "Extrabold", "cjk", JA),
  fontFamily("Toppan Bunkyu Mincho", "Regular", "cjk", JA),
  fontFamily("Trattatello", "Regular", "display"),
  fontFamily("Trebuchet MS", FOUR, "sans"),
  fontFamily("Tsukushi A Round Gothic", "Regular, Bold", "cjk", JA),
  fontFamily("Tsukushi B Round Gothic", "Regular, Bold", "cjk", JA),
  fontFamily("Verdana", FOUR, "sans"),
  fontFamily("Waseem", "Regular, Light", "serif", { script: "Arabic" }),
  fontFamily("Wawati SC", "Regular", "cjk", SC),
  fontFamily("Wawati TC", "Regular", "cjk", TC),
  fontFamily("Webdings", "Regular", "symbol", {
    sample: "☀☁☂☃★☆☎☏☐☑☒\n☚☛☜☝☞☟☠☢☣☮☯\n♔♕♖♗♘♙♚♛♜♝♞♟",
    repertoire: SYMBOL_RANGES,
  }),
  fontFamily("Weibei SC", "Bold", "cjk", SC),
  fontFamily("Weibei TC", "Bold", "cjk", TC),
  fontFamily("Wingdings", "Regular", "symbol", {
    sample: "✁✂✃✄☎✆✇✈✉☛☞✌✍✎\n☺☹☠⚐☼❄✞✠✡☪☯☸\n✦✧★✩✪✰✓✗☑☒",
    repertoire: DINGBAT_RANGES.slice(0, 4),
  }),
  fontFamily("Wingdings 2", "Regular", "symbol", {
    sample: "☐☑☒✓✔✕✖✗✘\n①②③④⑤⑥⑦⑧⑨⑩\n❶❷❸❹❺❻❼❽❾❿",
    repertoire: [
      [0x2460, 0x2473],
      [0x2776, 0x2793],
    ],
  }),
  fontFamily("Wingdings 3", "Regular", "symbol", {
    sample: "←↑→↓↔↕↖↗↘↙\n⇐⇑⇒⇓⇔⇕⇦⇧⇨⇩\n▲▼◀▶△▽◁▷",
    repertoire: [
      [0x2190, 0x21ff],
      [0x25b2, 0x25c5],
    ],
  }),
  fontFamily("Xingkai SC", "Light, Bold", "cjk", SC),
  fontFamily("Xingkai TC", "Light, Bold", "cjk", TC),
  fontFamily("Yuanti SC", "Light, Regular, Bold", "cjk", SC),
  fontFamily("Yuanti TC", "Light, Regular, Bold", "cjk", TC),
  fontFamily("YuGothic", "Medium, Bold", "cjk", JA),
  fontFamily("YuKyokasho", "Medium, Bold", "cjk", JA),
  fontFamily("YuKyokasho Yoko", "Medium, Bold", "cjk", JA),
  fontFamily("YuMincho", "Medium, Demibold, Extrabold", "cjk", JA),
  fontFamily("YuMincho +36p Kana", "Medium, Demibold, Extrabold", "cjk", JA),
  fontFamily("Yuppy SC", "Regular", "cjk", SC),
  fontFamily("Yuppy TC", "Regular", "cjk", TC),
  fontFamily("Zapf Dingbats", "Regular", "symbol", {
    required: true,
    sample: DINGBATS,
    // Measured: the six rows of the capture are 41.7 pt apart at 42 pt.
    leading: 0.993,
    repertoire: DINGBAT_RANGES,
  }),
  fontFamily("Zapfino", "Regular", "script"),
];

const named =
  (...names: string[]) =>
  (family: FontFamily) =>
    names.includes(family.name);

/** The library, which holds every font. */
export const allFonts: FontCollection = {
  id: "all-fonts",
  name: "All Fonts",
  icon: "library",
  matches: () => true,
};

/** The collections that follow a rule. */
export const smartCollections: readonly FontCollection[] = [
  {
    id: "english",
    name: "English",
    icon: "library",
    matches: (family) => family.script === "Latin",
  },
  {
    id: "fixed-width",
    name: "Fixed Width",
    icon: "smart",
    matches: (family) => family.kind === "mono",
  },
];

const LANGUAGE_COLLECTIONS: readonly (readonly [RegExp, FontScript])[] = [
  [/^ar\b/i, "Arabic"],
  [/^ja\b/i, "Japanese"],
  [/^zh-(hant|tw|hk|mo)\b/i, "Traditional Chinese"],
  [/^zh\b/i, "Simplified Chinese"],
];

/**
 * The smart collections of the person's other languages, as macOS adds one for each language in
 * use: here the browser's languages, which is what Language & Region lists on this desktop.
 */
export function languageCollections(languages: readonly string[]): readonly FontCollection[] {
  const scripts = languages.flatMap(
    (tag) => LANGUAGE_COLLECTIONS.find(([pattern]) => pattern.test(tag))?.[1] ?? [],
  );
  return [...new Set(scripts)].map((script) => ({
    id: `language-${slug(script)}`,
    name: script,
    icon: "library" as const,
    matches: (family: FontFamily) => family.script === script,
  }));
}

/**
 * A reader of a kept list that gives one array for one stored value: `useKeptValue` takes a new array
 * for a new value, on every render.
 */
export function keptListReader<T>(
  read: (stored: readonly unknown[]) => readonly T[],
): (stored: unknown) => readonly T[] | undefined {
  const known = new WeakMap<object, readonly T[]>();
  return (stored) => {
    if (!Array.isArray(stored)) return undefined;
    const list = known.get(stored) ?? read(stored);
    known.set(stored, list);
    return list;
  };
}

/** Why a font macOS lists and has not downloaded stays dimmed here. */
export const DOWNLOAD_REASON = "This desktop has no font server to download it from.";

/** Where File > Restore Standard Fonts puts the fonts that were added, in Documents. */
export const REMOVED_FOLDER = "Fonts (Removed)";

/** The most characters the Repertoire view and report set: more than this would stall the page. */
export const REPERTOIRE_SHOWN = 5_000;

/** The collections that are lists of families, as macOS sets them up. */
export const defaultCollections: readonly FontCollection[] = [
  {
    id: "fun",
    name: "Fun",
    icon: "collection",
    matches: named(
      "American Typewriter",
      "Bradley Hand",
      "Brush Script MT",
      "Chalkboard",
      "Chalkduster",
      "Comic Sans MS",
      "Herculanum",
      "Luminari",
      "Marker Felt",
      "Noteworthy",
      "Papyrus",
      "Phosphate",
      "SignPainter",
      "Trattatello",
      "Zapfino",
    ),
  },
  {
    id: "modern",
    name: "Modern",
    icon: "collection",
    matches: named(
      "Avenir",
      "Avenir Next",
      "DIN Alternate",
      "Futura",
      "Geneva",
      "Gill Sans",
      "Helvetica Neue",
      "Optima",
    ),
  },
  {
    id: "pdf",
    name: "PDF",
    icon: "collection",
    matches: named("Courier", "Helvetica", "Symbol", "Times", "Zapf Dingbats"),
  },
  {
    id: "traditional",
    name: "Traditional",
    icon: "collection",
    matches: named(
      "Baskerville",
      "Big Caslon",
      "Bodoni 72",
      "Cochin",
      "Copperplate",
      "Didot",
      "Georgia",
      "Hoefler Text",
      "Marion",
      "Palatino",
      "Times New Roman",
    ),
  },
  {
    id: "web",
    name: "Web",
    icon: "collection",
    matches: named(
      "Andale Mono",
      "Arial",
      "Arial Black",
      "Comic Sans MS",
      "Courier New",
      "Georgia",
      "Impact",
      "Times New Roman",
      "Trebuchet MS",
      "Verdana",
      "Webdings",
    ),
  },
];

/** The families of a collection, out of `all`, in the list's order. */
export function familiesIn(
  collection: FontCollection,
  all: readonly FontFamily[],
): readonly FontFamily[] {
  if (collection.matches) return all.filter(collection.matches);
  const ids = collection.families ?? [];
  return all.filter((family) => ids.includes(family.id));
}

/** How many fonts a list of families holds: a font is one style of a family. */
export const fontCount = (list: readonly FontFamily[]) =>
  list.reduce((count, family) => count + family.styles.length, 0);

/** The title of the window: "All Fonts (281 Fonts)". */
export function windowTitle(collection: FontCollection, list: readonly FontFamily[]): string {
  const count = fontCount(list);
  return `${collection.name} (${count} ${count === 1 ? "Font" : "Fonts"})`;
}

/** The family and the style a row of the font list stands for; a family stands for its first. */
export function findFont(
  id: string | number | undefined,
  all: readonly FontFamily[],
): { family: FontFamily; style: FontStyle } | undefined {
  for (const family of all) {
    const [first] = family.styles;
    if (family.id === id && first) return { family, style: first };
    const style = family.styles.find((candidate) => candidate.id === id);
    if (style) return { family, style };
  }
  return undefined;
}

/** What the search field's menu offers to search in, in the menu's order. */
export const SEARCH_SCOPES = [
  { id: "all", name: "Everything" },
  { id: "family", name: "Family" },
  { id: "style", name: "Style" },
  { id: "postscript", name: "PostScript Name" },
] as const;

export type SearchScope = (typeof SEARCH_SCOPES)[number]["id"];

/**
 * The families that the text finds. Everywhere: those whose name, one of whose full font names
 * or one of whose PostScript names contains it, so that nothing a single scope finds is
 * missed. In one scope: those whose family name, one of whose style names or one of whose
 * PostScript names does.
 */
export function searchFamilies(
  list: readonly FontFamily[],
  text: string,
  scope: SearchScope = "all",
): readonly FontFamily[] {
  const query = text.trim().toLowerCase();
  if (query === "") return list;
  const has = (value: string) => value.toLowerCase().includes(query);
  const postScript = (family: FontFamily) =>
    family.styles.some((style) => has(postScriptName(family, style)));
  return list.filter((family) => {
    if (scope === "family") return has(family.name);
    if (scope === "style") return family.styles.some((style) => has(style.name));
    if (scope === "postscript") return postScript(family);
    return (
      has(family.name) ||
      family.styles.some((style) => has(`${family.name} ${style.name}`)) ||
      postScript(family)
    );
  });
}

const SAMPLES: Record<FontScript, string> = {
  Latin: "ABCDEFGHIJKLM\nNOPQRSTUVWXYZ\nabcdefghijklm\nnopqrstuvwxyz\n1234567890",
  Arabic: "أبجد هوز حطي كلمن\nسعفص قرشت ثخذ ضظغ\n٠١٢٣٤٥٦٧٨٩",
  "Simplified Chinese": "汉体书写信息技术标准相容\n档案下载使用界面简单\n1234567890",
  "Traditional Chinese": "漢體書寫信息技術標準相容\n檔案下載使用界面簡單\n1234567890",
  Japanese: "あいうえおかきくけこ\nアイウエオカキクケコ\n日本語の文字 1234567890",
  Symbols: "★☆☀☁☂☃☎☑☒☚☛\n♠♣♥♦♪♫♯\n←↑→↓↔↕",
};

const REPERTOIRES: Record<FontScript, readonly [number, number][]> = {
  Latin: [
    [0x21, 0x7e],
    [0xa1, 0xff],
  ],
  Arabic: [
    [0x621, 0x63a],
    [0x641, 0x64a],
    [0x660, 0x669],
  ],
  "Simplified Chinese": [
    [0x21, 0x7e],
    [0x4e00, 0x4e5f],
  ],
  "Traditional Chinese": [
    [0x21, 0x7e],
    [0x4e00, 0x4e5f],
  ],
  Japanese: [
    [0x3041, 0x3093],
    [0x30a1, 0x30f6],
  ],
  Symbols: SYMBOL_RANGES,
};

/** The lines the Sample view shows for a family. */
export const sampleOf = (family: FontFamily) => family.sample ?? SAMPLES[family.script];

/** The characters the Repertoire view shows for a family, in code point order. */
export function repertoireOf(family: FontFamily): readonly string[] {
  const glyphs: string[] = [];
  for (const [first, last] of family.repertoire ?? REPERTOIRES[family.script])
    for (let code = first; code <= last; code++)
      // U+00AD is the soft hyphen, which draws nothing.
      if (code !== 0xad) glyphs.push(String.fromCodePoint(code));
  return glyphs;
}

/** The text the Custom view starts with. */
export const CUSTOM_TEXT = "The quick brown fox jumps over the lazy dog.";

/** The sizes the Size combo box suggests, and the range of the slider beside it. */
export const SIZES = [9, 10, 11, 12, 13, 14, 18, 24, 36, 48, 64, 72, 96, 144, 288] as const;
export const MIN_SIZE = 9;
export const MAX_SIZE = 288;
/** The size of the reference screenshots. */
export const DEFAULT_SIZE = 42;

/** The next larger size of the list, for View > Bigger; the largest once past it. */
export const biggerSize = (size: number): number => SIZES.find((each) => each > size) ?? MAX_SIZE;
/** The next smaller size of the list, for View > Smaller; the smallest once past it. */
export const smallerSize = (size: number): number =>
  SIZES.findLast((each) => each < size) ?? MIN_SIZE;

/**
 * View > Fit: the largest whole size, within the slider's range, at which text fills a box.
 * `widest` is the width of its widest line at 100 pt, `lines` how many lines it has and `leading`
 * its line height as a multiple of the size.
 */
export function fitSize(
  widest: number,
  lines: number,
  leading: number,
  width: number,
  height: number,
): number {
  const fits = Math.min((width / widest) * 100, height / (lines * leading));
  return Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.floor(fits)));
}

/** A PostScript name by rule: the family and, unless the style is the plain one, the style. */
export function postScriptName(family: FontFamily, style: FontStyle): string {
  const base = family.name.replace(/[^A-Za-z0-9]/g, "");
  const face = style.name.replace(/[^A-Za-z0-9]/g, "");
  return /^(regular|plain)$/i.test(style.name) ? base : `${base}-${face}`;
}
