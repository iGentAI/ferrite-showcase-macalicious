import { changeDesktopValue } from "../../../desktop/desktop-personal";
import "./page-accessibility.css";

/**
 * Accessibility on the served desktop: what a page can do for itself. Display's colour settings are
 * filters on the page, Reduce motion and Reduce transparency restyle it, the screen flash is a layer
 * over it, Speech reads the selection with the browser's voices, Zoom scales the page around the
 * pointer, and Captions styles the subtitles the browser draws over a video. All of it stops at this
 * page.
 */
export const INVERT_KEY = "accessibility.invert";
export const GRAYSCALE_KEY = "accessibility.grayscale";
export const CONTRAST_KEY = "accessibility.increaseContrast";
export const REDUCE_MOTION_KEY = "accessibility.reduceMotion";
export const REDUCE_TRANSPARENCY_KEY = "accessibility.reduceTransparency";
export const FLASH_KEY = "accessibility.flashScreen";
export const SPEAK_KEY = "accessibility.speakSelection";
export const VOICE_KEY = "accessibility.voice";
export const SPEAKING_RATE_KEY = "accessibility.speakingRate";
export const ZOOM_KEYS_KEY = "accessibility.zoomKeys";
export const ZOOM_SCROLL_KEY = "accessibility.zoomScroll";
export const ZOOM_LEVEL_KEY = "accessibility.zoomLevel";
export const CAPTION_STYLE_KEY = "accessibility.captionStyle";

export const MOST_ZOOM = 8;
/** What each caption style is called, and the value of `data-mac-caption-style` it sets. */
export const CAPTION_STYLES: Readonly<Record<string, string>> = {
  Default: "",
  "Transparent Background": "transparent",
  Classic: "classic",
  "Large Text": "large",
};

export const SYSTEM_VOICE = "System Voice";
export const SPEAKING_RATES: Readonly<Record<string, number>> = { Slow: 0.7, Normal: 1, Fast: 1.5 };

/** What the settings ask of the root's filter. */
export function pageFilter(values: Readonly<Record<string, unknown>>): string {
  return [
    values[INVERT_KEY] === true ? "invert(1) hue-rotate(180deg)" : "",
    values[GRAYSCALE_KEY] === true ? "grayscale(1)" : "",
    values[CONTRAST_KEY] === true ? "contrast(1.25)" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

let flash = false;
let speak = false;
let voice = SYSTEM_VOICE;
let rate = 1;

/** Speak these words with the chosen voice and rate; nothing in a browser without speech. */
export function speakText(text: string): void {
  if (typeof speechSynthesis === "undefined") return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const chosen = speechSynthesis.getVoices().find((each) => each.name === voice);
  if (chosen) utterance.voice = chosen;
  utterance.rate = rate;
  speechSynthesis.speak(utterance);
}

/** What is selected, in a text field or on the page. */
function selectedWords(): string {
  const field = document.activeElement;
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    if (field.type === "password") return "";
    return field.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? 0);
  }
  return document.getSelection()?.toString() ?? "";
}

function onKeyDown(event: KeyboardEvent) {
  if (zoomKeys && event.altKey && (event.metaKey || event.ctrlKey) && onZoomKey(event.code)) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (!speak || event.key !== "Escape" || !event.altKey || event.metaKey || event.ctrlKey) return;
  const words = selectedWords();
  if (words === "") return;
  event.preventDefault();
  event.stopPropagation();
  speakText(words);
}

/** The whole page goes white for a moment, as an alert sound plays. */
export function flashForAlert(): void {
  if (!flash) return;
  const layer = document.createElement("div");
  layer.className = "mac-system-preferences-page-flash";
  layer.setAttribute("aria-hidden", "true");
  document.body.append(layer);
  setTimeout(() => layer.remove(), 200);
}

let listening = false;

let zoomKeys = false;
let zoomScroll = false;
let zoom = 1;
/** Where ⌥⌘8 turns the zoom back on to. */
let zoomWhenOff = 2;
/** The last place of the pointer: the page is scaled around it, so it stays over what it points at. */
let pointer: { x: number; y: number } | null = null;
/** A scroll gesture is saved when it pauses; until then the setting read back is behind it. */
let saveAfterScroll: ReturnType<typeof setTimeout> | undefined;

const clampZoom = (level: number) => Math.min(MOST_ZOOM, Math.max(1, level));

function showZoom() {
  const root = document.documentElement;
  root.style.transform = zoom > 1 ? `scale(${zoom})` : "";
  root.style.overflow = zoom > 1 ? "hidden" : "";
  root.style.transformOrigin =
    zoom > 1 && pointer ? `${pointer.x}px ${pointer.y}px` : zoom > 1 ? "50% 50%" : "";
}

function setZoom(level: number) {
  zoom = clampZoom(level);
  if (zoom > 1) zoomWhenOff = zoom;
  showZoom();
}

function onZoomKey(code: string): boolean {
  if (code === "Digit8") setZoom(zoom > 1 ? 1 : zoomWhenOff);
  else if (code === "Equal") setZoom(zoom * 1.25);
  else if (code === "Minus") setZoom(zoom / 1.25);
  else return false;
  clearTimeout(saveAfterScroll);
  saveAfterScroll = undefined;
  changeDesktopValue(ZOOM_LEVEL_KEY, zoom);
  return true;
}

function onPointerMove(event: PointerEvent) {
  pointer = { x: event.clientX, y: event.clientY };
  if (zoom > 1) showZoom();
}

function onWheel(event: WheelEvent) {
  if (!zoomScroll || !event.ctrlKey) return;
  event.preventDefault();
  pointer = { x: event.clientX, y: event.clientY };
  setZoom(zoom * Math.exp(-event.deltaY * 0.01));
  clearTimeout(saveAfterScroll);
  saveAfterScroll = setTimeout(() => {
    saveAfterScroll = undefined;
    changeDesktopValue(ZOOM_LEVEL_KEY, zoom);
  }, 300);
}

/** Follow what the settings say. */
export function followAccessibility(values: Readonly<Record<string, unknown>>): void {
  const root = document.documentElement;
  root.style.filter = pageFilter(values);
  root.toggleAttribute("data-mac-reduce-motion", values[REDUCE_MOTION_KEY] === true);
  root.toggleAttribute("data-mac-reduce-transparency", values[REDUCE_TRANSPARENCY_KEY] === true);
  const captions = CAPTION_STYLES[String(values[CAPTION_STYLE_KEY])];
  if (captions) root.setAttribute("data-mac-caption-style", captions);
  else root.removeAttribute("data-mac-caption-style");
  flash = values[FLASH_KEY] === true;
  speak = values[SPEAK_KEY] === true;
  const chosen = values[VOICE_KEY];
  voice = typeof chosen === "string" ? chosen : SYSTEM_VOICE;
  rate = SPEAKING_RATES[String(values[SPEAKING_RATE_KEY])] ?? 1;
  zoomKeys = values[ZOOM_KEYS_KEY] === true;
  zoomScroll = values[ZOOM_SCROLL_KEY] === true;
  const level = values[ZOOM_LEVEL_KEY];
  if (saveAfterScroll === undefined) setZoom(typeof level === "number" ? level : 1);
  if (listening) return;
  listening = true;
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("pointermove", onPointerMove, { capture: true, passive: true });
  window.addEventListener("wheel", onWheel, { capture: true, passive: false });
}

/** Stop, when the person's session ends. */
export function clearAccessibility(): void {
  clearTimeout(saveAfterScroll);
  saveAfterScroll = undefined;
  followAccessibility({});
  zoomWhenOff = 2;
  pointer = null;
  listening = false;
  window.removeEventListener("keydown", onKeyDown, true);
  window.removeEventListener("pointermove", onPointerMove, true);
  window.removeEventListener("wheel", onWheel, true);
}
