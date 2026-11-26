/*
 * The demo's artwork, all original. The mark before "News" stands where the app has Apple's
 * logo. The pictures of the stories are generated photographs made for the demo's invented
 * headlines (./art), with one abstract mark in a flat panel for a story that has none. A sidebar
 * row's icon is a tile of one colour with the channel's initial, where News has a full-colour
 * picture. The toolbar's glyphs are the library's System Images.
 */

import { useState } from "react";

/** The mark before "News" in the masthead: a folded sheet. */
export function NewsMark() {
  return (
    <svg
      className="mac-news-mark"
      width="22"
      height="26"
      viewBox="0 0 22 26"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M3 0h11l8 8v15a3 3 0 0 1-3 3H3a3 3 0 0 1-3-3V3a3 3 0 0 1 3-3zm2 12v2.500h12V12zm0 5v2.500h8V17z"
      />
    </svg>
  );
}

/**
 * The placeholder of a story's picture: a frame with a disc and a slope, centred in the
 * picture's box. Decorative: the headline says what the story is.
 */
export function PictureMark() {
  return (
    <svg
      className="mac-news-picture-mark"
      width="40"
      height="32"
      viewBox="0 0 40 32"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M4 0h32a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V4a4 4 0 0 1 4-4zm0 3a1 1 0 0 0-1 1v24a1 1 0 0 0 1 1h32a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm7.500 4a3.500 3.500 0 1 1 0 7 3.500 3.500 0 0 1 0-7zM6 26l8-9 5 5 6.500-8L34 26z"
      />
    </svg>
  );
}

/* Generated editorial photographs, all original, one per story id, for the demo's invented
   headlines. A story without one keeps the placeholder mark. */
const PICTURES: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>("./art/*.webp", { eager: true, query: "?url", import: "default" }),
  ).map(([file, url]) => [file.slice("./art/".length, -".webp".length), url]),
);

/**
 * A story's picture: its generated photograph, covering the picture's box, or the placeholder
 * mark when the story has none. In the desktop app a story names its own picture (`src`, from
 * its feed), loaded from the publisher; the mark stands in when it does not load. Decorative:
 * the headline says what the story is.
 */
export function StoryPicture({ id, src }: { id: string; src?: string }) {
  const [failed, setFailed] = useState<string>();
  const url = src ?? PICTURES[id];
  if (!url || failed === url) return <PictureMark />;
  return (
    <img
      className="mac-news-picture"
      src={url}
      alt=""
      draggable={false}
      loading={src ? "lazy" : undefined}
      referrerPolicy={src ? "no-referrer" : undefined}
      onError={src ? () => setFailed(url) : undefined}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
}

/** The play mark of a video story: a white triangle on a translucent dark disc, 44 pt. */
export function PlayMark() {
  return (
    <svg
      className="mac-news-play"
      width="44"
      height="44"
      viewBox="0 0 44 44"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="22" cy="22" r="22" className="mac-news-play-disc" />
      <path d="M17 12.500 32 22 17 31.500z" className="mac-news-play-triangle" />
    </svg>
  );
}

/** A sidebar row's icon: a rounded tile of the channel's colour with its initial. */
export function ChannelIcon({ tint, initial }: { tint: string; initial: string }) {
  return (
    <svg width="18.5" height="18.5" viewBox="0 0 37 37" aria-hidden="true" focusable="false">
      <rect width="37" height="37" rx="8" fill={tint} />
      <text
        x="18.5"
        y="26.5"
        fill="#ffffff"
        fontSize="22"
        fontWeight="700"
        textAnchor="middle"
        style={{ fontFamily: "var(--mac-font-family-system)" }}
      >
        {initial}
      </text>
    </svg>
  );
}
