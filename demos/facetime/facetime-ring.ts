/** The ringtones of Preferences > Settings, by the names on a Mac. */
export const RINGTONES: readonly string[] = [
  "Opening",
  "Apex",
  "Beacon",
  "Bulletin",
  "By the Seaside",
  "Chimes",
  "Circuit",
  "Constellation",
  "Cosmic",
  "Crystals",
  "Hillside",
  "Illuminate",
  "Night Owl",
  "Playtime",
  "Presto",
  "Radar",
  "Radiate",
  "Ripples",
  "Sencha",
  "Signal",
  "Silk",
  "Slow Rise",
  "Stargaze",
  "Summit",
  "Twinkle",
  "Uplift",
  "Waves",
];

export const DEFAULT_RINGTONE = "Opening";

/** The three notes of a ringtone: Apple's sounds are not shipped, so each name has its own phrase. */
export function ringNotes(name: string): readonly number[] {
  const at = Math.max(0, RINGTONES.indexOf(name));
  const root = 330 * 2 ** (at / 24);
  return [root, root * 2 ** ((3 + (at % 3)) / 12), root * 1.5];
}

/**
 * Plays a ringtone once through the page's audio, and answers how to stop it. A browser that has not
 * yet let the page make a sound keeps it silent, and the panel still rings.
 */
export function playRing(name: string): () => void {
  if (typeof AudioContext === "undefined") return () => {};
  const context = new AudioContext();
  void context.resume().catch(() => {});
  ringNotes(name).forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + index * 0.25;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.15, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.25);
  });
  const close = () => {
    if (context.state !== "closed") void context.close();
  };
  const timer = setTimeout(close, 1_000);
  return () => {
    clearTimeout(timer);
    close();
  };
}
