"use client";

import {
  Alert,
  AlertButtons,
  AlertClose,
  AlertInformativeText,
  AlertMessage,
  AlertPopup,
} from "macalicious/alert";
import { Avatar } from "macalicious/avatar";
import { CatalystChrome, CatalystSidebar } from "macalicious/catalyst-chrome";
import { CatalystSegment, CatalystSegmentedControl } from "macalicious/catalyst-segmented-control";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { DefaultButton } from "macalicious/default-button";
import { EmptyState } from "macalicious/empty-state";
import { ImageButton } from "macalicious/image-button";
import { ImageView } from "macalicious/image-view";
import { Label } from "macalicious/label";
import {
  ListView,
  ListViewRowDetail,
  ListViewRowLeading,
  ListViewRowTitle,
} from "macalicious/list-view";
import {
  MapButton,
  MapCompass,
  MapControls,
  MapTypeControl,
  MapTypeOption,
  MapZoomControl,
} from "macalicious/map-controls";
import { PushButton } from "macalicious/push-button";
import { Separator } from "macalicious/separator";
import { Window } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CARDS_DRAG } from "../contacts/contacts-groups";
import { requestDesktopEffects } from "../desktop/desktop-effects";
import { openItem, useOpenItemRequests } from "../desktop/desktop-open-item";
import { changeDesktopValue, useDesktopValue } from "../desktop/desktop-personal";
import { askToReach } from "../desktop/desktop-reach";
import { servedByDesktopApp } from "../desktop/desktop-server";
import {
  clampZoom,
  distanceBetween,
  formatDistance,
  type LatLon,
  MAX_ZOOM,
  type MapView,
  MIN_ZOOM,
  unitsFor,
} from "../maps/maps-geo";
import { currentPosition, type Located, watchLocation } from "../maps/maps-location";
import { askMapsDirections } from "../maps/maps-open";
import { coordinateText, droppedPin, reversePlace, searchPlaces } from "../maps/maps-server";
import { TileMap } from "../maps/maps-tiles";
import { FindMy, type FindMyProps } from "./find-my";
import { DeviceGlyph, LocationGlyph, ShareGlyph } from "./find-my-artwork";
import type { FindMyDevice, FindMyList, FindMyPerson } from "./find-my-data";
import {
  DeviceMenuItems,
  NO_IMAGERY,
  NO_REMOVE_THIS,
  PersonMenuItems,
  removeQuestion,
  useFindMyMenus,
} from "./find-my-menus";
import {
  FriendMenuItems,
  initialsOf,
  type NewRule,
  NO_ACCOUNT,
  NotifySheet,
  type PersonActions,
  PersonCard,
  personDetail,
  personRowId,
  ShareSheet,
} from "./find-my-people";
import {
  accountToken,
  askForSound,
  changePerson,
  clearSound,
  deviceKind,
  deviceLabel,
  lastSeen,
  POLL_MS,
  playFindMySound,
  REPORT_EVERY_MS,
  REPORT_MOVE_M,
  readContactCards,
  readDevices,
  readPeople,
  removeDevice,
  reportLocation,
  type ServedDevice,
  type ServedPerson,
} from "./find-my-server";
import "./find-my.tokens.css";
import "./find-my.css";
import "./find-my-desktop.css";

/** Where the map opens before the browser has said where it is: the United States. */
const START_VIEW: MapView = { center: { lat: 39.5, lon: -98.35 }, zoom: 4 };
/** The zoom a device or the person is shown at. */
const CLOSE_ZOOM = 15;
/** The longest wait between two tries to clear a played sound. */
const SOUND_CLEAR_MAX_MS = 30_000;
/** How often the heartbeat looks whether the latest position is due to be reported again. */
export const HEARTBEAT_MS = 15_000;
/** How long the first retry of a report that failed waits; each further failure doubles it. */
const RETRY_FIRST_MS = 5_000;

const LISTS: readonly { id: FindMyList; title: string }[] = [
  { id: "people", title: "People" },
  { id: "devices", title: "Devices" },
];

const SIDEBAR = {
  "--mac-catalyst-chrome-sidebar-fill": "var(--mac-find-my-sidebar)",
  "--mac-catalyst-chrome-sidebar-divider": "var(--mac-find-my-divider)",
} as CSSProperties;
const SHARE: CSSProperties = { flex: "none", alignItems: "flex-start", minHeight: 42 };
const CONTROLS: CSSProperties = { gap: 10 };

/** Why the compass stays where it is. */
const NO_ROTATION = "This desktop's OpenStreetMap map is always north up, and does not rotate.";

/** Have Maps route to a device, named as the list names it. */
const directionsTo = (device: ServedDevice) =>
  askMapsDirections({ ...droppedPin(device), name: device.label, address: [] });

/** The person's last list, chosen devices and map, in the desktop's settings. */
const FIND_MY_KEPT = "find-my.view";
const KEEP_AFTER_MS = 400;
interface FindMyKept {
  list?: FindMyList;
  devices?: readonly string[];
  view?: MapView;
}
const NO_KEPT: FindMyKept = {};

/** A kept view, with whatever of it reads. */
export function readFindMyKept(stored: unknown): FindMyKept | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { list, devices, view } = stored as Record<string, unknown>;
  const at = (typeof view === "object" && view !== null ? view : {}) as Record<string, unknown>;
  return {
    list: list === "people" || list === "devices" ? list : undefined,
    devices: Array.isArray(devices)
      ? devices.filter((id): id is string => typeof id === "string")
      : undefined,
    view:
      typeof at.lat === "number" &&
      typeof at.lon === "number" &&
      typeof at.zoom === "number" &&
      Math.abs(at.lat) <= 90 &&
      Math.abs(at.lon) <= 180
        ? { center: { lat: at.lat, lon: at.lon }, zoom: clampZoom(at.zoom) }
        : undefined,
  };
}

/** What Share My Location says to someone who is not signed in. */
export function sharingNote(signedInNow: boolean): string {
  return signedInNow
    ? "Name someone with an account on this desktop to share your location with them."
    : "Sign in to share your location. Sharing with friends needs an account they can find.";
}

/** A row of the sidebar: the person, one of their friends, or one of their devices. */
interface Row {
  id: string;
  name: string;
  detail: string;
  device: ServedDevice | null;
  friend?: ServedPerson;
}

/**
 * A row as `onSelectionChange` reports it, in the demo's shapes: the person, or a device with
 * its kind. On the served window the map is OpenStreetMap's, not the demo's abstract one, so
 * `coordinate` holds the real position, longitude as `x` and latitude as `y`; the person's
 * position is this browser's, or the origin while it is not known.
 */
export function selectionItem(
  row: Row | null,
  location: LatLon | null,
): FindMyPerson | FindMyDevice | null {
  if (!row) return null;
  const at = row.friend ? row.friend.position : (row.device ?? location);
  const person: FindMyPerson = {
    id: row.id,
    name: row.name,
    place: row.detail,
    coordinate: at ? { x: at.lon, y: at.lat } : { x: 0, y: 0 },
  };
  return row.device ? { ...person, kind: deviceKind(row.device.label) } : person;
}

/**
 * Find My as the desktop's Ferrite application serves it: OpenStreetMap's real map with this
 * browser's location from the Geolocation API (asked for when the window opens), reported to
 * the module as one of the person's devices; the Devices list, read every ten seconds, with
 * each device's last position and time, Play Sound (the device's own browser plays it when it
 * next reads the list) and Remove; and People, this person and the accounts they share with or
 * follow (`find-my-people.tsx`).
 */
function ServedFindMy({
  people: _people,
  devices: _devices,
  defaultList = "people",
  defaultSelectedId = null,
  defaultMapType: _defaultMapType,
  defaultCenter: _defaultCenter,
  defaultZoom: _defaultZoom,
  defaultHeading: _defaultHeading,
  defaultSharing: _defaultSharing,
  onSelectionChange,
  onSharingChange: _onSharingChange,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  width = 1135,
  height = 723,
  className,
  ...windowProps
}: FindMyProps) {
  const kept = useDesktopValue(FIND_MY_KEPT, readFindMyKept, NO_KEPT);
  const keptNow = useRef(kept);
  keptNow.current = kept;
  const [ownList, setList] = useState<FindMyList | null>(null);
  const list = ownList ?? kept.list ?? defaultList;
  // The selected rows' ids in each list. An id whose row is not listed (a device not read yet, or
  // gone) is kept: the row is selected again when it is listed.
  const [ownSelection, setOwnSelection] = useState<Record<FindMyList, readonly string[]> | null>(
    null,
  );
  const selection = ownSelection ?? {
    people: defaultList === "people" && defaultSelectedId ? [defaultSelectedId] : [],
    devices:
      kept.devices ?? (defaultList === "devices" && defaultSelectedId ? [defaultSelectedId] : []),
  };
  const setSelection = (
    change: (
      current: Record<FindMyList, readonly string[]>,
    ) => Record<FindMyList, readonly string[]>,
  ) => setOwnSelection((current) => change(current ?? selection));
  const [ownView, setOwnView] = useState<MapView | null>(null);
  const view = ownView ?? kept.view ?? START_VIEW;
  const setView = (next: MapView | ((current: MapView) => MapView)) =>
    setOwnView((current) => (typeof next === "function" ? next(current ?? view) : next));
  // Kept once it rests, and when the window goes: a map moves many times a second under a drag.
  const keepNow = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!ownList && !ownSelection && !ownView) return;
    const keep = () => {
      keepNow.current = null;
      const shown = ownView ?? keptNow.current.view;
      changeDesktopValue(FIND_MY_KEPT, {
        list: ownList ?? keptNow.current.list,
        devices: ownSelection?.devices ?? keptNow.current.devices,
        view: shown ? { ...shown.center, zoom: clampZoom(shown.zoom) } : undefined,
      });
    };
    keepNow.current = keep;
    const timer = setTimeout(keep, KEEP_AFTER_MS);
    return () => clearTimeout(timer);
  }, [ownList, ownSelection, ownView]);
  useEffect(() => () => keepNow.current?.(), []);
  const [location, setLocation] = useState<Located | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [devices, setDevices] = useState<readonly ServedDevice[]>([]);
  const [devicesRead, setDevicesRead] = useState(false);
  // When the list was last read, and whether the last read failed: before any read succeeded
  // the list says so instead of loading for ever, and after one it says the rows may be stale.
  const [readAt, setReadAt] = useState<number | null>(null);
  const [devicesFailed, setDevicesFailed] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [account, setAccount] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [column, setColumn] = useState<HTMLElement | null>(null);
  // The devices the alert asks about removing.
  const [removing, setRemoving] = useState<readonly ServedDevice[]>([]);
  const [friends, setFriends] = useState<readonly ServedPerson[]>([]);
  const [sharingOpen, setSharingOpen] = useState(false);
  const [notifying, setNotifying] = useState<ServedPerson | null>(null);
  const [unfriending, setUnfriending] = useState<ServedPerson | null>(null);
  const units = useMemo(
    () => unitsFor(typeof navigator === "undefined" ? undefined : navigator.language),
    [],
  );
  const label = useMemo(
    () => deviceLabel(typeof navigator === "undefined" ? "" : navigator.userAgent),
    [],
  );
  // Whether the map has been placed, by the first position or by the person: a later position
  // does not move it.
  const placed = useRef(false);
  if (kept.view) placed.current = true;
  const lastReport = useRef<{ at: number; where: LatLon } | null>(null);
  const playing = useRef(false);
  // The Play Sound request (its id, or the device's for a server that names none) this window has
  // already played, until the server stops showing it pending. A newer request has a new id and
  // is played in turn.
  const soundHandled = useRef<string | null>(null);
  const alive = useRef(true);

  // One read of the devices at a time. A read is never dropped, however slow (a poll that
  // comes while one is out is not sent); a change made meanwhile (a report, Play Sound, Remove)
  // marks the list stale, and one more read follows once the read out answers, so its answer
  // never stands for a list from before that change.
  const reading = useRef<Promise<void> | null>(null);
  const changedSince = useRef(false);
  const refresh = useCallback(async ({ changed = false }: { changed?: boolean } = {}) => {
    if (changed) changedSince.current = true;
    if (reading.current) return reading.current;
    const run = (async () => {
      try {
        do {
          changedSince.current = false;
          const read = await readDevices();
          if (!alive.current) return;
          // A change made while this read was out: its answer may be from before it.
          if (changedSince.current) continue;
          setNow(Date.now());
          setDevicesFailed(read === null);
          if (read) {
            setDevices(read);
            setDevicesRead(true);
            setReadAt(Date.now());
          }
        } while (changedSince.current && alive.current);
      } finally {
        // Cleared in the step the loop ends in, so a change marked after it starts a read of
        // its own instead of joining one that has ended.
        reading.current = null;
      }
    })();
    reading.current = run;
    await run;
  }, []);

  // A read that was out when a link changed may be from before it: only the newest read counts.
  const peopleRead = useRef(0);
  const refreshPeople = useCallback(async () => {
    peopleRead.current += 1;
    const mine = peopleRead.current;
    const read = await readPeople();
    if (read && alive.current && mine === peopleRead.current) {
      setFriends(read.people);
      setAccount(read.signedIn);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void refresh();
    void refreshPeople();
    const timer = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void refresh();
      void refreshPeople();
    }, POLL_MS);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, [refresh, refreshPeople]);

  // Where this browser is, as it changes: shown, and reported to the module as a device at
  // most once a minute unless it moved. A browser that does not move may get no new position
  // for a long time, so a heartbeat reports the latest known one each minute as well, and the
  // device's last-seen time stays current while the window is open.
  const latest = useRef<Located | null>(null);
  // Bumped to start the position watch again, after Current Location found the browser's
  // position once the watch had given up (permission granted again, or a timeout).
  const [watchKey, setWatchKey] = useState(0);
  // A report in flight: none is sent beside it, and the heartbeat waits for its answer.
  const reporting = useRef(false);
  // After a report that failed, the next attempt waits this long (doubling, at most a minute).
  const retryAfter = useRef({ at: 0, wait: RETRY_FIRST_MS });
  // Whether `at` is due to be reported: nothing reported yet, a minute gone, or moved too far.
  const due = useCallback((at: LatLon) => {
    const last = lastReport.current;
    return (
      !last ||
      Date.now() - last.at >= REPORT_EVERY_MS ||
      distanceBetween(last.where, at) >= REPORT_MOVE_M
    );
  }, []);
  const report = useCallback(
    (at: Located) => {
      if (reporting.current || Date.now() < retryAfter.current.at) return;
      reporting.current = true;
      void reportLocation(at, label).then((answer) => {
        reporting.current = false;
        if ("problem" in answer) {
          // Not recorded: the last report stays where it was, so the next position or the
          // heartbeat tries again once the backoff has passed.
          const wait = retryAfter.current.wait;
          retryAfter.current = {
            at: Date.now() + wait,
            wait: Math.min(wait * 2, REPORT_EVERY_MS),
          };
          if (alive.current) setNote(`This browser's location was not recorded: ${answer.problem}`);
          return;
        }
        lastReport.current = { at: Date.now(), where: at };
        retryAfter.current = { at: 0, wait: RETRY_FIRST_MS };
        if (!alive.current) return;
        void refresh({ changed: true });
        // A position that came while this report was on its way, and is due, is reported now
        // rather than at the next heartbeat.
        const newer = latest.current;
        if (newer && newer !== at && due(newer)) reportNext.current?.(newer);
      });
    },
    [label, refresh, due],
  );
  const reportNext = useRef(report);
  reportNext.current = report;
  useEffect(() => {
    // A new `watchKey` starts the watch again (see `locate`).
    void watchKey;
    return watchLocation(
      (at) => {
        latest.current = at;
        setLocation(at);
        setProblem(null);
        if (!placed.current) {
          placed.current = true;
          setOwnView({ center: at, zoom: CLOSE_ZOOM });
        }
        if (due(at)) report(at);
      },
      (reason) => {
        // No position any more (permission withdrawn, or none to be had): forget the last one,
        // so the heartbeat stops reporting a place the browser no longer vouches for.
        latest.current = null;
        setLocation(null);
        setProblem(reason);
      },
    );
  }, [report, watchKey, due]);
  useEffect(() => {
    const timer = setInterval(() => {
      const at = latest.current;
      if (!at || document.visibilityState === "hidden") return;
      if (due(at)) report(at);
    }, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [report, due]);

  // Play Sound asked of this browser: play it once, and clear the request only once it has been
  // heard. A request already handled is remembered until the server stops showing it, so a
  // refresh that still finds it pending never plays it again. When the browser blocks the sound
  // (no click on the page yet), the request is kept: the next click or key press in the window
  // plays it and then clears it, and polls do not try again on their own.
  type AskedSound = { id: string; label: string; request: string };
  const [blockedSound, setBlockedSound] = useState<AskedSound | null>(null);
  const acknowledge = useCallback(
    async (id: string, request: string) => {
      // Retried until it is heard, the window closes, or the server stops showing this request
      // pending: 1, 2, 4 … seconds apart, at most SOUND_CLEAR_MAX_MS. Only this request is
      // cleared; one asked since stays pending.
      for (let attempt = 0; alive.current && soundHandled.current === request; attempt++) {
        if (await clearSound(id, request)) break;
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(1_000 * 2 ** attempt, SOUND_CLEAR_MAX_MS)),
        );
      }
      if (alive.current) void refresh({ changed: true });
    },
    [refresh],
  );
  const playAsked = useCallback(
    async (me: AskedSound) => {
      playing.current = true;
      const played = await playFindMySound();
      if (!played) {
        playing.current = false;
        if (!alive.current) return;
        setBlockedSound(me);
        setNote(
          "A sound was asked for on this browser, but the browser did not let the page play it. Click in the window to play it.",
        );
        return;
      }
      setBlockedSound(null);
      // The sound has played: a newer request may play while this one is acknowledged.
      playing.current = false;
      if (alive.current) setNote(`Playing a sound on ${me.label}`);
      await acknowledge(me.id, me.request);
    },
    [acknowledge],
  );
  useEffect(() => {
    const me = devices.find((device) => device.this);
    if (!me) return;
    // A pending sound always names its request (`devicesFromServer`).
    const request = me.sound_pending ? me.sound_request : null;
    if (!request) {
      soundHandled.current = null;
      setBlockedSound(null);
      return;
    }
    if (soundHandled.current === request || playing.current) return;
    soundHandled.current = request;
    void playAsked({ id: me.id, label: me.label, request });
  }, [devices, playAsked]);
  // A sound the browser blocked plays on the next gesture in the window, which lets it play.
  const onGesture = () => {
    if (blockedSound && !playing.current) void playAsked(blockedSound);
  };

  const people: Row[] = [
    {
      id: "me",
      name: "Me",
      detail: location
        ? `This browser · within ${formatDistance(location.accuracy_m, units)}`
        : problem
          ? "Location not available"
          : "Finding your location…",
      device: null,
    },
    ...friends.map((friend) => ({
      id: personRowId(friend.name),
      name: friend.full_name,
      detail: personDetail(friend, now),
      device: null,
      friend,
    })),
  ];
  const deviceRows: Row[] = devices.map((device) => ({
    id: device.id,
    name: device.label,
    detail: `${device.this ? "This browser · " : ""}${lastSeen(device.at, now)}`,
    device,
  }));
  const items = list === "people" ? people : deviceRows;
  const chosenRows = items.filter((item) => selection[list].includes(item.id));
  // The one row the card and the owner are told of: none while several are selected.
  const selected = chosenRows.length === 1 ? (chosenRows[0] ?? null) : null;
  const zoom = clampZoom(view.zoom);

  // The owner hears of the selection whenever the row it shows changes, whatever changed it: a
  // click, the other list, a device that is read for the first time, removed, or no longer
  // listed. A person and a device may have the same id, so the list is part of the key.
  const selectedKey = selected ? `${list}:${selected.id}` : null;
  const reportedKey = useRef(selectedKey);
  const tellSelection = useRef(onSelectionChange);
  tellSelection.current = onSelectionChange;
  useEffect(() => {
    if (reportedKey.current === selectedKey) return;
    reportedKey.current = selectedKey;
    tellSelection.current?.(selectionItem(selected, location));
  }, [selectedKey, selected, location]);

  const showPoint = (point: LatLon) => {
    placed.current = true;
    setView((current) => ({ center: point, zoom: Math.max(clampZoom(current.zoom), CLOSE_ZOOM) }));
  };

  const select = (ids: readonly (string | number)[]) => {
    const rows = items.filter((item) => ids.includes(item.id));
    setSelection((current) => ({ ...current, [list]: rows.map((row) => row.id) }));
    const [row] = rows;
    if (!row) return;
    if (rows.length > 1) {
      setNote(`${rows.length} devices selected`);
      return;
    }
    if (row.device) showPoint(row.device);
    else if (row.friend) {
      if (row.friend.position) showPoint(row.friend.position);
    } else if (location) showPoint(location);
    setNote(`${row.name}: ${row.detail}`);
  };

  const locate = async () => {
    if (location) {
      showPoint(location);
      setNote("Current Location");
      return;
    }
    setNote("Finding your location…");
    const answer = await currentPosition();
    if (!alive.current) return;
    if ("problem" in answer) {
      setProblem(answer.problem);
      setNote(answer.problem);
      return;
    }
    // A position after the watch gave up: it is shown and reported as the watch's would be,
    // and the watch starts again so that later positions follow.
    latest.current = answer.at;
    setLocation(answer.at);
    setProblem(null);
    showPoint(answer.at);
    setNote("Current Location");
    report(answer.at);
    setWatchKey((key) => key + 1);
  };

  const playSound = async (device: ServedDevice) => {
    setNote(`Asking ${device.label} to play a sound…`);
    const problemText = await askForSound(device.id);
    if (!alive.current) return;
    setNote(
      problemText
        ? `Play Sound failed: ${problemText}`
        : device.this
          ? "Play Sound was asked of this browser"
          : `${device.label} plays the sound when Find My is next open on it`,
    );
    await refresh({ changed: true });
  };

  const remove = async (targets: readonly ServedDevice[]) => {
    const problems = await Promise.all(targets.map((device) => removeDevice(device.id)));
    if (!alive.current) return;
    const failed = problems.find((problemText) => problemText !== null);
    const [only] = targets;
    setNote(
      failed
        ? `Remove failed: ${failed}`
        : targets.length === 1 && only
          ? `Removed ${only.label}`
          : `Removed ${targets.length} devices`,
    );
    if (!failed)
      setSelection((current) => ({
        ...current,
        devices: current.devices.filter((id) => !targets.some((device) => device.id === id)),
      }));
    await refresh({ changed: true });
  };

  const showList = (next: FindMyList) => {
    if (next === list) return;
    setList(next);
    setNote(null);
  };
  // A device asked for from Spotlight: chosen at once, its row and marker as soon as it is listed.
  const [askedDevice, setAskedDevice] = useState<string | null>(null);
  useOpenItemRequests("find-my", ({ id }) => {
    // A person's notification (find_my/people.rs) names no device: their answer is on the people list.
    if (/^(?:share|ask)-/.test(id)) {
      showList("people");
      return;
    }
    showList("devices");
    setSelection((current) => ({ ...current, devices: [id] }));
    setAskedDevice(id);
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new request or list moves the map.
  useEffect(() => {
    const found = devices.find((device) => device.id === askedDevice);
    if (!found) return;
    setAskedDevice(null);
    showPoint(found);
  }, [askedDevice, devices]);
  const zoomBy = (change: number) =>
    setView((current) => ({
      ...current,
      zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, clampZoom(current.zoom) + change)),
    }));

  const changeLink = async (done: string, change: () => Promise<string | null>) => {
    peopleRead.current += 1;
    const why = await change();
    if (!alive.current) return why;
    setNote(why ? `${done} failed: ${why}` : done);
    await refreshPeople();
    return why;
  };
  const choosePerson = (name: string) => {
    showList("people");
    setSelection((current) => ({ ...current, people: [personRowId(name)] }));
  };
  const startSharing = async (typed: string): Promise<string | null> => {
    const name = accountToken(typed);
    const why = await changeLink(`Sharing your location with ${name}`, () =>
      changePerson(name, "share", "PUT"),
    );
    if (!why && alive.current) choosePerson(name);
    return why;
  };
  const personActions: PersonActions = {
    contact: (person) => {
      void readContactCards().then((cards) => {
        if (!alive.current) return;
        const card = cards.find((each) => each.user === person.name);
        if (!card) {
          setNote(`${person.full_name} has no card in Contacts.`);
          return;
        }
        requestDesktopEffects([{ open: "contacts" }]);
        openItem({ app: "contacts", id: card.id, title: person.full_name });
      });
    },
    message: (person) => askToReach({ app: "messages", to: person.name, name: person.full_name }),
    directions: (person) => {
      if (!person.position) return;
      askMapsDirections({
        ...droppedPin(person.position),
        name: person.full_name,
        address: [],
      });
    },
    share: (person) => void startSharing(person.name),
    stopSharing: (person) =>
      void changeLink(`Stopped sharing your location with ${person.full_name}`, () =>
        changePerson(person.name, "share", "DELETE"),
      ),
    ask: (person) =>
      void changeLink(`Asked to follow ${person.full_name}`, () =>
        changePerson(person.name, "ask", "PUT"),
      ),
    decline: (person) =>
      void changeLink(`Not sharing your location with ${person.full_name}`, () =>
        changePerson(person.name, "ask", "DELETE"),
      ),
    notify: setNotifying,
    removeRule: (person) =>
      void changeLink(`Removed the notification about ${person.full_name}`, () =>
        changePerson(person.name, "notify", "DELETE"),
      ),
    removeTell: (person) =>
      void changeLink(`${person.full_name} will not be notified`, () =>
        changePerson(person.name, "tell", "DELETE"),
      ),
    remove: setUnfriending,
  };
  const addRule = async ({ who, kind, repeat, place }: NewRule) => {
    const person = notifying;
    if (!person) return;
    let at: { lat: number; lon: number; label: string } | null = location
      ? { lat: location.lat, lon: location.lon, label: "your location" }
      : null;
    if (place !== null) {
      const found = await searchPlaces(place);
      const first = found.ok ? found.value[0] : undefined;
      if (!first) {
        setNote(
          found.ok
            ? `Maps found no place called “${place}”.`
            : `Maps could not look the place up: ${found.message}.`,
        );
        return;
      }
      at = { lat: first.lat, lon: first.lon, label: place };
    }
    if (place === null && who === "them" && location) {
      const here = await reversePlace(location);
      const name = here.ok ? here.value[0]?.name : undefined;
      at = { lat: location.lat, lon: location.lon, label: name || coordinateText(location) };
    }
    if (!at) return;
    const { lat, lon, label } = at;
    void changeLink(
      who === "me"
        ? `You will be notified about ${person.full_name}`
        : `${person.full_name} will be notified about you`,
      () =>
        changePerson(person.name, who === "me" ? "notify" : "tell", "PUT", {
          kind,
          lat: Number(lat.toFixed(6)),
          lon: Number(lon.toFixed(6)),
          label,
          repeat,
        }),
    );
  };
  const openShare = () => {
    if (account) setSharingOpen(true);
    else setNote(sharingNote(false));
  };
  const dropCards = (ids: readonly string[]) => {
    void readContactCards().then(async (cards) => {
      for (const id of ids) {
        const card = cards.find((each) => each.id === id);
        if (!alive.current || !card) continue;
        if (card.user) await startSharing(card.user);
        else setNote(NO_ACCOUNT(card.name || "This card"));
      }
    });
  };

  const renderRow = (index: number) => {
    const item = items[index];
    if (!item) return null;
    return (
      <>
        <ListViewRowLeading>
          {item.device ? (
            <ImageView className="mac-find-my-avatar" mask="circle" width={29} height={29}>
              <DeviceGlyph kind={deviceKind(item.device.label)} />
            </ImageView>
          ) : item.friend ? (
            <Avatar className="mac-find-my-avatar">{initialsOf(item.friend.full_name)}</Avatar>
          ) : (
            <Avatar className="mac-find-my-avatar" />
          )}
        </ListViewRowLeading>
        <ListViewRowTitle>{item.name}</ListViewRowTitle>
        <ListViewRowDetail className="mac-find-my-place">{item.detail}</ListViewRowDetail>
      </>
    );
  };

  const chosenDevices = chosenRows.flatMap((row) => (row.device ? [row.device] : []));
  const device = list === "devices" ? (selected?.device ?? null) : null;
  const friend = list === "people" ? (selected?.friend ?? null) : null;
  const sheetAnchor = column?.closest(".mac-find-my");

  const menuKey = useFindMyMenus({
    within: column,
    list,
    showList,
    canZoomIn: zoom < MAX_ZOOM,
    canZoomOut: zoom > MIN_ZOOM,
    zoomIn: () => zoomBy(1),
    zoomOut: () => zoomBy(-1),
    goToCurrentLocation: () => void locate(),
    chosen: chosenDevices,
    remove: setRemoving,
    selectAll:
      list === "devices" && deviceRows.length > 0
        ? () => select(deviceRows.map((row) => row.id))
        : null,
    shareMyLocation: account ? openShare : null,
  });

  return (
    <Window
      aria-label="Find My"
      topHighlight
      width={width}
      height={height}
      className={className ? `mac-find-my ${className}` : "mac-find-my"}
      {...windowProps}
      tabIndex={-1}
      onKeyDown={(event) => {
        windowProps.onKeyDown?.(event);
        if (removing.length === 0 && !event.defaultPrevented && menuKey(event.nativeEvent))
          event.preventDefault();
      }}
      onPointerDownCapture={(event) => {
        windowProps.onPointerDownCapture?.(event);
        onGesture();
      }}
      onKeyDownCapture={(event) => {
        windowProps.onKeyDownCapture?.(event);
        onGesture();
      }}
    >
      <CatalystChrome
        bar="none"
        controls={
          <WindowControls
            onClose={onClose}
            onMinimize={onMinimize}
            onZoom={onZoom}
            zoomRole={zoomRole}
            minimizeDisabled={minimizeDisabled}
            zoomDisabled={zoomDisabled}
          />
        }
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
        sidebar={
          <CatalystSidebar
            aria-label="People and devices"
            width={261}
            divider="plain"
            style={SIDEBAR}
          >
            <div className="mac-find-my-column" ref={setColumn}>
              <CatalystSegmentedControl
                aria-label="Show"
                className="mac-find-my-switch"
                value={list}
                onValueChange={(value) => showList(value as FindMyList)}
              >
                {LISTS.map((item) => (
                  <CatalystSegment key={item.id} value={item.id}>
                    {item.title}
                  </CatalystSegment>
                ))}
              </CatalystSegmentedControl>
              <Separator aria-hidden="true" className="mac-find-my-rule" />
              {items.length > 0 ? (
                <ContextualMenu>
                  <ContextualMenuTrigger
                    render={
                      <ListView
                        aria-label={list === "people" ? "People" : "Devices"}
                        className={
                          list === "people" && friends.length === 0
                            ? "mac-find-my-list mac-find-my-people"
                            : "mac-find-my-list"
                        }
                        count={items.length}
                        rowHeight={48}
                        separator="inset"
                        separatorInset={49.5}
                        renderRow={renderRow}
                        getRowId={(index) => items[index]?.id ?? index}
                        getRowLabel={(index) => items[index]?.name ?? ""}
                        selectionMode={list === "devices" ? "multiple" : "single"}
                        value={chosenRows.map((row) => row.id)}
                        onValueChange={select}
                        onContextMenuCapture={(event) => {
                          const row = (event.target as Element).closest<HTMLElement>(
                            "[data-index]",
                          );
                          const item = items[Number(row?.dataset.index)];
                          // Under the last row there is nothing for the menu to act on.
                          if (!item) {
                            event.preventDefault();
                            event.stopPropagation();
                          } else if (!selection[list].includes(item.id)) select([item.id]);
                        }}
                      />
                    }
                  />
                  <ContextualMenuPopup aria-label={list === "people" ? "Person" : "Device"}>
                    {list === "people" ? (
                      friend ? (
                        <FriendMenuItems person={friend} actions={personActions} />
                      ) : (
                        <PersonMenuItems goToCurrentLocation={() => void locate()} />
                      )
                    ) : (
                      <DeviceMenuItems
                        targets={chosenDevices}
                        playSound={(each) => void playSound(each)}
                        directions={directionsTo}
                        remove={setRemoving}
                      />
                    )}
                  </ContextualMenuPopup>
                </ContextualMenu>
              ) : (
                <EmptyState className="mac-find-my-list">
                  {devicesRead
                    ? "No Devices"
                    : devicesFailed
                      ? "Devices could not be loaded. Find My tries again every ten seconds."
                      : "Loading Devices…"}
                </EmptyState>
              )}
              {list === "devices" && devicesFailed && readAt !== null ? (
                <Label role="alert" render={<p />} textStyle="small" color="secondary">
                  {`Devices could not be refreshed. The list is as of ${new Date(readAt).toLocaleTimeString()}.`}
                </Label>
              ) : null}
              {list === "people" && friends.length === 0 ? (
                <div className="mac-find-my-sharing" role="note">
                  <Label render={<p />} textStyle="small-emphasized">
                    {account ? "No Friends" : "Sign in to share your location"}
                  </Label>
                  <Label render={<p />} textStyle="small" color="secondary">
                    Friends who share their location with you appear here. Your other browsers are
                    under Devices.
                  </Label>
                </div>
              ) : null}
              <ImageButton
                layout="row"
                style={SHARE}
                aria-pressed={false}
                onClick={openShare}
                onDragOver={(event) => {
                  if (account && event.dataTransfer.types.includes(CARDS_DRAG))
                    event.preventDefault();
                }}
                onDrop={(event) => {
                  const ids = event.dataTransfer.getData(CARDS_DRAG);
                  if (!ids) return;
                  event.preventDefault();
                  try {
                    const parsed: unknown = JSON.parse(ids);
                    if (Array.isArray(parsed))
                      dropCards(parsed.filter((id) => typeof id === "string"));
                  } catch {
                    setNote("Those cards could not be read.");
                  }
                }}
              >
                <span className="mac-find-my-share">
                  <ShareGlyph />
                  <span className="mac-find-my-share-title">Share My Location</span>
                </span>
              </ImageButton>
            </div>
          </CatalystSidebar>
        }
      >
        <div className="mac-find-my-map" data-map-type="map" data-sharing={undefined}>
          <TileMap
            view={view}
            onViewChange={(next) => {
              placed.current = true;
              setView(next);
            }}
            label={`Map, zoom ${zoom}`}
            location={location}
            attributionClassName="mac-find-my-attribution"
          >
            {(layer) => (
              <>
                {friends.flatMap((item) => {
                  if (!item.position) return [];
                  const at = layer.project(item.position);
                  const id = personRowId(item.name);
                  const chosen = list === "people" && selection.people.includes(id);
                  return [
                    <span
                      key={id}
                      className="mac-find-my-marker"
                      data-marker={id}
                      data-selected={chosen ? "" : undefined}
                      style={{
                        transform: `translate(${at.x - layer.width / 2}px, ${at.y - layer.height / 2}px)`,
                      }}
                    >
                      <ContextualMenu>
                        <ContextualMenuTrigger
                          render={<span className="mac-find-my-marker-disc" />}
                          onClick={() => choosePerson(item.name)}
                          onContextMenuCapture={() => choosePerson(item.name)}
                        >
                          {initialsOf(item.full_name)}
                        </ContextualMenuTrigger>
                        <ContextualMenuPopup aria-label={item.full_name} data-map-control="">
                          <FriendMenuItems person={item} actions={personActions} />
                        </ContextualMenuPopup>
                      </ContextualMenu>
                      {chosen ? (
                        <span className="mac-find-my-marker-name">{item.full_name}</span>
                      ) : null}
                    </span>,
                  ];
                })}
                {devices
                  .filter((item) => !(item.this && location))
                  .map((item) => {
                    const at = layer.project(item);
                    const chosen = list === "devices" && selection.devices.includes(item.id);
                    return (
                      <span
                        key={item.id}
                        className="mac-find-my-marker"
                        data-marker={item.id}
                        data-selected={chosen ? "" : undefined}
                        style={{
                          transform: `translate(${at.x - layer.width / 2}px, ${at.y - layer.height / 2}px)`,
                        }}
                      >
                        <ContextualMenu>
                          <ContextualMenuTrigger
                            render={<span className="mac-find-my-marker-disc" />}
                            onContextMenuCapture={() =>
                              setSelection((current) => ({ ...current, devices: [item.id] }))
                            }
                          >
                            <DeviceGlyph kind={deviceKind(item.label)} />
                          </ContextualMenuTrigger>
                          {/* A press in the menu reaches the map through React: it is no drag. */}
                          <ContextualMenuPopup aria-label={item.label} data-map-control="">
                            <DeviceMenuItems
                              targets={[item]}
                              playSound={(each) => void playSound(each)}
                              directions={directionsTo}
                              remove={setRemoving}
                            />
                          </ContextualMenuPopup>
                        </ContextualMenu>
                        {chosen ? (
                          <span className="mac-find-my-marker-name">{item.label}</span>
                        ) : null}
                      </span>
                    );
                  })}
              </>
            )}
          </TileMap>
          <Label role="status" textStyle="small" className="mac-find-my-note">
            {note ?? (list === "people" && problem ? problem : null)}
          </Label>
          {friend ? (
            <PersonCard
              person={friend}
              now={now}
              place={
                friend.position && location
                  ? `${formatDistance(distanceBetween(location, friend.position), units)} away`
                  : null
              }
              actions={personActions}
            />
          ) : null}
          {device ? (
            <section className="mac-find-my-device-card" aria-label={device.label}>
              <h2 className="mac-find-my-device-name">{device.label}</h2>
              <Label render={<p />} textStyle="small" color="secondary">
                {device.this ? "This browser · " : ""}
                {lastSeen(device.at, now)} · within {formatDistance(device.accuracy_m, units)}
              </Label>
              <Label render={<p />} textStyle="small" color="secondary" selectable>
                {coordinateText(device)} · {new Date(device.at).toLocaleString()}
              </Label>
              <div className="mac-find-my-device-actions">
                <PushButton size="small" onClick={() => void playSound(device)}>
                  Play Sound
                </PushButton>
                <PushButton
                  size="small"
                  disabled={device.this}
                  focusableWhenDisabled
                  onClick={() => setRemoving([device])}
                >
                  Remove This Device
                </PushButton>
              </div>
              {device.this ? (
                <Label render={<p />} textStyle="small" color="secondary">
                  {NO_REMOVE_THIS}
                </Label>
              ) : null}
            </section>
          ) : null}
          <MapControls placement="none" aria-label="Map options" className="mac-find-my-types">
            <MapTypeControl aria-label="Map type" value="map">
              <MapTypeOption value="map">Map</MapTypeOption>
              <MapTypeOption value="hybrid" disabled title={NO_IMAGERY}>
                Hybrid
              </MapTypeOption>
              <MapTypeOption value="satellite" disabled title={NO_IMAGERY}>
                Satellite
              </MapTypeOption>
            </MapTypeControl>
          </MapControls>
          <MapControls
            placement="none"
            aria-label="Map controls"
            className="mac-find-my-controls"
            style={CONTROLS}
          >
            <MapButton
              variant="rounded"
              aria-label="Show Your Current Location"
              onClick={() => void locate()}
            >
              <LocationGlyph />
            </MapButton>
            <MapControls placement="none" orientation="vertical" aria-label="Compass and zoom">
              <MapCompass className="mac-find-my-compass" pitchDisabled title={NO_ROTATION} />
              <MapZoomControl
                onZoomIn={() => zoomBy(1)}
                onZoomOut={() => zoomBy(-1)}
                zoomInDisabled={zoom >= MAX_ZOOM}
                zoomOutDisabled={zoom <= MIN_ZOOM}
              />
            </MapControls>
          </MapControls>
        </div>
      </CatalystChrome>
      <ShareSheet
        open={sharingOpen}
        anchor={sheetAnchor}
        send={startSharing}
        onClose={() => setSharingOpen(false)}
      />
      <NotifySheet
        person={notifying}
        anchor={sheetAnchor}
        hasPlace={location !== null}
        send={(rule) => void addRule(rule)}
        onClose={() => setNotifying(null)}
      />
      <Alert
        open={unfriending !== null}
        onOpenChange={(open) => {
          if (!open) setUnfriending(null);
        }}
      >
        <AlertPopup>
          <AlertMessage>{`Remove ${unfriending?.full_name ?? ""}?`}</AlertMessage>
          <AlertInformativeText>
            You stop sharing your location with them, and they leave your list.
          </AlertInformativeText>
          <AlertButtons>
            <AlertClose>Cancel</AlertClose>
            <AlertClose
              render={<DefaultButton />}
              onClick={() => {
                const person = unfriending;
                if (person) {
                  void changeLink(`Removed ${person.full_name}`, () =>
                    changePerson(person.name, null, "DELETE"),
                  );
                }
              }}
            >
              Remove
            </AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <Alert
        open={removing.length > 0}
        onOpenChange={(open) => {
          if (!open) setRemoving([]);
        }}
      >
        <AlertPopup>
          <AlertMessage>{removeQuestion(removing)}</AlertMessage>
          <AlertInformativeText>
            A device comes back the next time Find My is open on it.
          </AlertInformativeText>
          <AlertButtons>
            <AlertClose>Cancel</AlertClose>
            <AlertClose render={<DefaultButton />} onClick={() => void remove(removing)}>
              Remove
            </AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
    </Window>
  );
}

/**
 * Find My as the desktop shows it. When the `macalicious-desktop` Ferrite application serves the
 * desktop, the window shows OpenStreetMap's real map, this browser's location and the person's
 * devices with Play Sound and Remove (`ServedFindMy`). Every other build, the documentation
 * included, shows the demo over its abstract drawing, as `FindMy` does, and asks nothing.
 */
export function DesktopFindMy(props: FindMyProps) {
  return servedByDesktopApp() ? <ServedFindMy {...props} /> : <FindMy {...props} />;
}
