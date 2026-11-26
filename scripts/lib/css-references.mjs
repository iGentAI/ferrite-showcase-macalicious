// What a stylesheet refers to outside itself, read the way CSS reads it: comments and strings
// are skipped, and names match in any case and through escapes (`@IMPORT`, `\75rl(`). Shared
// by lint (scripts/check-conventions.mjs) and the package build (vite.shared.ts), so the two
// cannot disagree about what a stylesheet holds.

const HEX = /[0-9a-fA-F]/;
const NAME = /[-\w\u0080-\uffff]/;
const SPACE = /\s/;

/**
 * The `@import` rules and the `url()` references of a stylesheet, with their 1-based lines.
 * A string directly inside `image-set()` is a URL too. An `@import` or `url(` written inside
 * a comment, a string or a `data:` URI is text, not a reference, and is left out.
 *
 * @param {string} css
 * @returns {{ imports: { line: number }[], urls: { url: string, line: number }[] }}
 */
export function cssReferences(css) {
  const imports = [];
  const urls = [];
  let i = 0;
  let line = 1;
  const advance = (to) => {
    for (; i < to; i++) if (css[i] === "\n") line++;
  };
  // The name at i (identifier characters and escapes), decoded and in lower case.
  const name = () => {
    let text = "";
    while (i < css.length) {
      if (css[i] === "\\" && i + 1 < css.length && css[i + 1] !== "\n") {
        let j = i + 1;
        let hex = "";
        while (hex.length < 6 && HEX.test(css[j] ?? "")) hex += css[j++];
        if (hex === "") text += css[j++];
        else {
          const point = Number.parseInt(hex, 16);
          text += String.fromCodePoint(point > 0 && point <= 0x10ffff ? point : 0xfffd);
          if (SPACE.test(css[j] ?? "")) j++;
        }
        advance(j);
      } else if (NAME.test(css[i])) text += css[i++];
      else break;
    }
    return text.toLowerCase();
  };
  // The quoted string at i; an unclosed one ends at the line break, as in CSS.
  const string = () => {
    const quote = css[i];
    let text = "";
    let j = i + 1;
    while (j < css.length && css[j] !== quote && css[j] !== "\n") {
      if (css[j] === "\\") j++;
      text += css[j++] ?? "";
    }
    advance(Math.min(j + 1, css.length));
    return text;
  };

  let depth = 0;
  const imageSets = []; // the parenthesis depth of every open image-set()
  while (i < css.length) {
    const char = css[i];
    if (char === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      advance(end === -1 ? css.length : end + 2);
    } else if (char === '"' || char === "'") {
      const at = line;
      const text = string();
      if (imageSets.at(-1) === depth) urls.push({ url: text, line: at });
    } else if (char === "@") {
      const at = line;
      i++;
      if (name() === "import") imports.push({ line: at });
    } else if (char === "(") {
      depth++;
      i++;
    } else if (char === ")") {
      if (imageSets.at(-1) === depth) imageSets.pop();
      depth--;
      i++;
    } else if (char === "\\" || NAME.test(char)) {
      const at = line;
      const start = i;
      const word = name();
      if (i === start) advance(i + 1);
      else if (css[i] === "(") {
        depth++;
        i++;
        if (word === "url") {
          let j = i;
          while (SPACE.test(css[j] ?? "")) j++;
          advance(j);
          if (css[i] === '"' || css[i] === "'") urls.push({ url: string(), line: at });
          else {
            while (j < css.length && css[j] !== ")" && !SPACE.test(css[j])) j++;
            urls.push({ url: css.slice(i, j), line: at });
            advance(j);
          }
        } else if (word === "image-set" || word === "-webkit-image-set") imageSets.push(depth);
      }
    } else advance(i + 1);
  }
  return { imports, urls };
}
