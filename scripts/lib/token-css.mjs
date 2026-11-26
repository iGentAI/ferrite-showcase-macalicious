// The rules for a component's own token file, <name>.tokens.css (CONTRIBUTING.md, "Component
// token files"): nothing but declarations of --mac-<name>-* custom properties, in rules whose
// selectors are :root, [data-appearance...] or [data-accent...].
//
// The file is read as CSS (comments, strings, nested blocks), not line by line, so a property
// that shares a line with something else, or a rule for an element, cannot slip through.
// What a value says is read the same way as in ordinary component CSS: `!important` through
// readCss (scripts/lib/raw-colors.mjs) and url() through cssReferences
// (scripts/lib/css-references.mjs), so text in a string or a comment is not taken for either,
// and `! IMPORTANT`, `!/**/important` and `!\69mportant` are what they are in CSS. The flag is a
// flag only at the top level of a declaration: in `f(!important)`, `[!important]` or
// `{!important}` it is part of the value, which a custom property may hold, and the declaration
// is not important.

import { cssReferences } from "./css-references.mjs";
import { readCss } from "./raw-colors.mjs";

const ALLOWED_SELECTOR =
  /^(?::root|\[data-(?:appearance|accent)(?:[~|^$*]?=(?:"[^"]*"|'[^']*'|[\w-]+))?\])+$/;
/** At-rules that may wrap token rules: they select an environment, not an element. */
const ALLOWED_AT_RULE = /^@(?:media|supports)\b/;

const BITMAP =
  /^data:image\/(png|jpe?g|gif|webp|avif|bmp)|\.(png|jpe?g|gif|webp|avif|bmp)([?#]|$)/i;

const lineAt = (css, index) => css.slice(0, index).split("\n").length;

// An escaped character, a comment or a string, whichever starts first, as in raw-colors.mjs:
// `/*` inside a string opens no comment, and a quote inside a comment opens no string.
const TOKEN = /\\[\s\S]|\/\*[\s\S]*?\*\/|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'/g;

/** Blank out comments, keeping every newline so positions still map to lines. */
const stripComments = (css) =>
  css.replace(TOKEN, (token) => (token.startsWith("/*") ? token.replace(/[^\n]/g, " ") : token));

/** Split on a separator that is outside parentheses, brackets and strings. */
function splitTopLevel(text, separator) {
  const parts = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quote) {
      if (char === "\\") i++;
      else if (char === quote) quote = "";
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "(" || char === "[") depth++;
    else if (char === ")" || char === "]") depth--;
    else if (char === separator && depth === 0) {
      parts.push({ text: text.slice(start, i), start });
      start = i + 1;
    }
  }
  parts.push({ text: text.slice(start), start });
  return parts;
}

/** Index of the brace that closes the block opened at `open`. */
function closingBrace(css, open) {
  let depth = 0;
  let quote = "";
  for (let i = open; i < css.length; i++) {
    const char = css[i];
    if (quote) {
      if (char === "\\") i++;
      else if (char === quote) quote = "";
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "{") depth++;
    else if (char === "}" && --depth === 0) return i;
  }
  return -1;
}

/**
 * Whether position `index` of `code` (a stylesheet as readCss reads it: no comments, strings or
 * escapes left) is at the top level of its declaration, outside every (...), [...] and {...}
 * of a value. The blocks open at that position are counted from the start of the stylesheet, so
 * neither a `;` nor a `{` inside a function hides the function. A closer with no opener of its
 * kind is ignored, and a `}` closes whatever was left open inside its block.
 *
 * A `{` is a block of a value ("v" below) only inside the value of a custom property, which
 * begins at the colon after a dashed name (`--x:`) and runs to a `;` outside its blocks or to
 * the `}` of its rule; CSS reads a dashed name followed by a colon as a declaration, never as a
 * rule. Every other `{` opens a rule.
 */
function atDeclarationLevel(code, index) {
  const open = [];
  // Where the text of the current statement begins, and how many blocks were open where the
  // current custom property's value began (-1 outside such a value).
  let start = 0;
  let value = -1;
  for (let i = 0; i < index; i++) {
    const char = code[i];
    if (char === "(" || char === "[") open.push(char);
    else if (char === ")" || char === "]") {
      if (open.at(-1) === (char === ")" ? "(" : "[")) open.pop();
    } else if (char === "{") {
      open.push(value === -1 ? "{" : "v");
      if (value === -1) start = i + 1;
    } else if (char === "}") {
      if (open.includes("{") || open.includes("v")) {
        for (let closed = open.pop(); closed !== "{" && closed !== "v"; closed = open.pop());
      }
      // The brace closed the rule the value was in, not a block of the value.
      if (open.length < value) value = -1;
      if (value === -1) start = i + 1;
    } else if (char === ";") {
      if (open.length === value) value = -1;
      if (value === -1) start = i + 1;
    } else if (
      char === ":" &&
      value === -1 &&
      // A dashed name: `--` and then name characters, which in CSS include everything non-ASCII.
      /^\s*--[-\w\u{80}-\u{10FFFF}]*\s*$/u.test(code.slice(start, i))
    ) {
      value = open.length;
    }
  }
  return !open.includes("(") && !open.includes("[") && !open.includes("v");
}

/**
 * Problems in a token file, as `{ line, message }` in line order. `name` is the component's
 * folder name.
 */
export function checkTokenCss(raw, name) {
  const css = stripComments(raw);
  const problems = [];
  const report = (line, message) => problems.push({ line, message });
  const fail = (index, message) => report(lineAt(css, index), message);
  const prefix = `--mac-${name}-`;

  function declarations(body, offset) {
    for (const part of splitTopLevel(body, ";")) {
      const text = part.text.trim();
      if (text === "") continue;
      const at = offset + part.start + part.text.indexOf(text);
      const colon = text.indexOf(":");
      const property = (colon === -1 ? text : text.slice(0, colon)).trim();
      if (colon === -1) fail(at, `"${text}" is not a declaration`);
      else if (!property.startsWith("--")) {
        fail(
          at,
          `"${property}" is not a custom property; a token file only declares ${prefix}* values`,
        );
      } else if (!property.startsWith(prefix)) {
        fail(at, `"${property}" must start with "${prefix}" in ${name}.tokens.css`);
      }
    }
  }

  function rules(from, to) {
    let i = from;
    while (i < to) {
      const open = css.indexOf("{", i);
      const semicolon = css.indexOf(";", i);
      if (open === -1 || open >= to) {
        const rest = css.slice(i, to).trim();
        if (rest !== "") {
          fail(i + css.slice(i, to).indexOf(rest), `"${rest}" is outside any rule`);
        }
        return;
      }
      // A statement at-rule (@import, @charset, @layer a;) before the next block.
      if (semicolon !== -1 && semicolon < open) {
        const statement = css.slice(i, semicolon).trim();
        if (statement !== "") {
          fail(
            i + css.slice(i, semicolon).indexOf(statement),
            `"${statement}" is not allowed in a token file`,
          );
        }
        i = semicolon + 1;
        continue;
      }
      const close = closingBrace(css, open);
      if (close === -1 || close > to) return fail(open, "unbalanced braces");
      const prelude = css.slice(i, open).trim();
      const preludeAt = i + css.slice(i, open).indexOf(prelude);
      if (prelude.startsWith("@")) {
        if (ALLOWED_AT_RULE.test(prelude)) rules(open + 1, close);
        else fail(preludeAt, `"${prelude.split(/\s/)[0]}" is not allowed in a token file`);
      } else {
        for (const selector of splitTopLevel(prelude, ",")) {
          const text = selector.text.trim();
          if (!ALLOWED_SELECTOR.test(text)) {
            fail(
              preludeAt,
              `selector "${text}": a token file declares custom properties on :root, [data-appearance] or [data-accent]; rules for elements belong in ${name}.css`,
            );
          }
        }
        const body = css.slice(open + 1, close);
        if (splitTopLevel(body, "{").length > 1) {
          fail(open, "nested rules are not allowed in a token file");
        } else declarations(body, open + 1);
      }
      i = close + 1;
    }
  }

  rules(0, css.length);

  // The `!important` flag, in any spelling CSS accepts, and never the same text in a string, a
  // comment, the contents of url() or the arguments of a function. Once per line.
  const important = new Set(
    readCss(raw)
      .matches(/!\s*important(?![\w-])/gi)
      .filter(({ match }) => atDeclarationLevel(match.input, match.index))
      .map(({ line }) => line),
  );
  for (const line of important) report(line, "!important is not allowed in component CSS");
  // Bitmaps: what url() names, not text that looks like it.
  const bitmaps = new Set(
    cssReferences(raw)
      .urls.filter(({ url }) => BITMAP.test(url))
      .map(({ line }) => line),
  );
  for (const line of bitmaps) report(line, "bitmap images are not allowed in component CSS");

  return problems
    .map((problem, index) => ({ problem, index }))
    .sort((a, b) => a.problem.line - b.problem.line || a.index - b.index)
    .map(({ problem }) => problem);
}
