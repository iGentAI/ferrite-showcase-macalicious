"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sessionFetch, withDeadline } from "../desktop/desktop-server";
import { isAccountConversation } from "./messages-accounts";

/**
 * Do Not Disturb for the Messages window the desktop's Ferrite application serves, kept on the
 * server per account (`ferrite-apps/desktop/src/apps/messages/muted.rs`): a muted conversation's
 * messages send its person no notification, in any of their browsers, and the setting outlives
 * a reload and a restart of the server. Another account never sees it.
 *
 * The window's ids are mapped to the server's: an account conversation keeps its id; the shared
 * room's conversation is `room-<room>`, so each room is muted on its own. The list is read when
 * the window opens and when it gains focus (a change made in another browser shows then). A
 * change is sent at once and shows once the server has kept it; a refusal is reported in
 * `refusals`, under the conversation, and the checkbox stays as the server has it.
 */

const API = "/api/messages/muted";

/** The shared room's conversation in the window, and the room it shows. */
export interface RoomConversation {
  /** The window's id for it (`LIVE_CONVERSATION.id`). */
  id: string;
  /** The room on the server (`?room=`, or `desktop`). */
  room: string;
}

/** The server's id for the window's conversation `id`, or `null` for one it does not keep. */
export function muteIdOf(id: string, room: RoomConversation): string | null {
  if (isAccountConversation(id)) return id;
  return id === room.id ? `room-${room.room}` : null;
}

/** The window's id for the server's `muteId`, or `null` for another room's. */
export function windowIdOf(muteId: string, room: RoomConversation): string | null {
  if (isAccountConversation(muteId)) return muteId;
  return muteId === `room-${room.room}` ? room.id : null;
}

export interface DoNotDisturb {
  /** The window's conversations with Do Not Disturb on, as the server keeps them. */
  muted: ReadonlySet<string>;
  /** Turn Do Not Disturb on or off for a conversation of the window. */
  setMuted: (id: string, muted: boolean) => void;
  /** Why the last change of a conversation was not kept, by the window's id. */
  refusals: ReadonlyMap<string, string>;
}

async function request(
  url: string,
  init?: RequestInit,
): Promise<{ status: number; body: unknown }> {
  try {
    return await withDeadline(async (signal) => {
      const response = await sessionFetch(url, { credentials: "same-origin", signal, ...init });
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        // No JSON body.
      }
      return { status: response.status, body };
    });
  } catch {
    return { status: 0, body: null };
  }
}

export function useDoNotDisturb(enabled: boolean, room: RoomConversation): DoNotDisturb {
  const [muted, setMutedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [refusals, setRefusals] = useState<ReadonlyMap<string, string>>(() => new Map());
  const roomNow = useRef(room);
  roomNow.current = room;
  // Each conversation's change under way, by a number: only the latest one's answer is taken.
  const asked = useRef(new Map<string, number>());
  const serial = useRef(0);
  // Changes the server has kept, counted, and when each conversation's last one was kept: a read
  // of the list that began before a change was kept answers what the server had then, so it
  // leaves that conversation as the change made it, and one still on its way as it is.
  const kept = useRef(0);
  const keptAt = useRef(new Map<string, number>());
  const stopped = useRef(false);

  const load = useCallback(async () => {
    const since = kept.current;
    const reply = await request(API);
    const ids = (reply.body as { muted?: unknown } | null)?.muted;
    if (stopped.current || reply.status !== 200 || !Array.isArray(ids)) return;
    setMutedIds((before) => {
      const next = new Set<string>();
      for (const each of ids) {
        if (typeof each !== "string") continue;
        const id = windowIdOf(each, roomNow.current);
        if (id) next.add(id);
      }
      const newer = [
        ...asked.current.keys(),
        ...[...keptAt.current].filter(([, at]) => at > since).map(([id]) => id),
      ];
      for (const id of newer) {
        if (before.has(id)) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    stopped.current = false;
    void load();
    const focus = () => void load();
    const visible = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visible);
    return () => {
      stopped.current = true;
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [enabled, load]);

  const setMuted = useCallback((id: string, value: boolean) => {
    const muteId = muteIdOf(id, roomNow.current);
    if (!muteId) return;
    serial.current += 1;
    const mine = serial.current;
    asked.current.set(id, mine);
    void request(`${API}/${encodeURIComponent(muteId)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ muted: value }),
    }).then((reply) => {
      if (stopped.current || asked.current.get(id) !== mine) return;
      asked.current.delete(id);
      if (reply.status === 200) {
        kept.current += 1;
        keptAt.current.set(id, kept.current);
        setMutedIds((all) => {
          if (all.has(id) === value) return all;
          const next = new Set(all);
          if (value) next.add(id);
          else next.delete(id);
          return next;
        });
        setRefusals((all) => {
          if (!all.has(id)) return all;
          const next = new Map(all);
          next.delete(id);
          return next;
        });
        return;
      }
      const error = (reply.body as { error?: unknown } | null)?.error;
      setRefusals((all) =>
        new Map(all).set(
          id,
          typeof error === "string" && error
            ? `Do Not Disturb was not changed: ${error}.`
            : "Do Not Disturb was not changed; try again.",
        ),
      );
    });
  }, []);

  return { muted, setMuted, refusals };
}
