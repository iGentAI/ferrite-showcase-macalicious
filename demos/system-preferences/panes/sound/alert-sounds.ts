import { desktopValues } from "../../../desktop/desktop-personal";
import { flashForAlert } from "../accessibility/page-accessibility";

/**
 * The sounds the desktop plays itself, drawn with Web Audio: stand-ins with Catalina's names, since
 * Apple's sound files are not part of this project. Each is a short tone of its own pitch. They all
 * follow the Sound pane's Output volume and Mute, which go no further than this page.
 */
const PITCHES: Readonly<Record<string, readonly [hertz: number, seconds: number]>> = {
  Basso: [147, 0.45],
  Blow: [262, 0.4],
  Bottle: [392, 0.25],
  Frog: [196, 0.2],
  Funk: [233, 0.3],
  Glass: [1318, 0.5],
  Hero: [523, 0.6],
  Morse: [880, 0.12],
  Ping: [1046, 0.35],
  Pop: [622, 0.08],
  Purr: [110, 0.35],
  Sosumi: [740, 0.3],
  Submarine: [165, 0.7],
  Tink: [1568, 0.1],
};

const MOVE_TO_TRASH: readonly [hertz: number, seconds: number] = [196, 0.12];
const EMPTY_TRASH: readonly [hertz: number, seconds: number] = [98, 0.4];
const VOLUME_FEEDBACK: readonly [hertz: number, seconds: number] = [622, 0.08];

/** Where Output volume stands on the served desktop until the person moves it: leaves all as it is. */
export const FULL_OUTPUT_VOLUME = 100;

/** What Output volume and Mute leave of this desktop's sounds, from 0 to 1. */
export function outputLevel(values: Readonly<Record<string, unknown>> = desktopValues()): number {
  if (values["sound.mute"] === true) return 0;
  const volume = values["sound.outputVolume"];
  return (typeof volume === "number" ? volume : FULL_OUTPUT_VOLUME) / 100;
}

let audio: AudioContext | undefined;

/**
 * Plays a tone at `level` (0 to 1); nothing in a browser without Web Audio. A sound that cannot play
 * is left out: it never fails what it accompanies, such as a file operation already done.
 */
function playTone([hertz, seconds]: readonly [number, number], level: number): void {
  if (level <= 0 || typeof AudioContext === "undefined") return;
  try {
    audio ??= new AudioContext();
    // A context made before the person's first press starts suspended.
    if (audio.state === "suspended") void audio.resume().catch(() => {});
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = hertz;
    const start = audio.currentTime;
    gain.gain.setValueAtTime(Math.max(0.0001, level * 0.3), start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + seconds);
  } catch {}
}

/** Plays the alert `name` at `volume` (0 to 100), under Output volume and Mute. */
export function playAlert(name: string, volume: number): void {
  flashForAlert();
  const tone = PITCHES[name];
  if (tone) playTone(tone, (volume / 100) * outputLevel());
}

/** The tone of "Play feedback when volume is changed", at the Output volume just chosen (0 to 100). */
export function playVolumeFeedback(volume: number): void {
  playTone(VOLUME_FEEDBACK, volume / 100);
}

/** "Play user interface sound effects": the drive's changes that sound on a Mac, at the alert volume. */
export function playDriveSound(ops: readonly { op: string }[]): void {
  const values = desktopValues();
  if (values["sound.interfaceSounds"] === false) return;
  const tone = ops.some(({ op }) => op === "empty-trash")
    ? EMPTY_TRASH
    : ops.some(({ op }) => op === "trash")
      ? MOVE_TO_TRASH
      : null;
  if (!tone) return;
  const alertVolume = values["sound.alertVolume"];
  playTone(tone, ((typeof alertVolume === "number" ? alertVolume : 100) / 100) * outputLevel());
}
