"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";

/** The screen effects a phrase in a message sets off. */
export type MessageEffect = "balloons" | "confetti" | "fireworks" | "lasers";

const PHRASES: readonly (readonly [RegExp, MessageEffect])[] = [
  [/\bhappy birthday\b/i, "balloons"],
  [/\b(?:congratulations|congrats)\b/i, "confetti"],
  [/\bhappy new year\b/i, "fireworks"],
  [/\bpew pew\b/i, "lasers"],
];

/** The effect `text` sets off, if any. */
export function effectOf(text: string): MessageEffect | null {
  return PHRASES.find(([phrase]) => phrase.test(text))?.[1] ?? null;
}

const PIECES = 24;
const SHOWN_MS = 3_200;

/**
 * Plays the effect of a message the server took since this window read its conversations, once, when it
 * is the last one in the conversation shown. So nothing here plays while it is on its way, and a reload
 * does not set off what came before it. Nothing plays for someone who asks their browser for less motion.
 */
export function MessageEffectLayer<Message extends { id: string; text: string }>({
  conversationId,
  message,
  isNew,
}: {
  conversationId: string | null;
  message: Message | null;
  isNew: (message: Message) => boolean;
}) {
  const [playing, setPlaying] = useState<{ effect: MessageEffect; key: number } | null>(null);
  const played = useRef(new Set<string>());
  const plays = useRef(0);
  const fresh = message !== null && isNew(message);
  const id = message?.id;
  const text = message?.text;

  useEffect(() => {
    if (!conversationId || id === undefined || text === undefined || !fresh) return;
    const mark = `${conversationId}\u0000${id}`;
    if (played.current.has(mark)) return;
    played.current.add(mark);
    const effect = effectOf(text);
    if (!effect || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setPlaying({ effect, key: ++plays.current });
  }, [conversationId, id, text, fresh]);

  const key = playing?.key;
  useEffect(() => {
    if (key === undefined) return;
    const timer = setTimeout(() => setPlaying(null), SHOWN_MS);
    return () => clearTimeout(timer);
  }, [key]);

  if (!playing) return null;
  return (
    <div
      key={playing.key}
      className="mac-messages-effect"
      data-effect={playing.effect}
      data-play={playing.key}
      aria-hidden
    >
      {Array.from({ length: PIECES }, (_, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: the pieces are all alike and never reorder
          key={index}
          style={
            {
              "--_along": `${(index * 37) % 100}%`,
              "--_delay": `${((index * 7) % 10) * 80}ms`,
              "--_turn": `${(index * 360) / PIECES}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
