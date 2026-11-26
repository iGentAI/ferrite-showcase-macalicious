"use client";

import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { ScrollView } from "macalicious/scroll-view";
import { TextField } from "macalicious/text-field";
import { useId, useState } from "react";
import { faceCrop, faceNamed, type UnnamedFace } from "./photos-faces";
import type { LibraryAlbum, LibraryPhoto, PhotoFace } from "./photos-library";
import type { Memory, Person, ServedSource } from "./photos-served-data";
import {
  albumOf,
  photoCount,
  photosOfSource,
  spanText,
  thumbKey,
  titleOf,
} from "./photos-served-data";

/** The memories of the albums chosen with Show as Memory, by memory id; an empty album makes none. */
export function albumMemoriesOf(
  ids: readonly string[],
  photos: readonly LibraryPhoto[],
  albums: readonly LibraryAlbum[],
  now: number,
): Memory[] {
  return ids.flatMap((id) => {
    const source: ServedSource = `album:${id.slice("album-".length)}`;
    const album = albumOf(source, albums);
    const held = photosOfSource(source, photos, albums, now);
    if (!album || held.length === 0) return [];
    return [
      {
        id,
        title: album.name,
        detail: `${spanText(held)}, ${photoCount(held.length)}`,
        photos: held,
      },
    ];
  });
}

/** A picture in a round tile, drawn so that a face fills it once its size is known. */
export function FaceCrop({
  url,
  face,
  className,
}: {
  url: string | undefined;
  face: PhotoFace;
  className: string;
}) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  return (
    <span className={className}>
      {url ? (
        <img
          src={url}
          alt=""
          draggable={false}
          className="mac-photos-face-image"
          style={size ? faceCrop(face, size.width, size.height) : { visibility: "hidden" as const }}
          onLoad={({ currentTarget }) =>
            setSize({ width: currentTarget.naturalWidth, height: currentTarget.naturalHeight })
          }
        />
      ) : null}
    </span>
  );
}

/** The names to complete a face's name from, for the `list` of the fields that name a face. */
export const FaceNames = ({ id, names }: { id: string; names: readonly string[] }) => (
  <datalist id={id}>
    {names.map((name) => (
      <option key={name} value={name} />
    ))}
  </datalist>
);

/** A field naming a face. Return or leaving it saves, and a name already given keeps its spelling. */
export function FaceNameField({
  label,
  face,
  names,
  list,
  onName,
}: {
  label: string;
  face: PhotoFace;
  names: readonly string[];
  /** The id of a `FaceNames`. */
  list: string;
  onName: (name: string | null) => void;
}) {
  const [text, setText] = useState(face.name ?? "");
  const [shown, setShown] = useState(face.name ?? "");
  if (shown !== (face.name ?? "")) {
    setShown(face.name ?? "");
    setText(face.name ?? "");
  }
  const save = () => {
    const typed = text.trim();
    if (typed === (face.name ?? "")) return;
    const known = names.find((name) => name.toLowerCase() === typed.toLowerCase());
    onName(typed ? (known ?? typed) : null);
  };
  return (
    <TextField
      aria-label={label}
      className="mac-photos-face-name"
      size="small"
      placeholder="Add Name"
      list={list}
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

/** How the People row's words read while faces are looked for, and after. */
export function peopleNote(looking: boolean, unavailable: boolean, left: number) {
  if (unavailable) return "Faces could not be looked for this time. Name people in Info.";
  const here = "Faces are found on this desktop, and no picture leaves it.";
  if (looking) return `Looking for faces, ${photoCount(left)} to go. ${here}`;
  return `${here} Faces are not matched to each other: a person is the faces and photos given their name.`;
}

/**
 * The People row: a round tile per person, cropped to the first face with their name, or else the
 * first photo that names them; under them the faces still to name.
 */
export function PeopleTiles({
  people,
  urls,
  unnamed,
  note,
  onChoose,
  onOpenFace,
  onNameFace,
  onNotAFace,
}: {
  people: readonly Person[];
  /** Thumbnails by `thumbKey`. */
  urls: ReadonlyMap<string, string>;
  unnamed: readonly UnnamedFace[];
  note: string;
  onChoose: (person: Person) => void;
  onOpenFace: (photo: LibraryPhoto) => void;
  onNameFace: (photo: LibraryPhoto, face: PhotoFace, name: string | null) => void;
  onNotAFace: (photo: LibraryPhoto, face: PhotoFace) => void;
}) {
  const list = useId();
  const names = people.map((person) => person.name);
  return (
    <ScrollView className="mac-photos-groups">
      <Label textStyle="small" color="secondary" className="mac-photos-people-note">
        {note}
      </Label>
      <div className="mac-photos-people">
        {people.map((person) => {
          const named = faceNamed(person.name, person.photos);
          const first = person.photos[0];
          const url = first ? urls.get(thumbKey(first)) : undefined;
          return (
            <button
              key={person.name}
              type="button"
              className="mac-photos-person"
              aria-label={`${person.name}, ${photoCount(person.photos.length)}`}
              onClick={() => onChoose(person)}
            >
              {named ? (
                <FaceCrop
                  url={urls.get(thumbKey(named.photo))}
                  face={named.face}
                  className="mac-photos-person-face"
                />
              ) : (
                <span className="mac-photos-person-face">
                  {url ? <img src={url} alt="" draggable={false} /> : null}
                </span>
              )}
              <span className="mac-photos-person-name">{person.name}</span>
              <span className="mac-photos-memory-detail">{person.photos.length}</span>
            </button>
          );
        })}
      </div>
      {unnamed.length > 0 ? (
        <>
          <h2 className="mac-photos-group-title mac-photos-memory-heading">Unnamed Faces</h2>
          <FaceNames id={list} names={names} />
          <div className="mac-photos-people">
            {unnamed.map(({ photo, face }) => (
              <div
                key={`${photo.id}:${face.id}`}
                className="mac-photos-person"
                data-face={`${photo.id}:${face.id}`}
              >
                <button
                  type="button"
                  className="mac-photos-face-open"
                  aria-label={`Open the photo of this face, ${titleOf(photo)}`}
                  onClick={() => onOpenFace(photo)}
                >
                  <FaceCrop
                    url={urls.get(thumbKey(photo))}
                    face={face}
                    className="mac-photos-person-face"
                  />
                </button>
                <FaceNameField
                  label={`Name this face, in ${titleOf(photo)}`}
                  face={face}
                  names={names}
                  list={list}
                  onName={(name) => onNameFace(photo, face, name)}
                />
                <PushButton size="mini" onClick={() => onNotAFace(photo, face)}>
                  Not a Face
                </PushButton>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </ScrollView>
  );
}

/** The Memories row: favourites first under their own heading, a large tile per memory. */
export function MemoryTiles({
  memories,
  favorites,
  urls,
  onChoose,
}: {
  memories: readonly Memory[];
  /** The ids of the memories kept in Favorite Memories. */
  favorites: readonly string[];
  /** Thumbnails by `thumbKey`. */
  urls: ReadonlyMap<string, string>;
  onChoose: (memory: Memory) => void;
}) {
  const tiles = (list: readonly Memory[]) => (
    <div className="mac-photos-memories">
      {list.map((memory) => {
        const first = memory.photos[0];
        const url = first ? urls.get(thumbKey(first)) : undefined;
        return (
          <button
            key={memory.id}
            type="button"
            className="mac-photos-memory"
            data-memory={memory.id}
            aria-label={`${memory.title}, ${memory.detail}`}
            onClick={() => onChoose(memory)}
          >
            {url ? <img src={url} alt="" draggable={false} /> : null}
            <span className="mac-photos-memory-text">
              <span className="mac-photos-memory-title">{memory.title}</span>
              <span className="mac-photos-memory-detail">{memory.detail}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
  const kept = memories.filter((memory) => favorites.includes(memory.id));
  if (kept.length === 0) {
    return <ScrollView className="mac-photos-groups">{tiles(memories)}</ScrollView>;
  }
  return (
    <ScrollView className="mac-photos-groups">
      <h2 className="mac-photos-group-title mac-photos-memory-heading">Favorite Memories</h2>
      {tiles(kept)}
      <h2 className="mac-photos-group-title mac-photos-memory-heading">Memories</h2>
      {tiles(memories.filter((memory) => !favorites.includes(memory.id)))}
    </ScrollView>
  );
}
