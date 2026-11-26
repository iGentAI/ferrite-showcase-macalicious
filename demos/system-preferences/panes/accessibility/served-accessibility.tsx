"use client";

import { Checkbox } from "macalicious/checkbox";
import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { Slider } from "macalicious/slider";
import { useEffect, useState } from "react";
import { PaneChoice } from "../../choice";
import { usePreference } from "../../pane";
import {
  CAPTION_STYLE_KEY,
  CAPTION_STYLES,
  CONTRAST_KEY,
  FLASH_KEY,
  GRAYSCALE_KEY,
  INVERT_KEY,
  MOST_ZOOM,
  REDUCE_MOTION_KEY,
  REDUCE_TRANSPARENCY_KEY,
  SPEAK_KEY,
  SPEAKING_RATE_KEY,
  SPEAKING_RATES,
  SYSTEM_VOICE,
  speakText,
  VOICE_KEY,
  ZOOM_KEYS_KEY,
  ZOOM_LEVEL_KEY,
  ZOOM_SCROLL_KEY,
} from "./page-accessibility";

/** The categories below Captions, which the library demo's list ends at. */
export const SERVED_GROUPS = [
  {
    heading: "Motor",
    categories: [
      { id: "voice-control", name: "Voice Control" },
      { id: "keyboard", name: "Keyboard" },
      { id: "pointer-control", name: "Pointer Control" },
      { id: "switch-control", name: "Switch Control" },
    ],
  },
  {
    heading: "General",
    categories: [
      { id: "siri", name: "Siri" },
      { id: "shortcut", name: "Shortcut" },
    ],
  },
] as const;

function Setting({ setting, children }: { setting: string; children: string }) {
  const [on, setOn] = usePreference(setting, false);
  return (
    <Checkbox checked={on} onCheckedChange={setOn}>
      {children}
    </Checkbox>
  );
}

function Display() {
  return (
    <>
      <Setting setting={INVERT_KEY}>Invert colors</Setting>
      <Setting setting={GRAYSCALE_KEY}>Use grayscale</Setting>
      <Setting setting={REDUCE_MOTION_KEY}>Reduce motion</Setting>
      <Setting setting={CONTRAST_KEY}>Increase contrast</Setting>
      <Setting setting={REDUCE_TRANSPARENCY_KEY}>Reduce transparency</Setting>
      <Label textStyle="small">
        These change this desktop's page, not your screen or your other windows. Reduce motion
        shortens its transitions.
      </Label>
    </>
  );
}

function Speech() {
  const [voices, setVoices] = useState<readonly string[]>([]);
  useEffect(() => {
    if (typeof speechSynthesis === "undefined") return;
    const read = () => setVoices(speechSynthesis.getVoices().map((voice) => voice.name));
    read();
    speechSynthesis.addEventListener("voiceschanged", read);
    return () => speechSynthesis.removeEventListener("voiceschanged", read);
  }, []);
  if (typeof speechSynthesis === "undefined")
    return <Label>This browser does not offer speech to web pages.</Label>;
  return (
    <>
      <PaneChoice
        setting={VOICE_KEY}
        options={[SYSTEM_VOICE, ...new Set(voices)]}
        initial={SYSTEM_VOICE}
        width={260}
        aria-label="System Voice"
      />
      <PaneChoice
        setting={SPEAKING_RATE_KEY}
        options={Object.keys(SPEAKING_RATES)}
        initial="Normal"
        width={120}
        aria-label="Speaking Rate"
      />
      <PushButton onClick={() => speakText("This is how the voice sounds.")}>Play</PushButton>
      <Setting setting={SPEAK_KEY}>Speak selected text when the key is pressed (⌥⎋)</Setting>
      <Label textStyle="small">The voices are the ones your browser offers.</Label>
    </>
  );
}

function Zoom() {
  const [level, setLevel] = usePreference<number>(ZOOM_LEVEL_KEY, 1);
  return (
    <>
      <Setting setting={ZOOM_KEYS_KEY}>Use keyboard shortcuts to zoom</Setting>
      <Label textStyle="small">
        ⌥⌘8 turns zoom on and off, ⌥⌘= zooms in and ⌥⌘− zooms out. Off a Mac, ⌘ is Control.
      </Label>
      <Setting setting={ZOOM_SCROLL_KEY}>Scroll with the Control key held to zoom</Setting>
      <Label>Zoom of this page: {Math.round(level * 100)}%</Label>
      <Slider
        aria-label="Zoom of this page"
        min={1}
        max={MOST_ZOOM}
        step={0.25}
        value={level}
        onValueChange={(value) => setLevel(value as number)}
        style={{ width: 240 }}
      />
      <Label textStyle="small">
        This enlarges this desktop's page around the pointer, not your screen. Your browser's zoom
        and your computer's Zoom work on it as well.
      </Label>
    </>
  );
}

function Captions() {
  return (
    <>
      <Label>Style for subtitles and captions:</Label>
      <PaneChoice
        setting={CAPTION_STYLE_KEY}
        options={Object.keys(CAPTION_STYLES)}
        initial="Default"
        width={200}
        aria-label="Style for subtitles and captions"
      />
      <Label textStyle="small">
        This styles the subtitles of TV's home videos, a .vtt or .srt file of the video's name
        beside it. A YouTube video draws its own.
      </Label>
    </>
  );
}

const STATEMENTS: Readonly<Record<string, string>> = {
  voiceover:
    "VoiceOver belongs to your computer. Turned on there, it reads this desktop as it does any page: the controls have names and roles for it. A web page cannot turn it on.",
  descriptions:
    "Nothing on this desktop plays video with audio descriptions, so there is nothing to choose here.",
  "voice-control":
    "Voice Control belongs to your computer. Turned on there, it can press this desktop's controls by their names. A web page cannot turn it on.",
  keyboard:
    "Sticky Keys and Slow Keys belong to your computer and reach this page as ordinary typing. A web page cannot turn them on.",
  "pointer-control":
    "How the pointer moves belongs to your computer, and a web page cannot change it.",
  "switch-control": "Switch Control belongs to your computer. A web page cannot turn it on.",
  siri: "Siri on this desktop takes typed questions, as it can't hear you. Open it from the menu bar or the Dock.",
  shortcut:
    "The Accessibility Shortcut (⌥⌘F5) belongs to your computer, and a web page cannot choose what it does.",
};

/** One category of the list on the served desktop. */
export function ServedCategory({ id }: { id: string }) {
  return (
    <div className="mac-system-preferences-accessibility-served">
      {id === "display" ? (
        <Display />
      ) : id === "speech" ? (
        <Speech />
      ) : id === "zoom" ? (
        <Zoom />
      ) : id === "captions" ? (
        <Captions />
      ) : id === "audio" ? (
        <Setting setting={FLASH_KEY}>Flash the screen when an alert sound occurs</Setting>
      ) : (
        <Label>{STATEMENTS[id]}</Label>
      )}
    </div>
  );
}
