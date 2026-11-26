import { outputLevel } from "../system-preferences/panes/sound/alert-sounds";

/** One note of a tone: its pitch, when it begins and how long it rings, in seconds. */
type ToneNote = readonly [hertz: number, at: number, seconds: number];

interface ContactTone {
  wave: OscillatorType;
  notes: readonly ToneNote[];
}

/**
 * The sound of each ringtone and text tone, drawn with Web Audio. These are original stand-ins that
 * only carry Catalina's names, since Apple's sound files are not part of this project.
 */
const TONES: Readonly<Record<string, ContactTone>> = {
  Opening: {
    wave: "sine",
    notes: [
      [440, 0, 0.3],
      [554, 0.2, 0.3],
      [659, 0.4, 0.5],
    ],
  },
  Apex: {
    wave: "triangle",
    notes: [
      [784, 0, 0.16],
      [1047, 0.18, 0.16],
      [784, 0.36, 0.16],
      [1047, 0.54, 0.35],
    ],
  },
  Beacon: {
    wave: "sine",
    notes: [
      [330, 0, 0.25],
      [330, 0.3, 0.25],
      [494, 0.6, 0.6],
    ],
  },
  Chimes: {
    wave: "sine",
    notes: [
      [1319, 0, 0.6],
      [988, 0.25, 0.6],
      [784, 0.5, 0.8],
    ],
  },
  Radar: {
    wave: "triangle",
    notes: [
      [698, 0, 0.12],
      [698, 0.2, 0.12],
      [880, 0.4, 0.3],
    ],
  },
  Note: { wave: "sine", notes: [[880, 0, 0.35]] },
  Aurora: {
    wave: "triangle",
    notes: [
      [523, 0, 0.25],
      [784, 0.15, 0.45],
    ],
  },
  Bamboo: {
    wave: "square",
    notes: [
      [392, 0, 0.07],
      [523, 0.1, 0.07],
      [392, 0.2, 0.07],
    ],
  },
  Chord: {
    wave: "sine",
    notes: [
      [523, 0, 0.6],
      [659, 0, 0.6],
      [784, 0, 0.6],
    ],
  },
  "Tri-tone": {
    wave: "triangle",
    notes: [
      [622, 0, 0.14],
      [880, 0.16, 0.14],
      [622, 0.32, 0.25],
    ],
  },
};

/** What a name from another source sounds, such as an imported card's "Marimba". */
const OTHER_TONE = TONES.Note as ContactTone;

let audio: AudioContext | undefined;
let sounding: GainNode | undefined;

/**
 * Sounds the tone `name` at `volume` (0 to 100), under Output volume and Mute, in place of the one
 * still ringing. A browser without Web Audio stays silent, and a sound that cannot play never fails
 * the choice it accompanies.
 */
export function playContactTone(name: string, volume: number): void {
  const level = (volume / 100) * outputLevel();
  if (level <= 0 || typeof AudioContext === "undefined") return;
  const { wave, notes } = TONES[name] ?? OTHER_TONE;
  try {
    audio ??= new AudioContext();
    // A context made before the person's first press starts suspended.
    if (audio.state === "suspended") void audio.resume().catch(() => {});
    sounding?.disconnect();
    const output = audio.createGain();
    output.gain.value = level * 0.3;
    output.connect(audio.destination);
    sounding = output;
    const now = audio.currentTime;
    for (const [hertz, at, seconds] of notes) {
      const oscillator = audio.createOscillator();
      const envelope = audio.createGain();
      oscillator.type = wave;
      oscillator.frequency.value = hertz;
      envelope.gain.setValueAtTime(1 / notes.filter((note) => note[1] === at).length, now + at);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + at + seconds);
      oscillator.connect(envelope).connect(output);
      oscillator.start(now + at);
      oscillator.stop(now + at + seconds);
    }
  } catch {}
}
