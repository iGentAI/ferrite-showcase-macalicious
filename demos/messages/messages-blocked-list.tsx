"use client";

import { BorderedList, BorderedListRow, BorderedListRows } from "macalicious/bordered-list";
import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { TextField } from "macalicious/text-field";
import { useCallback, useEffect, useState } from "react";
import { SERVER_CHANGE_EVENT } from "../desktop/desktop-live";
import { servedByDesktopApp, sessionFetch } from "../desktop/desktop-server";
import "./messages-blocked-list.css";

export interface BlockedPerson {
  name: string;
  full_name?: string;
}

const API = "/api/messages/blocked";

/**
 * The people the person has blocked: one list on the server for Messages and FaceTime, as on a Mac.
 * `set` answers `null` when the server took the change, or why it did not.
 */
export function useBlockedPeople() {
  const [people, setPeople] = useState<readonly BlockedPerson[]>([]);
  const read = useCallback(async () => {
    if (!servedByDesktopApp()) return;
    try {
      const reply = await sessionFetch(API, { credentials: "same-origin" });
      if (!reply.ok) return;
      const body = (await reply.json()) as { blocked?: BlockedPerson[] };
      if (Array.isArray(body.blocked)) setPeople(body.blocked);
    } catch {
      // The list stays as it was; the next change or opening reads it again.
    }
  }, []);
  useEffect(() => {
    void read();
    const changed = (event: Event) => {
      if ((event as CustomEvent<{ app?: string }>).detail?.app === "messages") void read();
    };
    window.addEventListener(SERVER_CHANGE_EVENT, changed);
    return () => window.removeEventListener(SERVER_CHANGE_EVENT, changed);
  }, [read]);
  const set = useCallback(
    async (name: string, blocked: boolean): Promise<string | null> => {
      try {
        const reply = await sessionFetch(`${API}/${encodeURIComponent(name)}`, {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ blocked }),
        });
        if (reply.status === 404) return `No one on this desktop has the account name ${name}.`;
        if (!reply.ok) return "The list could not be changed just now.";
        await read();
        return null;
      } catch {
        return "The list could not be changed just now.";
      }
    },
    [read],
  );
  return { people, set };
}

/** The Blocked pane of FaceTime's and Messages' Preferences: the list, adding by account name, Remove. */
export function BlockedPeoplePane() {
  const { people, set } = useBlockedPeople();
  const [chosen, setChosen] = useState<readonly string[]>([]);
  const [typed, setTyped] = useState("");
  const [refusal, setRefusal] = useState<string | null>(null);
  if (!servedByDesktopApp()) {
    return (
      <div className="mac-messages-blocked">
        <Label>Only an account on a desktop's server has people to block.</Label>
      </div>
    );
  }
  const add = async () => {
    const name = typed.trim();
    if (name === "") return;
    const why = await set(name, true);
    setRefusal(why);
    if (why === null) setTyped("");
  };
  return (
    <div className="mac-messages-blocked">
      <Label>Blocked people cannot call you or send you messages.</Label>
      <BorderedList className="mac-messages-blocked-list">
        <BorderedListRows
          aria-label="Blocked people"
          rowHeight={24}
          value={chosen}
          onValueChange={setChosen}
        >
          {people.map((person) => (
            <BorderedListRow
              key={person.name}
              value={person.name}
              title={person.full_name || person.name}
              textValue={person.full_name || person.name}
            />
          ))}
        </BorderedListRows>
      </BorderedList>
      <div className="mac-messages-blocked-add">
        <TextField
          aria-label="Account name to block"
          placeholder="Account name"
          value={typed}
          onValueChange={setTyped}
          onKeyDown={(event) => {
            if (event.key === "Enter") void add();
          }}
        />
        <PushButton disabled={typed.trim() === ""} onClick={() => void add()}>
          Add
        </PushButton>
        <PushButton
          disabled={chosen.length === 0}
          onClick={() => {
            void Promise.all(chosen.map((name) => set(name, false))).then((answers) => {
              setRefusal(answers.find((why) => why !== null) ?? null);
            });
            setChosen([]);
          }}
        >
          Remove
        </PushButton>
      </div>
      {refusal ? <Label role="alert">{refusal}</Label> : null}
    </div>
  );
}
