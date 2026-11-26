import { outputLevel } from "./alert-sounds";

/**
 * Output volume and Mute for what the desktop's applications play. Music, Podcasts, QuickTime Player
 * and the others set `volume` on their own media elements, some of which are never in the document,
 * so the level is applied where all of them pass: `HTMLMediaElement`'s `volume` and `play`. An
 * application reads back the volume it asked for. Only an element that is playing is scaled: one
 * that stops holds what was asked of it again. Installed once and kept, so that what plays across a
 * change of session is still followed; with no session the level is full and nothing is changed.
 * Nothing here reaches the computer's own volume, a web page's video in a frame, or the browser's
 * spoken voices.
 */
let level = 1;
let setNative: ((element: HTMLMediaElement, volume: number) => void) | null = null;

const sounding = new Map<HTMLMediaElement, { asked: number; stop: () => void }>();

const STOPPING = ["pause", "ended", "error", "emptied"] as const;

function install() {
  const proto = HTMLMediaElement.prototype;
  const volume = Object.getOwnPropertyDescriptor(proto, "volume");
  const { get, set } = volume ?? {};
  if (!volume || !get || !set) return;
  const { play } = proto;
  setNative = (element, value) => set.call(element, value);
  const start = (element: HTMLMediaElement) => {
    if (sounding.has(element)) return;
    const entry = {
      asked: get.call(element) as number,
      stop: () => {
        sounding.delete(element);
        for (const type of STOPPING) element.removeEventListener(type, onStopping);
        set.call(element, entry.asked);
      },
    };
    // A pause event is queued: by the time it arrives the element may be playing again.
    const onStopping = ({ type }: Event) => {
      if (type !== "pause" || element.paused) entry.stop();
    };
    sounding.set(element, entry);
    for (const type of STOPPING) element.addEventListener(type, onStopping);
    set.call(element, entry.asked * level);
  };
  Object.defineProperty(proto, "volume", {
    ...volume,
    get(this: HTMLMediaElement) {
      return sounding.get(this)?.asked ?? get.call(this);
    },
    set(this: HTMLMediaElement, value: number) {
      // Out of range throws here as it does for the application.
      set.call(this, value);
      const entry = sounding.get(this);
      if (!entry) return;
      entry.asked = value;
      set.call(this, value * level);
    },
  });
  proto.play = function (this: HTMLMediaElement) {
    start(this);
    const playing = play.call(this);
    playing.catch(() => {
      if (this.paused) sounding.get(this)?.stop();
    });
    return playing;
  };
  // Elements in the document that play by themselves: `autoplay`, and a person's press on `controls`.
  const onPlay = (event: Event) => {
    if (event.target instanceof HTMLMediaElement) start(event.target);
  };
  // The person moved the volume on an element's own `controls`: that is what they ask of the element,
  // and the desktop's level still applies. Writes from here read back as expected and change nothing.
  const onVolumeChange = ({ target }: Event) => {
    if (!(target instanceof HTMLMediaElement)) return;
    const entry = sounding.get(target);
    if (!entry) return;
    const native: number = get.call(target);
    if (Math.abs(native - entry.asked * level) <= 0.001) return;
    entry.asked = native;
    set.call(target, native * level);
  };
  document.addEventListener("play", onPlay, true);
  document.addEventListener("volumechange", onVolumeChange, true);
  // What started before this was installed.
  for (const element of document.querySelectorAll<HTMLMediaElement>("audio, video")) {
    if (!element.paused) start(element);
  }
}

/** Follow what the settings say. */
export function followOutputVolume(values: Readonly<Record<string, unknown>>): void {
  if (!setNative) install();
  level = outputLevel(values);
  for (const [element, { asked }] of sounding) setNative?.(element, asked * level);
}

/** Back to full, when the person's session ends: everything holds what it asked. */
export function clearOutputVolume(): void {
  level = 1;
  for (const [element, { asked }] of sounding) setNative?.(element, asked);
}
