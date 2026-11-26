import type { ComponentType } from "react";
import { createRoot } from "react-dom/client";
import "macalicious/tokens.css";
import "macalicious/fallback-font.css";
import "./harness.css";

/**
 * Renders one example, alone, for the visual comparison runner.
 *
 *   /?example=src/components/push-button/examples/visual-dialog-buttons.tsx
 *    &appearance=light|dark &accent=blue &highlight=green &windowState=main|inactive
 *
 * Sets <html data-ready> once the example has rendered and its fonts and images have loaded.
 */
const examples = import.meta.glob<{ default: ComponentType }>([
  "../../src/components/*/examples/*.tsx",
  "../../demos/*/examples/*.tsx",
  "../checks/*/examples/*.tsx",
]);

/** The glob's key for a path from the repository root (keys are relative to this file). */
const keyOf = (example: string) =>
  example.startsWith("visual/") ? `../${example.slice("visual/".length)}` : `../../${example}`;

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** Longest wait for fonts and images, in milliseconds, before the page reports a problem instead. */
const SETTLE_TIMEOUT = 10_000;

const sourceOf = (image: HTMLImageElement) => image.currentSrc || image.src;

/**
 * Wait until what is on the page is what a capture should show, and return a problem as text,
 * or nothing. The runner calls it again after its actions (window.__visualSettle).
 *
 *   two frames   for React to commit and the browser to lay out; a popup is positioned a
 *                frame after it opens
 *   fonts        the web fonts the rendered text asked for, including one requested while
 *                another was loading. Each face is asked for its own state: WebKit on Linux
 *                leaves document.fonts "loading", and its ready promise pending, for ever
 *                once one face has failed, although no face is loading any more. A face
 *                that is still loading after the timeout is a problem, not a hang
 *   images       every <img> loaded and decoded, or failed: an example may show a missing
 *                image on purpose, so a failed one is drawn as the browser draws it. An image
 *                marked loading="lazy" is asked for now: off screen it would never load, and
 *                the capture may reach it. An image that is still loading after the timeout
 *                is a problem that names it
 *
 * Fonts and images are looked for again on every frame, until two frames in a row find
 * nothing loading: text laid out with a font that has just arrived may ask for another face (a
 * second weight, another unicode range), and an image's load handler may put another image on
 * the page, change a source, or render text that asks for a font.
 */
async function settle(): Promise<string | undefined> {
  await frame();
  await frame();
  const loadingFonts = () => [...document.fonts].filter((face) => face.status === "loading");

  /** The source each image was last loaded and decoded with, or failed with. */
  const settled = new WeakMap<HTMLImageElement, string>();
  const watched = new Set<HTMLImageElement>();
  /** One per image that is waited for; aborting it removes both of that wait's listeners. */
  const waits = new Set<AbortController>();
  const watch = (image: HTMLImageElement) => {
    if (watched.has(image)) return;
    watched.add(image);
    if (image.loading === "lazy") image.loading = "eager";
    void (async () => {
      if (!image.complete) {
        await new Promise<void>((resolve) => {
          const wait = new AbortController();
          waits.add(wait);
          const done = () => {
            wait.abort();
            waits.delete(wait);
            resolve();
          };
          image.addEventListener("load", done, { signal: wait.signal });
          image.addEventListener("error", done, { signal: wait.signal });
        });
      }
      const source = sourceOf(image);
      // decode() rejects for a failed image, which is drawn as it is.
      await image.decode().catch(() => undefined);
      settled.set(image, source);
      watched.delete(image);
    })();
  };
  /** The images on the page that are loading or decoding, or have a source not yet looked at. */
  const loadingImages = () => {
    const images = [...document.images];
    for (const image of images) {
      if (!image.complete || settled.get(image) !== sourceOf(image)) watch(image);
    }
    return images.filter((image) => watched.has(image));
  };

  const deadline = performance.now() + SETTLE_TIMEOUT;
  for (let quiet = 0; quiet < 2; ) {
    await frame();
    const fonts = loadingFonts();
    const images = loadingImages();
    quiet = fonts.length === 0 && images.length === 0 ? quiet + 1 : 0;
    if (quiet < 2 && performance.now() > deadline) {
      // Nothing is left listening on an image the page gave up on.
      for (const wait of waits) wait.abort();
      waits.clear();
      const problems: string[] = [];
      if (fonts.length > 0) {
        const names = [...new Set(fonts.map((face) => face.family))].join(", ");
        problems.push(
          `fonts did not finish loading within ${SETTLE_TIMEOUT / 1000} s (still loading: ${names})`,
        );
      }
      if (images.length > 0) {
        const names = images.map((image) => sourceOf(image) || "(no src)").join(", ");
        problems.push(`images did not finish loading within ${SETTLE_TIMEOUT / 1000} s: ${names}`);
      }
      return problems.length > 0
        ? problems.join("; ")
        : `the page did not stay quiet for two frames within ${SETTLE_TIMEOUT / 1000} s`;
    }
  }
  return undefined;
}

declare global {
  interface Window {
    __visualSettle: typeof settle;
  }
}
window.__visualSettle = settle;

async function main() {
  const params = new URLSearchParams(location.search);
  const html = document.documentElement;
  const example = params.get("example") ?? "";

  for (const [param, attribute] of [
    ["appearance", "data-appearance"],
    ["accent", "data-accent"],
    ["highlight", "data-highlight"],
    ["windowState", "data-window-state"],
  ] as const) {
    const value = params.get(param);
    if (value) html.setAttribute(attribute, value);
  }

  const load = examples[keyOf(example)];
  if (!load) {
    html.setAttribute("data-error", `Unknown example: ${example}`);
    document.body.textContent = `Unknown example "${example}". Known examples:\n${Object.keys(
      examples,
    )
      .map((key) => (key.startsWith("../../") ? key.slice(6) : `visual/${key.slice(3)}`))
      .join("\n")}`;
    return;
  }

  const { default: Example } = await load();
  const container = document.getElementById("visual-root");
  if (!container) throw new Error("#visual-root is missing");
  createRoot(container).render(<Example />);

  const problem = await settle();
  if (problem) throw new Error(problem);
  html.setAttribute("data-ready", "");
}

main().catch((error: unknown) => {
  document.documentElement.setAttribute("data-error", String(error));
});
