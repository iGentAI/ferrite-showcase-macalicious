// The part of the site check that needs a real browser: open every component and demo page of
// the built site in Chromium, in Aqua and in Dark Aqua, and
//
//   - report every example that does not render: an error on the page or in the console, an
//     example that paints nothing or never finishes loading, an appearance that is not applied;
//   - take a light and a dark screenshot of the page's first example, which the component and
//     demo index pages show (docs/dist/screenshots/<route>-light.png and -dark.png).
//
// docs/build.mjs runs it after prerendering when Playwright has a Chromium installed
// (`npm run visual:install`); without one the build says so and goes on, unless
// REQUIRE_BROWSER_TESTS=1. DOCS_BROWSER=0 skips it.
//
// What it guarantees. It is the test harness of this repository's own documentation pages,
// not a tool for any page; within that, it promises this and no more:
//
//   - It never cancels, replaces or pauses an animation or a transition of the page. Sound
//     and video that play are paused while pictures are taken, and played again after.
//   - It waits for the page's animations and transitions that are going to end, up to
//     SETTLE_TIMEOUT, before it hides anything. A page that has not settled by then, that has
//     a paused transition, or that has a transition under way in what is about to be hidden
//     or shown, is reported ("cannot be told"), never forced.
//   - A page that is ready and has no example at all fails: nothing on it was checked.
//   - A preview's content is all that it holds, and all of it is hidden while the preview is
//     pictured without it: each element with a box of its own; what is in an element without
//     one (`display: contents`, at any depth), which no opacity of that element hides; text
//     put straight into the preview or into such an element; what the preview, or such an
//     element, generates (`::before`, `::after`); and the elements of the preview in the top
//     layer (an open modal dialog or popover, a full-screen element) with their `::backdrop`,
//     which no opacity of an ancestor hides. Another preview is taken out of the pictures the
//     same way: whole, and its top layer with it (the preview itself included, when it is in
//     the top layer, with its backdrop); or, when it has no box of its own
//     (`display: contents`), by all it holds, as above. The preview looked at keeps its own
//     backdrop, which is the preview's, not its content.
//   - The declarations it writes into a style attribute come after every other, so that an
//     `all` of the page's there, `!important` or not, does not override them.
//   - Hiding a preview's content changes no property that is inherited, so nothing inside an
//     element it hides can start a transition: elements are hidden by `opacity: 0` in their
//     own style attribute, with `transition: none` beside it; generated content and backdrops,
//     which have no style attribute, by a rule that sets both. Only text put straight into a
//     preview, or into an element without a box, is hidden by its (inherited) text colours,
//     white space included, both by a rule and in that element's own style attribute (which
//     outranks a rule); while they are cleared, transitions are suppressed on everything in
//     that preview, every element and every pseudo-element that can carry a transition.
//   - Each style attribute it writes to is given back as the page left it: as written, or,
//     where a script of the page changed it meanwhile, with that change kept.
//
// Deliberately out of scope:
//
//   - transitions and animations driven from outside the previews it hides (an ancestor, the
//     page around them, another document);
//   - scripts that undo what it does while content is hidden, for example by re-enabling
//     transitions in it or by writing over the attributes it sets; such a change is kept, and
//     a transition it starts is left to run with the example reported, but no more is promised;
//   - a script that, while content is hidden, only reorders the declarations of a style
//     attribute without changing any of them: the attribute is given back in its old order;
//   - transition events the page itself expects at a given moment while it is looked at;
//   - the list marker (`::marker`) of a preview, or of an element without a box, shown as a
//     list item, which opacity does not apply to; top-layer elements inside a shadow root;
//   - browsers other than Chromium, the only one this pass runs in.
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";

export const APPEARANCES = ["light", "dark"];

/** Site path of a route's screenshot, without the base: "screenshots/demos/finder-dark.png". */
export const screenshotFile = (route, appearance) => `screenshots${route}-${appearance}.png`;

/**
 * Chromium, when Playwright and its browser are installed; else null. A browser that is
 * installed and does not start (a missing system library, say) is an error, not an absent
 * browser: the caller must not take it for "nothing to check with".
 */
export async function launchBrowser() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
    if (!existsSync(chromium.executablePath())) return null;
  } catch {
    return null;
  }
  return chromium.launch();
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

/** Serve the built site as a static host does: a route is its folder's index.html. */
export async function serve(outDir, base = "/") {
  const root = base.replace(/\/?$/, "/");
  const server = http.createServer(async (request, response) => {
    const send = async (status, file) => {
      response.writeHead(status, {
        "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
      });
      response.end(await readFile(file));
    };
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
      const relative = `${pathname}/`.startsWith(root)
        ? pathname.slice(root.length).replace(/\/+$/, "")
        : null;
      if (relative !== null && !relative.split("/").includes("..")) {
        for (const candidate of [relative, path.posix.join(relative, "index.html")]) {
          const file = path.join(outDir, candidate);
          if (candidate !== "" && path.extname(candidate) !== "" && existsSync(file)) {
            await send(200, file);
            return;
          }
        }
      }
      await send(404, path.join(outDir, "404.html"));
    } catch (error) {
      response.writeHead(500).end(String(error));
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = /** @type {import("node:net").AddressInfo} */ (server.address());
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

const PREVIEWS =
  "figure.docs-example > .docs-preview, figure.docs-example > .docs-preview-pair > .docs-preview";

/**
 * Runs in the page: what is wrong with the structure of the examples in the given appearance.
 * Whether an example paints anything is not decided here but by looking at its pixels
 * (`paintsSomething`).
 */
function inspect(appearance) {
  const failures = [];
  if (!document.querySelector("figure.docs-example")) {
    failures.push("the page has no examples, so nothing on it was checked");
  }
  for (const error of document.querySelectorAll(".docs-article .docs-error")) {
    failures.push(error.textContent.replace(/\s+/g, " ").trim());
  }
  for (const figure of document.querySelectorAll("figure.docs-example")) {
    const name = figure.getAttribute("data-example") ?? "?";
    const previews = [
      ...figure.querySelectorAll(
        ":scope > .docs-preview, :scope > .docs-preview-pair > .docs-preview",
      ),
    ].filter((preview) => (preview.getAttribute("data-appearance") ?? appearance) === appearance);
    if (previews.length === 0) failures.push(`example ${name} has no preview`);
    for (const preview of previews) {
      if (preview.hasAttribute("aria-busy")) {
        failures.push(`example ${name} did not finish loading`);
        continue;
      }
      const scheme = getComputedStyle(preview).colorScheme;
      if (scheme !== appearance) {
        failures.push(`example ${name} is drawn with color-scheme "${scheme}"`);
      }
    }
  }
  return failures;
}

/**
 * Hides what a preview holds and leaves the preview itself as it is: its elements, what they
 * generate, what it generates itself, and text put straight into it. Layout does not change,
 * and neither does the preview's colour, which its own border or background may be drawn in.
 *
 * Elements are hidden by `opacity: 0` in their own style attribute (`hideContent`): each
 * element with a box directly in the preview, and each other preview whole. Opacity hides an
 * element and everything in it, `visibility: visible !important` and fixed positions
 * included, and it is not inherited, so nothing inside changes its value, and no element or
 * pseudo-element in there can start a transition because of it. Two kinds of element it does
 * not hide that way. An element without a box (`display: contents`) is not painted at all,
 * its opacity with it: what is in it is hidden as if it were straight in the preview. An
 * element in the top layer is painted apart from its ancestors, their opacity not applied:
 * it is hidden by its own.
 *
 * What the preview generates itself (`::before`, `::after`), and what an element without a
 * box generates, has no style attribute: it is hidden by a rule of its own
 * (`data-docs-probe-generated`), which sets `opacity: 0` while another
 * (`data-docs-probe-generated-still`) sets `transition: none`, both in the same change of
 * style, as the style attributes do; a pair of rules of their own (`data-docs-probe-backdrop`,
 * `data-docs-probe-backdrop-still`) hides the `::backdrop` of an element in the top layer,
 * which is painted apart from the element, though never the backdrop of the preview looked
 * at. The `transition: none` is taken away a moment later than the opacity, so that showing
 * it starts no transition either.
 *
 * Text put straight into a preview, or into an element without a box, has no element to hide,
 * and is hidden by the colours its text is painted in (`data-docs-probe-text`). Those are
 * inherited, so while they are cleared
 * every transition in that preview is suppressed (`data-docs-probe-still`): on every element,
 * and on every pseudo-element that can carry one. The ones every Chromium knows share one
 * rule; the newer ones, and Chromium's own (`::-webkit-…`), each have a rule of their own,
 * since one a browser does not know would void a whole list of selectors. The rules are in a
 * cascade layer, because an important declaration in a layer wins over an important one
 * outside any, whatever the selectors; among layers it is the first of the page whose
 * important declarations win, so they are put before every other stylesheet
 * (`addProbeStyle`), not after.
 *
 * No content is hidden while a transition is under way in it (`settle`, `hideContent`), so
 * none of this cancels a transition of the page.
 */
const VENDOR_PSEUDO = [
  "-webkit-slider-thumb",
  "-webkit-slider-runnable-track",
  "-webkit-scrollbar",
  "-webkit-scrollbar-thumb",
  "-webkit-scrollbar-track",
  "-webkit-scrollbar-track-piece",
  "-webkit-scrollbar-button",
  "-webkit-scrollbar-corner",
  "-webkit-resizer",
  "-webkit-inner-spin-button",
  "-webkit-outer-spin-button",
  "-webkit-search-cancel-button",
  "-webkit-search-decoration",
  "-webkit-file-upload-button",
  "-webkit-progress-bar",
  "-webkit-progress-value",
  "-webkit-progress-inner-element",
  "-webkit-meter-bar",
  "-webkit-meter-optimum-value",
  "-webkit-meter-suboptimum-value",
  "-webkit-meter-even-less-good-value",
  "-webkit-color-swatch",
  "-webkit-color-swatch-wrapper",
  "-webkit-calendar-picker-indicator",
  "-webkit-datetime-edit",
  "-webkit-datetime-edit-fields-wrapper",
  "-webkit-datetime-edit-text",
  "-webkit-datetime-edit-year-field",
  "-webkit-datetime-edit-month-field",
  "-webkit-datetime-edit-day-field",
  "-webkit-datetime-edit-hour-field",
  "-webkit-datetime-edit-minute-field",
  "-webkit-datetime-edit-second-field",
  "-webkit-datetime-edit-millisecond-field",
  "-webkit-datetime-edit-ampm-field",
  "-webkit-datetime-edit-week-field",
  "-webkit-details-marker",
  "-webkit-input-placeholder",
  "-webkit-textfield-decoration-container",
  "-webkit-clear-button",
];
export const PROBE_STYLE = `
@layer docs-probe {
[data-docs-probe-text] {
  -webkit-text-fill-color: transparent !important;
  -webkit-text-stroke-color: transparent !important;
  text-decoration-color: transparent !important;
  text-emphasis-color: transparent !important;
  text-shadow: none !important;
}
[data-docs-probe-generated]::before,
[data-docs-probe-generated]::after,
[data-docs-probe-backdrop]::backdrop {
  opacity: 0 !important;
}
[data-docs-probe-generated-still]::before,
[data-docs-probe-generated-still]::after,
[data-docs-probe-backdrop-still]::backdrop {
  transition: none !important;
}
[data-docs-probe-still],
[data-docs-probe-still] *,
:is([data-docs-probe-still], [data-docs-probe-still] *)::before,
:is([data-docs-probe-still], [data-docs-probe-still] *)::after,
:is([data-docs-probe-still], [data-docs-probe-still] *)::marker,
:is([data-docs-probe-still], [data-docs-probe-still] *)::placeholder,
:is([data-docs-probe-still], [data-docs-probe-still] *)::file-selector-button,
:is([data-docs-probe-still], [data-docs-probe-still] *)::backdrop,
:is([data-docs-probe-still], [data-docs-probe-still] *)::first-letter,
:is([data-docs-probe-still], [data-docs-probe-still] *)::first-line {
  transition: none !important;
}
${[
  "details-content",
  "before::marker",
  "after::marker",
  "checkmark",
  "picker-icon",
  "picker(select)",
  "scroll-marker",
  "scroll-marker-group",
  "scroll-button(*)",
  ...VENDOR_PSEUDO,
]
  .map(
    (name) =>
      `:is([data-docs-probe-still], [data-docs-probe-still] *)::${name} { transition: none !important; }`,
  )
  .join("\n")}
}`;

/** Runs in the page: put PROBE_STYLE first among the page's stylesheets (see there). */
function addProbeStyle(content) {
  const style = document.createElement("style");
  style.textContent = content;
  document.head.prepend(style);
}

/**
 * How long `settle` waits for the page's animations to end, in milliseconds.
 */
export const SETTLE_TIMEOUT = 10_000;

/**
 * Runs in the page: wait until no animation or transition of the page that is going to end is
 * still under way, at most `timeout` milliseconds; true when none is, false when one is still
 * under way at the end, and "paused" at once when the page has paused a transition. Nothing of
 * the page's is paused, cancelled, finished or replaced: the check waits for them. An
 * animation that never ends (an endless one, or one the page paused) does not count, since
 * waiting cannot help, and hiding does not touch it; what it changes is told apart by the
 * pictures themselves (`compare`). A paused transition is another matter: hiding sets
 * `transition: none` (see `hideContent`), which would cancel it, so such a page is not
 * probed at all.
 */
function settle(timeout) {
  const paused = () =>
    document
      .getAnimations()
      .some((animation) => animation instanceof CSSTransition && animation.playState === "paused");
  const ending = () =>
    document.getAnimations().some((animation) => {
      if (animation.playState === "finished" || animation.playState === "idle") return false;
      if (animation.playState === "paused") return false;
      // Played backwards, an animation ends at time zero, however many times it repeats.
      if (animation.playbackRate < 0) return (animation.currentTime ?? 0) > 0;
      if (animation.playbackRate === 0) return false;
      const end = animation.effect?.getComputedTiming().endTime;
      return typeof end === "number" && Number.isFinite(end);
    });
  const start = performance.now();
  return new Promise((resolve) => {
    const check = () => {
      if (paused()) resolve("paused");
      else if (!ending()) resolve(true);
      else if (performance.now() - start > timeout) resolve(false);
      else setTimeout(check, 16);
    };
    check();
  });
}

/**
 * Runs in the page: hide the content of a preview (see PROBE_STYLE). `showContent` undoes it.
 * Given the selector of all previews as `others`, it is every preview but this one that is
 * hidden, the same way and itself included, by its own style attribute as well: an example of
 * theirs, or a preview, that insists on being visible, and keeps changing, must not be in
 * the pictures of this one. Each element's own style attribute gets `transition: none` too,
 * since a `transition` declared there with `!important` would outrank PROBE_STYLE's.
 */
function hideContent(preview, { others }) {
  const targets = others
    ? [...document.querySelectorAll(others)].filter((other) => other !== preview)
    : [preview];
  // `transition: none` would cancel a transition under way or paused in what is hidden, which
  // the page may have started since it settled (a timer, a listener of a media pause): then
  // nothing is hidden, and the caller says the page did not settle.
  const touched = document
    .getAnimations()
    .some(
      (animation) =>
        animation instanceof CSSTransition &&
        (animation.playState === "running" || animation.playState === "paused") &&
        targets.some((target) => target.contains(animation.effect?.target ?? null)),
    );
  if (touched) return false;
  // The elements in the top layer under an element, and the element itself when it is one
  // (`self`), which no opacity of an ancestor hides.
  const layered = (root, self) =>
    [":modal", ":popover-open", ":fullscreen"].flatMap((selector) => {
      try {
        return [
          ...(self && root.matches(selector) ? [root] : []),
          ...root.querySelectorAll(selector),
        ];
      } catch {
        return [];
      }
    });
  // Every declaration of a style attribute, by name, with its value and priority.
  const declarations = (element) =>
    new Map(
      [...element.style].map((name) => [
        name,
        [element.style.getPropertyValue(name), element.style.getPropertyPriority(name)],
      ]),
    );
  // The text colours that hide text, as PROBE_STYLE's `data-docs-probe-text` rule has them.
  const TEXT_HIDDEN = [
    ["-webkit-text-fill-color", "transparent"],
    ["-webkit-text-stroke-color", "transparent"],
    ["text-decoration-color", "transparent"],
    ["text-emphasis-color", "transparent"],
    ["text-shadow", "none"],
  ];
  // Hidden and kept from transitioning in the same change of style: whether a change starts a
  // transition is decided by the `transition` after it, which is `none`.
  for (const target of targets) {
    const saved = [];
    // The preview whose content is hidden, or another preview without a box of its own (which
    // its opacity would not hide), and each element in it without a box of its own
    // (`display: contents`), at any depth: what is in one of them is laid out, and has to be
    // hidden, as if it were straight in the preview. `boxes` are the elements in them that
    // have a box.
    const holders = [];
    const boxes = [];
    const walk = (element) => {
      holders.push(element);
      for (const child of element.children) {
        if (getComputedStyle(child).display === "contents") walk(child);
        else boxes.push(child);
      }
    };
    const whole = others && getComputedStyle(target).display !== "contents";
    if (!whole) walk(target);
    // The elements in the top layer: in the preview, and another preview itself when it is
    // one (its backdrop is not its opacity's to hide). The preview whose content is hidden is
    // left as it is, its backdrop with it.
    const top = [...new Set(layered(target, Boolean(others)))];
    // Text straight in one of them, which only its text colours hide: any text, white space
    // included, which a preserved `white-space` paints, with its decorations.
    const speaking = holders.filter((holder) =>
      [...holder.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent !== "",
      ),
    );
    const text = speaking.length > 0;
    // What `opacity: 0` hides: another preview whole when it has a box, or each element with a
    // box in the preview; and in either, each element in the top layer.
    const hidden = new Set([...(whole ? [target] : boxes), ...top]);
    // What the rule for generated content hides: what a preview without its own opacity
    // applied, and its elements without a box, generate. And what the rule for backdrops
    // hides: the backdrop of each element in the top layer, never the probed preview's own.
    const generating = holders;
    const backdrops = top;
    // What gets `transition: none` in its own style attribute: what is hidden; and, while the
    // text colours of this preview are cleared, it and everything in it, since a `transition`
    // of a style attribute, with `!important`, would outrank PROBE_STYLE's.
    const still = text ? [target, ...target.querySelectorAll("*")] : [...hidden];
    for (const element of still) {
      if (!element.style) continue;
      // The style attribute as written, to be put back word for word: every declaration
      // with its own value, `var()` and `!important` included, in its own order.
      const before = element.getAttribute("style");
      // Each declaration is taken out before it is written, so that it is written last: a
      // declaration written in its old place would stay under an `all` of the page's after it.
      element.style.removeProperty("transition");
      element.style.setProperty("transition", "none", "important");
      if (hidden.has(element)) {
        element.style.removeProperty("opacity");
        element.style.setProperty("opacity", "0", "important");
      }
      // The text colours of an element that holds text straight, in its own style attribute
      // as well as by PROBE_STYLE's rule, since a text colour written there with `!important`
      // would outrank the rule.
      if (speaking.includes(element)) {
        for (const [name, value] of TEXT_HIDDEN) {
          element.style.removeProperty(name);
          element.style.setProperty(name, value, "important");
        }
      }
      // And what it holds now, so that what a script of the page writes there while the
      // content is hidden can be told apart, and kept (see `showContent`).
      saved.push({
        element,
        before,
        hidden: element.getAttribute("style"),
        held: declarations(element),
      });
    }
    target.__docsProbeSaved = saved;
    target.__docsProbeMarked = { speaking, generating, backdrops };
    target.setAttribute("data-docs-probe", "");
    for (const element of generating) {
      element.setAttribute("data-docs-probe-generated", "");
      element.setAttribute("data-docs-probe-generated-still", "");
    }
    for (const element of backdrops) {
      element.setAttribute("data-docs-probe-backdrop", "");
      element.setAttribute("data-docs-probe-backdrop-still", "");
    }
    if (text) {
      target.setAttribute("data-docs-probe-still", "");
      for (const holder of speaking) holder.setAttribute("data-docs-probe-text", "");
    }
    if (others) target.setAttribute("data-docs-probe-away", "");
  }
  return true;
}

/**
 * Runs in the page: the end of `hideContent`, called with what it was called with, in two
 * steps: the content is shown while it is still kept from transitioning, and its transitions
 * are given back only once the style is up to date, so that showing it starts no transition
 * either. Each style attribute is put back as it was written, every declaration in its place;
 * what a script of the page wrote there while the content was hidden (each declaration that
 * differs from what hiding left, or that it removed) is then written over that again, and
 * kept. A transition the page started in the hidden content all the same (by writing a
 * `transition` of its own into a style attribute, which outranks PROBE_STYLE) is left to run:
 * its element is given its style back without `transition: none`, which would cancel it, and
 * the answer is false, so that the caller says the page did not settle.
 */
function showContent(preview, { others }) {
  const targets = others
    ? [...document.querySelectorAll(others)].filter((other) => other !== preview)
    : [preview];
  const moving = new Set(
    document
      .getAnimations()
      .filter(
        (animation) =>
          animation instanceof CSSTransition &&
          (animation.playState === "running" || animation.playState === "paused") &&
          targets.some((target) => target.contains(animation.effect?.target ?? null)),
      )
      .map((animation) => animation.effect.target),
  );
  const declarations = (element) =>
    new Map(
      [...element.style].map((name) => [
        name,
        [element.style.getPropertyValue(name), element.style.getPropertyPriority(name)],
      ]),
    );
  const write = (element, value) => {
    if (value === null) element.removeAttribute("style");
    else element.setAttribute("style", value);
  };
  const records = targets.flatMap((target) => target.__docsProbeSaved ?? []);
  const marked = targets.map((target) => target.__docsProbeMarked ?? {});
  // Shown, still without transitions.
  for (const target of targets) {
    target.removeAttribute("data-docs-probe");
    if (others) target.removeAttribute("data-docs-probe-away");
  }
  for (const { speaking = [], generating = [], backdrops = [] } of marked) {
    for (const holder of speaking) holder.removeAttribute("data-docs-probe-text");
    for (const element of generating) element.removeAttribute("data-docs-probe-generated");
    for (const element of backdrops) element.removeAttribute("data-docs-probe-backdrop");
  }
  for (const record of records) {
    const { element, before, hidden, held } = record;
    if (element.getAttribute("style") === hidden) {
      record.final = before;
    } else {
      const now = declarations(element);
      const changed = [];
      for (const [name, [value, priority]] of now) {
        const was = held.get(name);
        if (!was || was[0] !== value || was[1] !== priority) changed.push([name, value, priority]);
      }
      for (const name of held.keys()) if (!now.has(name)) changed.push([name, "", ""]);
      write(element, before);
      for (const [name, value, priority] of changed) {
        if (value === "") element.style.removeProperty(name);
        else element.style.setProperty(name, value, priority);
      }
      const after = element.getAttribute("style");
      record.final = before === null && after === "" ? null : after;
    }
    write(element, record.final);
    if (moving.has(element)) continue;
    // Written last, after any `all` of the page's (see `hideContent`).
    element.style.removeProperty("transition");
    element.style.setProperty("transition", "none", "important");
    record.shown = element.getAttribute("style");
  }
  // getAnimations brings the style up to date: the content is shown, and nothing started.
  document.getAnimations();
  // The transitions given back.
  for (const target of targets) {
    target.removeAttribute("data-docs-probe-still");
    delete target.__docsProbeSaved;
    delete target.__docsProbeMarked;
  }
  for (const { generating = [], backdrops = [] } of marked) {
    for (const element of generating) element.removeAttribute("data-docs-probe-generated-still");
    for (const element of backdrops) element.removeAttribute("data-docs-probe-backdrop-still");
  }
  for (const { element, final, shown } of records) {
    if (shown !== undefined && element.getAttribute("style") === shown) write(element, final);
  }
  return moving.size === 0;
}

/**
 * Runs in the page: keep sound and video still for as long as pictures are taken. Animations
 * and transitions are not touched (see `settle`). `release` lets the media play again.
 */
function hold() {
  const media = [...document.querySelectorAll("video, audio")].filter((item) => !item.paused);
  for (const item of media) item.pause();
  window.__docsProbeHeld = { media };
}

/**
 * Runs in the page: the end of `hold`. What was playing plays again, and the next pictures
 * are taken of a page in the state a reader has it in, not one this check left stopped.
 */
function release() {
  const { media = [] } = window.__docsProbeHeld ?? {};
  delete window.__docsProbeHeld;
  // Playing again is asked for, not waited for without end: media that cannot go on (its
  // source is gone, say) never says so.
  return Promise.race([
    Promise.allSettled(media.map((item) => item.play())),
    new Promise((resolve) => setTimeout(resolve, 1000)),
  ]).then(() => undefined);
}

/**
 * Whether a preview's content puts any pixel on the page. Nothing about the content is
 * assumed: the preview is photographed as it is and again with its content hidden, and it
 * paints something exactly when the two pictures show different things. A box, a background or a shape is no
 * evidence by itself, since each can be transparent, clipped away or out of view; and text
 * needs no element around it to be seen.
 *
 * Two pictures taken at different moments can also differ because the page moved in between.
 * Nothing of the page's animations is paused, cancelled or replaced. Instead, before anything
 * is hidden, the check waits for every animation and transition that is going to end to end
 * (`settle`, at most `SETTLE_TIMEOUT`); when they do not, the answer is "unsettled": no
 * evidence either way. The same answer is given when the page starts a transition in what is
 * to be hidden later, before one of the hidings (`hideContent` looks again each time). Media is paused and the caret hidden. What still moves (an endless
 * animation, a script) is told apart by taking the first picture again: when it comes out the
 * same, the difference was the hidden content. When the picture keeps changing, the content
 * is what changes if the preview stands still while its content is hidden; otherwise
 * something else on the page moves and the answer is "changing": no evidence either way.
 *
 * The pictures are of the page, not of the viewport. The first pair covers the preview
 * together with everything its elements reach, which is where an example nearly always
 * paints and is a small picture. Only when that shows nothing is the whole page pictured,
 * before the example is called empty: a shadow, an outline or generated content can be
 * painted anywhere, far from the box of the element it belongs to. A page is pictured whole
 * in tiles (`LIMITS`), across and down, nearest the preview first in either direction, and no
 * more of them than a build has time for: when a page is larger than that and nothing was
 * found, the answer is "unseen", not "paints nothing".
 *
 * The example a picture is wanted of (`picture`) is looked for in the first pair and then on
 * the whole page, since the picture is to show everything it paints: the box around the
 * pixels that differ between the two pictures, taken from the very pictures the answer was
 * read from (`paintedBox`). The picture itself is taken here too, before anything is let go,
 * with the other examples still out of it. Content that moves (an endless animation, a
 * script) can be elsewhere by then, so the box is used only when the pictures it was read
 * from held still, and the picture is checked against them (`pictureOf`); otherwise the
 * example is pictured on its preview.
 *
 * Two pictures of a page that did not change are not always the same to the last bit: the
 * browser now and then rounds a pixel on the edge of a rounded corner or of a blurred
 * backdrop one step lighter or darker, more often on a busy machine. Pictures are therefore
 * compared as colours, and colours within `NOISE` of each other are one colour (`differ`).
 * An example whose every pixel is that close to an empty preview is not seen by a reader
 * either.
 *
 * @param {import("playwright").Page} page
 * @param {import("playwright").ElementHandle} preview
 * @param {typeof import("sharp")} sharp
 * @param {object} [options]
 * @param {"content" | "preview" | null} [options.picture] also take the picture of the
 *   example for the index pages: of what it paints (a component), or of its whole preview and
 *   what it paints outside of it (a demo)
 * @returns {Promise<{ paints: boolean | "changing" | "unseen" | "unsettled" | "paused", image: Buffer | null }>}
 */
async function probe(page, preview, sharp, { picture = null } = {}) {
  await preview.scrollIntoViewIfNeeded();
  const settled = await page.evaluate(settle, SETTLE_TIMEOUT);
  if (settled !== true) {
    return { paints: settled === "paused" ? "paused" : "unsettled", image: null };
  }
  const { near, tiles, covered } = await preview.evaluate(regions, LIMITS);
  // One pixel per point is enough to tell, and a quarter of the work at 2x.
  const shot = { fullPage: true, scale: "css", caret: "hide", timeout: SHOT_TIMEOUT };
  // A picture reaches over other examples (a hidden input of one pixel in the corner of the
  // window is enough), and one of those may be changing: the other previews are taken out of
  // every picture, so that what differs between two pictures is this example alone.
  const others = { others: PREVIEWS };
  await page.evaluate(hold);
  if (!(await preview.evaluate(hideContent, others))) {
    await page.evaluate(release);
    return { paints: "unsettled", image: null };
  }
  let result;
  try {
    let paints = false;
    let box = null;
    // The pictures the box was read from, by the part of the page each shows, and whether
    // every one of them held still.
    const sources = [];
    let steady = true;
    // The near part first, always: it holds the preview and everything its elements reach,
    // however far across or down the page that is. Then the tiles of the whole page, nearest
    // the preview first, for paint that no element's box reaches; with no picture to take,
    // only when the near part showed none.
    for (const clips of near ? [[near], tiles] : [tiles]) {
      for (const clip of clips) {
        const seen = await compare(page, preview, { ...shot, clip }, sharp);
        if (seen.paints === true) {
          paints = true;
          // Without a picture to take, where else it paints does not matter.
          if (!picture) break;
          steady &&= seen.steady;
          sources.push([clip, seen.shown]);
          box = around(box, await paintedBox(sharp, seen.shown, seen.hidden, clip));
        } else if (seen.paints === "changing" && paints === false) {
          paints = "changing";
        }
      }
      if (paints !== false && !picture) break;
    }
    if (paints === false && !covered) paints = "unseen";
    let image = null;
    if (picture) {
      // A box read from pictures that never held still is where the content was at one
      // moment: the example is then pictured on its preview, not cropped to that box.
      image = await pictureOf(page, preview, sharp, {
        box: steady ? box : null,
        whole: picture === "preview",
        sources,
      });
    }
    result = { paints, image };
  } catch (error) {
    if (!(error instanceof Unsettled)) throw error;
    result = { paints: "unsettled", image: null };
  } finally {
    // A transition the page started in the other previews while they were hidden: the
    // pictures are no evidence either.
    const clean = await preview.evaluate(showContent, others);
    await page.evaluate(release);
    if (!clean) result = { paints: "unsettled", image: null };
  }
  return result;
}

/**
 * How much of a page the pictures of `probe` take in, in points. A list can hold a million
 * points of rows behind a scroll view, and a page can be as long as its author likes; a
 * picture cannot, and a build has to end.
 */
const LIMITS = {
  /** The first pair of pictures: this far before the preview, and this much in all. */
  reach: 2000,
  span: 8000,
  /** The whole page: tiles this high and this wide, and this many of them. */
  tile: 8000,
  tiles: 4,
  wide: 4000,
  /** The picture for the index pages: this much on a side. */
  picture: 4000,
};

/**
 * Runs in the page: the parts of the page that `probe` takes pictures of, in page coordinates,
 * which is what the clip of a picture of the full page is relative to. `near` is the preview
 * with everything its elements reach; `tiles` is the whole page, nearest the preview first;
 * `covered` says whether the tiles are all of the page.
 */
function regions(element, limits) {
  const frame = element.getBoundingClientRect();
  let { left, top, right, bottom } = frame;
  for (const inside of element.querySelectorAll("*")) {
    const box = inside.getBoundingClientRect();
    if (box.width === 0 && box.height === 0) continue;
    left = Math.min(left, box.left);
    top = Math.min(top, box.top);
    right = Math.max(right, box.right);
    bottom = Math.max(bottom, box.bottom);
  }
  const root = document.documentElement;
  const width = Math.ceil(Math.max(root.scrollWidth, window.innerWidth));
  const height = Math.ceil(Math.max(root.scrollHeight, window.innerHeight));
  // Stay within reach of the preview, whose own box comes first. What this leaves out is
  // seen by the pictures of the whole page.
  const span = (from, to, start, limit) => {
    const low = Math.max(0, Math.floor(from), Math.floor(start) - limits.reach);
    return [low, Math.min(limit, Math.ceil(to), low + limits.span)];
  };
  const { scrollX, scrollY } = window;
  const [x, x2] = span(left + scrollX, right + scrollX, frame.left + scrollX, width);
  const [y, y2] = span(top + scrollY, bottom + scrollY, frame.top + scrollY, height);
  const nearby = x2 - x >= 1 && y2 - y >= 1 ? { x, y, width: x2 - x, height: y2 - y } : null;
  // The page in tiles, across and down, ordered by how far each is from the preview's box in
  // either direction (none for a tile it overlaps), then by how far its middle is from the
  // preview's middle. Only the rows and columns that can be among the nearest are looked at:
  // the ones about the preview's middle and the ones next to its box on either side, never
  // more than a few times `limits.tiles` of each, however large the page.
  const columns = Math.ceil(width / limits.wide);
  const rows = Math.ceil(height / limits.tile);
  const frameX = [frame.left + scrollX, frame.right + scrollX];
  const frameY = [frame.top + scrollY, frame.bottom + scrollY];
  const gap = (low, high, [from, to]) => Math.max(0, low - to, from - high);
  const middle = (low, high, [from, to]) => Math.abs((low + high) / 2 - (from + to) / 2);
  const near = (count, size, [from, to]) => {
    const clamp = (index) => Math.min(count - 1, Math.max(0, index));
    const first = clamp(Math.floor(from / size));
    const last = Math.max(first, clamp(Math.ceil(to / size) - 1));
    const centre = clamp(Math.floor((from + to) / 2 / size));
    const picked = new Set();
    for (let index = centre - limits.tiles; index <= centre + limits.tiles; index++) {
      if (index >= first && index <= last) picked.add(index);
    }
    for (let step = 1; step <= limits.tiles; step++) {
      if (first - step >= 0) picked.add(first - step);
      if (last + step < count) picked.add(last + step);
    }
    return [...picked];
  };
  const cells = [];
  for (const row of near(rows, limits.tile, frameY)) {
    for (const column of near(columns, limits.wide, frameX)) {
      const tile = {
        x: column * limits.wide,
        y: row * limits.tile,
        width: Math.min(limits.wide, width - column * limits.wide),
        height: Math.min(limits.tile, height - row * limits.tile),
      };
      const across = [tile.x, tile.x + tile.width];
      const down = [tile.y, tile.y + tile.height];
      cells.push({
        tile,
        away: Math.hypot(gap(...across, frameX), gap(...down, frameY)),
        off: Math.hypot(middle(...across, frameX), middle(...down, frameY)),
      });
    }
  }
  const tiles = cells
    .sort((one, other) => one.away - other.away || one.off - other.off)
    .slice(0, limits.tiles)
    .map(({ tile }) => tile);
  return { near: nearby, tiles, covered: rows * columns <= limits.tiles };
}

/** The box around two boxes, either of which may be none. */
function around(one, other) {
  if (!one || !other) return one ?? other;
  const x = Math.min(one.x, other.x);
  const y = Math.min(one.y, other.y);
  return {
    x,
    y,
    width: Math.max(one.x + one.width, other.x + other.width) - x,
    height: Math.max(one.y + one.height, other.y + other.height) - y,
  };
}

/** A page that started a transition in what is to be hidden, after it settled. */
class Unsettled extends Error {}

/** A picture with the content of a preview hidden. */
async function shootHidden(page, preview, options) {
  if (!(await preview.evaluate(hideContent, {}))) throw new Unsettled();
  let picture;
  let clean = false;
  try {
    picture = await page.screenshot(options);
  } finally {
    clean = await preview.evaluate(showContent, {});
  }
  // A transition the page started while its content was hidden: the picture is no evidence.
  if (!clean) throw new Unsettled();
  return picture;
}

/**
 * The picture of an example for the index pages, of the part of the page that `pictureClip`
 * gives for `box`. A box read from the pixels (`box`, from the pictures `sources`) holds only
 * while the page still shows what those pictures showed: the part pictured is taken again at
 * their scale just before and just after the picture, and both have to match them where they
 * overlap. When either does not, the content moved in between, and the example is pictured
 * on its preview instead, with no crop read from pixels.
 */
async function pictureOf(page, preview, sharp, { box, whole, sources }) {
  const clip = await preview.evaluate(pictureClip, { box, whole, most: LIMITS.picture });
  if (!clip) return null;
  const take = () => page.screenshot({ clip, fullPage: true, timeout: SHOT_TIMEOUT });
  if (!box) return take();
  const check = () =>
    page.screenshot({ clip, fullPage: true, scale: "css", caret: "hide", timeout: SHOT_TIMEOUT });
  const before = await check();
  const image = await take();
  const after = await check();
  for (const seen of [before, after]) {
    if (!(await matches(sharp, seen, clip, sources))) {
      return pictureOf(page, preview, sharp, { box: null, whole, sources: [] });
    }
  }
  return image;
}

/**
 * Whether a picture (PNG, one pixel a point) of the part of the page `clip` names shows what
 * each of `sources`, pictures of other parts at the same scale, shows where the two overlap.
 */
export async function matches(sharp, picture, clip, sources) {
  for (const [where, source] of sources) {
    const left = Math.max(clip.x, where.x);
    const top = Math.max(clip.y, where.y);
    const width = Math.min(clip.x + clip.width, where.x + where.width) - left;
    const height = Math.min(clip.y + clip.height, where.y + where.height) - top;
    if (width < 1 || height < 1) continue;
    const part = (image, from) =>
      sharp(image)
        .extract({ left: left - from.x, top: top - from.y, width, height })
        .png()
        .toBuffer();
    if (await differ(sharp, await part(picture, clip), await part(source, where))) return false;
  }
  return true;
}

/** How far apart two values of a colour channel (0 to 255) may be and still be one colour. */
export const NOISE = 2;

/**
 * How long one picture may take, in milliseconds. A picture of a whole demo takes a few
 * seconds on an idle machine and several times that when other builds share its processors.
 */
export const SHOT_TIMEOUT = 60_000;

/**
 * Whether two pictures (PNG) show different things: see `probe` on what is the same.
 * @param {(image: Buffer) => import("sharp").Sharp} sharp
 * @param {Buffer} one
 * @param {Buffer} other
 */
export async function differ(sharp, one, other) {
  if (one.equals(other)) return false;
  const [a, b] = await Promise.all(
    [one, other].map((image) => sharp(image).raw().toBuffer({ resolveWithObject: true })),
  );
  if (
    a.info.width !== b.info.width ||
    a.info.height !== b.info.height ||
    a.info.channels !== b.info.channels
  ) {
    return true;
  }
  for (let at = 0; at < a.data.length; at++) {
    if (Math.abs(a.data[at] - b.data[at]) > NOISE) return true;
  }
  return false;
}

/**
 * The pictures of `probe`, taken once the page's animations that end have ended: whether the
 * content of
 * the preview paints in the part of the page that `options` names and, when it does, the two
 * pictures that show it, with the content (`shown`) and without (`hidden`). `steady` says
 * whether `shown` came out the same when it was taken again; when it never did, the content
 * moves by itself (an endless animation or a script), and where `shown`
 * has it is no more than where it was at one moment.
 */
async function compare(page, preview, options, sharp) {
  const shoot = () => page.screenshot(options);
  const hide = () => shootHidden(page, preview, options);
  let shown;
  let hidden;
  for (let attempt = 0; attempt < 3; attempt++) {
    shown = await shoot();
    hidden = await hide();
    if (!(await differ(sharp, shown, hidden))) {
      // Nothing of it seen. On a page where something keeps moving, the content may have
      // been out of view in both pictures: look twice more, a little later, before saying so.
      const moving = await page.evaluate(() =>
        document.getAnimations().some((animation) => animation.playState === "running"),
      );
      if (!moving || attempt === 2) return { paints: false };
      await new Promise((resolve) => setTimeout(resolve, 150));
      continue;
    }
    // The difference is the content's only if both pictures hold still: the one with it, and
    // the one without (a backdrop that changes by itself differs from one moment to the next).
    if (
      !(await differ(sharp, shown, await shoot())) &&
      !(await differ(sharp, hidden, await hide()))
    ) {
      return { paints: true, shown, hidden, steady: true };
    }
  }
  // The picture never came out the same twice. Is it the content that moves?
  hidden = await hide();
  for (let again = 0; again < 2; again++) {
    if (await differ(sharp, hidden, await hide())) return { paints: "changing" };
  }
  // The page without it holds still now. The content paints only if a fresh pair, taken now,
  // still differs: a backdrop that changed once, between the earlier pictures, does not.
  shown = await shoot();
  hidden = await hide();
  if (!(await differ(sharp, shown, hidden))) return { paints: false };
  return { paints: true, shown, hidden, steady: false };
}

/**
 * Where the content of a preview paints, in page coordinates: the box around the pixels that
 * differ between a picture of it (`shown`) and a picture with it hidden (`hidden`), both of
 * the part of the page that `clip` names. Read from the pixels, as `probe` is, because the box
 * of an element says neither that it is seen nor where its shadow falls.
 */
async function paintedBox(sharp, shownPicture, hiddenPicture, clip) {
  const read = (image) => sharp(image).raw().toBuffer({ resolveWithObject: true });
  const [shown, hidden] = await Promise.all([read(shownPicture), read(hiddenPicture)]);
  const { width, height, channels } = shown.info;
  if (hidden.info.width !== width || hidden.info.height !== height) return null;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width * channels;
    const end = row + width * channels;
    if (shown.data.compare(hidden.data, row, end, row, end) === 0) continue;
    let painted = false;
    for (let x = 0; x < width; x++) {
      const at = row + x * channels;
      let apart = 0;
      for (let channel = 0; channel < channels; channel++) {
        apart = Math.max(apart, Math.abs(shown.data[at + channel] - hidden.data[at + channel]));
      }
      if (apart <= NOISE) continue;
      painted = true;
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
    if (!painted) continue;
    top = Math.min(top, y);
    bottom = y;
  }
  if (right < 0) return null;
  return {
    x: clip.x + left,
    y: clip.y + top,
    width: right - left + 1,
    height: bottom - top + 1,
  };
}

/**
 * Runs in the page: the part of the page that the picture of an example shows, given where
 * the example paints (`box`, in page coordinates, or none). A component is a control of a few
 * dozen points in a preview hundreds wide: its picture shows the control, not the empty
 * preview. A demo (`whole`) is shown on its whole preview, and with it whatever it paints
 * outside of that. No side of a picture is longer than `most`.
 */
function pictureClip(preview, { box, whole, most }) {
  const rect = preview.getBoundingClientRect();
  const frame = {
    left: rect.left + window.scrollX,
    top: rect.top + window.scrollY,
    right: rect.right + window.scrollX,
    bottom: rect.bottom + window.scrollY,
  };
  const root = document.documentElement;
  const page = {
    right: Math.max(root.scrollWidth, window.innerWidth),
    bottom: Math.max(root.scrollHeight, window.innerHeight),
  };
  let left;
  let top;
  let right;
  let bottom;
  if (whole || !box) {
    left = Math.floor(Math.min(frame.left, box?.x ?? frame.left));
    top = Math.floor(Math.min(frame.top, box?.y ?? frame.top));
    right = Math.ceil(Math.max(frame.right, box ? box.x + box.width : frame.right));
    bottom = Math.ceil(Math.max(frame.bottom, box ? box.y + box.height : frame.bottom));
  } else {
    // Stay inside the preview, whose edge pixels are shared with the border of the code
    // below, except on a side where the component sticks out of it: there the page is the
    // limit.
    const inner = {
      left: Math.ceil(frame.left) + 1,
      top: Math.ceil(frame.top) + 1,
      right: Math.floor(frame.right) - 1,
      bottom: Math.floor(frame.bottom) - 1,
    };
    const limit = {
      left: box.x < inner.left ? 0 : inner.left,
      top: box.y < inner.top ? 0 : inner.top,
      right: box.x + box.width > inner.right ? page.right : inner.right,
      bottom: box.y + box.height > inner.bottom ? page.bottom : inner.bottom,
    };
    // Room for a shadow or a focus ring, and never smaller than a card's picture, so that a
    // small control is shown at its own size rather than enlarged.
    const PAD = 12;
    const MIN = { width: 150, height: 96 };
    const grow = (from, to, least, low, high) => {
      const extra = Math.max(0, least - (to - from)) / 2;
      return [Math.max(low, from - extra), Math.min(high, to + extra)];
    };
    [left, right] = grow(box.x - PAD, box.x + box.width + PAD, MIN.width, limit.left, limit.right);
    [top, bottom] = grow(
      box.y - PAD,
      box.y + box.height + PAD,
      MIN.height,
      limit.top,
      limit.bottom,
    );
  }
  // What is longer than a picture may be keeps the start of the preview in it.
  const bound = (from, to, start, end) => {
    const low = Math.max(0, from);
    const high = Math.min(end, to);
    if (high - low <= most) return [low, high];
    const first = Math.min(Math.max(low, start - most / 4), high - most);
    return [first, first + most];
  };
  [left, right] = bound(left, right, frame.left, page.right);
  [top, bottom] = bound(top, bottom, frame.top, page.bottom);
  if (right - left < 1 || bottom - top < 1) return null;
  // Whole points, so that a picture of it at one pixel a point lines up with the pictures
  // `probe` took (`matches`).
  const x = Math.floor(left);
  const y = Math.floor(top);
  return { x, y, width: Math.ceil(right) - x, height: Math.ceil(bottom) - y };
}

/**
 * Open the given routes of the built site and report what does not render.
 *
 * @param {object} options
 * @param {import("playwright").Browser} options.browser
 * @param {string} options.outDir docs/dist
 * @param {string} [options.base]
 * @param {string[]} options.routes
 * @param {boolean} [options.screenshots] write the screenshots (default true)
 * @param {number} [options.concurrency]
 * @returns {Promise<{ results: Map<string, { light: string[], dark: string[], errors: string[] }>,
 *   screenshots: Set<string> }>}
 */
export async function browserPass({
  browser,
  outDir,
  base = "/",
  routes,
  screenshots: takeScreenshots = true,
  concurrency = 3,
}) {
  const { default: sharp } = await import("sharp");
  const prefix = base.replace(/\/$/, "");
  const server = await serve(outDir, base);
  const results = new Map();
  const screenshots = new Set();
  // Component examples are small: capture them at 2x so the index stays sharp on a Retina
  // display. A demo is a whole window, shown scaled down.
  const contexts = new Map();
  const contextFor = async (scale) => {
    let context = contexts.get(scale);
    if (!context) {
      context = browser.newContext({
        viewport: { width: 1600, height: 1000 },
        deviceScaleFactor: scale,
        reducedMotion: "reduce",
      });
      contexts.set(scale, context);
    }
    return context;
  };

  const visit = async (route) => {
    const result = { light: [], dark: [], errors: [] };
    results.set(route, result);
    const context = await contextFor(route.startsWith("/demos/") ? 1 : 2);
    const page = await context.newPage();
    const note = (message) => {
      const line = message.split("\n")[0].slice(0, 300);
      if (!result.errors.includes(line)) result.errors.push(line);
    };
    page.on("pageerror", (error) => note(error.message));
    page.on("console", (message) => {
      // A failed request is reported once, by the response handler, with its URL.
      if (message.type() === "error" && !/Failed to load resource/.test(message.text())) {
        note(message.text());
      }
    });
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (response.status() >= 400 && url.pathname !== "/favicon.ico") {
        note(`${response.status()} for ${url.pathname}`);
      }
    });
    // A request that got no answer at all: a refused connection, a blocked or broken resource.
    // Requests still under way when the page is closed are cancelled, which is no failure.
    let closing = false;
    page.on("requestfailed", (request) => {
      if (closing) return;
      const url = new URL(request.url());
      const where = url.origin === server.origin ? url.pathname : request.url();
      note(`request failed: ${where} (${request.failure()?.errorText ?? "no response"})`);
    });
    try {
      const response = await page.goto(`${server.origin}${prefix}${route}`, { waitUntil: "load" });
      if (response && !response.ok()) throw new Error(`the server answered ${response.status()}`);
      await page.waitForFunction(
        () =>
          document.documentElement.hasAttribute("data-docs-ready") &&
          !document.querySelector(".docs-preview[aria-busy], .docs-code[aria-busy]"),
        null,
        { timeout: 30_000 },
      );
      // Examples are separate chunks: wait until they have arrived and hydrated.
      await page.waitForLoadState("networkidle", { timeout: 30_000 });
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      await page.evaluate(addProbeStyle, PROBE_STYLE);
      const shots = [];
      for (const appearance of APPEARANCES) {
        await page.evaluate(
          (value) =>
            new Promise((resolve) => {
              document.documentElement.setAttribute("data-appearance", value);
              requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined)));
            }),
          appearance,
        );
        result[appearance].push(...(await page.evaluate(inspect, appearance)));
        // The picture of the page is of its first example in this appearance: a component is
        // cropped to what it paints, wherever on the page that is; a demo is shown whole, on
        // its preview, with what it paints outside of it.
        const kind = route.startsWith("/demos/") ? "preview" : "content";
        let pictured = false;
        for (const preview of await page.$$(PREVIEWS)) {
          const { name, own, busy, first } = await preview.evaluate((element) => ({
            name: element.closest("figure")?.getAttribute("data-example") ?? "?",
            own: element.getAttribute("data-appearance"),
            busy: element.hasAttribute("aria-busy"),
            first: element.closest("figure") === document.querySelector("figure.docs-example"),
          }));
          if (busy || (own ?? appearance) !== appearance) continue;
          const picture = takeScreenshots && first && !pictured ? kind : null;
          const { paints, image } = await probe(page, preview, sharp, { picture });
          if (picture) pictured = true;
          if (image) {
            shots.push([
              appearance,
              await sharp(image)
                .resize({ width: 1280, height: 1600, fit: "inside", withoutEnlargement: true })
                .png({ compressionLevel: 9 })
                .toBuffer(),
            ]);
          }
          if (paints === "changing") {
            result[appearance].push(
              `example ${name} is on a page that changes by itself, so whether it renders cannot be told`,
            );
          } else if (paints === "unsettled") {
            result[appearance].push(
              `example ${name} is on a page whose animations did not settle while it was looked at (it waited up to ${SETTLE_TIMEOUT / 1000} s), so whether it renders cannot be told`,
            );
          } else if (paints === "paused") {
            result[appearance].push(
              `example ${name} is on a page with a paused transition, which hiding its content would cancel, so whether it renders cannot be told`,
            );
          } else if (paints === "unseen") {
            result[appearance].push(
              `example ${name} is on a page too large to picture whole, so whether it renders cannot be told`,
            );
          } else if (!paints) {
            result[appearance].push(`example ${name} rendered nothing visible`);
          }
        }
      }
      if (shots.length === APPEARANCES.length) {
        for (const [appearance, image] of shots) {
          const file = path.join(outDir, screenshotFile(route, appearance));
          await mkdir(path.dirname(file), { recursive: true });
          await writeFile(file, image);
        }
        screenshots.add(route);
      }
    } catch (error) {
      const message = `page did not render: ${String(error.message ?? error).split("\n")[0]}`;
      for (const appearance of APPEARANCES) {
        if (result[appearance].length === 0) result[appearance].push(message);
      }
    } finally {
      closing = true;
      await page.close();
    }
  };

  try {
    const queue = [...routes];
    await Promise.all(
      Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
        for (let route = queue.shift(); route !== undefined; route = queue.shift()) {
          await visit(route);
        }
      }),
    );
  } finally {
    for (const context of contexts.values()) await (await context).close();
    await server.close();
  }
  return { results, screenshots };
}
