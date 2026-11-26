/**
 * Heading anchors. Every heading of a page gets an `id`, so a link such as
 * `/fidelity#vibrancy-and-materials` lands on its section. The id is the heading's text the way
 * GitHub writes it (lower case, punctuation dropped, spaces to hyphens, a counter on repeats),
 * which keeps the links inside CONTRIBUTING.md and the other root documents working both on
 * GitHub and on the site.
 *
 * Plain JavaScript, because the site check (site-check.mjs), which Node runs directly, computes
 * the same ids for the Markdown export.
 */

/**
 * The id GitHub gives a heading with this text (as the github-slugger package computes it:
 * lower case, everything but letters, digits, marks, spaces, hyphens and underscores dropped,
 * so a tab disappears, then each space becomes a hyphen). A repeated heading gets a counter (`foo`,
 * `foo-1`), and every id handed out is reserved, so a later heading that is literally "Foo 1"
 * does not take `foo-1` a second time (it becomes `foo-1-1`), as on GitHub.
 * @param {string} text
 * @param {Map<string, number>} seen the ids of one page so far, with their repeat counters
 * @returns {string}
 */
export function slug(text, seen) {
  const base = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M} _-]/gu, "")
    .replace(/ /g, "-");
  let id = base;
  while (seen.has(id)) {
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    id = `${base}-${count}`;
  }
  seen.set(id, 0);
  return id;
}

/**
 * @typedef {{ type: string, tagName?: string, name?: string | null, value?: string,
 *   properties?: Record<string, unknown>,
 *   attributes?: { type: string, name?: string, value?: unknown }[],
 *   children?: HastNode[] }} HastNode
 */

/**
 * The text of a heading. A picture in it counts by its alternative text, as it does in the
 * Markdown export (site-check.mjs, `readMarkdown`), so that a heading has the same id in both
 * and a heading that is only a picture has one at all. A picture is an `img` element, or one
 * written as JSX in the page (`<img alt="Status" />`), which is a node of its own kind.
 * @param {HastNode} node @returns {string}
 */
const textOf = (node) => {
  if (node.type === "text") return node.value ?? "";
  if (node.type === "element" && node.tagName === "img") {
    return typeof node.properties?.alt === "string" ? node.properties.alt : "";
  }
  if (
    (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") &&
    node.name === "img"
  ) {
    const alt = (node.attributes ?? []).find(
      (attribute) => attribute.type === "mdxJsxAttribute" && attribute.name === "alt",
    );
    return typeof alt?.value === "string" ? alt.value : "";
  }
  return (node.children ?? []).map(textOf).join("");
};

/** rehype plugin: add `id` to the headings that have none. */
export function rehypeHeadingIds() {
  /** @param {HastNode} tree */
  return (tree) => {
    /** @type {Map<string, number>} */
    const seen = new Map();
    /** @type {HastNode[]} */
    const headings = [];
    // An id written by hand is taken before any is generated, wherever it is on the page and
    // whatever has it: a heading, an `<a id>`, or an element written as JSX in the page
    // (`<div id="foo" />`), which is a node of its own kind with attributes. A generated id
    // never repeats one.
    /** @param {unknown} id */
    const reserve = (id) => {
      if (typeof id === "string" && id !== "") seen.set(id, seen.get(id) ?? 0);
    };
    /** @param {HastNode} node */
    const visit = (node) => {
      if (node.type === "element") {
        if (/^h[1-6]$/.test(node.tagName ?? "")) headings.push(node);
        reserve(node.properties?.id);
      }
      if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
        for (const attribute of node.attributes ?? []) {
          if (attribute.type === "mdxJsxAttribute" && attribute.name === "id") {
            reserve(attribute.value);
          }
        }
      }
      for (const child of node.children ?? []) visit(child);
    };
    visit(tree);
    for (const heading of headings) {
      heading.properties ??= {};
      if (!heading.properties.id) {
        const id = slug(textOf(heading), seen);
        if (id) heading.properties.id = id;
      }
    }
  };
}
