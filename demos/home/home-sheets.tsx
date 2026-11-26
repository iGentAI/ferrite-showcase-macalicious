"use client";

import { Checkbox } from "macalicious/checkbox";
import { ColorWell } from "macalicious/color-well";
import { DefaultButton } from "macalicious/default-button";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { SheetActions, SheetClose, SheetDescription, SheetTitle } from "macalicious/sheet";
import { Slider } from "macalicious/slider";
import { TextField } from "macalicious/text-field";
import { type ReactNode, useId, useState } from "react";
import {
  type HomeAccessory,
  type HomeAccessoryKind,
  type HomeAutomation,
  type HomeDefinition,
  type HomeScene,
  type HomeTrigger,
  type HomeWallpaper,
  isLight,
  WALLPAPERS,
} from "./home-data";

/** The longest name the desktop's Home module keeps. */
const MAX_NAME_LENGTH = 100;

/** Why no one can be invited to a home. */
export const NO_SHARING =
  "Sharing a home needs HomeKit and another person's Apple ID. This desktop has neither, so no one can be invited.";

const KIND_TITLES: readonly { value: HomeAccessoryKind; title: string }[] = [
  { value: "light", title: "Light" },
  { value: "outlet", title: "Outlet" },
  { value: "speaker", title: "Speaker" },
  { value: "tv", title: "Television" },
  { value: "garage-door", title: "Garage Door" },
  { value: "blinds", title: "Blinds" },
  { value: "sensor", title: "Sensor" },
];

/** One labelled control of a sheet. */
function Row({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <>
      <Label id={id} align="end">
        {label}
      </Label>
      {children}
    </>
  );
}

function NameField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <TextField
      aria-labelledby={id}
      maxLength={MAX_NAME_LENGTH}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  );
}

function Choice<T extends string>({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: T;
  options: readonly { value: T; title: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <PopUpButton
      aria-labelledby={id}
      value={value}
      onValueChange={(next) => {
        const chosen = options.find((option) => option.value === next);
        if (chosen) onChange(chosen.value);
      }}
    >
      {options.map((option) => (
        <PopUpButtonItem key={option.value} value={option.value}>
          {option.title}
        </PopUpButtonItem>
      ))}
    </PopUpButton>
  );
}

function Actions({
  action = "Done",
  disabled,
  onDone,
  onRemove,
  removeTitle,
  removeWhy,
}: {
  action?: string;
  disabled?: boolean;
  onDone: () => void;
  /** Asks to remove what the sheet shows. */
  onRemove?: () => void;
  removeTitle?: string;
  /** Why it cannot be removed, when it cannot. */
  removeWhy?: string;
}) {
  return (
    <SheetActions>
      {removeTitle ? (
        <PushButton
          className="mac-home-remove"
          disabled={removeWhy !== undefined}
          title={removeWhy}
          onClick={onRemove}
        >
          {removeTitle}
        </PushButton>
      ) : null}
      <SheetClose>Cancel</SheetClose>
      <SheetClose render={<DefaultButton />} disabled={disabled} onClick={onDone}>
        {action}
      </SheetClose>
    </SheetActions>
  );
}

/** What the add sheet asks for. */
export interface Addition {
  name: string;
  room: string;
  /** For an accessory: what it is. */
  kind: HomeAccessoryKind;
  /** For a scene: whether it turns the room's lights on or off. */
  on: boolean;
  /** For a scene: what it does to other accessories of the home, over what `room` and `on` say. */
  sets: Readonly<Record<string, boolean>>;
}

export interface AddFormProps {
  kind: "accessory" | "scene";
  /** The rooms to choose from. */
  rooms: readonly string[];
  /** The room chosen at first, if it is among them. */
  room: string;
  /** For a scene: the accessories it can set. */
  accessories?: readonly HomeAccessory[];
  /** Whether the desktop's server keeps the home: it then says plainly nothing is found. */
  served: boolean;
  onAdd: (addition: Addition) => void;
}

/** The content of the add sheet. It is mounted while the sheet is open, so it starts empty. */
export function AddForm({
  kind,
  rooms,
  room: shownRoom,
  accessories = [],
  served,
  onAdd,
}: AddFormProps) {
  const scene = kind === "scene";
  const id = useId();
  const [name, setName] = useState("");
  const [room, setRoom] = useState(rooms.includes(shownRoom) ? shownRoom : (rooms[0] ?? ""));
  const [lights, setLights] = useState<"on" | "off">("on");
  const [sets, setSets] = useState<Readonly<Record<string, boolean>>>({});
  const [accessoryKind, setAccessoryKind] = useState<HomeAccessoryKind>("light");
  return (
    <>
      <SheetTitle>{scene ? "Add Scene" : "Add Accessory"}</SheetTitle>
      <SheetDescription>
        {scene
          ? "The scene sets a room's lights and any other accessories you choose. It joins the favorite scenes."
          : served
            ? "Home found no accessories: a web page has no HomeKit and cannot look for any. You can add a simulated one, which switches nothing in the world."
            : "Home would look for an accessory to set up. The demo adds a light to the room you choose, as a favorite."}
      </SheetDescription>
      <div className="mac-home-form">
        <Row label="Name:" id={`${id}name`}>
          <NameField id={`${id}name`} value={name} onChange={setName} />
        </Row>
        <Row label="Room:" id={`${id}room`}>
          <Choice
            id={`${id}room`}
            value={room}
            options={[
              ...(scene ? [{ value: "", title: "No Room" }] : []),
              ...rooms.map((value) => ({ value, title: value })),
            ]}
            onChange={setRoom}
          />
        </Row>
        {scene ? (
          <Row label="Lights:" id={`${id}lights`}>
            <Choice
              id={`${id}lights`}
              value={lights}
              options={[
                { value: "on", title: "On" },
                { value: "off", title: "Off" },
              ]}
              onChange={setLights}
            />
          </Row>
        ) : served ? (
          <Row label="Kind:" id={`${id}kind`}>
            <Choice
              id={`${id}kind`}
              value={accessoryKind}
              options={KIND_TITLES}
              onChange={setAccessoryKind}
            />
          </Row>
        ) : null}
      </div>
      {scene ? (
        <SceneSets accessories={accessories} sets={sets} onChange={setSets} idBase={`${id}set`} />
      ) : null}
      <Actions
        action="Add"
        disabled={
          name.trim() === "" ||
          (scene ? room === "" && Object.keys(sets).length === 0 : room === "")
        }
        onDone={() =>
          onAdd({ name: name.trim(), room, kind: accessoryKind, on: lights === "on", sets })
        }
      />
    </>
  );
}

/** A sheet that asks for one name: New Room, New Home. */
export function NameForm({
  title,
  description,
  taken = [],
  onDone,
}: {
  title: string;
  description: string;
  /** Names it may not have. */
  taken?: readonly string[];
  onDone: (name: string) => void;
}) {
  const id = useId();
  const [name, setName] = useState("");
  const clean = name.trim();
  return (
    <>
      <SheetTitle>{title}</SheetTitle>
      <SheetDescription>{description}</SheetDescription>
      <div className="mac-home-form">
        <Row label="Name:" id={id}>
          <NameField id={id} value={name} onChange={setName} />
        </Row>
      </div>
      <Actions
        action="Add"
        disabled={clean === "" || taken.includes(clean)}
        onDone={() => onDone(clean)}
      />
    </>
  );
}

/** Home Settings: the home's name, its wallpaper, who shares it, and removing it. */
export function HomeSettingsForm({
  home,
  only,
  onDone,
  onRemove,
}: {
  home: HomeDefinition;
  /** Whether it is the only home, which cannot go. */
  only: boolean;
  onDone: (name: string, wallpaper: HomeWallpaper) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(home.name);
  const [wallpaper, setWallpaper] = useState<HomeWallpaper>(home.wallpaper ?? "lagoon");
  return (
    <>
      <SheetTitle>Home Settings</SheetTitle>
      <SheetDescription>
        {home.accessories.length} simulated{" "}
        {home.accessories.length === 1 ? "accessory" : "accessories"}. None of them is a real
        device.
      </SheetDescription>
      <div className="mac-home-form">
        <Row label="Name:" id={`${id}name`}>
          <NameField id={`${id}name`} value={name} onChange={setName} />
        </Row>
        <Row label="Wallpaper:" id={`${id}wallpaper`}>
          <Choice
            id={`${id}wallpaper`}
            value={wallpaper}
            options={WALLPAPERS.map((each) => ({ value: each.id, title: each.title }))}
            onChange={setWallpaper}
          />
        </Row>
        <Row label="People:" id={`${id}people`}>
          <PushButton aria-labelledby={`${id}people`} disabled title={NO_SHARING}>
            Invite…
          </PushButton>
        </Row>
      </div>
      <p className="mac-home-reason">{NO_SHARING}</p>
      <Actions
        disabled={name.trim() === ""}
        onDone={() => onDone(name.trim(), wallpaper)}
        onRemove={onRemove}
        removeTitle="Remove Home…"
        removeWhy={only ? "This is the only home." : undefined}
      />
    </>
  );
}

/** Room Settings: the room's name, and removing it. */
export function RoomSettingsForm({
  room,
  rooms,
  onDone,
  onRemove,
}: {
  room: string;
  rooms: readonly string[];
  onDone: (name: string) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(room);
  const clean = name.trim();
  return (
    <>
      <SheetTitle>Room Settings</SheetTitle>
      <div className="mac-home-form">
        <Row label="Name:" id={id}>
          <NameField id={id} value={name} onChange={setName} />
        </Row>
      </div>
      <Actions
        disabled={clean === "" || (clean !== room && rooms.includes(clean))}
        onDone={() => onDone(clean)}
        onRemove={onRemove}
        removeTitle="Remove Room…"
        removeWhy={rooms.length < 2 ? "A home keeps at least one room." : undefined}
      />
    </>
  );
}

/** The colour a light has until the person gives it another. */
const WARM_WHITE = "#ffe9c4";

/** An accessory's settings and detail: name, room, favorite, brightness, colour, position, and removing it. */
export function AccessoryForm({
  accessory,
  rooms,
  onDone,
  onRemove,
}: {
  accessory: HomeAccessory;
  rooms: readonly string[];
  onDone: (changes: Partial<HomeAccessory>) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(accessory.name);
  const [room, setRoom] = useState(accessory.room);
  const [favorite, setFavorite] = useState(accessory.favorite === true);
  const [brightness, setBrightness] = useState(accessory.brightness ?? 100);
  const [color, setColor] = useState(accessory.color ?? WARM_WHITE);
  const [position, setPosition] = useState(accessory.on ? (accessory.position ?? 100) : 0);
  const light = isLight(accessory);
  const blinds = accessory.kind === "blinds";
  return (
    <>
      <SheetTitle>{accessory.name} Settings</SheetTitle>
      <SheetDescription>A simulated accessory: it switches nothing in the world.</SheetDescription>
      <div className="mac-home-form">
        <Row label="Name:" id={`${id}name`}>
          <NameField id={`${id}name`} value={name} onChange={setName} />
        </Row>
        <Row label="Room:" id={`${id}room`}>
          <Choice
            id={`${id}room`}
            value={room}
            options={rooms.map((value) => ({ value, title: value }))}
            onChange={setRoom}
          />
        </Row>
        {light ? (
          <Row label="Brightness:" id={`${id}brightness`}>
            <Slider
              aria-labelledby={`${id}brightness`}
              min={1}
              max={100}
              value={brightness}
              onValueChange={(value) => {
                if (typeof value === "number") setBrightness(value);
              }}
            />
          </Row>
        ) : null}
        {light ? (
          <Row label="Color:" id={`${id}color`}>
            <ColorWell aria-labelledby={`${id}color`} value={color} onValueChange={setColor} />
          </Row>
        ) : null}
        {blinds ? (
          <Row label="Position:" id={`${id}position`}>
            <Slider
              aria-labelledby={`${id}position`}
              min={0}
              max={100}
              value={position}
              onValueChange={(value) => {
                if (typeof value === "number") setPosition(value);
              }}
            />
          </Row>
        ) : null}
        <span />
        <Checkbox checked={favorite} onCheckedChange={setFavorite}>
          Include in Favorites
        </Checkbox>
      </div>
      <Actions
        disabled={name.trim() === ""}
        onDone={() =>
          onDone({
            name: name.trim(),
            room,
            favorite,
            ...(light ? { brightness, color } : {}),
            ...(blinds ? { on: position > 0, ...(position > 0 ? { position } : {}) } : {}),
          })
        }
        onRemove={onRemove}
        removeTitle="Remove Accessory…"
      />
    </>
  );
}

/** What a scene does to each accessory that switches: leave it, turn it on, or turn it off. */
function SceneSets({
  accessories,
  sets,
  onChange,
  idBase,
}: {
  accessories: readonly HomeAccessory[];
  sets: Readonly<Record<string, boolean>>;
  onChange: (sets: Readonly<Record<string, boolean>>) => void;
  idBase: string;
}) {
  return (
    <div className="mac-home-sets">
      {accessories
        .filter((accessory) => accessory.kind !== "sensor")
        .map((accessory) => {
          const set = sets[accessory.id];
          return (
            <div key={accessory.id} className="mac-home-form">
              <Row label={`${accessory.room} ${accessory.name}:`} id={`${idBase}${accessory.id}`}>
                <Choice
                  id={`${idBase}${accessory.id}`}
                  value={set === undefined ? "leave" : set ? "on" : "off"}
                  options={[
                    { value: "leave", title: "Leave As It Is" },
                    { value: "on", title: "On" },
                    { value: "off", title: "Off" },
                  ]}
                  onChange={(value) => {
                    const { [accessory.id]: _gone, ...rest } = sets;
                    onChange(
                      value === "leave" ? rest : { ...rest, [accessory.id]: value === "on" },
                    );
                  }}
                />
              </Row>
            </div>
          );
        })}
    </div>
  );
}

/** A scene's editor: its name and what it does to each accessory of the home. */
export function SceneForm({
  scene,
  accessories,
  onDone,
  onRemove,
}: {
  scene: HomeScene;
  accessories: readonly HomeAccessory[];
  onDone: (changes: Pick<HomeScene, "name" | "sets">) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(scene.name);
  const [sets, setSets] = useState<Readonly<Record<string, boolean>>>(scene.sets);
  return (
    <>
      <SheetTitle>Edit Scene</SheetTitle>
      <div className="mac-home-form">
        <Row label="Name:" id={`${id}name`}>
          <NameField id={`${id}name`} value={name} onChange={setName} />
        </Row>
      </div>
      <SceneSets accessories={accessories} sets={sets} onChange={setSets} idBase={id} />
      <Actions
        disabled={name.trim() === ""}
        onDone={() => onDone({ name: name.trim(), sets })}
        onRemove={onRemove}
        removeTitle="Remove Scene…"
      />
    </>
  );
}

const nowAsTime = () => {
  const now = new Date();
  const two = (value: number) => String(value).padStart(2, "0");
  return `${two(now.getHours())}:${two(now.getMinutes())}`;
};

/** An automation's editor: when, and which scene. Location triggers are left out. */
export function AutomationForm({
  automation,
  home,
  onDone,
  onRemove,
}: {
  /** The one being edited; a new one when absent. */
  automation?: HomeAutomation;
  home: HomeDefinition;
  onDone: (changes: Pick<HomeAutomation, "name" | "trigger" | "scene" | "enabled">) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const trigger = automation?.trigger;
  const watchable = home.accessories.filter((accessory) => accessory.kind !== "sensor");
  const [name, setName] = useState(automation?.name ?? "");
  const [kind, setKind] = useState<HomeTrigger["kind"]>(trigger?.kind ?? "time");
  const [at, setAt] = useState(trigger?.kind === "time" ? trigger.at : nowAsTime());
  const [accessory, setAccessory] = useState(
    trigger?.kind === "accessory" ? trigger.accessory : (watchable[0]?.id ?? ""),
  );
  const [turns, setTurns] = useState<"on" | "off">(
    trigger?.kind === "accessory" && !trigger.on ? "off" : "on",
  );
  const [scene, setScene] = useState(automation?.scene ?? home.scenes[0]?.id ?? "");
  const [enabled, setEnabled] = useState(automation?.enabled ?? true);
  const complete =
    name.trim() !== "" &&
    scene !== "" &&
    (kind === "time" ? /^\d\d:\d\d$/.test(at) : accessory !== "");
  return (
    <>
      <SheetTitle>{automation ? "Edit Automation" : "Add Automation"}</SheetTitle>
      <SheetDescription>
        It runs while this Home window is open: there is no home hub to run it otherwise. It changes
        simulated accessories only.
      </SheetDescription>
      <div className="mac-home-form">
        <Row label="Name:" id={`${id}name`}>
          <NameField id={`${id}name`} value={name} onChange={setName} />
        </Row>
        <Row label="When:" id={`${id}kind`}>
          <Choice
            id={`${id}kind`}
            value={kind}
            options={[
              { value: "time", title: "A Time of Day Occurs" },
              { value: "accessory", title: "An Accessory Is Controlled" },
            ]}
            onChange={setKind}
          />
        </Row>
        {kind === "time" ? (
          <Row label="Time:" id={`${id}at`}>
            <TextField
              aria-labelledby={`${id}at`}
              type="time"
              value={at}
              onChange={(event) => setAt(event.currentTarget.value)}
            />
          </Row>
        ) : (
          <>
            <Row label="Accessory:" id={`${id}accessory`}>
              <Choice
                id={`${id}accessory`}
                value={accessory}
                options={watchable.map((each) => ({
                  value: each.id,
                  title: `${each.room} ${each.name}`,
                }))}
                onChange={setAccessory}
              />
            </Row>
            <Row label="Turns:" id={`${id}turns`}>
              <Choice
                id={`${id}turns`}
                value={turns}
                options={[
                  { value: "on", title: "On" },
                  { value: "off", title: "Off" },
                ]}
                onChange={setTurns}
              />
            </Row>
          </>
        )}
        <Row label="Run Scene:" id={`${id}scene`}>
          <Choice
            id={`${id}scene`}
            value={scene}
            options={home.scenes.map((each) => ({ value: each.id, title: each.name }))}
            onChange={setScene}
          />
        </Row>
        <span />
        <Checkbox checked={enabled} onCheckedChange={setEnabled}>
          Enable This Automation
        </Checkbox>
      </div>
      <Actions
        disabled={!complete}
        onDone={() =>
          onDone({
            name: name.trim(),
            trigger:
              kind === "time"
                ? { kind: "time", at }
                : { kind: "accessory", accessory, on: turns === "on" },
            scene,
            enabled,
          })
        }
        onRemove={onRemove}
        removeTitle={automation ? "Remove Automation…" : undefined}
      />
    </>
  );
}

/** Asks before something goes. */
export function ConfirmForm({
  title,
  text,
  onConfirm,
}: {
  title: string;
  text: string;
  onConfirm: () => void;
}) {
  return (
    <>
      <SheetTitle>{title}</SheetTitle>
      <SheetDescription>{text}</SheetDescription>
      <Actions action="Remove" onDone={onConfirm} />
    </>
  );
}
