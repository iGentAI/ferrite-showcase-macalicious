import { useEffect } from "react";
import { onDesktopEffects, requestDesktopEffects } from "../desktop/desktop-effects";
import { changeDesktopValue, desktopValues, useDesktopValue } from "../desktop/desktop-personal";

/**
 * A conversation in a window of its own. A window remembers what it shows by its id in the person's
 * settings, as a desktop that brings windows back after a reload gives them back without what they
 * were opened with.
 */
export const MESSAGES_SEPARATE = "messages.separate";

/** Which conversation each separate window shows, by window id. */
export type SeparateWindows = Readonly<Record<string, string>>;

const NONE: SeparateWindows = {};

/** The main windows open now, and whether one has been asked for and has yet to open. */
let mainWindows = 0;
let mainAsked = false;

/**
 * What other applications send to Messages (a share, Contacts' message button, a separate window's New
 * Message) is kept until a main window takes it, and they ask the desktop to open Messages, which only
 * brings a window of it forward. So while only separate windows are open, one of them asks for a main
 * window as well, after that request has been carried out so that the new window ends up in front.
 */
export function useMainWindowOpens(isMain: boolean, isSeparate: boolean) {
  useEffect(() => {
    if (!isMain) return;
    mainWindows += 1;
    mainAsked = false;
    return () => {
      mainWindows -= 1;
    };
  }, [isMain]);
  useEffect(() => {
    if (!isSeparate) return;
    return onDesktopEffects((effects) => {
      const opens = effects.some((effect) => "open" in effect && effect.open === "messages");
      if (!opens || mainWindows > 0 || mainAsked) return;
      mainAsked = true;
      setTimeout(() => requestDesktopEffects([{ newWindow: "messages" }]), 0);
    });
  }, [isSeparate]);
}

/** The list as stored, leaving out what Messages did not write. */
export function readSeparateWindows(stored: unknown): SeparateWindows | undefined {
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return undefined;
  return Object.fromEntries(
    Object.entries(stored).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

/** The conversation a window was asked to show, from `opening`. */
export function readOpening(opening: unknown): string | undefined {
  const conversation = (opening as { conversation?: unknown } | null | undefined)?.conversation;
  return typeof conversation === "string" ? conversation : undefined;
}

/**
 * The conversation this window shows alone, or `undefined` for the main window: what it was opened
 * with, written down by the window's id, or what is written down when it comes back after a reload.
 */
export function useSeparateConversation(opening: unknown, element: HTMLElement | null) {
  const asked = readOpening(opening);
  const kept = useDesktopValue(MESSAGES_SEPARATE, readSeparateWindows, NONE);
  const id = element?.closest<HTMLElement>("[data-window-id]")?.dataset.windowId;
  useEffect(() => {
    if (!id || !asked) return;
    const all = readSeparateWindows(desktopValues()[MESSAGES_SEPARATE]) ?? NONE;
    if (all[id] !== asked) changeDesktopValue(MESSAGES_SEPARATE, { ...all, [id]: asked });
  }, [id, asked]);
  return asked ?? (id ? kept[id] : undefined);
}
