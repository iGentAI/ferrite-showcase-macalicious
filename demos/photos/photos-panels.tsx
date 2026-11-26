"use client";

import { Checkbox } from "macalicious/checkbox";
import { DefaultButton } from "macalicious/default-button";
import { InspectorPanel } from "macalicious/inspector-panel";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { RoundButton } from "macalicious/round-button";
import { SheetActions, SheetClose, SheetTitle } from "macalicious/sheet";
import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";
import { TextField } from "macalicious/text-field";
import { TokenField } from "macalicious/token-field";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { type ServedPlace, searchPlaces } from "../maps/maps-server";
import { HeartGlyph } from "./photos-artwork";
import { facesToName } from "./photos-faces";
import type {
  LibraryAlbum,
  LibraryPhoto,
  ManagedKeyword,
  PhotoChange,
  PhotoLocation,
  SmartAlbum,
  SmartRule,
} from "./photos-library";
import { FaceCrop, FaceNameField, FaceNames } from "./photos-memories";
import { LocationMap } from "./photos-places";
import {
  dayText,
  exifLines,
  photoCount,
  RULE_FIELDS,
  shownSize,
  sizeText,
  spanText,
  thumbKey,
  timeText,
  titleOf,
} from "./photos-served-data";

/** A date as a `datetime-local` field holds it, in this browser's time zone. */
export function localInput(ms: number): string {
  const date = new Date(ms);
  const two = (n: number) => String(n).padStart(2, "0");
  const year = String(date.getFullYear()).padStart(4, "0");
  return `${year}-${two(date.getMonth() + 1)}-${two(date.getDate())}T${two(date.getHours())}:${two(date.getMinutes())}`;
}

/** "52.0799, 4.3113", or a place's name and that. */
export function placeText(location: PhotoLocation): string {
  const at = `${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}`;
  return location.name ? `${location.name} (${at})` : at;
}

/**
 * "52.08, 4.31 Scheveningen": a latitude and longitude in degrees and an optional name after them;
 * `null` for text that does not start with both.
 */
export function parsePlace(text: string): PhotoLocation | null {
  const match = /^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*(.*)$/.exec(text);
  if (!match) return null;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const name = (match[3] ?? "").trim();
  return name ? { lat, lon, name } : { lat, lon };
}

/**
 * The Location field's search: a typed name asks the same geocoder Maps uses, and each place found
 * is a row to choose. A failure or an empty answer is said in the pane.
 */
function usePlaceSearch() {
  const [found, setFound] = useState<readonly ServedPlace[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const latest = useRef(0);
  const clear = () => {
    latest.current += 1;
    setFound([]);
    setNote(null);
  };
  const search = async (typed: string) => {
    clear();
    const asked = latest.current;
    setNote(`Looking for “${typed}”…`);
    const answer = await searchPlaces(typed);
    if (asked !== latest.current) return;
    if (!answer.ok) {
      setNote(`Places could not be searched: ${answer.message}.`);
      return;
    }
    setFound(answer.value);
    setNote(answer.value.length === 0 ? `No place called “${typed}” was found.` : null);
  };
  return { found, note, clear, search };
}

export interface InfoWindowProps {
  /** The photos it shows: the open one, else the selection. */
  photos: readonly LibraryPhoto[];
  /** What it names when nothing is selected. */
  sourceName: string;
  /** How many photos the pane lists, when nothing is selected. */
  listed: readonly LibraryPhoto[];
  albums: readonly LibraryAlbum[];
  /** Keywords to complete from. */
  keywords: readonly string[];
  /** The names already given, to complete a face's name from. */
  people: readonly string[];
  /** Thumbnails by `thumbKey`. */
  urls: ReadonlyMap<string, string>;
  /** Applies a change to every photo shown. */
  onChange: (change: PhotoChange) => void;
  onAdjustDate: () => void;
  onClose: () => void;
}

/** A field that saves when it is left or Return is pressed, as Info's fields do. */
function SavedField({
  label,
  value,
  placeholder,
  onSave,
}: {
  label: string;
  value: string;
  placeholder: string;
  onSave: (value: string) => void;
}) {
  const [text, setText] = useState(value);
  // What Return saved: leaving the field afterwards, for a place found from it, saves nothing more.
  const saved = useRef<string | null>(null);
  // The selection changed, or another window changed the photo.
  useEffect(() => {
    saved.current = null;
    setText(value);
  }, [value]);
  const save = () => {
    if (text === value || text === saved.current) return;
    saved.current = text;
    onSave(text);
  };
  return (
    <TextField
      aria-label={label}
      className="mac-photos-info-field"
      placeholder={placeholder}
      value={text}
      onValueChange={(next) => setText(String(next))}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          save();
        }
      }}
    />
  );
}

/**
 * Photos' Info window: it floats over the window and follows the selection. The title, caption,
 * keywords and location of what is selected are edited here, for one photo or for several.
 */
export function InfoWindow({
  photos,
  sourceName,
  listed,
  albums,
  keywords,
  people,
  urls,
  onChange,
  onAdjustDate,
  onClose,
}: InfoWindowProps) {
  const one = photos.length === 1 ? photos[0] : undefined;
  const faceNames = useId();
  const many = photos.length > 1;
  const places = usePlaceSearch();
  const shared = (read: (photo: LibraryPhoto) => string) => {
    const first = photos[0];
    if (!first) return "";
    const value = read(first);
    return photos.every((photo) => read(photo) === value) ? value : "";
  };
  const favorite = photos.length > 0 && photos.every((photo) => photo.favorite);
  const wordsOfAll = photos.reduce<string[] | null>(
    (common, photo) =>
      common === null
        ? photo.keywords
        : common.filter((word) => photo.keywords.some((each) => each === word)),
    null,
  );
  const title = one ? titleOf(one) : many ? `${photoCount(photos.length)} Selected` : sourceName;
  const peopleOfAll = photos.reduce<string[] | null>(
    (common, photo) =>
      common === null ? photo.people : common.filter((name) => photo.people.includes(name)),
    null,
  );
  return (
    <InspectorPanel
      title={title}
      className="mac-photos-info-window"
      aria-label="Info"
      width={280}
      onClose={onClose}
    >
      {photos.length === 0 ? (
        <div className="mac-photos-info-body">
          <Label>{photoCount(listed.length)}</Label>
          <Label color="secondary">{spanText(listed)}</Label>
        </div>
      ) : (
        <div className="mac-photos-info-body">
          <SavedField
            key={`title:${photos.map((photo) => photo.id).join()}`}
            label="Title"
            placeholder={many ? "Add a Title to All" : "Add a Title"}
            value={shared((photo) => photo.title ?? "")}
            onSave={(value) => onChange({ title: value })}
          />
          <SavedField
            key={`caption:${photos.map((photo) => photo.id).join()}`}
            label="Caption"
            placeholder={many ? "Add a Caption to All" : "Add a Caption"}
            value={shared((photo) => photo.caption ?? "")}
            onSave={(value) => onChange({ caption: value })}
          />
          <TokenField
            aria-label="Keywords"
            tokensLabel="Keywords"
            className="mac-photos-info-field"
            placeholder="Add Keywords"
            list="mac-photos-keywords"
            value={wordsOfAll ?? []}
            onValueChange={(next) => {
              const before = wordsOfAll ?? [];
              const add = next.filter((word) => !before.includes(word));
              const remove = before.filter((word) => !next.includes(word));
              if (add.length > 0 || remove.length > 0) {
                onChange({ add_keywords: add, remove_keywords: remove });
              }
            }}
          />
          <datalist id="mac-photos-keywords">
            {keywords.map((word) => (
              <option key={word} value={word} />
            ))}
          </datalist>
          <TokenField
            aria-label="People"
            tokensLabel="People"
            className="mac-photos-info-field"
            placeholder="Name People"
            value={peopleOfAll ?? []}
            onValueChange={(next) => {
              const before = peopleOfAll ?? [];
              const add = next.filter((name) => !before.includes(name));
              const remove = before.filter((name) => !next.includes(name));
              if (add.length > 0 || remove.length > 0) {
                onChange({ add_people: add, remove_people: remove });
              }
            }}
          />
          {one && facesToName(one).length > 0 ? (
            <fieldset className="mac-photos-info-faces" aria-label="Faces">
              <FaceNames id={faceNames} names={people} />
              {facesToName(one).map((face) => (
                <div key={face.id} className="mac-photos-info-face" data-face={face.id}>
                  <FaceCrop
                    url={urls.get(thumbKey(one))}
                    face={face}
                    className="mac-photos-info-face-crop"
                  />
                  <FaceNameField
                    label={`Name face ${face.id + 1}`}
                    face={face}
                    names={people}
                    list={faceNames}
                    onName={(name) => onChange({ face: { id: face.id, name } })}
                  />
                  <PushButton
                    size="mini"
                    onClick={() => onChange({ face: { id: face.id, not_a_face: true } })}
                  >
                    Not a Face
                  </PushButton>
                </div>
              ))}
            </fieldset>
          ) : null}
          <PushButton size="small" className="mac-photos-info-date" onClick={onAdjustDate}>
            {one ? `${dayText(one.taken_ms)} at ${timeText(one.taken_ms)}` : spanText(photos)}
          </PushButton>
          <button
            type="button"
            className="mac-photos-info-heart"
            aria-label={favorite ? "Unfavorite" : "Favorite"}
            aria-pressed={favorite}
            onClick={() => onChange({ favorite: !favorite })}
          >
            <HeartGlyph filled={favorite} />
          </button>
          <SavedField
            key={`location:${photos.map((photo) => photo.id).join()}`}
            label="Location"
            placeholder="Assign a Location: a place, or latitude, longitude"
            value={shared((photo) =>
              photo.location
                ? `${photo.location.lat}, ${photo.location.lon}${
                    photo.location.name ? ` ${photo.location.name}` : ""
                  }`
                : "",
            )}
            onSave={(value) => {
              if (!value.trim()) {
                places.clear();
                onChange({ location: null });
              } else {
                const place = parsePlace(value);
                if (place) {
                  places.clear();
                  onChange({ location: place });
                } else void places.search(value.trim());
              }
            }}
          />
          {places.note ? (
            <Label role="status" textStyle="small" color="secondary">
              {places.note}
            </Label>
          ) : null}
          {places.found.length > 0 ? (
            <div className="mac-photos-place-results">
              {places.found.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  className="mac-photos-place-result"
                  onClick={() => {
                    places.clear();
                    onChange({
                      location: {
                        lat: Number(place.lat.toFixed(5)),
                        lon: Number(place.lon.toFixed(5)),
                        name: place.name.slice(0, 200),
                      },
                    });
                  }}
                >
                  {[place.name, ...place.address.slice(0, 1)].join(", ")}
                </button>
              ))}
            </div>
          ) : null}
          {one ? (
            <>
              <LocationMap
                key={one.id}
                location={one.location}
                onPlace={({ lat, lon }) =>
                  onChange({
                    location: { lat: Number(lat.toFixed(5)), lon: Number(lon.toFixed(5)) },
                  })
                }
              />
              <Label textStyle="small" color="secondary">
                Control-click the map to place the photo.
              </Label>
            </>
          ) : null}
          {one ? (
            <>
              <Label textStyle="small" color="secondary">
                {one.name}
              </Label>
              <Label textStyle="small" color="secondary">
                {`${shownSize(one).width} × ${shownSize(one).height}  ${sizeText(one.bytes)}  ${(one.mime.split("/")[1] ?? "").toUpperCase()}`}
              </Label>
              {one.camera ? (
                <Label textStyle="small" color="secondary">
                  {one.camera}
                </Label>
              ) : null}
              {exifLines(one).map((line) => (
                <Label key={line} textStyle="small" color="secondary">
                  {line}
                </Label>
              ))}
              {one.edit ? (
                <Label textStyle="small" color="secondary">
                  Edited
                </Label>
              ) : null}
              <Label textStyle="small" color="secondary">
                {one.source === "photo-booth"
                  ? "Taken in Photo Booth"
                  : `Imported ${dayText(one.added_ms)}`}
              </Label>
              {albums
                .filter((each) => each.photos.includes(one.id))
                .map((each) => (
                  <Label key={each.id} textStyle="small" color="secondary">
                    {`In “${each.name}”`}
                  </Label>
                ))}
            </>
          ) : null}
        </div>
      )}
    </InspectorPanel>
  );
}

export interface KeywordManagerProps {
  managed: readonly ManagedKeyword[];
  /** Every keyword in use, for the list. */
  all: readonly string[];
  /** Whether a photo is selected, so a keyword can be applied. */
  canApply: boolean;
  /** Toggles the keyword on what is selected. */
  onApply: (keyword: string) => void;
  /** Keeps the list. */
  onChange: (keywords: ManagedKeyword[]) => void;
  onClose: () => void;
}

/**
 * The Keyword Manager (Window > Keyword Manager, Command-K): the keywords, a click applying one to
 * the selection, and the keys that apply a keyword, one letter each.
 */
export function KeywordManager({
  managed,
  all,
  canApply,
  onApply,
  onChange,
  onClose,
}: KeywordManagerProps) {
  const [adding, setAdding] = useState("");
  const list = all.map(
    (name) => managed.find((each) => each.name.toLowerCase() === name.toLowerCase()) ?? { name },
  );
  const add = () => {
    const name = adding.trim();
    if (!name) return;
    setAdding("");
    if (!managed.some((each) => each.name.toLowerCase() === name.toLowerCase())) {
      onChange([...managed, { name }]);
    }
  };
  const setKey = (name: string, key: string) => {
    const entries = list.map((each) => {
      if (each.name !== name) {
        // One key names one keyword.
        return key && each.key === key ? { name: each.name } : each;
      }
      return key ? { name, key } : { name };
    });
    onChange(entries);
  };
  return (
    <InspectorPanel
      title="Keywords"
      className="mac-photos-keyword-window"
      aria-label="Keyword Manager"
      width={280}
      onClose={onClose}
    >
      <div className="mac-photos-info-body">
        <ul className="mac-photos-keyword-list" aria-label="Keywords">
          {list.map((each) => (
            <li key={each.name} className="mac-photos-keyword-row">
              <PushButton
                size="small"
                disabled={!canApply}
                className="mac-photos-keyword-name"
                onClick={() => onApply(each.name)}
              >
                {each.name}
              </PushButton>
              <TextField
                aria-label={`Key for ${each.name}`}
                className="mac-photos-keyword-key"
                size="small"
                maxLength={1}
                value={each.key ?? ""}
                onValueChange={(value) => setKey(each.name, String(value).toLowerCase())}
              />
              <RoundButton
                size="small"
                aria-label={`Remove ${each.name}`}
                onClick={() =>
                  onChange(
                    managed.filter((other) => other.name.toLowerCase() !== each.name.toLowerCase()),
                  )
                }
              >
                −
              </RoundButton>
            </li>
          ))}
        </ul>
        <form
          className="mac-photos-name-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            add();
          }}
        >
          <TextField
            aria-label="New Keyword"
            placeholder="New Keyword"
            value={adding}
            onValueChange={(value) => setAdding(String(value))}
          />
          <PushButton type="submit" size="small" disabled={!adding.trim()}>
            Add
          </PushButton>
        </form>
      </div>
    </InspectorPanel>
  );
}

const blankRule = (): SmartRule => ({ field: "favorite", op: "is", value: "favorite" });

export interface SmartAlbumSheetProps {
  /** The smart album edited; a new one otherwise. */
  album: SmartAlbum | null;
  albumNames: readonly string[];
  keywords: readonly string[];
  onDone: (album: Pick<SmartAlbum, "name" | "any" | "rules">) => void;
}

/** Smart Album: a name, whether any or all rules are met, and the rules. */
export function SmartAlbumSheet({ album, albumNames, keywords, onDone }: SmartAlbumSheetProps) {
  const [name, setName] = useState(album?.name ?? "Untitled Smart Album");
  const [any, setAny] = useState(album?.any ?? false);
  const [rules, setRules] = useState<SmartRule[]>(album?.rules ?? [blankRule()]);
  const change = (at: number, next: Partial<SmartRule>) =>
    setRules((all) =>
      all.map((rule, index) => {
        if (index !== at) return rule;
        const merged = { ...rule, ...next };
        const field = RULE_FIELDS.find((each) => each.id === merged.field) ?? RULE_FIELDS[0];
        if (!field) return merged;
        if (next.field) {
          merged.op = field.ops[0]?.id ?? "is";
          merged.value =
            field.values?.[0]?.id ??
            (field.id === "album"
              ? (albumNames[0] ?? "")
              : field.id === "keyword"
                ? (keywords[0] ?? "")
                : "");
        }
        return merged;
      }),
    );
  const valid = name.trim() !== "" && rules.every((rule) => rule.value.trim() !== "");
  return (
    <div className="mac-photos-sheet">
      <SheetTitle>{album ? "Smart Album" : "New Smart Album"}</SheetTitle>
      <div className="mac-photos-sheet-row">
        <Label>Smart Album name:</Label>
        <TextField
          aria-label="Smart Album name"
          autoFocus
          value={name}
          onValueChange={(value) => setName(String(value))}
        />
      </div>
      <div className="mac-photos-sheet-row">
        <Label>Match</Label>
        <PopUpButton<string>
          aria-label="Match"
          value={any ? "any" : "all"}
          onValueChange={(value) => setAny(value === "any")}
        >
          <PopUpButtonItem value="all">all</PopUpButtonItem>
          <PopUpButtonItem value="any">any</PopUpButtonItem>
        </PopUpButton>
        <Label>of the following conditions:</Label>
      </div>
      {rules.map((rule, at) => {
        const field = RULE_FIELDS.find((each) => each.id === rule.field);
        const choices =
          field?.values ??
          (rule.field === "album"
            ? albumNames.map((id) => ({ id, name: id }))
            : rule.field === "keyword"
              ? keywords.map((id) => ({ id, name: id }))
              : undefined);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: a rule has no identity but its place in the list
          <div key={at} className="mac-photos-sheet-row" data-rule={at}>
            <PopUpButton<string>
              aria-label={`Rule ${at + 1} field`}
              value={rule.field}
              onValueChange={(value) => value && change(at, { field: value })}
            >
              {RULE_FIELDS.map((each) => (
                <PopUpButtonItem key={each.id} value={each.id}>
                  {each.name}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
            <PopUpButton<string>
              aria-label={`Rule ${at + 1} comparison`}
              value={rule.op}
              onValueChange={(value) => value && change(at, { op: value })}
            >
              {(field?.ops ?? []).map((each) => (
                <PopUpButtonItem key={each.id} value={each.id}>
                  {each.name}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
            {choices ? (
              <PopUpButton<string>
                aria-label={`Rule ${at + 1} value`}
                value={rule.value}
                onValueChange={(value) => value && change(at, { value })}
              >
                {choices.map((each) => (
                  <PopUpButtonItem key={each.id} value={each.id}>
                    {each.name}
                  </PopUpButtonItem>
                ))}
              </PopUpButton>
            ) : (
              <TextField
                aria-label={`Rule ${at + 1} value`}
                value={rule.value}
                type={rule.field === "date" && rule.op !== "in-last" ? "date" : "text"}
                onValueChange={(value) => change(at, { value: String(value) })}
              />
            )}
            <RoundButton
              size="small"
              aria-label={`Remove rule ${at + 1}`}
              disabled={rules.length === 1}
              onClick={() => setRules((all) => all.filter((_, index) => index !== at))}
            >
              −
            </RoundButton>
            <RoundButton
              size="small"
              aria-label={`Add a rule after ${at + 1}`}
              onClick={() =>
                setRules((all) => [...all.slice(0, at + 1), blankRule(), ...all.slice(at + 1)])
              }
            >
              +
            </RoundButton>
          </div>
        );
      })}
      <SheetActions>
        <SheetClose>Cancel</SheetClose>
        <DefaultButton disabled={!valid} onClick={() => onDone({ name: name.trim(), any, rules })}>
          OK
        </DefaultButton>
      </SheetActions>
    </div>
  );
}

/** Adjust Date and Time: the first photo's date; the others of a selection shift by as much. */
/**
 * Photos' Preferences, floating over its window as Info does: the real panes, General, iCloud and
 * Shared Albums. What the real window offers and a browser cannot is dimmed and says why.
 */
export function PreferencesPanel({
  autoplay,
  onAutoplayChange,
  location = "Originals are files in your drive’s Pictures folder. Other Macs’ libraries can’t be opened here.",
  onShowLibrary,
  onClose,
}: {
  /** Whether a movie starts when opened. Left out, as in the demo with no movies to play, no row. */
  autoplay?: boolean;
  onAutoplayChange?: (next: boolean) => void;
  /** Where the library is kept, in words. */
  location?: string;
  /** Show Finder the library's files. Left out, or with no photo to show, no button. */
  onShowLibrary?: () => void;
  onClose: () => void;
}) {
  const dimmed = (name: string, reason: string, checked = false) => (
    <>
      <Checkbox disabled checked={checked} title={reason}>
        {name}
      </Checkbox>
      <Label textStyle="small" color="secondary">
        {reason}
      </Label>
    </>
  );
  return (
    <InspectorPanel
      title="Preferences"
      className="mac-photos-preferences"
      aria-label="Preferences"
      width={420}
      onClose={onClose}
    >
      <TabView defaultValue="general">
        <TabViewList aria-label="Preferences">
          <TabViewTab value="general">General</TabViewTab>
          <TabViewTab value="icloud">iCloud</TabViewTab>
          <TabViewTab value="shared">Shared Albums</TabViewTab>
        </TabViewList>
        <TabViewPanel value="general">
          <div className="mac-photos-info-body">
            <Label>Library Location</Label>
            <Label color="secondary">{location}</Label>
            {onShowLibrary ? (
              <span>
                <PushButton size="small" onClick={onShowLibrary}>
                  Show in Finder
                </PushButton>
              </span>
            ) : null}
            {dimmed(
              "Use as System Photo Library",
              "This desktop keeps one library for each person, so there is no other to choose.",
              true,
            )}
            {dimmed(
              "Copy items to the Photos library",
              "An import always uploads a copy to your drive; a file can’t stay referenced elsewhere from a browser.",
              true,
            )}
            {onAutoplayChange ? (
              <>
                <Checkbox
                  checked={autoplay}
                  onCheckedChange={(next) => onAutoplayChange(next === true)}
                >
                  Autoplay Videos
                </Checkbox>
                <Label color="secondary">A movie starts playing when you open it.</Label>
              </>
            ) : null}
            {dimmed(
              "Summarize Photos",
              "Days shows every photo: this desktop analyses no picture to choose the best.",
            )}
            {dimmed(
              "Show Holiday Events",
              "Memories come from dates and places only: this desktop has no holiday calendar for them.",
            )}
          </div>
        </TabViewPanel>
        <TabViewPanel value="icloud">
          <div className="mac-photos-info-body">
            {dimmed(
              "iCloud Photos",
              "This desktop has no iCloud, so a library stays on its server.",
            )}
          </div>
        </TabViewPanel>
        <TabViewPanel value="shared">
          <div className="mac-photos-info-body">
            {dimmed(
              "Shared Albums",
              "This desktop has no iCloud to share albums through. Share sends a photo instead.",
            )}
          </div>
        </TabViewPanel>
      </TabView>
    </InspectorPanel>
  );
}

/** What Import shows before anything is added. A file the library already holds starts unchosen. */
export function ImportReviewSheet({
  files,
  held,
  onDone,
}: {
  files: readonly File[];
  /** Whether the library already holds this file. */
  held: (file: File) => boolean;
  onDone: (files: readonly File[]) => void;
}) {
  const [chosen, setChosen] = useState<ReadonlySet<File>>(
    () => new Set(files.filter((file) => !held(file))),
  );
  const [urls, setUrls] = useState<ReadonlyMap<File, string>>(new Map());
  useEffect(() => {
    const made = new Map(
      files
        .filter((file) => file.type.startsWith("image/"))
        .map((file) => [file, URL.createObjectURL(file)] as const),
    );
    setUrls(made);
    return () => {
      for (const url of made.values()) URL.revokeObjectURL(url);
    };
  }, [files]);
  const fresh = files.filter((file) => !held(file));
  const toggle = (file: File) =>
    setChosen((old) => {
      const next = new Set(old);
      if (!next.delete(file)) next.add(file);
      return next;
    });
  return (
    <div className="mac-photos-sheet">
      <SheetTitle>Import</SheetTitle>
      <Label color="secondary">
        {`${photoCount(files.length)}${
          fresh.length < files.length
            ? `, ${files.length - fresh.length} already in the library`
            : ""
        }`}
      </Label>
      <div className="mac-photos-import-grid">
        {files.map((file) => {
          const url = urls.get(file);
          return (
            <button
              key={`${file.name}:${file.size}:${file.lastModified}`}
              type="button"
              className="mac-photos-import-item"
              aria-pressed={chosen.has(file)}
              data-held={held(file) ? "" : undefined}
              title={held(file) ? "Already in the library" : undefined}
              onClick={() => toggle(file)}
            >
              {url ? <img src={url} alt="" draggable={false} /> : null}
              <span className="mac-photos-import-name">{file.name}</span>
            </button>
          );
        })}
      </div>
      <SheetActions>
        <SheetClose render={<PushButton />}>Cancel</SheetClose>
        <PushButton disabled={chosen.size === 0} onClick={() => onDone([...chosen])}>
          {`Import ${chosen.size} Selected`}
        </PushButton>
        <DefaultButton disabled={fresh.length === 0} onClick={() => onDone(fresh)}>
          Import All New Items
        </DefaultButton>
      </SheetActions>
    </div>
  );
}

export function AdjustDateSheet({
  photo,
  count,
  onDone,
}: {
  photo: LibraryPhoto;
  count: number;
  onDone: (takenMs: number) => void;
}) {
  const [text, setText] = useState(() => localInput(photo.taken_ms));
  const when = Date.parse(text);
  return (
    <div className="mac-photos-sheet">
      <SheetTitle>Adjust Date and Time</SheetTitle>
      <div className="mac-photos-sheet-row">
        <Label>Adjusted:</Label>
        <TextField
          aria-label="Adjusted"
          type="datetime-local"
          value={text}
          onValueChange={(value) => setText(String(value))}
        />
      </div>
      {count > 1 ? (
        <Label color="secondary">{`The other ${count - 1} photos move by the same amount.`}</Label>
      ) : null}
      <SheetActions>
        <SheetClose>Cancel</SheetClose>
        <DefaultButton disabled={!Number.isFinite(when)} onClick={() => onDone(when)}>
          Adjust
        </DefaultButton>
      </SheetActions>
    </div>
  );
}

/** What File > Export asks. */
export interface ExportChoice {
  kind: "edited" | "original";
  format: "jpeg" | "png";
  /** The longer side, in pixels, or 0 for full size. */
  side: number;
  /** Where it goes: a folder of the drive, `"download"`, or `"other"` for the Save dialog. */
  to: string;
  /** Whether a photo's title is its file's name. */
  useTitle: boolean;
}

export const EXPORT_PLACES = [
  { id: "download", name: "Downloads (this computer)" },
  { id: "Desktop", name: "Desktop" },
  { id: "Documents", name: "Documents" },
  { id: "Pictures", name: "Pictures" },
  { id: "other", name: "Other…" },
] as const;

/** File > Export: the kind of picture, its size and where it goes. */
export function ExportSheet({
  count,
  kind,
  onDone,
}: {
  count: number;
  kind: ExportChoice["kind"];
  onDone: (choice: ExportChoice) => void;
}) {
  const [format, setFormat] = useState<ExportChoice["format"]>("jpeg");
  const [side, setSide] = useState("0");
  const [to, setTo] = useState("download");
  const [useTitle, setUseTitle] = useState(true);
  return (
    <div className="mac-photos-sheet">
      <SheetTitle>
        {kind === "original"
          ? `Export Unmodified Original for ${photoCount(count)}`
          : `Export ${photoCount(count)}`}
      </SheetTitle>
      {kind === "edited" ? (
        <>
          <div className="mac-photos-sheet-row">
            <Label>Photo Kind:</Label>
            <PopUpButton<string>
              aria-label="Photo Kind"
              value={format}
              onValueChange={(value) => setFormat(value === "png" ? "png" : "jpeg")}
            >
              <PopUpButtonItem value="jpeg">JPEG</PopUpButtonItem>
              <PopUpButtonItem value="png">PNG</PopUpButtonItem>
            </PopUpButton>
          </div>
          <div className="mac-photos-sheet-row">
            <Label>Size:</Label>
            <PopUpButton<string>
              aria-label="Size"
              value={side}
              onValueChange={(value) => value && setSide(value)}
            >
              <PopUpButtonItem value="0">Full Size</PopUpButtonItem>
              <PopUpButtonItem value="2048">Large</PopUpButtonItem>
              <PopUpButtonItem value="1280">Medium</PopUpButtonItem>
              <PopUpButtonItem value="640">Small</PopUpButtonItem>
            </PopUpButton>
          </div>
        </>
      ) : null}
      <div className="mac-photos-sheet-row">
        <Label>Save To:</Label>
        <PopUpButton<string>
          aria-label="Save To"
          value={to}
          onValueChange={(value) => value && setTo(value)}
        >
          {EXPORT_PLACES.map((each) => (
            <PopUpButtonItem key={each.id} value={each.id}>
              {each.name}
            </PopUpButtonItem>
          ))}
        </PopUpButton>
      </div>
      <Checkbox checked={useTitle} onCheckedChange={(next) => setUseTitle(next === true)}>
        Use the title as the file name
      </Checkbox>
      <SheetActions>
        <SheetClose>Cancel</SheetClose>
        <DefaultButton onClick={() => onDone({ kind, format, side: Number(side), to, useTitle })}>
          Export
        </DefaultButton>
      </SheetActions>
    </div>
  );
}

/** A name asked for in a sheet: a folder's, a smart album's, or a row's new name. */
export function NameSheet({
  title,
  action,
  initial,
  onDone,
}: {
  title: string;
  action: string;
  initial: string;
  onDone: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  return (
    <form
      className="mac-photos-sheet"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) onDone(name.trim());
      }}
    >
      <SheetTitle>{title}</SheetTitle>
      <TextField
        aria-label="Name"
        autoFocus
        value={name}
        onValueChange={(value) => setName(String(value))}
      />
      <SheetActions>
        <SheetClose>Cancel</SheetClose>
        <DefaultButton type="submit" disabled={!name.trim()}>
          {action}
        </DefaultButton>
      </SheetActions>
    </form>
  );
}
