"use client";

import { Box } from "macalicious/box";
import { Checkbox } from "macalicious/checkbox";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { RadioButton, RadioGroup } from "macalicious/radio-button";
import { useId, useSyncExternalStore } from "react";
import { servedByDesktopApp } from "../../../desktop/desktop-server";
import {
  HOLD_COMMAND_SPACE,
  SIRI_SHORTCUT_KEY,
  siriListensIn,
} from "../../../desktop/desktop-siri-settings";
import {
  HEY_SIRI_REFUSED,
  HEY_SIRI_SETTING,
  offersSpeechRecognition,
} from "../../../desktop/desktop-speech";
import { PaneAt, PaneFooter, PaneForm, PaneRow } from "../../form";
import { usePreference } from "../../pane";
import { Uncaptured } from "../uncaptured";
import { OrbPicture } from "./artwork";

/** The settings region's top-left corner in the window frame: it fills the pane from x 230. */
const DETAIL = { x: 230, y: 38 };

const SHORTCUTS = [
  "Hold Command Space",
  "Hold Option Space",
  "Press Fn (Function) Space",
  "Press Left Command Key Twice",
];

/** A page never sees Fn; the other choices it can honour. */
const SHORTCUT_NO_FN = "Press Fn (Function) Space";
/** What the served pane says of the choices it offers. */
const SHORTCUT_NOTE =
  "A page never sees the Fn key, so that choice is left out. Where your computer keeps Command-Space, hold Control-Option-Space.";

const LANGUAGES = [
  "English (Australia)",
  "English (Canada)",
  "English (United Kingdom)",
  "English (United States)",
  "French (France)",
  "German (Germany)",
  "Japanese",
  "Spanish (Spain)",
];

const VOICES = [
  "American (Female)",
  "American (Male)",
  "Australian (Female)",
  "Australian (Male)",
  "British (Female)",
  "British (Male)",
];

/**
 * What the served Siri can speak in: the accents of the pop-up that this browser has a voice for. A
 * browser's voices carry a language and no promise of a gender, and Siri asks only for the language.
 */
const ACCENTS = [
  ["American", "en-US"],
  ["Australian", "en-AU"],
  ["British", "en-GB"],
] as const;

const voicesOfBrowser = () =>
  typeof speechSynthesis === "undefined"
    ? ""
    : speechSynthesis
        .getVoices()
        .map((voice) => voice.lang.replace("_", "-"))
        .join(" ");

function subscribeVoices(changed: () => void) {
  if (typeof speechSynthesis === "undefined") return () => {};
  const synthesis = speechSynthesis;
  synthesis.addEventListener("voiceschanged", changed);
  return () => synthesis.removeEventListener("voiceschanged", changed);
}

const NO_VOICES = "This browser offers web pages no voices, so Siri cannot speak here.";
const VOICE_IS_ACCENT =
  "Siri asks your browser for a voice with this accent. A browser does not promise a voice's gender.";
const LANGUAGE_NOTE =
  "Siri listens and speaks in this language, where your browser can. It understands requests and writes its answers in English.";

/** A pop-up button of the settings form, 192.5 pt wide, whose items are their own values. */
function Choice({
  labelledBy,
  items,
  value,
  onValueChange,
  disabled,
  title,
}: {
  labelledBy: string;
  items: readonly string[];
  value: string;
  onValueChange: (value: string) => void;
  disabled: boolean;
  title?: string;
}) {
  return (
    <PopUpButton
      aria-labelledby={labelledBy}
      value={value}
      title={title}
      onValueChange={(next) => {
        if (next != null) onValueChange(next);
      }}
      disabled={disabled}
      style={{ width: 192.5 }}
    >
      {items.map((item) => (
        <PopUpButtonItem key={item} value={item}>
          {item}
        </PopUpButtonItem>
      ))}
    </PopUpButton>
  );
}

const OFF_IN_THIS_BROWSER =
  "This browser has no speech recognition, so it cannot listen for “Hey Siri”.";

const REFUSED_WORDS: Readonly<Record<string, string>> = {
  "not-allowed": "The browser was not allowed to use the microphone, so Hey Siri went off.",
  "service-not-allowed": "The browser was not allowed its speech service, so Hey Siri went off.",
  "audio-capture": "The browser found no microphone, so Hey Siri went off.",
};

/**
 * System Preferences > Siri. The settings keep their state and start no assistant; on the served
 * desktop Enable Ask Siri, Listen for “Hey Siri”, Language, Siri Voice, Voice Feedback and Show Siri
 * in menu bar reach its Siri (`effects.ts`, `startHeySiri`, `siriSpeaksIn`).
 * Turning Ask Siri off disables the settings that depend on it; the captures show it on only.
 *
 * Distances are those of reference/spec/apps/system-preferences-siri.md, in points from the
 * top-left corner of the window frame.
 */
export function Siri() {
  const served = servedByDesktopApp();
  const [askSiri, setAskSiri] = usePreference("siri.askSiri", true);
  // On the served desktop it opens a microphone, so it stays off until the person turns it on.
  const [heySiri, setHeySiriValue] = usePreference(HEY_SIRI_SETTING, !served);
  const [refused, setRefused] = usePreference(HEY_SIRI_REFUSED, "");
  const setHeySiri = (on: boolean) => {
    setRefused("");
    setHeySiriValue(on);
  };
  const canHear = !served || offersSpeechRecognition();
  const [whenLocked, setWhenLocked] = usePreference("siri.allowWhenLocked", true);
  const [shortcut, setShortcut] = usePreference(SIRI_SHORTCUT_KEY, HOLD_COMMAND_SPACE);
  const [language, setLanguage] = usePreference("siri.language", "English (United States)");
  const [voice, setVoice] = usePreference("siri.voice", "American (Female)");
  const voices = useSyncExternalStore(subscribeVoices, voicesOfBrowser, () => "").split(" ");
  const languageTag = siriListensIn(language);
  const inEnglish = !languageTag || languageTag.startsWith("en");
  const accent = voice.split(" ")[0] ?? "American";
  const accents = ACCENTS.filter(
    ([name, tag]) => name === accent || voices.some((lang) => lang === tag),
  ).map(([name]) => name);
  const hasVoices = voices.some((lang) => lang !== "");
  const voiceRefusal = !hasVoices
    ? NO_VOICES
    : inEnglish
      ? undefined
      : `Siri speaks with a voice of ${language} here.`;
  const [feedback, setFeedback] = usePreference<string>("siri.voiceFeedback", "on");
  const [inMenuBar, setInMenuBar] = usePreference("siri.showInMenuBar", true);
  const id = useId();
  const off = !askSiri;

  return (
    <PaneForm>
      <PaneAt x={59} y={71}>
        <OrbPicture />
      </PaneAt>
      <PaneAt x={0} y={194.5} width={230} style={{ justifyContent: "center" }}>
        <Label textStyle="emphasized">Siri</Label>
      </PaneAt>
      <PaneAt x={61} y={230}>
        <Checkbox checked={askSiri} onCheckedChange={setAskSiri}>
          Enable Ask Siri
        </Checkbox>
      </PaneAt>

      <PaneAt x={DETAIL.x} y={DETAIL.y}>
        <Box edges="leading" aria-label="Ask Siri" style={{ width: 438, height: 294 }}>
          <PaneForm origin={DETAIL} labelWidth={414} gap={6.5}>
            <PaneAt x={262.5} y={55.5}>
              <Label>
                Siri helps you get things done, just by asking. Find files on your
                <br />
                Mac, dictate a note, check the weather, and more.
              </Label>
            </PaneAt>

            <PaneAt x={420.5} y={100}>
              <Checkbox
                checked={heySiri && canHear}
                onCheckedChange={setHeySiri}
                disabled={off || !canHear}
                title={
                  !canHear
                    ? OFF_IN_THIS_BROWSER
                    : served
                      ? "Listens only while this page is open, through your browser's speech recognition, which may send what it hears to its maker."
                      : undefined
                }
              >
                Listen for “Hey Siri”
              </Checkbox>
            </PaneAt>
            <PaneAt x={420.5} y={120}>
              <Checkbox
                checked={whenLocked && !served}
                onCheckedChange={setWhenLocked}
                disabled={off || served}
                title={served ? "The locked screen asks only for the password here." : undefined}
              >
                Allow Siri when locked
              </Checkbox>
            </PaneAt>

            <PaneRow
              y={147}
              label="Keyboard Shortcut:"
              labelId={`${id}-shortcut`}
              labelOffset={2.5}
            >
              <Choice
                labelledBy={`${id}-shortcut`}
                items={served ? SHORTCUTS.filter((each) => each !== SHORTCUT_NO_FN) : SHORTCUTS}
                value={shortcut}
                onValueChange={setShortcut}
                disabled={off}
                title={served ? SHORTCUT_NOTE : undefined}
              />
            </PaneRow>
            <PaneRow y={178} label="Language:" labelId={`${id}-language`} labelOffset={2.5}>
              <Choice
                labelledBy={`${id}-language`}
                items={served ? LANGUAGES.filter((each) => siriListensIn(each)) : LANGUAGES}
                value={language}
                onValueChange={setLanguage}
                disabled={off}
                title={served ? LANGUAGE_NOTE : undefined}
              />
            </PaneRow>
            <PaneRow y={209} label="Siri Voice:" labelId={`${id}-voice`} labelOffset={2.5}>
              <Choice
                labelledBy={`${id}-voice`}
                items={served ? accents : VOICES}
                value={served ? accent : voice}
                onValueChange={setVoice}
                disabled={off || (served && voiceRefusal !== undefined)}
                title={served ? (voiceRefusal ?? VOICE_IS_ACCENT) : undefined}
              />
            </PaneRow>
            <PaneRow y={242} label="Voice Feedback:" labelId={`${id}-feedback`} labelOffset={0.5}>
              {/* The second button starts 45 pt after the first, whatever the font. */}
              <RadioGroup
                aria-labelledby={`${id}-feedback`}
                orientation="horizontal"
                value={feedback}
                onValueChange={(value) => setFeedback(value as string)}
                disabled={off}
                style={{ gap: 0 }}
              >
                <RadioButton value="on" style={{ width: 45 }}>
                  On
                </RadioButton>
                <RadioButton value="off">Off</RadioButton>
              </RadioGroup>
            </PaneRow>
            {served && !heySiri && REFUSED_WORDS[refused] ? (
              <PaneAt x={262.5} y={270}>
                <Label textStyle="small" color="secondary" role="status">
                  {REFUSED_WORDS[refused]}
                </Label>
              </PaneAt>
            ) : served && !inEnglish ? (
              <PaneAt x={262.5} y={270}>
                <Label textStyle="small" color="secondary" role="status">
                  It understands requests and writes its answers in English.
                </Label>
              </PaneAt>
            ) : null}

            <PaneAt x={250} y={295}>
              <Checkbox checked={inMenuBar} onCheckedChange={setInMenuBar}>
                Show Siri in menu bar
              </Checkbox>
            </PaneAt>
            <PaneAt x={419} y={292}>
              <Uncaptured
                action="Siri Suggestions & Privacy…"
                reason={
                  servedByDesktopApp()
                    ? "Siri here answers from this desktop's server, for your account only, and makes no suggestions."
                    : undefined
                }
              >
                <PushButton style={{ width: 196, paddingInline: 0 }}>
                  Siri Suggestions & Privacy…
                </PushButton>
              </Uncaptured>
            </PaneAt>
            <PaneFooter x={627} y={292}>
              <Uncaptured action="Help">
                <HelpButton />
              </Uncaptured>
            </PaneFooter>
          </PaneForm>
        </Box>
      </PaneAt>
    </PaneForm>
  );
}
