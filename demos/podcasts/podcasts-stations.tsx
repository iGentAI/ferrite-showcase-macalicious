"use client";

import { Checkbox } from "macalicious/checkbox";
import { DefaultButton } from "macalicious/default-button";
import { PushButton } from "macalicious/push-button";
import { Sheet, SheetActions, SheetClose, SheetPopup, SheetTitle } from "macalicious/sheet";
import { TextField } from "macalicious/text-field";
import { useState } from "react";

/** A station: a named playlist of the newest episodes of the shows it holds. */
export interface PodcastsStation {
  id: string;
  name: string;
  /** The ids of its shows. */
  shows: readonly string[];
}

/** The stations, in the desktop's settings. */
export const PODCASTS_STATIONS = "podcasts.stations";

/** How many episodes Play Station puts in the player and Up Next. */
export const STATION_EPISODES = 10;

const NAME_LENGTH = 100;

/** The stations as the setting holds them; anything else in it is dropped. */
export function readStations(stored: unknown): readonly PodcastsStation[] | undefined {
  if (!Array.isArray(stored)) return undefined;
  return stored.flatMap((each) =>
    typeof each?.id === "string" &&
    typeof each?.name === "string" &&
    Array.isArray(each?.shows) &&
    each.shows.every((show: unknown) => typeof show === "string")
      ? [{ id: each.id, name: each.name, shows: each.shows as string[] }]
      : [],
  );
}

/** `stations` with `station` in place of the one with its id, or after the others. */
export function savedStation(
  stations: readonly PodcastsStation[],
  station: PodcastsStation,
): PodcastsStation[] {
  return stations.some((each) => each.id === station.id)
    ? stations.map((each) => (each.id === station.id ? station : each))
    : [...stations, station];
}

/** File > New Station, and a station's Edit Station: its name and the followed shows it plays. */
export function StationSheet({
  anchor,
  station,
  shows,
  onSave,
  onCancel,
}: {
  anchor: Element | null;
  station?: PodcastsStation;
  shows: readonly { id: string; title: string }[];
  onSave: (name: string, shows: readonly string[]) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(station?.name ?? "");
  const [chosen, setChosen] = useState<readonly string[]>(station?.shows ?? []);
  const kept = chosen.filter((id) => shows.some((show) => show.id === id));
  const ready = name.trim() !== "" && kept.length > 0;
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <SheetPopup anchor={anchor} width={420}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (ready) onSave(name.trim(), kept);
          }}
        >
          <SheetTitle>{station ? "Edit Station" : "New Station"}</SheetTitle>
          <TextField
            aria-label="Station name"
            autoFocus
            maxLength={NAME_LENGTH}
            placeholder="Station name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            style={{ width: "100%", marginBlock: 12 }}
          />
          <fieldset
            aria-label="Shows"
            style={{ border: 0, margin: 0, padding: 0, maxHeight: 200, overflow: "auto" }}
          >
            {shows.map((show) => (
              <div key={show.id}>
                <Checkbox
                  checked={kept.includes(show.id)}
                  onCheckedChange={(on) =>
                    setChosen(on ? [...kept, show.id] : kept.filter((id) => id !== show.id))
                  }
                >
                  {show.title}
                </Checkbox>
              </div>
            ))}
          </fieldset>
          <SheetActions>
            <SheetClose render={<PushButton />}>Cancel</SheetClose>
            <DefaultButton type="submit" disabled={!ready}>
              {station ? "Save" : "Create"}
            </DefaultButton>
          </SheetActions>
        </form>
      </SheetPopup>
    </Sheet>
  );
}
