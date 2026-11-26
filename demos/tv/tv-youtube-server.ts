import { sessionFetch, withDeadline } from "../desktop/desktop-server";
import { cleanVideo, isVideoId, type TvVideo } from "./tv-youtube-data";

/**
 * TV's calls to its module of the `macalicious-desktop` Ferrite application
 * (`ferrite-apps/desktop/src/apps/tv`): the person's library document, and the two lookups that
 * go through the application's egress to YouTube. Only the desktop app serves these; elsewhere
 * the window plays videos without them.
 */
export const TV_LIBRARY_URL = "/api/tv/library";
export const TV_VIDEO_URL = "/api/tv/video";
export const TV_SEARCH_URL = "/api/tv/search";

/** What looking a link up found. */
export type TvLookup = { ok: true; video: TvVideo } | { ok: false; reason: string; status: number };

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const errorOf = (reply: unknown, fallback: string) => {
  const error = (reply as { error?: unknown } | null)?.error;
  return typeof error === "string" && error ? error : fallback;
};

/** The title and channel of the video a YouTube link names, from YouTube's oEmbed answer. */
export async function lookUpVideo(link: string): Promise<TvLookup> {
  try {
    return await withDeadline(async (signal) => {
      const response = await sessionFetch(`${TV_VIDEO_URL}?link=${encodeURIComponent(link)}`, {
        credentials: "same-origin",
        headers: { accept: "application/json" },
        signal,
      });
      const reply = await readJson(response);
      const video = reply as Partial<TvVideo> | null;
      if (
        response.ok &&
        typeof video?.id === "string" &&
        isVideoId(video.id) &&
        typeof video.title === "string"
      ) {
        return {
          ok: true,
          video: cleanVideo({ id: video.id, title: video.title, channel: video.channel ?? "" }),
        };
      }
      return {
        ok: false,
        status: response.status,
        reason: errorOf(reply, `YouTube could not be asked (HTTP ${response.status})`),
      };
    });
  } catch (error) {
    return {
      ok: false,
      status: 0,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/** What a YouTube search found: `available` is false when the desktop has no YouTube key. */
export type TvSearch =
  | { ok: true; available: boolean; results: TvVideo[]; reason?: string }
  | { ok: false; reason: string };

/** Search YouTube through the desktop app. A caller that sent a newer search ignores this answer. */
export async function searchYouTube(query: string): Promise<TvSearch> {
  try {
    return await withDeadline(async (signal) => {
      const response = await sessionFetch(`${TV_SEARCH_URL}?q=${encodeURIComponent(query)}`, {
        credentials: "same-origin",
        headers: { accept: "application/json" },
        signal,
      });
      const reply = (await readJson(response)) as {
        available?: unknown;
        results?: unknown;
        reason?: unknown;
      } | null;
      if (!response.ok || typeof reply?.available !== "boolean" || !Array.isArray(reply.results)) {
        return { ok: false, reason: errorOf(reply, `HTTP ${response.status}`) };
      }
      const results = reply.results.flatMap((item: unknown) => {
        const video = item as Partial<TvVideo> | null;
        return typeof video?.id === "string" &&
          isVideoId(video.id) &&
          typeof video.title === "string"
          ? [cleanVideo({ id: video.id, title: video.title, channel: video.channel ?? "" })]
          : [];
      });
      return {
        ok: true,
        available: reply.available,
        results,
        reason: typeof reply.reason === "string" ? reply.reason : undefined,
      };
    });
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
