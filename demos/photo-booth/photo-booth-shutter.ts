import { outputLevel } from "../system-preferences/panes/sound/alert-sounds";

/* A shutter's two clicks, its blade opening and closing: short bursts of filtered noise, made here as
   no recording of Apple's sound is in the project. */
const CLICKS = [0, 0.075] as const;
const CLICK_SECONDS = 0.05;

let audio: AudioContext | undefined;

/** Plays the shutter under Output volume and Mute; a browser without Web Audio stays silent, and a
 * sound that cannot play never stops the picture it accompanies. */
export function playShutter(): void {
  const level = outputLevel();
  if (level <= 0 || typeof AudioContext === "undefined") return;
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume().catch(() => {});
    const samples = Math.ceil(audio.sampleRate * CLICK_SECONDS);
    const noise = audio.createBuffer(1, samples, audio.sampleRate);
    const channel = noise.getChannelData(0);
    for (let i = 0; i < samples; i += 1) channel[i] = Math.random() * 2 - 1;
    for (const after of CLICKS) {
      const start = audio.currentTime + after;
      const burst = audio.createBufferSource();
      burst.buffer = noise;
      const filter = audio.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 2400;
      const gain = audio.createGain();
      gain.gain.setValueAtTime(level * 0.5, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + CLICK_SECONDS);
      burst.connect(filter).connect(gain).connect(audio.destination);
      burst.start(start);
    }
  } catch {}
}
