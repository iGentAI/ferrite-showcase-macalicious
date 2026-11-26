"use client";

import { Checkbox } from "macalicious/checkbox";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import {
  PreferencesWindow,
  PreferencesWindowForm,
  PreferencesWindowPane,
  type PreferencesWindowProps,
  PreferencesWindowRow,
} from "macalicious/preferences-window";
import { PushButton } from "macalicious/push-button";
import { useRef } from "react";
import { useDesktopSetting } from "../desktop/desktop-personal";
import { type DictionarySource, SOURCES } from "./dictionary-data";
import {
  ACCENT_KEY,
  ACCENTS,
  DEFAULT_ACCENT,
  DEFAULT_SOURCES,
  DEFAULT_TEXT_SIZE,
  type DictionaryAccent,
  readAccent,
  readSources,
  readTextSize,
  SOURCES_KEY,
  TEXT_SIZE_KEY,
  TEXT_SIZE_NAMES,
} from "./dictionary-settings";
import "./dictionary.tokens.css";
import "./dictionary.css";

/** What the Preferences window takes: a window of the desktop. */
export type DictionaryPreferencesProps = Omit<
  PreferencesWindowProps,
  "toolbar" | "children" | "modal" | "title"
>;

/** Dictionary's Preferences: which sources are shown in what order, and the size of the text. */
export function DictionaryPreferences(props: DictionaryPreferencesProps) {
  const [sources, setSources] = useDesktopSetting(SOURCES_KEY, readSources, DEFAULT_SOURCES);
  const [textSize, setTextSize] = useDesktopSetting(TEXT_SIZE_KEY, readTextSize, DEFAULT_TEXT_SIZE);
  const [accent, setAccent] = useDesktopSetting(ACCENT_KEY, readAccent, DEFAULT_ACCENT);
  const dragged = useRef<DictionarySource | null>(null);
  const place = (id: DictionarySource, at: number) => {
    const rest = sources.order.filter((each) => each !== id);
    setSources({ ...sources, order: [...rest.slice(0, at), id, ...rest.slice(at)] });
  };
  return (
    <PreferencesWindow
      title="Dictionary Preferences"
      toolbar={null}
      defaultValue="general"
      width={420}
      {...props}
    >
      <PreferencesWindowPane value="general">
        <Label render={<p />} className="mac-dictionary-preferences-note">
          Choose the sources Dictionary shows, and drag them into the order you want.
        </Label>
        <ul className="mac-dictionary-sources" aria-label="Sources">
          {sources.order.map((id, at) => {
            const title = SOURCES.find((source) => source.id === id)?.title ?? id;
            return (
              <li
                key={id}
                className="mac-dictionary-source-row"
                draggable
                onDragStart={() => {
                  dragged.current = id;
                }}
                onDragOver={(event) => {
                  if (dragged.current) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragged.current && dragged.current !== id) place(dragged.current, at);
                  dragged.current = null;
                }}
              >
                <Checkbox
                  checked={!sources.off.includes(id)}
                  onCheckedChange={(checked) =>
                    setSources({
                      ...sources,
                      off: checked
                        ? sources.off.filter((each) => each !== id)
                        : [...sources.off, id],
                    })
                  }
                >
                  {title}
                </Checkbox>
                <span className="mac-dictionary-source-moves">
                  <PushButton
                    size="mini"
                    aria-label={`Move ${title} up`}
                    disabled={at === 0}
                    onClick={() => place(id, at - 1)}
                  >
                    Up
                  </PushButton>
                  <PushButton
                    size="mini"
                    aria-label={`Move ${title} down`}
                    disabled={at === sources.order.length - 1}
                    onClick={() => place(id, at + 1)}
                  >
                    Down
                  </PushButton>
                </span>
              </li>
            );
          })}
        </ul>
        <PreferencesWindowForm>
          <PreferencesWindowRow label="Font size:">
            <PopUpButton
              aria-label="Font size"
              size="small"
              value={String(textSize)}
              onValueChange={(value) => setTextSize(Number(value))}
            >
              {TEXT_SIZE_NAMES.map((name, size) => (
                <PopUpButtonItem key={name} value={String(size)}>
                  {name}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
          </PreferencesWindowRow>
          <PreferencesWindowRow label="Pronunciation:">
            <PopUpButton
              aria-label="Pronunciation"
              size="small"
              value={accent}
              onValueChange={(value) => setAccent(value as DictionaryAccent)}
            >
              {ACCENTS.map((each) => (
                <PopUpButtonItem key={each.id} value={each.id}>
                  {each.title}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
          </PreferencesWindowRow>
        </PreferencesWindowForm>
      </PreferencesWindowPane>
    </PreferencesWindow>
  );
}
