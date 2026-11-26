"use client";

import { BorderedList } from "macalicious/bordered-list";
import { Checkbox } from "macalicious/checkbox";
import { EmptyState } from "macalicious/empty-state";
import { HelpButton } from "macalicious/help-button";
import { ImageButton } from "macalicious/image-button";
import { ImageWell } from "macalicious/image-well";
import { Label } from "macalicious/label";
import { OutlineView, type OutlineViewItem } from "macalicious/outline-view";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { ScrollView } from "macalicious/scroll-view";
import { Segment, SegmentedControl } from "macalicious/segmented-control";
import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";
import { type ChangeEvent, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { type DesktopDragItem, useDesktopDrop } from "../../../desktop/desktop-drag";
import {
  childrenOf,
  type DriveEntry,
  entryOf,
  inTrash,
  readFile,
  SPECIAL_FOLDER_IDS,
  uploadFile,
  useDrive,
} from "../../../desktop/desktop-files";
import {
  desktopPictureGeneration,
  isDaytime,
  lastDesktopPicture,
  subscribeDesktopPicture,
} from "../../../desktop/desktop-personal";
import { servedByDesktopApp } from "../../../desktop/desktop-server";
import { PaneAt, PaneFooter, PaneForm } from "../../form";
import { usePreference } from "../../pane";
import { Uncaptured } from "../uncaptured";
import { ColorsIcon, FolderIcon, MinusGlyph, PictureArtwork, PlusGlyph } from "./artwork";
import { DriveFolderSheet } from "./folder-sheet";
import { drivePictures, folderOfSource, libraryPictures } from "./picture-rotation";
import {
  ADDED_FOLDER,
  addedFolder,
  DESKTOP_COLORS,
  DESKTOP_PICTURES,
  DESKTOP_PICTURES_SOURCE,
  type DesktopMode,
  type DesktopPicture,
  DYNAMIC_DESKTOPS,
  folderId,
  INTERVALS,
  MODES,
  PICTURES_FOLDER,
} from "./pictures";
import { previewScreenSaver, SAVER_AFTER_KEY, SAVER_CLOCK_KEY, SAVER_DELAYS } from "./screen-saver";
import {
  chooseBuiltInPicture,
  driveFileOf,
  drivePicture,
  isLatestPictureChoice,
  showDrivePicture,
  takePictureChoice,
} from "./stored-picture";
import "./desktop-and-screen-saver.css";

/** The tab view's top-left corner in the window frame: the strip is centred on the box's edge. */
const TABS = { x: 13, y: 56 };

/** Why the picture-changing settings are dimmed. */
const DYNAMIC_NOTE = "A Dynamic picture changes by itself through the day. Choose a still picture.";
const CHANGE_OFF_NOTE = "Turn on Change picture first.";

interface Source extends OutlineViewItem {
  name: string;
  icon?: "folder" | "colors";
}

/** Whether the browser's clock says day, looked at each minute. */
function useDaytime(watch: boolean): boolean {
  const [day, setDay] = useState(() => isDaytime(new Date()));
  useEffect(() => {
    if (!watch) return;
    const timer = setInterval(() => setDay(isDaytime(new Date())), 60_000);
    return () => clearInterval(timer);
  }, [watch]);
  return day;
}

/**
 * Small pictures of drive files, read one after another while the gallery shows them; their
 * addresses are given back when it closes.
 */
function useDriveThumbnails(ids: readonly string[]): Readonly<Record<string, string>> {
  const [urls, setUrls] = useState<Readonly<Record<string, string>>>({});
  const made = useRef(new Map<string, string>());
  const key = ids.join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is `ids`, by value.
  useEffect(() => {
    const stop = new AbortController();
    void (async () => {
      for (const id of ids) {
        if (stop.signal.aborted) return;
        if (made.current.has(id)) continue;
        try {
          const blob = await readFile(id, { signal: stop.signal });
          const url = URL.createObjectURL(blob);
          made.current.set(id, url);
          setUrls((all) => ({ ...all, [id]: url }));
        } catch {
          // A picture that cannot be read shows its name alone.
        }
      }
    })();
    return () => stop.abort();
  }, [key]);
  useEffect(
    () => () => {
      for (const url of made.current.values()) URL.revokeObjectURL(url);
      made.current.clear();
    },
    [],
  );
  return urls;
}

/** A picture of the drive, at the gallery's size; the picture's name while it is read. */
function DrivePictureArtwork({
  url,
  width = 91,
  height = 60.5,
}: {
  url: string | undefined;
  width?: number;
  height?: number;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ position: "relative", display: "block", width, height, overflow: "hidden" }}
    >
      {url ? (
        <img
          src={url}
          alt=""
          draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : null}
    </span>
  );
}

/** A picture the gallery lists by its file on the person's drive. */
type DriveImage = Pick<DriveEntry, "id" | "name">;

/**
 * The pictures of a folder of the person's drive: on the desktop served by the desktop's Ferrite
 * application, where the drive is the person's own.
 */
function DrivePictureGroup({
  title,
  pictures,
  current,
  onChoose,
}: {
  title: string;
  pictures: readonly DriveImage[];
  current: string;
  onChoose: (entry: DriveImage) => void;
}) {
  const urls = useDriveThumbnails(pictures.map((entry) => entry.id));
  const id = useId();
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset cannot take the label in the band above the pictures as its legend
    <div role="group" aria-labelledby={id}>
      <div className="mac-system-preferences-desktop-and-screen-saver-heading">
        <Label id={id} textStyle="callout">
          {title}
        </Label>
      </div>
      <div className="mac-system-preferences-desktop-and-screen-saver-pictures">
        {pictures.map((entry) => (
          <ImageButton
            key={entry.id}
            aria-label={entry.name}
            aria-current={drivePicture(entry.id) === current ? "true" : undefined}
            onClick={() => onChoose(entry)}
          >
            <DrivePictureArtwork url={urls[entry.id]} />
          </ImageButton>
        ))}
      </div>
    </div>
  );
}

/** A group of the gallery: its heading and its pictures, four to a row. */
function PictureGroup({
  title,
  pictures,
  current,
  onChoose,
}: {
  title: string;
  pictures: readonly DesktopPicture[];
  current: string;
  onChoose: (picture: string) => void;
}) {
  const id = useId();
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset cannot take the label in the band above the pictures as its legend
    <div role="group" aria-labelledby={id}>
      <div className="mac-system-preferences-desktop-and-screen-saver-heading">
        <Label id={id} textStyle="callout">
          {title}
        </Label>
      </div>
      <div className="mac-system-preferences-desktop-and-screen-saver-pictures">
        {pictures.map((picture) => (
          <ImageButton
            key={picture.id}
            aria-label={picture.name}
            // Catalina draws nothing around the desktop's picture; it is only announced.
            aria-current={picture.id === current ? "true" : undefined}
            onClick={() => onChoose(picture.id)}
          >
            <PictureArtwork picture={picture.id} />
          </ImageButton>
        ))}
      </div>
    </div>
  );
}

/**
 * System Preferences > Desktop & Screen Saver: the Desktop tab. A picture of the gallery
 * becomes the desktop picture: its name and its drawing appear beside the preview. A dynamic
 * desktop has a pop-up button for its three looks, and the sentence about the time of day
 * while it is Dynamic. "Change picture" and what follows it are available for a still picture
 * only, as both captures show them disabled under a dynamic one. The source list selects and
 * its groups open and close; only Apple's Desktop Pictures are captured, so every other row
 * says so, and so does the Screen Saver tab.
 *
 * No file is read in the library's demo: the remove button takes the selected folder out of
 * Folders, and the add button, whose panel for choosing a folder is in no screenshot, says so.
 * On the desktop served by the desktop's Ferrite application the person's own pictures are real:
 * Folders > Pictures shows the picture files of their drive's Pictures folder, the add button
 * uploads pictures from the computer into it, the folder button beside it adds any folder of the
 * drive, and Photos lists the Photos library. Dynamic goes by the page's clock, as a page is told
 * no location, and Change picture works (picture-rotation.ts). The choice is kept with the
 * person's settings and shown again when the desktop starts (stored-picture.ts).
 *
 * Distances are those of reference/spec/apps/system-preferences-desktop-and-screen-saver.md,
 * in points from the top-left corner of the window frame.
 */
export function DesktopAndScreenSaver() {
  const [tab, setTab] = usePreference<string>("desktop-and-screen-saver.tab", "desktop");
  const [pictureId, setPictureId] = usePreference<string>(
    "desktop-and-screen-saver.picture",
    "catalina",
  );
  const [mode, setMode] = usePreference<DesktopMode>("desktop-and-screen-saver.mode", "dynamic");
  const [source, setSource] = usePreference<string>(
    "desktop-and-screen-saver.source",
    DESKTOP_PICTURES_SOURCE,
  );
  const [expanded, setExpanded] = usePreference<readonly (string | number)[]>(
    "desktop-and-screen-saver.expanded",
    ["apple"],
  );
  const [folders, setFolders] = usePreference<readonly string[]>(
    "desktop-and-screen-saver.folders",
    [PICTURES_FOLDER],
  );
  const [change, setChange] = usePreference("desktop-and-screen-saver.changePicture", false);
  const [interval, setChangeInterval] = usePreference<string>(
    "desktop-and-screen-saver.interval",
    "Every 30 minutes",
  );
  const [random, setRandom] = usePreference("desktop-and-screen-saver.randomOrder", false);
  const [saverAfter, setSaverAfter] = usePreference<number>(SAVER_AFTER_KEY, 0);
  const [saverClock, setSaverClock] = usePreference(SAVER_CLOCK_KEY, false);
  const id = useId();
  // On the desktop served by Ferrite the person's drive is a real source.
  const served = servedByDesktopApp();
  const drive = useDrive(served);
  const shown = useSyncExternalStore(subscribeDesktopPicture, lastDesktopPicture, () => null);
  const upload = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const daytime = useDaytime(served);
  const [library, setLibrary] = useState<readonly DriveImage[] | "failed" | null>(null);
  const [folderSheet, setFolderSheet] = useState<Element | null>(null);
  useEffect(() => {
    if (!served || source !== "photos") return;
    let current = true;
    libraryPictures().then(
      (pictures) => current && setLibrary(pictures),
      () => current && setLibrary("failed"),
    );
    return () => {
      current = false;
    };
  }, [served, source]);
  // Each of these is an action of the person's: it takes a choice of picture as they act, and the
  // newest choice wins (stored-picture.ts). A desktop that hosts the pane shows the picture.
  const choosePicture = (next: string) => {
    setProblem(null);
    setPictureId(next);
    chooseBuiltInPicture(next, mode);
  };
  const chooseMode = (next: DesktopMode) => {
    setMode(next);
    chooseBuiltInPicture(pictureId, next);
  };
  const chooseDrivePicture = (entry: DriveImage, choice: number = takePictureChoice()) => {
    setProblem(null);
    // Kept as the wallpaper once it has been read and shown, if still the newest choice.
    showDrivePicture(entry.id, choice).catch((error: unknown) =>
      setProblem(`“${entry.name}” could not be shown: ${String(error)}`),
    );
  };
  const addPictures = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.currentTarget.files ?? [])].filter((file) =>
      file.type.startsWith("image/"),
    );
    event.currentTarget.value = "";
    if (files.length === 0) return;
    setBusy(true);
    setProblem(null);
    // Adding pictures is the person's choice of the last one, taken now: it becomes the desktop
    // picture when the upload ends, unless they have chosen another picture since. A session that
    // ends meanwhile was someone else's: its end cancels the upload under way and starts no other.
    const choice = takePictureChoice();
    const generation = desktopPictureGeneration();
    const stop = new AbortController();
    const unsubscribe = subscribeDesktopPicture(() => {
      if (generation !== desktopPictureGeneration()) stop.abort();
    });
    try {
      let last: DriveEntry | undefined;
      for (const file of files) {
        if (stop.signal.aborted) return;
        last = await uploadFile(file, SPECIAL_FOLDER_IDS.Pictures, { signal: stop.signal });
      }
      if (stop.signal.aborted || generation !== desktopPictureGeneration()) return;
      setSource(folderId(PICTURES_FOLDER));
      if (!expanded.includes("folders")) setExpanded([...expanded, "folders"]);
      if (last && isLatestPictureChoice(choice)) chooseDrivePicture(last, choice);
    } catch (error) {
      if (stop.signal.aborted) return;
      setProblem(
        `The picture could not be added: ${error instanceof Error ? error.message : error}`,
      );
    } finally {
      unsubscribe();
      setBusy(false);
    }
  };

  const dynamic = DYNAMIC_DESKTOPS.find((item) => item.id === pictureId);
  const fileId = driveFileOf(pictureId);
  const driveEntry = fileId ? drive?.entries.find((entry) => entry.id === fileId) : undefined;
  const custom = fileId !== undefined;
  const picture = dynamic ??
    DESKTOP_PICTURES.find((item) => item.id === pictureId) ??
    DESKTOP_COLORS.find((item) => item.id === pictureId) ?? {
      id: pictureId,
      name: driveEntry?.name ?? "Picture",
    };
  // What a drop adds to Folders, as macOS adds a folder dragged onto the list; once the drive has
  // loaded, a folder that went to the Trash or was erased is no longer listed.
  const knownFolders = drive
    ? folders.filter((name) => {
        const added = addedFolder(name);
        return added === undefined || (entryOf(drive, added) && !inTrash(drive, added));
      })
    : folders;
  const folderName = (name: string) => {
    const added = addedFolder(name);
    if (added === undefined) return name;
    return drive ? (entryOf(drive, added)?.name ?? "Folder") : "Folder";
  };
  const shownFolder = folderOfSource(source);
  const pictures =
    drive && shownFolder !== undefined ? drivePictures(childrenOf(drive, shownFolder)) : [];

  const addFolders = (names: readonly string[]) => {
    setFolders([...new Set([...folders, ...names])]);
    const last = names.at(-1);
    if (last) setSource(folderId(last));
    setProblem(null);
    if (!expanded.includes("folders")) setExpanded([...expanded, "folders"]);
  };
  const sourcesDrop = useDesktopDrop<HTMLDivElement>({
    enabled: served,
    accepts: (item) => item.kind === "folder",
    onDrop: (items) => addFolders(items.map((item) => `${ADDED_FOLDER}${item.id}`)),
    refusal: () => "Only a folder can be added to this list.",
    sayRefusal: setProblem,
  });
  const wellDrop = useDesktopDrop<HTMLDivElement>({
    enabled: served,
    accepts: (item: DesktopDragItem) =>
      item.kind === "file" && item.type?.startsWith("image/") === true,
    onDrop: (items) => {
      const last = items.at(-1);
      if (last) chooseDrivePicture(last);
    },
    refusal: () => "Only a picture can be the desktop picture.",
    sayRefusal: setProblem,
  });

  const sources: Source[] = [
    {
      id: "apple",
      name: "Apple",
      children: [
        { id: DESKTOP_PICTURES_SOURCE, name: "Desktop Pictures", icon: "folder" },
        { id: "colors", name: "Colors", icon: "colors" },
      ],
    },
    { id: "photos", name: "Photos", children: [] },
    {
      id: "folders",
      name: "Folders",
      children: knownFolders.map((name) => ({
        id: folderId(name),
        name: folderName(name),
        icon: "folder",
      })),
    },
  ];
  const selected = sources
    .flatMap((group) => [group, ...(group.children ?? [])])
    .find((item) => item.id === source);
  const selectedFolder = knownFolders.find((name) => folderId(name) === source);

  return (
    <TabView
      value={tab}
      onValueChange={(value) => setTab(value as string)}
      style={{ position: "absolute", left: TABS.x, top: TABS.y - 38, width: 642, height: 496 }}
    >
      <TabViewList aria-label="Desktop & Screen Saver">
        <TabViewTab value="desktop" style={{ width: 75, padding: 0 }}>
          Desktop
        </TabViewTab>
        <TabViewTab value="screen-saver" style={{ width: 103.5, padding: 0 }}>
          Screen Saver
        </TabViewTab>
      </TabViewList>
      <TabViewPanel value="desktop">
        <PaneForm origin={TABS}>
          <PaneAt x={49.5} y={94}>
            {/* The well shows the picture; the label beside it names it. */}
            <div ref={wellDrop}>
              <ImageWell editable={false} style={{ width: 138, height: 88 }}>
                {custom ? (
                  <DrivePictureArtwork url={shown?.day} width={119} height={74} />
                ) : (
                  <PictureArtwork
                    picture={pictureId}
                    // The picture of the hour while it is Dynamic: the captures were taken at
                    // dusk. A still is shown as the gallery shows it, as captured.
                    look={
                      served
                        ? (mode === "dynamic" ? daytime : mode === "light")
                          ? "day"
                          : "night"
                        : mode === "dynamic"
                          ? "night"
                          : "split"
                    }
                    width={119}
                    height={74}
                  />
                )}
              </ImageWell>
            </div>
          </PaneAt>
          <PaneAt x={204} y={104}>
            <Label id={`${id}-name`}>{picture?.name}</Label>
          </PaneAt>
          {dynamic ? (
            <PaneAt x={204} y={127}>
              <PopUpButton
                aria-label="Appearance of the desktop picture"
                value={mode}
                onValueChange={(value) => value && chooseMode(value)}
                style={{ width: 170 }}
              >
                {MODES.map(([value, title]) => (
                  <PopUpButtonItem key={value} value={value}>
                    {title}
                  </PopUpButtonItem>
                ))}
              </PopUpButton>
            </PaneAt>
          ) : null}
          {dynamic && mode === "dynamic" ? (
            <PaneAt x={204} y={155}>
              <Label textStyle="callout">
                {served
                  ? "This desktop picture changes at 7 in the morning and 7 in the evening, by this computer’s clock."
                  : "This desktop picture changes throughout the day, based on your location."}
              </Label>
            </PaneAt>
          ) : null}

          <PaneAt x={32} y={206}>
            {/* The frame of a bordered list around both columns of the browser. */}
            <BorderedList style={{ width: 604, height: 268 }}>
              <div className="mac-system-preferences-desktop-and-screen-saver-browser">
                <div ref={sourcesDrop} style={{ flex: "none", width: 171, height: 266 }}>
                  <OutlineView
                    aria-label="Picture sources"
                    size="small"
                    rowHeight={20}
                    indentation={9.5}
                    items={sources}
                    getItemLabel={(item) => item.name}
                    renderCell={(item) => (
                      <span className="mac-system-preferences-desktop-and-screen-saver-source">
                        {item.icon === "folder" ? <FolderIcon /> : null}
                        {item.icon === "colors" ? <ColorsIcon /> : null}
                        {item.name}
                      </span>
                    )}
                    expanded={expanded}
                    onExpandedChange={setExpanded}
                    value={[source]}
                    onValueChange={(value) => {
                      const [next] = value;
                      if (next !== undefined) {
                        setProblem(null);
                        setSource(String(next));
                      }
                    }}
                    style={{ width: 171, height: 266 }}
                  />
                </div>
                <div className="mac-system-preferences-desktop-and-screen-saver-gallery">
                  {problem ? (
                    <EmptyState role="alert">
                      <span>{problem}</span>
                      <PushButton onClick={() => setProblem(null)}>OK</PushButton>
                    </EmptyState>
                  ) : source === DESKTOP_PICTURES_SOURCE ? (
                    <ScrollView style={{ width: 430, height: 266 }}>
                      <PictureGroup
                        title="Dynamic Desktop"
                        pictures={DYNAMIC_DESKTOPS}
                        current={pictureId}
                        onChoose={choosePicture}
                      />
                      <PictureGroup
                        title="Desktop Pictures"
                        pictures={DESKTOP_PICTURES}
                        current={pictureId}
                        onChoose={choosePicture}
                      />
                    </ScrollView>
                  ) : source === "colors" ? (
                    <ScrollView style={{ width: 430, height: 266 }}>
                      <PictureGroup
                        title="Colors"
                        pictures={DESKTOP_COLORS}
                        current={pictureId}
                        onChoose={choosePicture}
                      />
                    </ScrollView>
                  ) : served && selectedFolder !== undefined ? (
                    pictures.length > 0 ? (
                      <ScrollView style={{ width: 430, height: 266 }}>
                        <DrivePictureGroup
                          title={selected?.name ?? "Pictures"}
                          pictures={pictures}
                          current={pictureId}
                          onChoose={chooseDrivePicture}
                        />
                      </ScrollView>
                    ) : (
                      <EmptyState>
                        {drive
                          ? selectedFolder === PICTURES_FOLDER
                            ? "Your Pictures folder has no pictures yet. Add one with the + button."
                            : `“${selected?.name}” has no pictures.`
                          : "Reading your Pictures folder…"}
                      </EmptyState>
                    )
                  ) : served && source === "photos" ? (
                    library === null ? (
                      <EmptyState>Reading your Photos library…</EmptyState>
                    ) : library === "failed" ? (
                      <EmptyState>Your Photos library could not be read.</EmptyState>
                    ) : library.length > 0 ? (
                      <ScrollView style={{ width: 430, height: 266 }}>
                        <DrivePictureGroup
                          title="Photos"
                          pictures={library}
                          current={pictureId}
                          onChoose={chooseDrivePicture}
                        />
                      </ScrollView>
                    ) : (
                      <EmptyState>Your Photos library has no pictures yet.</EmptyState>
                    )
                  ) : (
                    <EmptyState>
                      The pictures of {selected?.name ?? "this source"} are not part of this demo.
                    </EmptyState>
                  )}
                </div>
              </div>
            </BorderedList>
          </PaneAt>

          <PaneAt x={32} y={481}>
            <SegmentedControl trackingMode="momentary" distribution="fit" aria-label="Edit folders">
              {served ? (
                // On Ferrite the button adds pictures from the computer to the drive's Pictures.
                <Segment
                  aria-label="Add pictures"
                  disabled={busy}
                  style={{ width: 24, padding: "0 1px 0 0" }}
                  onClick={() => upload.current?.click()}
                >
                  <PlusGlyph />
                </Segment>
              ) : (
                <Uncaptured action="Add a folder">
                  <Segment aria-label="Add a folder" style={{ width: 24, padding: "0 1px 0 0" }}>
                    <PlusGlyph />
                  </Segment>
                </Uncaptured>
              )}
              <Segment
                aria-label="Remove the selected folder"
                disabled={selectedFolder === undefined}
                title={selectedFolder === undefined ? "Select a folder you added." : undefined}
                style={{ width: 24, padding: "0 0 0 1px" }}
                onClick={() => {
                  setFolders(folders.filter((name) => name !== selectedFolder));
                  setSource(DESKTOP_PICTURES_SOURCE);
                }}
              >
                <MinusGlyph />
              </Segment>
              {served ? (
                <Segment
                  aria-label="Add a folder of your drive"
                  title="Add a folder of your drive"
                  style={{ width: 28, padding: 0 }}
                  onClick={(event) => setFolderSheet(event.currentTarget.closest(".mac-window"))}
                >
                  <FolderIcon />
                </Segment>
              ) : null}
            </SegmentedControl>
            {served ? (
              <input
                ref={upload}
                type="file"
                accept="image/*"
                multiple
                hidden
                aria-label="Pictures to add"
                onChange={(event) => void addPictures(event)}
              />
            ) : null}
          </PaneAt>

          <PaneAt x={204} y={485}>
            <Checkbox
              checked={change && !dynamic}
              disabled={dynamic !== undefined}
              title={dynamic !== undefined ? DYNAMIC_NOTE : undefined}
              onCheckedChange={setChange}
            >
              Change picture:
            </Checkbox>
          </PaneAt>
          <PaneAt x={331} y={481}>
            <PopUpButton
              aria-label="Change picture"
              disabled={dynamic !== undefined || !change}
              title={dynamic !== undefined ? DYNAMIC_NOTE : !change ? CHANGE_OFF_NOTE : undefined}
              value={interval}
              onValueChange={(value) => value && setChangeInterval(value)}
              style={{ width: 208 }}
            >
              {INTERVALS.map((title) => (
                <PopUpButtonItem key={title} value={title}>
                  {title}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
          </PaneAt>
          <PaneAt x={204} y={505}>
            <Checkbox
              checked={random && change && !dynamic}
              disabled={dynamic !== undefined || !change}
              title={dynamic !== undefined ? DYNAMIC_NOTE : !change ? CHANGE_OFF_NOTE : undefined}
              onCheckedChange={setRandom}
            >
              Random order
            </Checkbox>
          </PaneAt>

          <PaneFooter x={615} y={508}>
            <Uncaptured action="Help">
              <HelpButton />
            </Uncaptured>
          </PaneFooter>
        </PaneForm>
      </TabViewPanel>
      <TabViewPanel value="screen-saver">
        <PaneForm origin={TABS}>
          <PaneAt x={49.5} y={94}>
            <Label id={`${id}-saver-after`}>Start after:</Label>
          </PaneAt>
          <PaneAt x={134} y={90}>
            <PopUpButton
              aria-labelledby={`${id}-saver-after`}
              value={String(saverAfter)}
              onValueChange={(value) => value && setSaverAfter(Number(value))}
              style={{ width: 140 }}
            >
              {SAVER_DELAYS.map(([minutes, title]) => (
                <PopUpButtonItem key={minutes} value={String(minutes)}>
                  {title}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
          </PaneAt>
          <PaneAt x={49.5} y={124}>
            <Checkbox checked={saverClock} onCheckedChange={setSaverClock}>
              Show with clock
            </Checkbox>
          </PaneAt>
          <PaneAt x={49.5} y={152}>
            <PushButton onClick={previewScreenSaver}>Preview</PushButton>
          </PaneAt>
          <PaneAt x={49.5} y={186}>
            <Label textStyle="callout" color="secondary" style={{ maxWidth: 520 }}>
              A web page sees only its own pointer and keys, so the time counts from your last input
              on this page. There is one screen saver. Hot Corners are in Mission Control&apos;s
              pane.
            </Label>
          </PaneAt>
        </PaneForm>
      </TabViewPanel>
      {folderSheet ? (
        <DriveFolderSheet
          window={folderSheet}
          onCancel={() => setFolderSheet(null)}
          onChoose={(folder) => {
            setFolderSheet(null);
            addFolders([
              folder === SPECIAL_FOLDER_IDS.Pictures ? PICTURES_FOLDER : `${ADDED_FOLDER}${folder}`,
            ]);
          }}
        />
      ) : null}
    </TabView>
  );
}
