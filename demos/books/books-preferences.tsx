"use client";

import { Checkbox } from "macalicious/checkbox";
import {
  PreferencesWindow,
  PreferencesWindowForm,
  PreferencesWindowPane,
  type PreferencesWindowProps,
  PreferencesWindowRow,
} from "macalicious/preferences-window";
import { useDesktopSetting } from "../desktop/desktop-personal";
import { BOOKS_SETTINGS, readBooksFlag } from "./books-appearance";

/** What the Preferences window takes: a window of the desktop. */
export type BooksPreferencesProps = Omit<
  PreferencesWindowProps,
  "toolbar" | "children" | "modal" | "title"
>;

/** Books' Preferences: how a book's page is set, kept with the person's other settings. */
export function BooksPreferences(props: BooksPreferencesProps) {
  const [justify, setJustify] = useDesktopSetting(BOOKS_SETTINGS.justify, readBooksFlag, false);
  const [autoNight, setAutoNight] = useDesktopSetting(
    BOOKS_SETTINGS.autoNight,
    readBooksFlag,
    true,
  );
  return (
    <PreferencesWindow
      title="Books Preferences"
      toolbar={null}
      defaultValue="general"
      width={420}
      {...props}
    >
      <PreferencesWindowPane value="general">
        <PreferencesWindowForm>
          <PreferencesWindowRow label="Reading:">
            <Checkbox checked={justify} onCheckedChange={(next) => setJustify(next === true)}>
              Justify text
            </Checkbox>
          </PreferencesWindowRow>
          <PreferencesWindowRow label="">
            <Checkbox checked={autoNight} onCheckedChange={(next) => setAutoNight(next === true)}>
              Auto-Night Theme
            </Checkbox>
          </PreferencesWindowRow>
        </PreferencesWindowForm>
      </PreferencesWindowPane>
    </PreferencesWindow>
  );
}
