"use client";

import { Avatar } from "macalicious/avatar";
import { BorderlessButton } from "macalicious/borderless-button";
import { CatalystChrome, CatalystSidebar } from "macalicious/catalyst-chrome";
import { CatalystSegment, CatalystSegmentedControl } from "macalicious/catalyst-segmented-control";
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
import { Separator } from "macalicious/separator";
import { Window, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  useCallback,
  useState,
} from "react";
import {
  DeviceGlyph,
  LocationGlyph,
  MAP_DESCRIPTION,
  MapDrawing,
  ShareGlyph,
} from "./find-my-artwork";
import {
  CAPTURED_CENTER,
  CURRENT_LOCATION,
  clampZoom,
  defaultDevices,
  defaultPeople,
  type FindMyDevice,
  type FindMyList,
  type FindMyMapType,
  type FindMyPerson,
  type FindMyPoint,
  initialsOf,
  MAX_ZOOM,
  ME_ID,
  MIN_ZOOM,
  project,
  scaleOf,
} from "./find-my-data";
import "./find-my.tokens.css";
import "./find-my.css";

export interface FindMyProps extends Omit<WindowProps, "children"> {
  /**
   * The rows of the People list. The person whose id is `"me"` is the user: the dot of the
   * current location stands at their coordinate, the location button shows it, and "Share My
   * Location" changes their second line. Without such a person the dot is at
   * `CURRENT_LOCATION`.
   * @default defaultPeople
   */
  people?: readonly FindMyPerson[];
  /**
   * The rows of the Devices list.
   * @default defaultDevices
   */
  devices?: readonly FindMyDevice[];
  /**
   * The list the sidebar shows when the window opens.
   * @default "people"
   */
  defaultList?: FindMyList;
  /**
   * The row of that list that is selected when the window opens; `null` for none, as in the
   * reference captures.
   * @default null
   */
  defaultSelectedId?: string | null;
  /**
   * The map type selected when the window opens.
   * @default "map"
   */
  defaultMapType?: FindMyMapType;
  /**
   * The point of the abstract map at the middle of the view when the window opens.
   * @default CAPTURED_CENTER
   */
  defaultCenter?: FindMyPoint;
  /**
   * The zoom level when the window opens, from -4 to 4; the map is drawn at 2 to the power of
   * half the level.
   * @default 0
   */
  defaultZoom?: number;
  /**
   * The direction that is up on the map when the window opens, in degrees clockwise from
   * north. The compass's ring turns the map north up again.
   * @default 0
   */
  defaultHeading?: number;
  /**
   * Whether the location is shared when the window opens.
   * @default false
   */
  defaultSharing?: boolean;
  /** Called with the person or device whose row is selected when it changes; `null` for none. */
  onSelectionChange?: (item: FindMyPerson | FindMyDevice | null) => void;
  /** Called with the new state when "Share My Location" is switched. */
  onSharingChange?: (sharing: boolean) => void;
  /** For the window controls: a window manager's close command. */
  onClose?: WindowControlsProps["onClose"];
  /** For the window controls: a window manager's minimize command. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** For the window controls: a window manager's zoom command. */
  onZoom?: WindowControlsProps["onZoom"];
  /** For the window controls: what the green button does now. */
  zoomRole?: WindowControlsProps["zoomRole"];
  /** For the window controls: disables minimize, as in full screen. */
  minimizeDisabled?: boolean;
  /** For the window controls: disables zoom. */
  zoomDisabled?: boolean;
  /**
   * Called when the primary pointer button goes down on the 22 pt strip along the window's
   * top edge, not on a window control. Find My shows no title bar: this strip is its drag
   * region, and a window manager starts moving the window here.
   */
  onDragRegionPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  /** Called when that strip is double-clicked: a window manager zooms the window. */
  onDragRegionDoubleClick?: (event: MouseEvent<HTMLDivElement>) => void;
}

const LISTS: readonly { id: FindMyList; title: string }[] = [
  { id: "people", title: "People" },
  { id: "devices", title: "Devices" },
];

const MAP_TYPES: readonly { id: FindMyMapType; title: string }[] = [
  { id: "map", title: "Map" },
  { id: "hybrid", title: "Hybrid" },
  { id: "satellite", title: "Satellite" },
];

/** What the Legal link says: the map is the demo's drawing, and there is nothing to license. */
const LEGAL_NOTE = "Placeholder map: an original drawing, no map data";

/*
 * The library's hooks, set where a stylesheet of the demo may not: on the elements.
 *
 * The sidebar is the Catalyst column of the library with Find My's own fill and its plain
 * one-point line.
 */
const SIDEBAR = {
  "--mac-catalyst-chrome-sidebar-fill": "var(--mac-find-my-sidebar)",
  "--mac-catalyst-chrome-sidebar-divider": "var(--mac-find-my-divider)",
} as CSSProperties;
/** "Share My Location" is a 42 pt row whose content starts at the sidebar's leading edge. */
const SHARE: CSSProperties = { flex: "none", alignItems: "flex-start", minHeight: 42 };
/**
 * The zoom pair is 56 pt wide in the library, as measured in Maps, and 54 pt in Find My. The
 * location button stands 10 pt before it and not 12, so that the button and the pair's
 * trailing edge are where the captures have them.
 */
const CONTROLS: CSSProperties = { gap: 10 };

/** Whether a row is the user's: the person, and never a device, whose id is `"me"`. */
function isMe(item: FindMyPerson | FindMyDevice): boolean {
  return !("kind" in item) && item.id === ME_ID;
}

/** The second line of a row: a person's or a device's place, and for the user the sharing. */
function detailOf(item: FindMyPerson | FindMyDevice, sharing: boolean): string {
  return isMe(item) && sharing ? `${item.place} · Sharing Location` : item.place;
}

/**
 * The Find My window of macOS 10.15: a full-height sidebar with the People and Devices
 * switch, the list it selects and "Share My Location", beside a map with the dot of the
 * current location, a Legal link, the map types, the location button and the compass over the
 * zoom pair. The map is an abstract placeholder of the demo's own, the devices are invented
 * and nothing is located or shared anywhere.
 *
 * The root is the library's `Window`, which takes every prop that is not listed here, so a
 * window manager places, sizes and activates it. The window has no title bar: the window
 * controls float over the sidebar in a strip along the top edge, which is the drag region;
 * their callbacks and the strip's are handed to those parts.
 */
export function FindMy({
  people = defaultPeople,
  devices = defaultDevices,
  defaultList = "people",
  defaultSelectedId = null,
  defaultMapType = "map",
  defaultCenter = CAPTURED_CENTER,
  defaultZoom = 0,
  defaultHeading = 0,
  defaultSharing = false,
  onSelectionChange,
  onSharingChange,
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
  const [list, setList] = useState<FindMyList>(defaultList);
  // Each list keeps its own selection, so switching back shows the row that was selected.
  const [selection, setSelection] = useState<Record<FindMyList, string | null>>(() => ({
    people: defaultList === "people" ? defaultSelectedId : null,
    devices: defaultList === "devices" ? defaultSelectedId : null,
  }));
  const [mapType, setMapType] = useState<FindMyMapType>(defaultMapType);
  const [center, setCenter] = useState<FindMyPoint>(defaultCenter);
  const [zoom, setZoom] = useState(() => clampZoom(defaultZoom));
  const [heading, setHeading] = useState(defaultHeading);
  const [sharing, setSharing] = useState(defaultSharing);
  // What the map says about the last thing that was done to it, or nothing.
  const [note, setNote] = useState<string | null>(null);

  const items: readonly (FindMyPerson | FindMyDevice)[] = list === "people" ? people : devices;
  const selected = items.find((item) => item.id === selection[list]) ?? null;
  // The current location is where the user is: the dot is drawn there and the button shows it.
  const location = people.find(isMe)?.coordinate ?? CURRENT_LOCATION;
  const scale = scaleOf(zoom);
  const mapTitle = MAP_TYPES.find((type) => type.id === mapType)?.title ?? "Map";

  /** Selects a row, or none: the map moves so that the row's marker is in its middle. */
  const select = (id: string | null) => {
    const next = items.find((item) => item.id === id) ?? null;
    setSelection((current) => ({ ...current, [list]: next?.id ?? null }));
    if (next) setCenter(next.coordinate);
    setNote(next ? `${next.name}: ${detailOf(next, sharing)}` : null);
    if (next !== selected) onSelectionChange?.(next);
  };

  const showList = (next: FindMyList) => {
    if (next === list) return;
    setList(next);
    setNote(null);
    const shown =
      (next === "people" ? people : devices).find((item) => item.id === selection[next]) ?? null;
    if (shown) setCenter(shown.coordinate);
    // A person and a device may have the same id: the rows are compared, not their ids.
    if (shown !== selected) onSelectionChange?.(shown);
  };

  const share = () => {
    const next = !sharing;
    setSharing(next);
    setNote(next ? "Sharing My Location" : "Not Sharing My Location");
    onSharingChange?.(next);
  };

  // Kept while the list and the sharing are the same: the rows are memoised on it.
  const renderRow = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item) return null;
      return (
        <>
          <ListViewRowLeading>
            {"kind" in item ? (
              <ImageView className="mac-find-my-avatar" mask="circle" width={29} height={29}>
                <DeviceGlyph kind={item.kind} />
              </ImageView>
            ) : (
              // The user has no picture: the silhouette, as captured. Anyone else, initials.
              <Avatar className="mac-find-my-avatar">
                {isMe(item) ? undefined : initialsOf(item.name)}
              </Avatar>
            )}
          </ListViewRowLeading>
          <ListViewRowTitle>{item.name}</ListViewRowTitle>
          <ListViewRowDetail className="mac-find-my-place">
            {detailOf(item, sharing)}
          </ListViewRowDetail>
        </>
      );
    },
    [items, sharing],
  );

  return (
    <Window
      aria-label="Find My"
      topHighlight
      width={width}
      height={height}
      className={className ? `mac-find-my ${className}` : "mac-find-my"}
      {...windowProps}
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
            <div className="mac-find-my-column">
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
                <ListView
                  aria-label={list === "people" ? "People" : "Devices"}
                  className="mac-find-my-list"
                  count={items.length}
                  rowHeight={48}
                  separator="inset"
                  separatorInset={49.5}
                  renderRow={renderRow}
                  getRowId={(index) => items[index]?.id ?? index}
                  getRowLabel={(index) => items[index]?.name ?? ""}
                  value={selected ? [selected.id] : []}
                  onValueChange={([id]) => select(typeof id === "string" ? id : null)}
                />
              ) : (
                <EmptyState className="mac-find-my-list">
                  {list === "people" ? "No People" : "No Devices"}
                </EmptyState>
              )}
              <ImageButton layout="row" style={SHARE} aria-pressed={sharing} onClick={share}>
                <span className="mac-find-my-share">
                  <ShareGlyph />
                  <span className="mac-find-my-share-title">Share My Location</span>
                </span>
              </ImageButton>
            </div>
          </CatalystSidebar>
        }
      >
        <div
          className="mac-find-my-map"
          data-map-type={mapType}
          data-sharing={sharing ? "" : undefined}
        >
          <ImageView
            className="mac-find-my-picture"
            alt={`${MAP_DESCRIPTION}. ${mapTitle}, zoom ${Math.round(scale * 100)}%, ${
              heading === 0 ? "north up" : `heading ${heading}°`
            }`}
            scaling="axes-independently"
          >
            <MapDrawing center={center} scale={scale} heading={heading} location={location} />
          </ImageView>
          {items.map((item) => {
            // The user has no marker of their own: the dot of the current location is theirs,
            // and only their name stands under it, while their row is selected.
            const me = isMe(item);
            const chosen = item.id === selected?.id;
            if (me && !chosen) return null;
            const at = project(item.coordinate, center, scale, heading);
            return (
              <span
                key={item.id}
                className="mac-find-my-marker"
                data-marker={item.id}
                data-selected={chosen ? "" : undefined}
                style={{ transform: `translate(${at.x}px, ${at.y}px)` }}
              >
                {"kind" in item ? (
                  <span className="mac-find-my-marker-disc">
                    <DeviceGlyph kind={item.kind} />
                  </span>
                ) : me ? null : (
                  <span className="mac-find-my-marker-disc" aria-hidden="true">
                    {initialsOf(item.name)}
                  </span>
                )}
                {chosen ? <span className="mac-find-my-marker-name">{item.name}</span> : null}
              </span>
            );
          })}
          <Label role="status" textStyle="small" className="mac-find-my-note">
            {note}
          </Label>
          <BorderlessButton
            className="mac-find-my-legal"
            onClick={() => setNote((current) => (current === LEGAL_NOTE ? null : LEGAL_NOTE))}
          >
            Legal
          </BorderlessButton>
          <MapControls placement="none" aria-label="Map options" className="mac-find-my-types">
            <MapTypeControl
              aria-label="Map type"
              value={mapType}
              onValueChange={(value) => setMapType(value as FindMyMapType)}
            >
              {MAP_TYPES.map((type) => (
                <MapTypeOption key={type.id} value={type.id}>
                  {type.title}
                </MapTypeOption>
              ))}
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
              onClick={() => {
                setCenter(location);
                setNote("Current Location");
              }}
            >
              <LocationGlyph />
            </MapButton>
            <MapControls placement="none" orientation="vertical" aria-label="Compass and zoom">
              {/* Find My offers no 3D here: the captures show the button dimmed. */}
              <MapCompass
                className="mac-find-my-compass"
                heading={heading}
                onNorthUp={() => setHeading(0)}
                pitchDisabled
              />
              <MapZoomControl
                onZoomIn={() => setZoom((current) => Math.min(MAX_ZOOM, current + 1))}
                onZoomOut={() => setZoom((current) => Math.max(MIN_ZOOM, current - 1))}
                zoomInDisabled={zoom >= MAX_ZOOM}
                zoomOutDisabled={zoom <= MIN_ZOOM}
              />
            </MapControls>
          </MapControls>
        </div>
      </CatalystChrome>
    </Window>
  );
}
