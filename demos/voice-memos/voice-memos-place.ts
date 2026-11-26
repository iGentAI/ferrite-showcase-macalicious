import { changeDesktopValue, desktopValues } from "../desktop/desktop-personal";

/** The desktop setting that keeps where the person left Voice Memos. */
export const VOICE_MEMOS_PLACE = "voice-memos.place";

/** Where the person left Voice Memos, kept for them across a reload and from browser to browser. */
export interface VoiceMemosPlace {
  /** The drive's id of the recording shown. */
  recording: string;
  /** The playhead in it, in seconds. */
  position: number;
  /** Whether the list stands beside the player. */
  sidebar: boolean;
}

/** The place as stored; `undefined` for anything else. */
export function readPlace(stored: unknown): VoiceMemosPlace | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { recording, position, sidebar } = stored as Record<string, unknown>;
  return typeof recording === "string" &&
    typeof position === "number" &&
    Number.isFinite(position) &&
    position >= 0 &&
    typeof sidebar === "boolean"
    ? { recording, position, sidebar }
    : undefined;
}

/** Saves the place, unless it is the one already kept. */
export function keepPlace(place: VoiceMemosPlace): void {
  const kept = readPlace(desktopValues()[VOICE_MEMOS_PLACE]);
  if (
    kept?.recording === place.recording &&
    kept.position === place.position &&
    kept.sidebar === place.sidebar
  ) {
    return;
  }
  changeDesktopValue(VOICE_MEMOS_PLACE, place);
}
