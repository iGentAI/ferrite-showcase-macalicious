// Raw colours in ordinary component CSS (CONTRIBUTING.md, "Styling conventions": tokens only),
// and the one reading of a component stylesheet that every convention check uses (`readCss`).
//
// What these checks are for: they are convention checks for contributors. They report what
// someone writes in a component stylesheet in the ordinary course of work, in every spelling
// CSS accepts (any letter case, identifier escapes, a name split by an escape's line break),
// and they must not report ordinary valid CSS that only looks like it: text in a string, in a
// comment, in the contents of url() or in an attribute selector's value is not syntax and is
// never read as a class, an at-rule, a property, a colour or an appearance test. The
// stylesheet is read with regular expressions and a small declaration splitter, not a CSS
// parser.
// Known limits:
//
//   - Only component stylesheets are read. A colour in a `style` prop or built in JavaScript
//     is not seen.
//   - Strings and url() are skipped whole, so a colour inside an inline SVG (`url("data:…")`)
//     is not seen. Use such an image as a mask and colour it with a token.
//   - Which properties take names and never colours is a fixed list (NAMES_ONLY below). In a
//     property that is not on it, a custom name that is also a colour name (`coral`) is
//     reported; rename it or add the property to the list.
//   - A value that only becomes a colour at run time (a custom property set elsewhere, an
//     attr() fallback) is judged by what the stylesheet says, not by what it resolves to.
//
// The stylesheet is read as declarations, not line by line, so that an exemption covers exactly
// one declaration or one colour expression and nothing that happens to share its line:
//
//   - A colour is a hex colour, a colour function (rgb(), oklch(), color(), ...) or a CSS named
//     colour. `transparent`, `currentColor` and the forced-colours system colours (ButtonText,
//     GrayText, ...) are not: they carry no value of the library's own. Names are read as CSS
//     reads them: in any letter case and with identifier escapes decoded (`r\65 d` is `red`).
//   - A named colour is looked for in every property except the few whose value is made of
//     names the author chose and cannot hold a colour (`animation-name: coral`,
//     `grid-area: red`, a font family). Hex colours and colour functions are reported in every
//     property.
//   - A relative colour whose origin is a `--mac-*` token and nothing else,
//     `rgb(from var(--mac-x) r g b / 0.5)`, is not a raw colour. Only the function and that
//     origin are passed over: a fallback in the var() (`var(--mac-x, #f00)`), an origin that is
//     not a token, and any other colour in the declaration are still reported.
//   - The alpha of a mask is the one raw colour allowed, in a `mask` or `mask-image` declaration
//     that carries the mark `raw-color-ok` in a comment: inside the declaration, after it on
//     the line it ends on, or before it on its first line or the line above. A comment that
//     trails one declaration marks that declaration only, never the one that follows.

const NAMED = new Set(
  `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet
  brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan
  darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta
  darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue
  darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey
  dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray
  green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush
  lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray
  lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray
  lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon
  mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue
  mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin
  navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen
  paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple
  rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna
  silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle
  tomato turquoise violet wheat white whitesmoke yellow yellowgreen`.split(/\s+/),
);

const COLOR_FUNCTION = /(?<![\w-])(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch|color|device-cmyk)\(/gi;
// The function name and its origin, when the origin is one --mac-* token without a fallback.
const RELATIVE_FROM_TOKEN =
  /(?<![\w-])(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch|color)\(\s*from\s+var\(\s*--mac-[\w-]+\s*\)/gi;
const HEX = /#[0-9a-fA-F]{3,8}(?![\w-])/g;
// A word that is not part of a longer identifier and not a function name (tan() is maths).
const WORD = /(?<![\w#.-])[a-zA-Z]+(?![\w-]|\s*\()/g;
const MASK = /^(?:-webkit-)?mask(?:-image)?$/;
// Properties whose value is names the author chose, strings and keywords, and never a colour,
// so a word such as `coral` there is a name and not a colour. Anything not listed is checked.
const NAMES_ONLY = new Set(
  `anchor-name anchor-scope animation animation-name animation-timeline container
  container-name counter-increment counter-reset counter-set font font-family
  font-variant-alternates grid grid-area grid-column grid-column-end grid-column-start
  grid-row grid-row-end grid-row-start grid-template grid-template-areas
  grid-template-columns grid-template-rows list-style-type page position-anchor position-try
  position-try-fallbacks scroll-timeline scroll-timeline-name string-set timeline-scope
  transition transition-property view-timeline view-timeline-name view-transition-class
  view-transition-name voice-family will-change`.split(/\s+/),
);
// The same, but only outside functions: `list-style: coral` names a counter style, while
// `list-style: linear-gradient(coral, …)` is an image and holds a colour.
const NAMES_AT_TOP_LEVEL = new Set(["list-style"]);

const blank = (text) => text.replace(/[^\n]/g, " ");

// An escaped character, a comment or a string, whichever starts first: `/*` inside a string
// does not open a comment, a quote inside a comment does not open a string, and an escaped
// quote (`[title=it\'s]`) opens nothing. A backslash in a string takes the next character
// with it, a line break included (CSS continues the string on the next line).
const STRING = /"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'/;
const TOKEN = new RegExp(`\\\\[\\s\\S]|/\\*[\\s\\S]*?\\*/|${STRING.source}`, "g");
const isComment = (token) => token.startsWith("/*");
const isString = (token) => token.startsWith('"') || token.startsWith("'");

/** Blank out comments, keeping every newline so positions still map to lines. */
const stripComments = (css) =>
  css.replace(TOKEN, (token) => (isComment(token) ? blank(token) : token));

/** Blank out comments and strings alike, at unchanged length. */
const stripCommentsAndStrings = (css) =>
  css.replace(TOKEN, (token) => (isComment(token) || isString(token) ? blank(token) : token));

/**
 * `text` with CSS escapes replaced by the characters they stand for (`r\65 d` becomes `red`),
 * and `map`, which gives for each character of the result its position in `text`.
 *
 * An escaped character is part of a name and never syntax: `light-dark\(` is an identifier,
 * not a function, `\.other` no class, and `\)` does not close a url(). So an escape that
 * stands for anything but a name character (a letter, a digit, `-`, `_`, or a character
 * outside ASCII) is decoded to `_`, which keeps the name in one piece and can be mistaken for
 * no punctuation.
 */
function decode(text) {
  let out = "";
  const map = [];
  for (let i = 0; i < text.length; ) {
    let char = text[i];
    let next = i + 1;
    if (char === "\\" && next < text.length && !/[\n\r\f]/.test(text[next])) {
      const hex = /^[0-9a-fA-F]{1,6}/.exec(text.slice(next, next + 6));
      if (hex) {
        const code = Number.parseInt(hex[0], 16);
        char = code === 0 || code > 0x10ffff ? "\ufffd" : String.fromCodePoint(code);
        next += hex[0].length;
        // One white space after a hex escape belongs to it; CRLF counts as one.
        if (text[next] === "\r" && text[next + 1] === "\n") next += 2;
        else if (/[ \t\n\r\f]/.test(text[next] ?? "")) next++;
      } else {
        char = String.fromCodePoint(text.codePointAt(next));
        next += char.length;
      }
      if (!/^[\w-]$/.test(char) && char.codePointAt(0) < 0x80) char = "_";
    }
    for (let unit = 0; unit < char.length; unit++) map.push(i);
    out += char;
    i = next;
  }
  return { text: out, map };
}

/** CSS text with its escapes decoded. */
const decodeCssEscapes = (text) => decode(text).text;

/**
 * A component stylesheet as every convention check reads it, made here and nowhere else:
 * comments and strings blanked, escapes decoded over the whole text (so a name split by an
 * escape's closing line break, `l\69` + newline + `ght-dark(`, is one name), the contents
 * of url() and the values of attribute selectors blanked. What is left is syntax: `content: ".foo"`, `[data-note="@import"]` and
 * `url(data:text/plain,!important)` hold a class, an at-rule and a flag in name only.
 * `matches(pattern)` gives every match of a global regular expression in that text, as
 * `{ line, match }`, the line counted from 1 in the file as written. (What a stylesheet
 * refers to, `@import` and url(), is read by scripts/lib/css-references.mjs.)
 */
export function readCss(raw) {
  const { text, map } = decode(stripCommentsAndStrings(raw));
  const lineOf = (index) => raw.slice(0, map[index]).split("\n").length;
  const code = text
    .replace(/(?<![\w-])url\([^)]*\)/gi, blank)
    // The value of an attribute selector written without quotes: `[data-note=red]`.
    .replace(/(\[\s*[\w-]+\s*[~|^$*]?=\s*)([^\]\s]+)/g, (_, head, value) => head + blank(value));
  return {
    matches: (pattern) =>
      [...code.matchAll(pattern)].map((match) => ({ line: lineOf(match.index), match })),
  };
}

/**
 * A declaration's value with escapes decoded and everything that cannot be a raw colour
 * blanked out: strings, url(), counter() and counters(), the attribute named by attr(), the
 * head of a relative colour whose origin is a token (the rest of that expression is still
 * read) and custom property names. Returned with the map from positions in the result to
 * positions in `value`.
 */
function colourBearing(value) {
  // Strings go first, so that an escape inside one is not read as part of a name. Function
  // names are matched after decoding, so `c\6f unter(red)` is read as `counter(red)`.
  const { text, map } = decode(stripCommentsAndStrings(value));
  return {
    text: text
      .replace(/(?<![\w-])(?:url|counters?)\([^)]*\)/gi, blank)
      // The attribute an attr() names, not its fallback.
      .replace(/(?<![\w-])attr\(\s*[\w-]+/gi, blank)
      .replace(RELATIVE_FROM_TOKEN, blank)
      .replace(/--[\w-]+/g, blank),
    map,
  };
}

/** Whether position `index` of `value` is outside every pair of parentheses. */
function atTopLevel(value, index) {
  let depth = 0;
  for (let i = 0; i < index; i++) {
    if (value[i] === "(") depth++;
    else if (value[i] === ")") depth = Math.max(0, depth - 1);
  }
  return depth === 0;
}

/**
 * Raw colours in a component stylesheet, as `{ line, marked }`, one entry per line that holds
 * one. `marked` says a declaration on that line carries `raw-color-ok` although it is not a
 * mask, so the caller can say why the mark did not help.
 */
export function rawColours(raw) {
  const css = stripComments(raw);
  const lineAt = (index) => css.slice(0, index).split("\n").length;
  const found = new Map();
  // Comments that carry the mark. Stripping keeps every position, so these index `css` too.
  const marks = [...raw.matchAll(TOKEN)]
    .filter((comment) => isComment(comment[0]) && comment[0].includes("raw-color-ok"))
    .map((comment) => ({ at: comment.index, end: comment.index + comment[0].length }));

  /** `from` is just past the previous terminator; `afterDeclaration` says that was a `;`. */
  function declaration(from, to, afterDeclaration) {
    const text = css.slice(from, to);
    const colon = text.indexOf(":");
    if (colon === -1 || text.trim() === "") return;
    const property = decodeCssEscapes(text.slice(0, colon)).trim().toLowerCase();
    if (property.startsWith("@")) return;
    const first = from + text.search(/\S/);
    const marked = marks.some(({ at, end }) => {
      // Inside the declaration.
      if (at >= first && at < to) return true;
      // After it, on the line it ends on, with nothing but its semicolon between.
      if (at >= to) return /^;?[ \t]*$/.test(css.slice(to, at));
      if (at < from) return false;
      // Before it. A comment on the line the previous declaration ended on belongs to that one.
      if (afterDeclaration && !css.slice(from, at).includes("\n")) return false;
      // Otherwise it must end on the declaration's first line or on the line above.
      return lineAt(end) >= lineAt(first) - 1;
    });
    if (marked && MASK.test(property)) return;

    const { text: value, map } = colourBearing(text.slice(colon + 1));
    const valueAt = from + colon + 1;
    const plain = property.replace(/^-(?:webkit|moz|ms|o)-/, "");
    const namesOnly = NAMES_ONLY.has(plain);
    const namesAtTopLevel = NAMES_AT_TOP_LEVEL.has(plain);
    const hits = [
      ...[...value.matchAll(HEX)].map((match) => match.index),
      ...[...value.matchAll(COLOR_FUNCTION)].map((match) => match.index),
      ...(namesOnly ? [] : [...value.matchAll(WORD)])
        .filter((match) => NAMED.has(match[0].toLowerCase()))
        .filter((match) => !(namesAtTopLevel && atTopLevel(value, match.index)))
        .map((match) => match.index),
    ];
    for (const index of hits) {
      const line = lineAt(valueAt + map[index]);
      const had = found.get(line);
      if (!had || (marked && !had.marked)) found.set(line, { line, marked });
    }
  }

  let start = 0;
  let afterDeclaration = false;
  let depth = 0;
  let quote = "";
  for (let i = 0; i < css.length; i++) {
    const char = css[i];
    // An escaped character is never syntax, in a string or outside one.
    if (char === "\\") i++;
    else if (quote) {
      if (char === quote) quote = "";
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "(") depth++;
    else if (char === ")") depth = Math.max(0, depth - 1);
    else if (depth > 0) continue;
    // What came before an opening brace was a selector or an at-rule, not a declaration.
    else if (char === "{") {
      start = i + 1;
      afterDeclaration = false;
    } else if (char === ";" || char === "}") {
      declaration(start, i, afterDeclaration);
      start = i + 1;
      afterDeclaration = char === ";";
    }
  }
  return [...found.values()].sort((a, b) => a.line - b.line);
}
