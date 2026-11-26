"use client";

import { Checkbox } from "macalicious/checkbox";
import { DefaultButton } from "macalicious/default-button";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { Segment, SegmentedControl } from "macalicious/segmented-control";
import { Sheet, SheetActions, SheetClose, SheetPopup, SheetTitle } from "macalicious/sheet";
import { Slider } from "macalicious/slider";
import { TextField } from "macalicious/text-field";
import { TextView } from "macalicious/text-view";
import { useRef, useState } from "react";
import { EQ_PRESETS } from "./music-audio";
import { formatDuration } from "./music-data";
import { shrinkCover } from "./music-drive";
import { artworkUrl, type LibrarySong, MUSIC_LIMITS } from "./music-server";

/** What Song Info can change: the fields Music keeps for a song. */
export interface SongInfoChange {
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  composer?: string;
  grouping?: string;
  comments?: string;
  sortName?: string;
  sortArtist?: string;
  sortAlbum?: string;
  sortAlbumArtist?: string;
  sortComposer?: string;
  rememberPosition?: boolean;
  year?: number | null;
  track?: number | null;
  start?: number | null;
  stop?: number | null;
  volumeAdjust?: number | null;
  eqPreset?: string;
  skipShuffle?: boolean;
  /** A new cover's bytes, made small, or `null` to take the cover away. */
  cover?: Uint8Array | null;
  /** The song's lyrics, kept beside the library. */
  lyrics?: string;
}

type TextKey =
  | "title"
  | "artist"
  | "album"
  | "genre"
  | "composer"
  | "grouping"
  | "comments"
  | "sortName"
  | "sortArtist"
  | "sortAlbum"
  | "sortAlbumArtist"
  | "sortComposer";
type NumberKey = "year" | "track";
type TimeKey = "start" | "stop";
type FieldKey = TextKey | NumberKey | TimeKey;

const TEXT_FIELDS: readonly { key: TextKey; label: string }[] = [
  { key: "title", label: "Song" },
  { key: "artist", label: "Artist" },
  { key: "album", label: "Album" },
  { key: "genre", label: "Genre" },
  { key: "composer", label: "Composer" },
  { key: "grouping", label: "Grouping" },
  { key: "comments", label: "Comments" },
];
const NUMBER_FIELDS: readonly { key: NumberKey; label: string }[] = [
  { key: "year", label: "Year" },
  { key: "track", label: "Track" },
];
const SORT_FIELDS: readonly { key: TextKey; label: string }[] = [
  { key: "sortName", label: "Sort Name" },
  { key: "sortArtist", label: "Sort Artist" },
  { key: "sortAlbum", label: "Sort Album" },
  { key: "sortAlbumArtist", label: "Sort Album Artist" },
  { key: "sortComposer", label: "Sort Composer" },
];
const TIME_FIELDS: readonly { key: TimeKey; label: string }[] = [
  { key: "start", label: "Start" },
  { key: "stop", label: "Stop" },
];

const ONLY_MUSIC = "Everything in this library is music.";
const NO_PRESET = "None";

/** The value the songs share in a field, or `null` when they differ. */
export function sharedValue<T>(values: readonly T[]): T | null {
  const [first] = values;
  return first !== undefined && values.every((value) => value === first) ? first : null;
}

/** A typed year or track: a whole positive number, or nothing; `undefined` when it is neither. */
export function readWhole(text: string, least = 1): number | null | undefined {
  const typed = text.trim();
  if (typed === "") return null;
  return /^\d{1,4}$/.test(typed) && Number(typed) >= least ? Number(typed) : undefined;
}

/**
 * A typed start or stop time, `1:30` or `90`, in seconds: nothing is `null`, and what is not a time
 * is `undefined`.
 */
export function readTime(text: string): number | null | undefined {
  const typed = text.trim();
  if (typed === "") return null;
  const match = /^(?:(\d{1,4}):)?(\d{1,5}(?:\.\d{1,3})?)$/.exec(typed);
  if (!match) return undefined;
  const seconds = Number(match[2]);
  if (match[1] !== undefined && seconds >= 60) return undefined;
  return Number(match[1] ?? 0) * 60 + seconds;
}

/** A start or stop time as the field shows it. */
const timeText = (seconds: number | null | undefined) => (seconds ? formatDuration(seconds) : "");

/**
 * Song Info (Command-I): one song's Details, Artwork, Lyrics, Options, Sorting and File, or Multiple
 * Item Info for several, where a field the songs differ in stays empty and changes only if something
 * is typed in it.
 */
export function MusicSongInfo({
  songs,
  lyrics,
  anchor,
  onSave,
  onCancel,
}: {
  songs: readonly LibrarySong[];
  /** The lyrics of the one song shown, as far as they are known yet. */
  lyrics?: string;
  anchor: Element | null;
  onSave: (change: SongInfoChange) => void;
  onCancel: () => void;
}) {
  const several = songs.length > 1;
  const [pane, setPane] = useState("details");
  const fieldOf = (song: LibrarySong, key: FieldKey) => {
    if (key === "start" || key === "stop") return timeText(song[key]);
    if (key === "year" || key === "track") return song[key];
    return song[key] ?? "";
  };
  const shown = (key: FieldKey) => {
    const value = sharedValue(songs.map((song) => fieldOf(song, key)));
    return value === null ? "" : String(value);
  };
  const mixed = (key: FieldKey) => new Set(songs.map((song) => fieldOf(song, key))).size > 1;
  const [typed, setTyped] = useState<Partial<Record<FieldKey, string>>>({});
  const [lyricsTyped, setLyricsTyped] = useState<string | null>(null);
  const [volume, setVolume] = useState<number | null>(null);
  const [preset, setPreset] = useState<string | null>(null);
  const [skip, setSkip] = useState<boolean | null>(null);
  const [remember, setRemember] = useState<boolean | null>(null);
  const [cover, setCover] = useState<Uint8Array | null | undefined>(undefined);
  const [coverShown, setCoverShown] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const picking = useRef(0);
  const picker = useRef<HTMLInputElement>(null);
  const first = songs[0];
  if (!first) return null;
  const picture = coverShown ?? (cover === undefined ? artworkUrl(first) : undefined);
  const removable = cover === undefined ? songs.some((song) => song.artwork) : cover !== null;
  const unchanged = (key: FieldKey, text: string | undefined) =>
    text === undefined || (text === shown(key) && !mixed(key));

  const save = () => {
    if (preparing) return;
    const change: SongInfoChange = {};
    for (const { key } of [...TEXT_FIELDS, ...SORT_FIELDS]) {
      const text = typed[key];
      if (text === undefined || unchanged(key, text)) continue;
      const value = text.trim().slice(0, MUSIC_LIMITS.text);
      if (key === "title" && value === "") {
        setProblem("A song needs a name.");
        return;
      }
      change[key] = value;
    }
    for (const { key, label } of NUMBER_FIELDS) {
      const text = typed[key];
      if (text === undefined || unchanged(key, text)) continue;
      const value = readWhole(text, key === "year" ? 1000 : 1);
      if (value === undefined) {
        setProblem(
          key === "year" ? "Year must have four digits." : `${label} must be a whole number.`,
        );
        return;
      }
      change[key] = value;
    }
    for (const { key, label } of TIME_FIELDS) {
      const text = typed[key];
      if (text === undefined || unchanged(key, text)) continue;
      const value = readTime(text);
      if (value === undefined) {
        setProblem(`${label} must be a time, such as 1:30.`);
        return;
      }
      change[key] = value;
    }
    if (cover !== undefined) change.cover = cover;
    if (lyricsTyped !== null && lyricsTyped !== (lyrics ?? "")) change.lyrics = lyricsTyped;
    if (volume !== null) change.volumeAdjust = volume;
    if (preset !== null) change.eqPreset = preset === NO_PRESET ? "" : preset;
    if (skip !== null) change.skipShuffle = skip;
    if (remember !== null) change.rememberPosition = remember;
    onSave(change);
  };

  const choosePicture = async (file: File) => {
    picking.current += 1;
    const pick = picking.current;
    setPreparing(true);
    const small = await file
      .arrayBuffer()
      .then((bytes) => shrinkCover({ data: new Uint8Array(bytes), type: file.type }))
      .catch(() => null);
    if (pick !== picking.current) return;
    setPreparing(false);
    if (!small) {
      setProblem(`“${file.name}” could not be read as a picture.`);
      return;
    }
    setProblem(null);
    setCover(small);
    setCoverShown(
      URL.createObjectURL(new Blob([small as Uint8Array<ArrayBuffer>], { type: "image/jpeg" })),
    );
  };

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <SheetPopup anchor={anchor} width={460}>
        <form
          className="mac-music-song-info"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <SheetTitle>{several ? `${songs.length} Songs` : first.title}</SheetTitle>
          <SegmentedControl
            aria-label="Song Info"
            value={[pane]}
            onValueChange={([next]) => {
              if (next) setPane(next);
            }}
          >
            <Segment value="details">Details</Segment>
            <Segment value="artwork">Artwork</Segment>
            {several ? null : <Segment value="lyrics">Lyrics</Segment>}
            <Segment value="options">Options</Segment>
            <Segment value="sorting">Sorting</Segment>
            <Segment value="file">File</Segment>
          </SegmentedControl>
          {pane === "details" ? (
            <div className="mac-music-song-info-fields">
              {[...TEXT_FIELDS, ...NUMBER_FIELDS]
                .filter(({ key }) => !(several && (key === "title" || key === "track")))
                .map(({ key, label }) => (
                  <div key={key} className="mac-music-song-info-field">
                    <label htmlFor={`music-song-info-${key}`}>{label}</label>
                    <TextField
                      id={`music-song-info-${key}`}
                      value={typed[key] ?? shown(key)}
                      placeholder={mixed(key) ? "Mixed" : undefined}
                      onValueChange={(next) => setTyped((now) => ({ ...now, [key]: next }))}
                    />
                  </div>
                ))}
            </div>
          ) : null}
          {pane === "artwork" ? (
            <div className="mac-music-song-info-artwork">
              {picture ? (
                <img src={picture} alt="The song's artwork" width={160} height={160} />
              ) : (
                <p>No Artwork</p>
              )}
              <input
                ref={picker}
                type="file"
                hidden
                aria-label="Artwork file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void choosePicture(file);
                }}
              />
              <PushButton onClick={() => picker.current?.click()}>Add Artwork…</PushButton>
              <PushButton
                disabled={!removable && !preparing}
                onClick={() => {
                  picking.current += 1;
                  setPreparing(false);
                  setCover(null);
                  setCoverShown(null);
                }}
              >
                Remove Artwork
              </PushButton>
            </div>
          ) : null}
          {pane === "lyrics" ? (
            <TextView
              aria-label="Lyrics"
              className="mac-music-song-info-lyrics"
              maxLength={MUSIC_LIMITS.lyricsChars}
              value={lyricsTyped ?? lyrics ?? ""}
              onValueChange={setLyricsTyped}
            />
          ) : null}
          {pane === "options" ? (
            <div className="mac-music-song-info-fields">
              {TIME_FIELDS.map(({ key, label }) => (
                <div key={key} className="mac-music-song-info-field">
                  <label htmlFor={`music-song-info-${key}`}>{label}</label>
                  <TextField
                    id={`music-song-info-${key}`}
                    value={typed[key] ?? shown(key)}
                    placeholder={mixed(key) ? "Mixed" : "0:00"}
                    onValueChange={(next) => setTyped((now) => ({ ...now, [key]: next }))}
                  />
                </div>
              ))}
              <div className="mac-music-song-info-field">
                <span id="music-song-info-volume">Volume</span>
                <Slider
                  aria-labelledby="music-song-info-volume"
                  min={-100}
                  max={100}
                  step={5}
                  value={volume ?? sharedValue(songs.map((song) => song.volumeAdjust ?? 0)) ?? 0}
                  onValueChange={(next) => setVolume(next as number)}
                />
              </div>
              <div className="mac-music-song-info-field">
                <span id="music-song-info-preset">Equalizer</span>
                <PopUpButton<string>
                  aria-labelledby="music-song-info-preset"
                  value={
                    preset ?? (sharedValue(songs.map((song) => song.eqPreset ?? "")) || NO_PRESET)
                  }
                  onValueChange={(next) => {
                    if (next) setPreset(next);
                  }}
                >
                  <PopUpButtonItem value={NO_PRESET}>{NO_PRESET}</PopUpButtonItem>
                  {Object.keys(EQ_PRESETS).map((name) => (
                    <PopUpButtonItem key={name} value={name}>
                      {name}
                    </PopUpButtonItem>
                  ))}
                </PopUpButton>
              </div>
              <div className="mac-music-song-info-field">
                <span id="music-song-info-kind">Media Kind</span>
                <PopUpButton<string>
                  aria-labelledby="music-song-info-kind"
                  value="music"
                  disabled
                  title={ONLY_MUSIC}
                >
                  <PopUpButtonItem value="music">Music</PopUpButtonItem>
                </PopUpButton>
              </div>
              <div className="mac-music-song-info-field">
                <span />
                <Checkbox
                  checked={skip ?? songs.every((song) => song.skipShuffle === true)}
                  onCheckedChange={setSkip}
                >
                  Skip when shuffling
                </Checkbox>
              </div>
              <div className="mac-music-song-info-field">
                <span />
                <Checkbox
                  checked={remember ?? songs.every((song) => song.rememberPosition === true)}
                  onCheckedChange={setRemember}
                >
                  Remember playback position
                </Checkbox>
              </div>
            </div>
          ) : null}
          {pane === "sorting" ? (
            <div className="mac-music-song-info-fields">
              {SORT_FIELDS.map(({ key, label }) => (
                <div key={key} className="mac-music-song-info-field">
                  <label htmlFor={`music-song-info-${key}`}>{label}</label>
                  <TextField
                    id={`music-song-info-${key}`}
                    value={typed[key] ?? shown(key)}
                    placeholder={mixed(key) ? "Mixed" : undefined}
                    onValueChange={(next) => setTyped((now) => ({ ...now, [key]: next }))}
                  />
                </div>
              ))}
            </div>
          ) : null}
          {pane === "file" ? (
            <dl className="mac-music-song-info-file">
              {several ? (
                <>
                  <dt>Songs</dt>
                  <dd>{songs.length}</dd>
                </>
              ) : (
                <>
                  <dt>Length</dt>
                  <dd>{formatDuration(first.duration)}</dd>
                  <dt>Where</dt>
                  <dd>
                    {first.source.kind === "file"
                      ? `${first.source.name} on your drive`
                      : first.source.kind === "archive"
                        ? `Internet Archive: ${first.source.item}`
                        : first.source.url}
                  </dd>
                  <dt>Added</dt>
                  <dd>{new Date(first.added).toLocaleDateString()}</dd>
                </>
              )}
            </dl>
          ) : null}
          {problem ? <p role="alert">{problem}</p> : null}
          <SheetActions>
            <SheetClose render={<PushButton />}>Cancel</SheetClose>
            <DefaultButton type="submit" disabled={preparing}>
              OK
            </DefaultButton>
          </SheetActions>
        </form>
      </SheetPopup>
    </Sheet>
  );
}
