"use client";

import { ImageButton } from "macalicious/image-button";
import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { useEffect, useRef, useState } from "react";
import {
  MicrophoneError,
  startTake,
  type VoiceMemosTake,
} from "../voice-memos/voice-memos-recorder";
import { AudioGlyph, MessagesGlyph } from "./messages-artwork";

/** The file an audio message goes as, by what the browser recorded. */
export function audioMessageName(type: string): string {
  const kind = type.split(";")[0]?.trim().toLowerCase();
  if (kind === "audio/webm") return "Audio Message.webm";
  if (kind === "audio/ogg") return "Audio Message.ogg";
  if (kind === "audio/mp4") return "Audio Message.m4a";
  if (kind === "audio/wav") return "Audio Message.wav";
  return "Audio Message";
}

const elapsedLabel = (seconds: number) => {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

/**
 * Record audio beside the message field: a press records, Stop ends it, and it can be listened to
 * before it is sent or thrown away. It goes as an attachment, in a format the browser plays. The
 * parent gives each conversation its own by `key`: going to another one throws away what is held.
 */
export function AudioMessageButton({
  onSend,
  onProblem,
}: {
  onSend: (recording: Blob, name: string) => void;
  onProblem: (message: string) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "starting" | "recording" | "held">("idle");
  const [seconds, setSeconds] = useState(0);
  const [held, setHeld] = useState<{ blob: Blob; url: string } | null>(null);
  const take = useRef<VoiceMemosTake | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      take.current?.cancel();
      take.current = null;
    };
  }, []);
  useEffect(() => {
    if (!held) return;
    return () => URL.revokeObjectURL(held.url);
  }, [held]);
  useEffect(() => {
    if (phase !== "recording") return;
    const timer = setInterval(() => setSeconds(take.current?.elapsed() ?? 0), 250);
    return () => clearInterval(timer);
  }, [phase]);

  const stop = async () => {
    const running = take.current;
    take.current = null;
    if (!running) return;
    try {
      const blob = await running.stop();
      if (!alive.current) return;
      setHeld({ blob, url: URL.createObjectURL(blob) });
      setPhase("held");
    } catch {
      if (!alive.current) return;
      setPhase("idle");
      onProblem("The recording could not be finished.");
    }
  };
  const start = () => {
    setPhase("starting");
    setSeconds(0);
    startTake(() => void stop()).then(
      (started) => {
        if (!alive.current) {
          started.cancel();
          return;
        }
        take.current = started;
        setPhase("recording");
      },
      (error: unknown) => {
        if (!alive.current) return;
        setPhase("idle");
        onProblem(
          error instanceof MicrophoneError && error.problem !== "denied"
            ? error.message
            : "Messages is not allowed to use the microphone. Allow it in the browser's settings for this site, then try again.",
        );
      },
    );
  };

  if (phase === "recording") {
    return (
      // biome-ignore lint/a11y/useSemanticElements: a fieldset's own box and legend do not belong in this bar
      <div className="mac-messages-recording" role="group" aria-label="Recording">
        <span className="mac-messages-recording-dot" aria-hidden="true" />
        <Label role="timer">{elapsedLabel(seconds)}</Label>
        <ImageButton aria-label="Stop recording" onClick={() => void stop()}>
          <MessagesGlyph name="stop" size={14} />
        </ImageButton>
      </div>
    );
  }
  if (phase === "held" && held) {
    const done = () => {
      setHeld(null);
      setPhase("idle");
    };
    return (
      // biome-ignore lint/a11y/useSemanticElements: a fieldset's own box and legend do not belong in this bar
      <div className="mac-messages-recording" role="group" aria-label="Audio message">
        {/* biome-ignore lint/a11y/useMediaCaption: the person's own recording has no captions */}
        <audio className="mac-messages-recording-player" controls src={held.url} />
        <PushButton size="small" onClick={done}>
          Cancel
        </PushButton>
        <PushButton
          size="small"
          onClick={() => {
            onSend(held.blob, audioMessageName(held.blob.type));
            done();
          }}
        >
          Send
        </PushButton>
      </div>
    );
  }
  return (
    <ImageButton aria-label="Record audio" disabled={phase === "starting"} onClick={start}>
      <AudioGlyph />
    </ImageButton>
  );
}
