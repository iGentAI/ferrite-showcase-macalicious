// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { type AddressInfo, createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import {
  browserPass,
  differ,
  launchBrowser,
  NOISE,
  SETTLE_TIMEOUT,
  SHOT_TIMEOUT,
  screenshotFile,
} from "../docs/browser-pass.mjs";

/*
 * The browser pass of the docs build (docs/browser-pass.mjs) opens every component and demo
 * page in Chromium and fails the build on an example that does not render. On the real site
 * every example renders, so the build never shows that the pass can tell: this test gives it a
 * page with an example that draws nothing and a page whose script throws.
 *
 * Needs the Chromium that `npm run visual:install` installs; skipped without it, unless
 * REQUIRE_BROWSER_TESTS=1, as the other browser tests are.
 */
const installed = (() => {
  try {
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
})();
const required = process.env.REQUIRE_BROWSER_TESTS === "1";

const outDir = mkdtempSync(path.join(tmpdir(), "docs-browser-pass-"));
afterAll(() => rmSync(outDir, { recursive: true, force: true }));

const page = (body: string) => `<!doctype html>
<html data-docs-ready>
  <head>
    <meta name="color-scheme" content="light dark" />
    <style>
      [data-appearance="light"] { color-scheme: light; }
      [data-appearance="dark"] { color-scheme: dark; }
      .docs-preview { padding: 24px; background: Canvas; color: CanvasText; }
    </style>
  </head>
  <body><article class="docs-article">${body}</article></body>
</html>`;

const example = (name: string, content: string) =>
  `<figure class="docs-example" data-example="${name}"><div class="docs-preview">${content}</div></figure>`;

/** Examples that take up room and draw nothing, and their counterparts that do draw. */
const NOTHING = {
  empty: "",
  "far-reaching-empty": `<span style="position: fixed; left: -1px; top: -1px; width: 1px; height: 1px; overflow: hidden"></span>`,
  "empty-wrapper": `<div style="width: 120px; height: 40px"><span style="display: block; height: 20px"></span></div>`,
  hidden: `<button style="visibility: hidden">Hidden</button>`,
  transparent: `<div style="opacity: 0"><button>Clear</button></div>`,
  clipped: `<div style="width: 0; height: 0; overflow: hidden"><button>Out of view</button></div>`,
  "clipped-positioned": `<div style="position: relative; width: 0; height: 40px; overflow: hidden"><button style="position: absolute; left: 0; top: 0">Out of view</button></div>`,
  "clear-text": `<p style="color: transparent">Words</p>`,
  "empty-picture": `<svg width="16" height="16"></svg>`,
  "unfilled-shape": `<svg width="16" height="16"><title>Ring</title><circle cx="8" cy="8" r="6" fill="none" /></svg>`,
  "faded-shape": `<svg width="16" height="16"><g opacity="0"><circle cx="8" cy="8" r="6" /></g></svg>`,
  "unstroked-line": `<svg width="16" height="16"><line x1="0" y1="4" x2="16" y2="12" /></svg>`,
  "out-of-view-shape": `<svg width="16" height="16"><circle cx="100" cy="100" r="6" /></svg>`,
  "clear-gradient": `<div style="width: 40px; height: 20px; background: linear-gradient(transparent, transparent)"></div>`,
  "clear-shadow": `<div style="width: 40px; height: 20px; box-shadow: 0 0 0 4px transparent"></div>`,
  "blank-canvas": `<canvas width="20" height="20"></canvas>`,
  // Paint that no reader sees, and no more than the browser's own rounding from one picture
  // of an unchanged page to the next: a channel of a colour moves by one step of 255.
  imperceptible: `<div style="width: 40px; height: 20px; background: rgb(0 0 0 / 0.004)"></div>`,
};
const SOMETHING = {
  basic: "<button>OK</button>",
  text: "<p>Words</p>",
  "plain-text": "Words with no element around them",
  box: `<div style="width: 40px; height: 20px; background: rgb(0 0 0 / 0.2)"></div>`,
  border: `<div style="width: 40px; height: 20px; border: 1px solid CanvasText"></div>`,
  generated: `<style>.dot::before { content: ""; display: block; width: 8px; height: 8px; background: red; }</style><span class="dot"></span>`,
  // Content that insists on being visible is content: it has to be hidden for the comparison
  // all the same, or it is in both pictures and taken for nothing.
  "important-visible": `<button style="visibility: visible !important">Kept</button>`,
  "important-rule": `<style>#kept-rule.kept-rule { visibility: visible !important; }</style><button id="kept-rule" class="kept-rule">Kept</button>`,
  "important-generated": `<style>#kept-dot.kept-dot::before { content: ""; display: block; width: 8px; height: 8px; background: red; visibility: visible !important; }</style><span id="kept-dot" class="kept-dot"></span>`,
  // The same in a cascade layer of the page: of two layers, the earlier one's important
  // declarations win, so the rules that hide content have to come before the page's.
  "important-layered": `<style>@layer early { .layered-dot::before { content: ""; display: block; width: 8px; height: 8px; background: red; visibility: visible !important; } }</style><span class="layered-dot"></span>`,
  picture: `<svg width="16" height="16"><circle cx="8" cy="8" r="6" /></svg>`,
  stroke: `<svg width="16" height="16"><line x1="0" y1="8" x2="16" y2="8" stroke="currentColor" /></svg>`,
  "drawn-canvas": `<canvas id="drawn" width="20" height="20"></canvas><script>document.getElementById("drawn").getContext("2d").fillRect(0, 0, 10, 10)</script>`,
  "visible-inside-hidden": `<div style="visibility: hidden"><b style="visibility: visible">Shown</b></div>`,
  "partly-clipped": `<div style="width: 30px; height: 10px; overflow: hidden"><button>Cut off</button></div>`,
  "positioned-past-a-clip": `<div style="position: relative; height: 40px"><div style="width: 0; height: 0; overflow: hidden"><button style="position: absolute; left: 0; top: 0">Not cut off</button></div></div>`,
  // Content that never looks the same twice: a script repaints it every few milliseconds.
  ticking: `<div id="ticking" style="width: 40px; height: 20px"></div><script>{ let n = 0; const box = document.getElementById("ticking"); setInterval(() => { n += 1; box.style.background = "rgb(" + (n % 256) + " " + ((n >> 8) % 256) + " 200)"; }, 4); }</script>`,
  animated: `<style>@keyframes pulse { from { background: rgb(255 0 0); } to { background: rgb(0 0 255); } }</style><div style="width: 40px; height: 20px; animation: pulse 50ms linear infinite alternate"></div>`,
  // Hiding it for the comparison must not be slowed down by its own transition.
  transitioned: `<button style="transition: all 10s">Slow</button>`,
  // Content a script keeps repainting, which also insists on being visible: it has to stay
  // out of the pictures of every other example, such as the one below that reaches over it.
  "insistent-ticking": `<div id="insistent" style="width: 40px; height: 20px; visibility: visible !important"></div><script>{ let n = 0; const box = document.getElementById("insistent"); setInterval(() => { n += 1; box.style.setProperty("background", "rgb(200 " + (n % 256) + " " + ((n >> 8) % 256) + ")"); }, 4); }</script>`,
  // An element of the example sits in the corner of the window, as a visually hidden input
  // does: the picture then reaches over the examples above this one, one of which is ticking.
  "far-reaching": `<span style="position: fixed; left: -1px; top: -1px; width: 1px; height: 1px; overflow: hidden"></span><button>OK</button>`,
  // What the example draws is all outside its preview's box.
  overflowing: `<div style="position: relative; height: 20px"><div style="position: absolute; left: 0; top: 200px; width: 40px; height: 20px; background: rgb(255 0 0)"></div></div>`,
  // What it draws is outside the box of every element it has: a shadow cast into the margin
  // beside the preview, and generated content placed there.
  "offset-shadow": `<div style="width: 10px; height: 10px; box-shadow: -50px 0 0 0 rgb(255 0 0)"></div>`,
  "outside-pseudo": `<style>.far { position: relative; height: 10px; } .far::after { content: ""; position: absolute; left: -60px; top: 0; width: 10px; height: 10px; background: rgb(0 128 0); }</style><div class="far"></div>`,
};

/** A red block: the middle of a picture of it is red. */
const RED = `<div style="width: 200px; height: 120px; background: rgb(255 0 0)"></div>`;

/** An example whose preview is busy until its script says it is ready (`READY`). */
const busy = (name: string, content: string) =>
  `<figure class="docs-example" data-example="${name}"><div class="docs-preview" aria-busy="true">${content}</div></figure>`;
/** In a fixture's script, with its block as `box`: no longer busy once a transition runs. */
const READY = `const ready = () => box.getAnimations().some((animation) => animation.playState === "running") ? box.closest(".docs-preview").removeAttribute("aria-busy") : requestAnimationFrame(ready); ready();`;
/** Room under an example: what sticks out of a preview is on the page, not past its end. */
const ROOM = `<div style="height: 600px"></div>`;
/**
 * Sound that plays (muted, in a video element, which a browser lets start by itself), of which
 * the page keeps count: the block turns red when the sound starts a second time, which is
 * when something that paused it let it play again.
 */
const RESUMED = `<div id="resumed" style="width: 40px; height: 20px"></div><script>{
  const rate = 8000, length = rate * 30, wav = new DataView(new ArrayBuffer(44 + length));
  const text = (at, word) => [...word].forEach((letter, i) => wav.setUint8(at + i, letter.charCodeAt(0)));
  text(0, "RIFF"); wav.setUint32(4, 36 + length, true); text(8, "WAVEfmt "); wav.setUint32(16, 16, true);
  wav.setUint16(20, 1, true); wav.setUint16(22, 1, true); wav.setUint32(24, rate, true); wav.setUint32(28, rate, true);
  wav.setUint16(32, 1, true); wav.setUint16(34, 8, true); text(36, "data"); wav.setUint32(40, length, true);
  for (let at = 44; at < 44 + length; at++) wav.setUint8(at, 128);
  const sound = document.createElement("video");
  sound.src = URL.createObjectURL(new Blob([wav.buffer], { type: "audio/wav" }));
  sound.muted = true; sound.loop = true; sound.style.display = "none"; document.body.append(sound);
  let starts = 0;
  sound.addEventListener("play", () => { starts += 1; if (starts > 1) document.getElementById("resumed").style.background = "rgb(255 0 0)"; });
  sound.play();
}</script>`;
/** A preview taller than the window: its content at either end of it, or none. */
const TALL = {
  "tall-bottom": `<div style="height: 3000px"></div>${RED}`,
  "tall-top": `<button>Top</button><div style="height: 3000px"></div>`,
  "tall-empty": `<div style="height: 3000px"></div>`,
};

/**
 * Empty examples whose preview is not a plain box: it is drawn in its own text colour, or it
 * changes between two pictures of it, by an animation or by a script. None of that is the
 * example rendering.
 */
const preview = (name: string, attributes: string, after = "") =>
  `<figure class="docs-example" data-example="${name}"><div class="docs-preview" ${attributes}></div>${after}</figure>`;
const EMPTY_PREVIEWS = [
  preview(
    "current-colour",
    `style="border: 2px solid currentColor; background: linear-gradient(currentColor, currentColor) 0 0 / 10px 10px no-repeat; box-shadow: inset 0 0 0 4px currentColor"`,
  ),
  preview(
    "animated-backdrop",
    `style="animation: backdrop 4s steps(1, end) infinite"`,
    `<style>@keyframes backdrop { 0% { background: rgb(255 0 0); } 50% { background: rgb(0 0 255); } }</style>`,
  ),
  preview(
    "changing-backdrop",
    `id="changing"`,
    `<script>{ let n = 0; const box = document.getElementById("changing"); setInterval(() => { n += 1; box.style.background = "rgb(" + (n % 256) + " " + ((n >> 8) % 256) + " 200)"; }, 4); }</script>`,
  ),
  // The same, of a preview that insists on being visible: it has to stay out of the pictures
  // of the other examples all the same, several of which are of the whole page.
  preview(
    "insistent-backdrop",
    `id="insisting" style="visibility: visible !important"`,
    `<script>{ let n = 0; const box = document.getElementById("insisting"); setInterval(() => { n += 1; box.style.setProperty("background", "rgb(200 " + (n % 256) + " " + ((n >> 8) % 256) + ")"); }, 4); }</script>`,
  ),
].join("");
const examples = (set: Record<string, string>) =>
  Object.entries(set)
    .map(([name, content]) => example(name, content))
    .join("");

/** A port nothing listens on: a request to it gets no response at all. */
const deadPort = await new Promise<number>((resolve) => {
  const probe = createServer();
  probe.listen(0, "127.0.0.1", () => {
    const { port } = probe.address() as AddressInfo;
    probe.close(() => resolve(port));
  });
});

for (const [file, content] of Object.entries({
  "404.html": page(""),
  "components/offline/index.html": page(
    `${example("basic", "<button>OK</button>")}<link rel="stylesheet" href="http://127.0.0.1:${deadPort}/gone.css" />`,
  ),
  "components/partly/index.html": page(
    `${examples(SOMETHING)}${examples(NOTHING)}
     <figure class="docs-example" data-example="clear-preview" style="opacity: 0"><div class="docs-preview"><button>OK</button></div></figure>
     ${EMPTY_PREVIEWS}
     <figure class="docs-example" data-example="pair"><div class="docs-preview-pair">
       <div class="docs-preview" data-appearance="light"><b>Aqua</b></div>
       <div class="docs-preview" data-appearance="dark"><b>Dark Aqua</b></div>
     </div></figure>`,
  ),
  "components/throws/index.html": page(
    `${example("basic", "<button>OK</button>")}<script>throw new Error("boom")</script>`,
  ),
  // The first example is far below the fold, under a band of another colour: the page has to
  // be scrolled before the picture is taken.
  "components/below/index.html": page(
    `<div style="height: 3000px; background: rgb(0 0 255)"></div>${example("basic", RED)}`,
  ),
  // The first example is drawn by an animation that never ends, and by nothing else.
  "components/animated/index.html": page(
    example(
      "basic",
      `<style>@keyframes glow { from { background: rgb(255 0 0); } to { background: rgb(255 0 0); } }</style><div style="width: 200px; height: 120px; animation: glow 1s linear infinite"></div>`,
    ),
  ),
  // The first example's content is at the bottom of a preview taller than the window.
  "components/tall/index.html": page(examples(TALL)),
  // The first example's content is all below its preview, over the room left under it.
  "components/overflow/index.html": page(
    `${example("basic", `<div style="position: relative; height: 20px"><div style="position: absolute; left: 0; top: 200px">${RED}</div></div>`)}${ROOM}`,
  ),
  // The first example moves, fast and far: a picture of it shows it only when it is taken
  // while the example is where it was found.
  "components/moving/index.html": page(
    example(
      "basic",
      `<style>@keyframes slide { from { transform: translateX(0); } to { transform: translateX(1000px); } }</style><div style="width: 200px; animation: slide 300ms linear infinite alternate">${RED}</div>`,
    ),
  ),
  // The first example paints green in its preview and, by a shadow that no element's box
  // reaches, red far under it.
  "components/mixed/index.html": page(
    `${example("basic", `<div style="width: 200px; height: 120px; background: rgb(0 255 0); box-shadow: 0 400px 0 0 rgb(255 0 0)"></div>`)}${ROOM}`,
  ),
  // A demo: its first example paints blue in its preview and red under it.
  "demos/overflow/index.html": page(
    `${example("basic", `<div style="position: relative; width: 200px; height: 120px; background: rgb(0 0 255)"><div style="position: absolute; left: 0; top: 400px">${RED}</div></div>`)}${ROOM}`,
  ),
  // A page longer than is pictured whole: an example that paints near its preview is seen;
  // of one that does not, nothing can be said.
  "components/long/index.html": page(
    `${example("basic", "<button>OK</button>")}${example("empty", "")}<div style="height: 40000px"></div>`,
  ),
  // Sound plays on the page; the second example is drawn only once it plays again after the
  // first example was looked at.
  "components/sound/index.html": page(
    `${example("basic", "<button>OK</button>")}${example("resumed", RESUMED)}`,
  ),
  // The second example is drawn by one change of its own style attribute, which its script
  // makes while the example is hidden for the pictures of the first: the change is the
  // page's, and is still there when the example is shown again.
  "components/kept/index.html": page(
    `${example("basic", "<button>OK</button>")}${example("kept", `<div id="kept" style="width: 40px; height: 20px"></div><script>{ const box = document.getElementById("kept"); const timer = setInterval(() => { if (!box.closest(".docs-preview").hasAttribute("data-docs-probe")) return; box.style.background = "rgb(255 0 0)"; clearInterval(timer); }, 4); }</script>`)}`,
  ),
  // The page starts a transition of three seconds, blue to red, and awaits its `finished`:
  // the check must let it end where and when it would have (it waits for it), and must start
  // no transition of its own afterwards, although the block transitions its visibility too.
  // Its preview is busy until the transition runs, and the check waits for that, so it is
  // probed while the transition is under way, not before it starts.
  "components/awaiting/index.html": page(
    busy(
      "basic",
      `<div id="awaited" style="width: 200px; height: 120px; background: rgb(0 0 255); transition: background 3s linear, visibility 3s"></div><script>{
        const box = document.getElementById("awaited");
        requestAnimationFrame(() => requestAnimationFrame(() => {
          box.style.background = "rgb(255 0 0)";
          const [transition] = box.getAnimations();
          if (!transition) return console.error("no transition started");
          transition.finished.then(() => {
            if (getComputedStyle(box).backgroundColor !== "rgb(255, 0, 0)") console.error("finished elsewhere");
            box.addEventListener("transitionrun", (event) => console.error("a transition of " + event.propertyName + " started"));
          }, () => console.error("transition.finished was rejected"));
          ${READY}
        }));
      }</script>`,
    ),
  ),
  // The page listens, in the capture phase on the window, before anything of the check runs,
  // for any transition cancelled or started once its own has ended: the check must give it
  // neither. A second preview has text of its own written straight into it, so that its text
  // colours are what hide that text, and generated content of its own, list markers (also the
  // marker of generated content shown as a list item), the content of an open details element
  // and the thumb of a range input that transition what hiding might change. Its colour is
  // fixed, since the page turning dark changes the colour it would otherwise inherit, and with
  // it start transitions that are the page's, not the check's; the markers transition no
  // `color` at all, since Chromium changes a marker's colour by itself when the page turns
  // dark. A third has a `transition` of its own, `!important`, in
  // its style attribute, of the colour its text is hidden by. Hiding those previews, or
  // their content, must start none.
  "components/listening/index.html": page(
    `<script>
      window.addEventListener("transitioncancel", (event) => console.error("transitioncancel of " + event.propertyName), true);
      window.addEventListener("transitionrun", (event) => { if (window.ended) console.error("transitionrun of " + event.propertyName + " on " + (event.target.id || event.target.className || event.target.tagName) + (event.pseudoElement || "")); }, true);
    </script>${busy(
      "basic",
      // Its transitions are of what the check hides by (visibility) and of what the page
      // changes (background); not of colour, which Chromium transitions on a button when the
      // page itself turns dark, a change that is the page's, not the check's.
      `<button id="listened" style="color: rgb(0 0 0); background: rgb(0 0 255); transition: visibility 2s, background 2s">Listened</button><script>{
        const box = document.getElementById("listened");
        requestAnimationFrame(() => requestAnimationFrame(() => {
          box.style.background = "rgb(255 0 0)";
          box.getAnimations()[0]?.finished.then(() => { window.ended = true; });
          ${READY}
        }));
      }</script>`,
    )}<style>#rooted::before { content: ""; display: block; width: 10px; height: 10px; background: rgb(0 128 0); transition: visibility 1s; } #rooted li::marker { transition: visibility 1s, -webkit-text-fill-color 1s; } #rooted details::details-content { transition: visibility 1s, content-visibility 1s allow-discrete; } #rooted .generated::before { content: "Generated"; display: list-item; margin-left: 20px; } #rooted .generated::before::marker { transition: visibility 1s, -webkit-text-fill-color 1s; } #rooted input[type="range"] { -webkit-appearance: none; } #rooted input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 10px; height: 10px; background: currentColor; transition: background-color 1s, visibility 1s; }</style><figure class="docs-example" data-example="rooted"><div class="docs-preview" id="rooted" style="color: rgb(0 0 0)">Rooted<button>OK</button><ul><li>Item</li></ul><details open><summary>More</summary>Details</details><div class="generated"></div><input type="range" aria-label="Level" /></div></figure><figure class="docs-example" data-example="inline-root"><div class="docs-preview" style="-webkit-text-fill-color: rgb(0 0 0); transition: -webkit-text-fill-color 1s !important">Text</div></figure>`,
  ),
  // A transition of a thousand seconds: the page does not settle in time, and is said so.
  "components/unsettled/index.html": page(
    busy(
      "basic",
      `<div id="slow" style="width: 200px; height: 120px; background: rgb(0 0 255); transition: background 1000s linear"></div><script>{
        const box = document.getElementById("slow");
        requestAnimationFrame(() => requestAnimationFrame(() => {
          box.style.background = "rgb(255 0 0)";
          ${READY}
        }));
      }</script>`,
    ),
  ),
  // A transition the page has paused: hiding would cancel it, so the page is not probed and
  // is said so; the transition is neither cancelled nor its `finished` rejected.
  "components/paused/index.html": page(
    busy(
      "basic",
      `<div id="held" style="width: 200px; height: 120px; background: rgb(0 0 255); transition: background 2s linear"></div><script>{
        const box = document.getElementById("held");
        box.addEventListener("transitioncancel", () => console.error("the paused transition was cancelled"));
        requestAnimationFrame(() => requestAnimationFrame(() => {
          box.style.background = "rgb(255 0 0)";
          const [transition] = box.getAnimations();
          if (!transition) return console.error("no transition started");
          transition.pause();
          transition.finished.catch(() => console.error("the paused transition's finished was rejected"));
          box.closest(".docs-preview").removeAttribute("aria-busy");
        }));
      }</script>`,
    ),
  ),
  // A transition whose longhands differ in `!important` reads back as no shorthand at all.
  // A script writes another property into the block's style attribute while it is hidden,
  // so the attribute cannot be put back word for word: each longhand has to come back, with
  // its own priority. The page says so in the console when one does not.
  // A visibility that an `all` after it overrules: the element is seen. A script writes
  // another property while it is hidden, so the attribute cannot be put back word for word;
  // the declarations must keep their places all the same, or the visibility would come back
  // after the `all` and hide the element. The page says so in the console.
  "components/ordered/index.html": page(
    `${example("basic", "<button>OK</button>")}${example(
      "ordered",
      `<b id="ordered" style="visibility: hidden; all: unset; display: block; width: 40px; height: 20px; background: rgb(0 0 255)"></b><script>{
        const box = document.getElementById("ordered");
        const preview = box.closest(".docs-preview");
        let written = false;
        new MutationObserver(() => {
          if (!written && preview.hasAttribute("data-docs-probe")) {
            written = true;
            box.style.outlineWidth = "0px";
            return;
          }
          if (!written || preview.hasAttribute("data-docs-probe") || preview.hasAttribute("data-docs-probe-away")) return;
          if (getComputedStyle(box).visibility !== "visible" || box.style.outlineWidth !== "0px") console.error("order lost: " + box.getAttribute("style"));
        }).observe(preview, { attributes: true, subtree: true });
      }</script>`,
    )}`,
  ),
  // Short transitions the page starts on a timer, also while it is looked at: none may be
  // cancelled (the page says so in the console when one is).
  "components/late/index.html": page(
    example(
      "basic",
      `<div id="late" style="width: 200px; height: 120px; background: rgb(255 0 0); transition: background 80ms"></div><script>{
        const box = document.getElementById("late");
        box.addEventListener("transitioncancel", () => console.error("a transition was cancelled"));
        let n = 0;
        setInterval(() => { n += 1; box.style.background = n % 2 ? "rgb(254 0 0)" : "rgb(255 0 0)"; }, 400);
      }</script>`,
    ),
  ),
  // A script that, the first time its content is hidden, writes a `transition` of its own
  // into the block's style attribute (outranking the check's) and starts it: showing the
  // content again must not cancel it (the page says so in the console), and the example the
  // pictures were for is said not to have settled.
  "components/rewriting/index.html": page(
    `${example("basic", "<button>OK</button>")}${example(
      "rewriting",
      `<div id="rewriting" style="width: 40px; height: 20px; background: rgb(255 0 0)"></div><script>{
        const box = document.getElementById("rewriting");
        const preview = box.closest(".docs-preview");
        box.addEventListener("transitioncancel", () => console.error("the page's transition was cancelled"));
        let started = false;
        new MutationObserver(() => {
          if (started || !preview.hasAttribute("data-docs-probe")) return;
          started = true;
          box.style.setProperty("transition", "background 12s", "important");
          box.style.background = "rgb(0 0 255)";
        }).observe(preview, { attributes: true, subtree: true });
      }</script>`,
    )}`,
  ),
  // An endless animation the page plays backwards from three seconds in: it ends at time
  // zero, and until then keeps the block invisible. The check must wait for it, and then sees
  // the block; a check that took it for endless would find nothing painted.
  "components/rewinding/index.html": page(
    busy(
      "basic",
      `<style>@keyframes unseen { from { opacity: 0; } to { opacity: 0; } }</style><div id="rewinding" style="width: 200px; height: 120px; background: rgb(255 0 0); animation: unseen 1s linear infinite"></div><script>{
        const box = document.getElementById("rewinding");
        requestAnimationFrame(() => {
          const [animation] = box.getAnimations();
          if (!animation) return console.error("no animation");
          animation.playbackRate = -1;
          animation.currentTime = 3000;
          box.closest(".docs-preview").removeAttribute("aria-busy");
        });
      }</script>`,
    ),
  ),
  "components/mixed-priority/index.html": page(
    `${example("basic", "<button>OK</button>")}${example(
      "mixed",
      `<div id="mixed" style="width: 40px; height: 20px; background: rgb(255 0 0); transition-property: background !important; transition-duration: 1ms"></div><script>{
        const box = document.getElementById("mixed");
        const preview = box.closest(".docs-preview");
        let written = false;
        new MutationObserver(() => {
          if (!written && preview.hasAttribute("data-docs-probe")) {
            written = true;
            box.style.outlineWidth = "0px";
            return;
          }
          if (!written || preview.hasAttribute("data-docs-probe") || preview.hasAttribute("data-docs-probe-away")) return;
          if (box.style.getPropertyValue("transition-property") !== "background" || box.style.getPropertyPriority("transition-property") !== "important" || box.style.getPropertyValue("transition-duration") !== "1ms") console.error("transition lost: " + box.getAttribute("style"));
        }).observe(preview, { attributes: true, subtree: true });
      }</script>`,
    )}`,
  ),
  // Style attributes that are put back word for word or not at all: a transition written
  // with var() and !important, and a visibility that an `all` after it overrules. Each
  // reports in the console when it is shown again changed.
  "components/styled/index.html": page(
    `${example("basic", "<button>OK</button>")}${example(
      "styled",
      `<button class="styled" style="--motion: color 1ms; transition: var(--motion) !important">Motion</button><b class="styled" style="visibility: hidden; all: unset; display: block; width: 40px; height: 20px; background: rgb(0 0 255)"></b><script>{
        const preview = document.currentScript.closest(".docs-preview");
        const styled = [...preview.querySelectorAll(".styled")].map((element) => [element, element.getAttribute("style")]);
        new MutationObserver(() => {
          if (preview.hasAttribute("data-docs-probe") || preview.hasAttribute("data-docs-probe-away")) return;
          for (const [element, style] of styled) {
            if (element.getAttribute("style") !== style) console.error("style changed: " + element.getAttribute("style"));
          }
        }).observe(preview, { attributes: true, subtree: true });
      }</script>`,
    )}`,
  ),
  // The first example is far to the right, past the first 4000 points of a wide page.
  "components/wide/index.html": page(
    `<div style="display: flex; width: max-content"><div style="flex: none; width: 5000px; height: 10px"></div>${example("basic", RED)}</div>`,
  ),
  // The first example is moved by a script, all the time: no crop read from its pixels can
  // hold, and it is pictured on its preview.
  "components/scripted/index.html": page(
    example(
      "basic",
      `<div style="position: relative; width: 900px; height: 120px"><div id="runner" style="position: absolute; top: 0; width: 200px; height: 120px; background: rgb(255 0 0)"></div></div><script>{ const runner = document.getElementById("runner"); setInterval(() => { runner.style.left = (Date.now() % 700) + "px"; }, 4); }</script>`,
    ),
  ),
  // A page that is ready and has no example at all: nothing on it was checked.
  "components/no-examples/index.html": page("<p>Words, and no example</p>"),
  // Content whose boxes are not children of the preview's own: in an element that has no box
  // of its own (`display: contents`), which `opacity` on that element does not hide, even
  // nested; text put straight into such an element; and what it generates.
  "components/contents/index.html": page(
    `<style>.contents-dot::before { content: ""; display: block; width: 20px; height: 10px; background: rgb(255 0 0); }</style>${examples(
      {
        "contents-child": `<div style="display: contents"><button>Inside</button></div>`,
        "contents-nested": `<div style="display: contents"><div style="display: contents"><b>Deep</b></div></div>`,
        "contents-text": `<span style="display: contents">Words in a box that is not there</span>`,
        "contents-generated": `<span class="contents-dot" style="display: contents"></span>`,
        "contents-empty": `<div style="display: contents"><span style="visibility: hidden">Hidden</span></div>`,
        // Text whose colour its element without a box sets in its own style attribute, with
        // `!important`, which outranks every rule.
        "contents-important-text": `<span style="display: contents; -webkit-text-fill-color: rgb(255 0 0) !important">Words in an insistent colour</span>`,
      },
    )}<figure class="docs-example" data-example="spaces"><div class="docs-preview" style="white-space: pre; text-decoration: underline 4px rgb(255 0 0); text-decoration-skip-spaces: none">          </div></figure>`,
  ),
  // Content the preview generates itself, before and after what it holds, as text and as a
  // block; the block's opacity transitions, and hiding it must start no transition (the page
  // says so in the console when one starts). A preview that generates nothing visible paints
  // nothing.
  "components/generated/index.html": page(
    `<script>window.addEventListener("transitionrun", (event) => console.error("transitionrun of " + event.propertyName + " on " + (event.target.id || event.target.tagName) + (event.pseudoElement || "")), true);</script><style>#own-before::before { content: "Before"; } #own-after::after { content: ""; display: block; width: 20px; height: 10px; background: rgb(255 0 0); transition: opacity 1s; } #own-empty::before { content: ""; }</style>${preview("own-before", `id="own-before"`)}${preview("own-after", `id="own-after"`)}${preview("own-empty", `id="own-empty"`)}`,
  ),
  // Content in the top layer, which the opacity of no ancestor hides: a modal dialog and a
  // popover, each inside an element of their preview, opened by the page.
  "components/top-layer/index.html": page(
    `${example("basic", "<button>OK</button>")}${example("modal", `<div><dialog id="modal">Modal words</dialog></div>`)}${example("popover", `<div><div popover id="popped" style="top: 0; bottom: auto">Popover words</div></div>`)}<script>document.getElementById("modal").showModal(); document.getElementById("popped").showPopover();</script>`,
  ),
  // Other previews that their opacity does not take out of the pictures of an example: one
  // without a box of its own (`display: contents`), whose content a script keeps repainting;
  // and, on a page of its own, one that is itself a popover, in the top layer, whose backdrop
  // a script keeps repainting (by rewriting a stylesheet, since a backdrop has no style
  // attribute). Unless each is hidden, the button's pictures keep changing: the repainted box
  // is placed over the button's preview, and the backdrop covers the window.
  "components/other-contents/index.html": page(
    `${example("basic", "<button>OK</button>")}<figure class="docs-example" data-example="contents-preview"><div class="docs-preview" style="display: contents"><div id="contents-ticking" style="position: absolute; left: 200px; top: 40px; width: 40px; height: 20px"></div></div></figure><script>{
      const box = document.getElementById("contents-ticking");
      let n = 0;
      setInterval(() => {
        n += 1;
        box.style.background = "rgb(" + (n % 256) + " " + ((n >> 8) % 256) + " 200)";
      }, 4);
    }</script>`,
  ),
  "components/other-top-layer/index.html": page(
    `${example("basic", "<button>OK</button>")}<figure class="docs-example" data-example="popover-preview"><div class="docs-preview" popover id="popover-preview" style="top: 0; bottom: auto; left: auto; right: 0">Popover preview</div></figure><style id="backdrop-ticking"></style><script>{
      document.getElementById("popover-preview").showPopover();
      const sheet = document.getElementById("backdrop-ticking");
      let n = 0;
      setInterval(() => {
        n += 1;
        sheet.textContent = "#popover-preview::backdrop { background: rgb(" + (n % 256) + " " + ((n >> 8) % 256) + " 200); }";
      }, 4);
    }</script>`,
  ),
  // A preview that is itself a popover, empty, over a backdrop of its own: the backdrop is the
  // preview's, not its content, and is left as it is, so the example paints nothing.
  "components/empty-top-layer/index.html": page(
    `<style>#empty-popover::backdrop { background: rgb(255 0 0); }</style><figure class="docs-example" data-example="empty-popover"><div class="docs-preview" popover id="empty-popover" style="top: 0; bottom: auto"></div></figure><script>document.getElementById("empty-popover").showPopover();</script>`,
  ),
  // A block whose style attribute ends in an `all` that is `!important`, after an important
  // opacity of its own: the opacity that hides it, and the `transition: none` beside it, have
  // to come after that `all`. The page looks each time its content is hidden, the first time
  // included, and says so in the console when the block is not.
  "components/important-all/index.html": page(
    example(
      "basic",
      `<b id="important-all" style="opacity: 1 !important; all: unset !important; display: block !important; width: 40px !important; height: 20px !important; background: rgb(255 0 0) !important"></b><script>{
        const box = document.getElementById("important-all");
        const preview = box.closest(".docs-preview");
        new MutationObserver(() => {
          if (!preview.hasAttribute("data-docs-probe") || preview.hasAttribute("data-docs-probe-away")) return;
          const { opacity, transitionProperty } = getComputedStyle(box);
          if (opacity !== "0" || transitionProperty !== "none") console.error("not hidden: opacity " + opacity + ", transition " + transitionProperty);
        }).observe(preview, { attributes: true, attributeFilter: ["data-docs-probe"] });
      }</script>`,
    ),
  ),
  // A full-screen element in an example, under another element of it: the test gives the page
  // a binding that enters full screen with the user activation it needs (`__fullscreen`), and
  // the preview is busy until the element is full screen. It covers the window, so unless it
  // is hidden with its backdrop, the button of the first example is not seen either.
  "components/full-screen/index.html": page(
    `${example("basic", "<button>OK</button>")}${busy("full-screen", `<div><div id="full" style="background: rgb(0 128 0)">Full-screen words</div></div>`)}<script>{
      const full = document.getElementById("full");
      document.addEventListener("fullscreenchange", () => {
        if (document.fullscreenElement === full) full.closest(".docs-preview").removeAttribute("aria-busy");
      });
      window.__fullscreen("#full");
    }</script>`,
  ),
})) {
  mkdirSync(path.dirname(path.join(outDir, file)), { recursive: true });
  writeFileSync(path.join(outDir, file), content);
}

describe("the comparison of two pictures", () => {
  /** A grey picture of 4 by 3 pixels, one pixel of it another grey. */
  const picture = (grey: number, pixel = grey, width = 4) => {
    const data = Buffer.alloc(width * 3 * 3, grey);
    data.fill(pixel, 15, 18);
    return sharp(data, { raw: { width, height: 3, channels: 3 } })
      .png()
      .toBuffer();
  };

  it("takes a pixel the browser rounded for no difference, and more for one", async () => {
    const plain = await picture(100);
    expect(await differ(sharp, plain, await picture(100))).toBe(false);
    // One pixel a step or two lighter or darker is the same picture taken again.
    expect(await differ(sharp, plain, await picture(100, 100 + NOISE))).toBe(false);
    expect(await differ(sharp, plain, await picture(100, 100 - NOISE))).toBe(false);
    // One step more is something painted, however small.
    expect(await differ(sharp, plain, await picture(100, 100 + NOISE + 1))).toBe(true);
    expect(await differ(sharp, plain, await picture(100, 100, 5))).toBe(true);
    expect(NOISE).toBe(2);
  });

  it("gives a picture a minute, which a whole demo needs on a busy machine", () => {
    expect(SHOT_TIMEOUT).toBe(60_000);
  });
});

describe.skipIf(!installed && !required)("browserPass", () => {
  it("reports what does not render and takes a light and a dark screenshot", async () => {
    const browser = await launchBrowser();
    if (!browser) throw new Error("Chromium is not installed: npm run visual:install");
    const routes = [
      "/components/partly",
      "/components/throws",
      "/components/offline",
      "/components/below",
      "/components/tall",
      "/components/overflow",
      "/components/animated",
      "/components/moving",
      "/components/mixed",
      "/components/long",
      "/components/sound",
      "/components/kept",
      "/components/awaiting",
      "/components/listening",
      "/components/unsettled",
      "/components/paused",
      "/components/mixed-priority",
      "/components/ordered",
      "/components/late",
      "/components/rewriting",
      "/components/rewinding",
      "/components/styled",
      "/components/wide",
      "/components/scripted",
      "/demos/overflow",
      "/components/absent",
    ];
    const { results, screenshots } = await browserPass({ browser, outDir, routes }).finally(() =>
      browser.close(),
    );

    // The examples that draw nothing fail in both appearances; the ones that draw, by text,
    // a background, a border, generated content or a picture, and the pair, do not. Content
    // that moves is content; a preview drawn in its text colour is not, and one that a script
    // keeps repainting gives no evidence either way. A preview that an endless animation
    // repaints is not held still (nothing of the page is): its backdrop turns from red to
    // blue and back every two seconds, and its empty example is seen to paint nothing, or,
    // when a turn falls between the pictures, to keep changing; never to paint, since a
    // difference counts only when the pictures with and without the content both hold still.
    // That one example is therefore checked apart from the rest.
    const nothing = [
      ...[...Object.keys(NOTHING), "clear-preview", "current-colour"].map(
        (name) => `example ${name} rendered nothing visible`,
      ),
      "example changing-backdrop is on a page that changes by itself, so whether it renders cannot be told",
      "example insistent-backdrop is on a page that changes by itself, so whether it renders cannot be told",
    ];
    const partly = results.get("/components/partly");
    const backdrop = /^example animated-backdrop /;
    for (const appearance of ["light", "dark"] as const) {
      const lines = partly?.[appearance].filter((line) => backdrop.test(line)) ?? [];
      expect([appearance, lines.length]).toEqual([appearance, 1]);
      for (const line of lines) {
        expect(line).toMatch(
          /^example animated-backdrop (rendered nothing visible|is on a page that changes by itself, so whether it renders cannot be told)$/,
        );
      }
    }
    expect({
      light: partly?.light.filter((line) => !backdrop.test(line)),
      dark: partly?.dark.filter((line) => !backdrop.test(line)),
      errors: partly?.errors,
    }).toEqual({
      light: nothing,
      dark: nothing,
      errors: [],
    });
    expect(results.get("/components/throws")).toEqual({ light: [], dark: [], errors: ["boom"] });
    // A tall preview renders wherever in it the content is, and not when it has none.
    const empty = ["example tall-empty rendered nothing visible"];
    expect(results.get("/components/tall")).toEqual({ light: empty, dark: empty, errors: [] });
    expect(results.get("/components/overflow")).toEqual({ light: [], dark: [], errors: [] });
    expect(results.get("/components/animated")).toEqual({ light: [], dark: [], errors: [] });
    for (const route of ["/components/moving", "/components/mixed", "/demos/overflow"]) {
      expect([route, results.get(route)]).toEqual([route, { light: [], dark: [], errors: [] }]);
    }
    // Four tiles of a long page are looked at, not all of it: that is no proof of an example
    // painting nothing, and is not reported as one.
    const unseen = [
      "example empty is on a page too large to picture whole, so whether it renders cannot be told",
    ];
    expect(results.get("/components/long")).toEqual({ light: unseen, dark: unseen, errors: [] });
    // Sound that was playing plays again after an example was looked at: the example that
    // waits for that is drawn.
    expect(results.get("/components/sound")).toEqual({ light: [], dark: [], errors: [] });
    // What a page writes into a style attribute while its example is hidden is kept.
    expect(results.get("/components/kept")).toEqual({ light: [], dark: [], errors: [] });
    // A transition the page awaits ends where and when it would have; a page listening for
    // cancelled or started transitions hears of none; style attributes come back as written;
    // an example past the first 4000 points across is found; one a script keeps moving paints.
    for (const route of [
      "/components/awaiting",
      "/components/listening",
      "/components/rewinding",
      "/components/mixed-priority",
      "/components/ordered",
      "/components/styled",
      "/components/wide",
      "/components/scripted",
    ]) {
      expect([route, results.get(route)]).toEqual([route, { light: [], dark: [], errors: [] }]);
    }
    // A transition that does not end in time is waited for, not stopped, and then reported.
    const unsettled = [
      `example basic is on a page whose animations did not settle while it was looked at (it waited up to ${SETTLE_TIMEOUT / 1000} s), so whether it renders cannot be told`,
    ];
    // A transition the page starts in hidden content is left to run, and the examples whose
    // pictures it falls in are said not to have settled.
    const rewriting = results.get("/components/rewriting");
    expect(rewriting?.errors).toEqual([]);
    // The pictures of the first example are taken while the transition, started when its
    // content was first hidden, still runs: that example is said not to have settled.
    expect(rewriting?.light).toContain(
      `example basic is on a page whose animations did not settle while it was looked at (it waited up to ${SETTLE_TIMEOUT / 1000} s), so whether it renders cannot be told`,
    );
    for (const appearance of ["light", "dark"] as const) {
      for (const line of rewriting?.[appearance] ?? []) {
        expect(line).toMatch(
          /^example (basic|rewriting) is on a page whose animations did not settle while it was looked at/,
        );
      }
    }
    // A page that starts short transitions now and then, while it is looked at: none of them
    // is cancelled, and the example is either seen or said not to have settled.
    const late = results.get("/components/late");
    expect(late?.errors).toEqual([]);
    for (const appearance of ["light", "dark"] as const) {
      for (const line of late?.[appearance] ?? []) expect(line).toBe(unsettled[0]);
    }
    expect(results.get("/components/unsettled")).toEqual({
      light: unsettled,
      dark: unsettled,
      errors: [],
    });
    // A transition the page paused is not probed, and not touched.
    const paused = [
      "example basic is on a page with a paused transition, which hiding its content would cancel, so whether it renders cannot be told",
    ];
    expect(results.get("/components/paused")).toEqual({ light: paused, dark: paused, errors: [] });
    // Every example painted, and a request of the page got no answer.
    expect(results.get("/components/offline")).toEqual({
      light: [],
      dark: [],
      errors: [
        expect.stringMatching(
          new RegExp(`^request failed: http://127\\.0\\.0\\.1:${deadPort}/gone\\.css \\(net::ERR_`),
        ),
      ],
    });
    // A route that was not built never becomes ready.
    expect(results.get("/components/absent")?.light[0]).toMatch(/^page did not render/);
    expect(results.get("/components/absent")?.errors).toContain("404 for /components/absent");

    // The pages with late transitions may or may not get their pictures, as they settle or
    // not.
    expect(
      [...screenshots]
        .filter((route) => route !== "/components/late" && route !== "/components/rewriting")
        .sort(),
    ).toEqual([
      "/components/animated",
      "/components/awaiting",
      "/components/below",
      "/components/kept",
      "/components/listening",
      "/components/long",
      "/components/mixed",
      "/components/mixed-priority",
      "/components/moving",
      "/components/offline",
      "/components/ordered",
      "/components/overflow",
      "/components/partly",
      "/components/rewinding",
      "/components/scripted",
      "/components/sound",
      "/components/styled",
      "/components/tall",
      "/components/throws",
      "/components/wide",
      "/demos/overflow",
    ]);
    const shot = (appearance: string, route = "/components/partly") =>
      readFileSync(path.join(outDir, screenshotFile(route, appearance)));
    expect(shot("light").subarray(1, 4).toString()).toBe("PNG");
    // The two pictures are of the two appearances, not the same one twice.
    expect(shot("light").equals(shot("dark"))).toBe(false);
    // The picture is of what the example paints, wherever that is: far down a page that had
    // to be scrolled (not the blue above it), at the bottom of a preview taller than the
    // window, or outside its preview; it shows an example that only an endless animation
    // draws, and one whose transition the check waited for, at its end. The middle of each
    // is the example's red.
    const pixels = async (appearance: string, route: string) => {
      const { data, info } = await sharp(shot(appearance, route))
        .raw()
        .toBuffer({ resolveWithObject: true });
      const at = (x: number, y: number) => {
        const start = (y * info.width + x) * info.channels;
        return [...data.subarray(start, start + 3)];
      };
      const has = (colour: number[]) => {
        for (let start = 0; start < data.length; start += info.channels) {
          if (colour.every((value, channel) => data[start + channel] === value)) return true;
        }
        return false;
      };
      return { info, at, has };
    };
    for (const route of [
      "/components/below",
      "/components/tall",
      "/components/overflow",
      "/components/animated",
      "/components/wide",
      "/components/awaiting",
    ]) {
      for (const appearance of ["light", "dark"]) {
        const { info, at } = await pixels(appearance, route);
        expect([
          route,
          appearance,
          ...at(Math.floor(info.width / 2), Math.floor(info.height / 2)),
        ]).toEqual([route, appearance, 255, 0, 0]);
      }
    }
    for (const appearance of ["light", "dark"]) {
      // A block a script keeps moving, and one an endless animation keeps moving (which the
      // check does not stop), give no crop that holds: each is pictured on its whole preview,
      // the width of the page (1280 pixels once scaled to fit a card), not cropped to the
      // block (about 450 pixels at two pixels a point).
      for (const route of ["/components/scripted", "/components/moving"]) {
        const moved = await pixels(appearance, route);
        expect([route, appearance, moved.info.width]).toEqual([route, appearance, 1280]);
      }
      // Everything a component paints is in its picture, also what it paints outside the
      // boxes of its elements while it paints inside them as well: the green block and, 400
      // points under it, its red shadow, at two pixels a point.
      const mixed = await pixels(appearance, "/components/mixed");
      expect([appearance, mixed.has([0, 255, 0]), mixed.has([255, 0, 0])]).toEqual([
        appearance,
        true,
        true,
      ]);
      expect(mixed.info.height).toBeGreaterThanOrEqual(2 * (400 + 120));
      // A demo is pictured on its whole preview, which is as wide as the page, and with what
      // it paints outside of it: blue in the preview, red 400 points under that.
      const demo = await pixels(appearance, "/demos/overflow");
      expect([appearance, demo.has([0, 0, 255]), demo.has([255, 0, 0])]).toEqual([
        appearance,
        true,
        true,
      ]);
      // The picture is scaled down to fit a card: the red under the preview is in it when it
      // is at least as high for its width as 520 points are for a page of 1600.
      expect(demo.info.width).toBeGreaterThan(1000);
      expect(demo.info.height * 1600).toBeGreaterThanOrEqual(520 * demo.info.width);
    }
  }, 240_000);

  it("fails a page with no examples, and hides content outside the preview's own boxes", async () => {
    const browser = await launchBrowser();
    if (!browser) throw new Error("Chromium is not installed: npm run visual:install");
    const routes = [
      "/components/no-examples",
      "/components/contents",
      "/components/generated",
      "/components/top-layer",
      "/components/other-contents",
      "/components/other-top-layer",
      "/components/empty-top-layer",
      "/components/important-all",
      "/components/full-screen",
    ];
    // Contexts that can enter full screen for a page that asks (see components/full-screen):
    // Playwright evaluates with the user activation that full screen needs.
    const withFullscreen = {
      newContext: async (options: Parameters<typeof browser.newContext>[0]) => {
        const context = await browser.newContext(options);
        await context.exposeBinding("__fullscreen", ({ page }, selector: string) =>
          page.evaluate((target) => document.querySelector(target)?.requestFullscreen(), selector),
        );
        return context;
      },
    } as unknown as typeof browser;
    const { results } = await browserPass({
      browser: withFullscreen,
      outDir,
      routes,
      screenshots: false,
    }).finally(() => browser.close());
    const outcome = (lines: string[]) => ({ light: lines, dark: lines, errors: [] });
    expect(results.get("/components/no-examples")).toEqual(
      outcome(["the page has no examples, so nothing on it was checked"]),
    );
    // Content in an element without a box of its own is hidden, and seen to paint; such an
    // element with nothing visible in it paints nothing. Text in an insistent colour is hidden
    // too, and so are white space and the underline under it, which `white-space: pre` paints.
    // (The fixture sets `text-decoration-skip-spaces: none`: from Chromium 156 the property's
    // initial value skips leading and trailing spaces, which would leave nothing to paint.)
    expect(results.get("/components/contents")).toEqual(
      outcome(["example contents-empty rendered nothing visible"]),
    );
    // What a preview generates itself is its content, hidden without starting a transition.
    expect(results.get("/components/generated")).toEqual(
      outcome(["example own-empty rendered nothing visible"]),
    );
    // A modal dialog and a popover in the top layer are hidden, and seen to paint.
    expect(results.get("/components/top-layer")).toEqual(outcome([]));
    // Another preview without a box is taken out of the pictures of the others by what it
    // holds: the button and the repainted content are seen to paint.
    expect(results.get("/components/other-contents")).toEqual(outcome([]));
    // Another preview in the top layer is taken out with its backdrop: the button is seen to
    // paint. (The probed top-layer preview's own result is checked on components/empty-top-layer.)
    const layer = results.get("/components/other-top-layer");
    const button = (lines: string[] = []) => lines.filter((line) => /^example basic /.test(line));
    expect({
      light: button(layer?.light),
      dark: button(layer?.dark),
      errors: layer?.errors,
    }).toEqual(outcome([]));
    // The backdrop of the preview looked at is the preview's, not its content, and is left as
    // it is: an empty popover preview over a red backdrop paints nothing.
    expect(results.get("/components/empty-top-layer")).toEqual(
      outcome(["example empty-popover rendered nothing visible"]),
    );
    // An `all` of the page's in a style attribute does not keep its element from being hidden,
    // the first time it is hidden included.
    expect(results.get("/components/important-all")).toEqual(outcome([]));
    // A full-screen element is hidden with its backdrop, and seen to paint; the example under
    // it, hidden from its pictures, is seen too.
    expect(results.get("/components/full-screen")).toEqual(outcome([]));
  }, 120_000);
});
