import { useEffect, useRef } from "react";

const ACTIONS: readonly MediaSessionAction[] = [
  "play",
  "pause",
  "stop",
  "seekbackward",
  "seekforward",
  "seekto",
];

/** How far a media key without a distance of its own skips: the window's two skip buttons. */
const SKIP_SECONDS = 15;

export interface NowPlaying {
  /** Whether a recording plays now. */
  playing: boolean;
  /** The recording's title. */
  title: string;
  /** The playhead, in seconds, when a key asks. */
  position: () => number;
  /** Starts the recording, when it is not playing. */
  play: () => void;
  /** Stops the recording, when it is playing. */
  pause: () => void;
  seek: (seconds: number) => void;
}

function setHandlers(session: MediaSession, now: { current: NowPlaying }) {
  const skip = (seconds: number) => now.current.seek(now.current.position() + seconds);
  const handlers: Partial<Record<MediaSessionAction, MediaSessionActionHandler>> = {
    play: () => now.current.play(),
    pause: () => now.current.pause(),
    stop: () => now.current.pause(),
    seekbackward: (details) => skip(-(details.seekOffset ?? SKIP_SECONDS)),
    seekforward: (details) => skip(details.seekOffset ?? SKIP_SECONDS),
    seekto: (details) => {
      if (details.seekTime !== undefined) now.current.seek(details.seekTime);
    },
  };
  for (const action of ACTIONS) {
    try {
      session.setActionHandler(action, handlers[action] ?? null);
    } catch {
      // An action this browser does not know.
    }
  }
}

/**
 * The keyboard's and the system's media keys, and the browser's Now Playing, through the Media
 * Session API: Voice Memos takes them when a recording starts to play, and holds them until its
 * window closes, as the last application to play does on a Mac.
 */
export function useNowPlaying(state: NowPlaying): void {
  const now = useRef(state);
  now.current = state;
  const held = useRef(false);
  const named = useRef<MediaMetadata | null>(null);
  const { playing, title } = state;

  useEffect(() => {
    const session = "mediaSession" in navigator ? navigator.mediaSession : undefined;
    if (!session) return;
    if (!playing) {
      if (held.current) session.playbackState = "paused";
      return;
    }
    held.current = true;
    setHandlers(session, now);
    if (typeof MediaMetadata !== "undefined") {
      named.current = new MediaMetadata({ title, artist: "Voice Memos" });
      session.metadata = named.current;
    }
    session.playbackState = "playing";
  }, [playing, title]);

  useEffect(
    () => () => {
      const session = "mediaSession" in navigator ? navigator.mediaSession : undefined;
      // Another application that has played since holds the keys now.
      if (!session || !held.current || session.metadata !== named.current) return;
      for (const action of ACTIONS) {
        try {
          session.setActionHandler(action, null);
        } catch {
          // An action this browser does not know.
        }
      }
      session.metadata = null;
      session.playbackState = "none";
    },
    [],
  );
}
