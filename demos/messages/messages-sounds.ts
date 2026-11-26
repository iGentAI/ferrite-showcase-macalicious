import { useEffect, useRef } from "react";
import {
  lastMessage,
  type MessagesConversation,
  type MessagesMessage,
  type MessagesSettings,
  SOUND_CHOICES,
} from "./messages-data";

/*
 * Messages' sound effects, played with the browser's audio. Apple's sounds are not part of the
 * library, so each choice of the Message received sound is a short tone of its own, as stand-ins.
 */

const SENT_HERTZ = 660;
const LOWEST_HERTZ = 523;
const SEMITONES_APART = 2;
const LENGTH_S = 0.18;
const VOLUME = 0.15;

/** The pitch of a Message received sound. A name not among the choices sounds as the first. */
export function soundHertz(name: string): number {
  const step = Math.max(0, SOUND_CHOICES.indexOf(name));
  return Math.round(LOWEST_HERTZ * 2 ** ((step * SEMITONES_APART) / 12));
}

let context: AudioContext | null = null;

function tone(hertz: number): void {
  if (typeof AudioContext === "undefined") return;
  context ??= new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const end = context.currentTime + LENGTH_S;
  oscillator.frequency.value = hertz;
  gain.gain.setValueAtTime(VOLUME, context.currentTime);
  gain.gain.linearRampToValueAtTime(0, end);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(end);
}

/** The sound of a message going out. */
export const playSentSound = () => tone(SENT_HERTZ);

/**
 * Plays the Message received sound when a conversation without Do Not Disturb gets a message from
 * someone else, with Play sound effects on. What was there when the window read it stays silent.
 */
export function useReceivedSound(
  conversations: readonly MessagesConversation[],
  { playSounds, sound }: Pick<MessagesSettings, "playSounds" | "sound">,
  isNewMessage: ((conversationId: string, message: MessagesMessage) => boolean) | undefined,
  silent: boolean,
): void {
  const heard = useRef(new Map<string, Set<string>>());
  const settings = useRef({ playSounds, sound, isNewMessage, silent });
  settings.current = { playSounds, sound, isNewMessage, silent };
  useEffect(() => {
    let arrived = false;
    for (const conversation of conversations) {
      const last = lastMessage(conversation);
      if (!last) continue;
      const ids = heard.current.get(conversation.id);
      const known = ids !== undefined;
      if (
        !ids?.has(last.id) &&
        last.from === "them" &&
        !conversation.muted &&
        (known || settings.current.isNewMessage?.(conversation.id, last))
      ) {
        arrived = true;
      }
      heard.current.set(conversation.id, (ids ?? new Set()).add(last.id));
    }
    if (arrived && settings.current.playSounds && !settings.current.silent) {
      tone(soundHertz(settings.current.sound));
    }
  }, [conversations]);
}
