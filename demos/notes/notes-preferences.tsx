"use client";

import { Checkbox } from "macalicious/checkbox";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PreferencesWindow, PreferencesWindowRow } from "macalicious/preferences-window";
import { Slider } from "macalicious/slider";
import type { ComponentProps } from "react";
import { KEEP_DELETED_DAYS, type NotesSort } from "./notes-data";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  NOTES_SETTINGS,
  type NotesNewNoteStart,
  readBoolean,
  readNewNoteStart,
  readNumber,
  readSort,
  useNotesSetting,
} from "./notes-settings";

const SORT_TITLES: Record<NotesSort, string> = {
  edited: "Date Edited",
  created: "Date Created",
  title: "Title",
};
const START_TITLES: Record<NotesNewNoteStart, string> = {
  title: "Title",
  heading: "Heading",
  body: "Body",
};

/**
 * Notes > Preferences, a window of the desktop. The values are the person's desktop values, so the
 * Notes window follows each change and they survive a reload.
 */
export function NotesPreferences(
  props: Omit<ComponentProps<typeof PreferencesWindow>, "toolbar" | "children">,
) {
  const [sort, setSort] = useNotesSetting(NOTES_SETTINGS.sort, readSort, "edited");
  const [start, setStart] = useNotesSetting(NOTES_SETTINGS.newNoteStart, readNewNoteStart, "title");
  const [zoom, setZoom] = useNotesSetting(NOTES_SETTINGS.zoom, readNumber, 1);
  const [onMyMac, setOnMyMac] = useNotesSetting(NOTES_SETTINGS.onMyMac, readBoolean, false);
  return (
    <PreferencesWindow title="Notes Preferences" toolbar={null} width={460} {...props}>
      <div className="mac-notes-preferences">
        <PreferencesWindowRow label="Sort notes by:">
          <PopUpButton
            aria-label="Sort notes by"
            value={sort}
            onValueChange={(next) => setSort(next as NotesSort)}
          >
            {(Object.keys(SORT_TITLES) as NotesSort[]).map((value) => (
              <PopUpButtonItem key={value} value={value}>
                {SORT_TITLES[value]}
              </PopUpButtonItem>
            ))}
          </PopUpButton>
        </PreferencesWindowRow>
        <PreferencesWindowRow label="New notes start with:">
          <PopUpButton
            aria-label="New notes start with"
            value={start}
            onValueChange={(next) => setStart(next as NotesNewNoteStart)}
          >
            {(Object.keys(START_TITLES) as NotesNewNoteStart[]).map((value) => (
              <PopUpButtonItem key={value} value={value}>
                {START_TITLES[value]}
              </PopUpButtonItem>
            ))}
          </PopUpButton>
        </PreferencesWindowRow>
        <PreferencesWindowRow label="Default text size:">
          <Slider
            aria-label="Default text size"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.25}
            value={zoom}
            onValueChange={(next) => setZoom(next as number)}
            style={{ width: 180 }}
          />
        </PreferencesWindowRow>
        <PreferencesWindowRow>
          <Checkbox checked={onMyMac} onCheckedChange={setOnMyMac}>
            Enable the On My Mac account
          </Checkbox>
        </PreferencesWindowRow>
        <PreferencesWindowRow>
          <Label>Deleted notes stay in Recently Deleted for {KEEP_DELETED_DAYS} days.</Label>
        </PreferencesWindowRow>
      </div>
    </PreferencesWindow>
  );
}
