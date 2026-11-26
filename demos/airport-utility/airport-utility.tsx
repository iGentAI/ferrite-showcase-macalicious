"use client";

import { DefaultButton } from "macalicious/default-button";
import { Form, FormRow } from "macalicious/form";
import { ImageButton } from "macalicious/image-button";
import { Label } from "macalicious/label";
import { cn } from "macalicious/lib/cn";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuItem } from "macalicious/menu-item";
import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from "macalicious/popover";
import { PushButton } from "macalicious/push-button";
import { SecureTextField } from "macalicious/secure-text-field";
import {
  Sheet,
  SheetActions,
  SheetClose,
  SheetDescription,
  SheetPopup,
  SheetTitle,
} from "macalicious/sheet";
import { StatusDot } from "macalicious/status-dot";
import { TextField } from "macalicious/text-field";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { BaseStationMark, NetworkMark } from "./airport-utility-artwork";
import {
  type AirPortBaseStation,
  type AirPortNearbyDevice,
  type AirPortSetup,
  type AirPortStatus,
  defaultNearbyDevices,
  proposeSetup,
  renameStation,
  setUp,
  setupProblem,
  statusWords,
} from "./airport-utility-data";
import "./airport-utility.tokens.css";
import "./airport-utility.css";

export interface AirPortUtilityProps extends Omit<WindowProps, "children"> {
  /**
   * The base stations of the network when the window opens: the nodes under the Internet.
   * Read once; a later change is not followed.
   * @default []
   */
  defaultStations?: readonly AirPortBaseStation[];
  /**
   * The Wi-Fi devices found nearby that are not set up, which Other Wi-Fi Devices lists. Read
   * once; a later change is not followed.
   * @default defaultNearbyDevices
   */
  defaultNearbyDevices?: readonly AirPortNearbyDevice[];
  /** Called with the base stations after one was set up or renamed. */
  onStationsChange?: (stations: AirPortBaseStation[]) => void;
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
  /** For the title bar: a window manager starts moving the window here. */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /** For the title bar: a window manager zooms the window here. */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
}

/* The Internet's details: an invented connection. Nothing is read from the machine. */
const INTERNET: readonly (readonly [string, string])[] = [
  ["Connection:", "Ethernet"],
  ["Router Address:", "10.0.1.1"],
  ["DNS Servers:", "10.0.1.1"],
  ["Domain Name:", "home.example"],
];

/*
 * A node keeps the image button's 5 pt of clear space. The Internet's picture box ends 220.5 pt
 * under the window's top and its name's line starts 11 pt lower, as captured, through the
 * image button's documented hook.
 */
const NODE = { "--mac-image-button-gap": "11px" } as CSSProperties;
const STATION = { "--mac-image-button-gap": "4px" } as CSSProperties;

/** The line under a node's picture: its status dot and its name. */
function NodeName({ status, children }: { status: AirPortStatus; children: ReactNode }) {
  return (
    <span className="mac-airport-utility-name">
      <StatusDot status={status} />
      <span className="mac-airport-utility-label">{children}</span>
    </span>
  );
}

/** A list of keys and values in a popover: the form's layout, rendered without a `<form>`. */
function Details({ children }: { children: ReactNode }) {
  return (
    <Form render={<div />} size="small" className="mac-airport-utility-details">
      {children}
    </Form>
  );
}

/** A base station's node, with the popover that shows its details and renames it. */
function Station({
  station,
  onRename,
}: {
  station: AirPortBaseStation;
  onRename: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(station.name);
  const words = statusWords(station.status);

  // Edit and the name's field replace each other, and the control that had the keyboard focus
  // goes away with them: the focus moves to the field when an edit starts, and back to Edit
  // when it ends in a popover that stays open.
  const field = useRef<HTMLDivElement>(null);
  const edit = useRef<HTMLElement>(null);
  const edited = useRef(editing);
  useEffect(() => {
    if (edited.current === editing) return;
    edited.current = editing;
    if (editing) field.current?.querySelector("input")?.focus();
    else edit.current?.focus();
  }, [editing]);
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // The popover opens on the details, never in the middle of an edit.
        if (!next) setEditing(false);
      }}
    >
      <PopoverTrigger
        render={
          <ImageButton
            aria-label={`${station.name}, ${words}`}
            className="mac-airport-utility-node"
            style={STATION}
            label={<NodeName status={station.status}>{station.name}</NodeName>}
          >
            <BaseStationMark />
          </ImageButton>
        }
      />
      <PopoverPopup side="right" style={{ width: 300 }}>
        <PopoverTitle>{station.name}</PopoverTitle>
        <Details>
          {editing ? (
            <FormRow label="Base Station Name:">
              <TextField
                ref={field}
                size="small"
                value={draft}
                onChange={(event) => setDraft(event.currentTarget.value)}
                style={{ width: "100%" }}
              />
            </FormRow>
          ) : null}
          <FormRow kind="value" label="Status:">
            {words}
          </FormRow>
          <FormRow kind="value" label="Network:">
            {station.network}
          </FormRow>
          <FormRow kind="value" label="IP Address:">
            {station.address}
          </FormRow>
          <FormRow kind="value" label="Serial Number:">
            {station.serial}
          </FormRow>
          <FormRow kind="value" label="Version:">
            {station.version}
          </FormRow>
        </Details>
        <div className="mac-airport-utility-actions">
          {editing ? (
            <>
              <PushButton size="small" keyEquivalent="escape" onClick={() => setEditing(false)}>
                Cancel
              </PushButton>
              <DefaultButton
                size="small"
                disabled={draft.trim() === ""}
                onClick={() => {
                  onRename(draft);
                  setEditing(false);
                }}
              >
                Done
              </DefaultButton>
            </>
          ) : (
            <PushButton
              ref={edit}
              size="small"
              onClick={() => {
                setDraft(station.name);
                setEditing(true);
              }}
            >
              Edit
            </PushButton>
          )}
        </div>
      </PopoverPopup>
    </Popover>
  );
}

/**
 * The window of AirPort Utility in macOS 10.15: the graph of the network on a blue-grey
 * gradient, with the Internet at its top, the base stations under it, and the Wi-Fi devices
 * that wait to be set up behind the Other Wi-Fi Devices button. The window is dark in Aqua and
 * in Dark Aqua alike, as both captures show it.
 *
 * Nothing is scanned or configured: the devices are invented, and setting one up only moves
 * it into the graph. The pictures are abstract placeholders.
 *
 * The root is the library's `Window`, which takes every prop that is not listed here, so a
 * window manager places, sizes and activates it; the window controls' and the title bar's
 * callbacks are handed to those parts.
 */
export function AirPortUtility({
  defaultStations = [],
  defaultNearbyDevices: found = defaultNearbyDevices,
  onStationsChange,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  width = 696,
  height = 532,
  state: windowState = "key",
  className,
  ...windowProps
}: AirPortUtilityProps) {
  const [stations, setStations] = useState<AirPortBaseStation[]>(() => [...defaultStations]);
  const [nearby, setNearby] = useState<AirPortNearbyDevice[]>(() =>
    found.filter((device) => !defaultStations.some((station) => station.id === device.id)),
  );
  const [announcement, setAnnouncement] = useState("");

  // The setup sheet hangs from the title bar. `device` is kept while the sheet slides away.
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  const [device, setDevice] = useState<AirPortNearbyDevice>();
  const [asking, setAsking] = useState(false);
  const [setup, setSetup] = useState<AirPortSetup>({
    network: "",
    name: "",
    password: "",
    verify: "",
  });
  const problem = setupProblem(setup);
  const change = (field: keyof AirPortSetup, value: string) =>
    setSetup((current) => ({ ...current, [field]: value }));

  const begin = (next: AirPortNearbyDevice) => {
    setDevice(next);
    setSetup(proposeSetup(next));
    setAsking(true);
  };
  const finish = () => {
    if (!device || problem !== undefined) return;
    const next = setUp(stations, device, setup);
    setStations(next);
    setNearby((current) => current.filter((each) => each.id !== device.id));
    setAnnouncement(`${setup.name.trim()} joined the network ${setup.network.trim()}`);
    onStationsChange?.(next);
  };
  const rename = (station: AirPortBaseStation, name: string) => {
    const next = renameStation(stations, station.id, name);
    const now = next.find((each) => each.id === station.id)?.name;
    if (now === undefined || now === station.name) return;
    setStations(next);
    setAnnouncement(`${station.name} is now named ${now}`);
    onStationsChange?.(next);
  };

  return (
    // While its sheet is open the window is main, not key, and everything in it is held.
    <Window
      width={width}
      height={height}
      state={asking && windowState === "key" ? "main" : windowState}
      className={cn("mac-airport-utility", className)}
      {...windowProps}
      // Dark in both appearances: both captures show the same dark window. After the caller's
      // props, so that none of them changes it.
      data-appearance="dark"
    >
      <TitleBar
        ref={setTitleBar}
        title="AirPort Utility"
        controls={
          <WindowControls
            closeDisabled={asking}
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
      />
      <WindowBody inert={asking} className="mac-airport-utility-graph">
        <div className="mac-airport-utility-others">
          <Menu>
            <MenuTrigger
              render={
                // 134 pt wide, as captured.
                <PushButton disabled={nearby.length === 0} style={{ width: 134 }}>
                  Other Wi-Fi Devices
                </PushButton>
              }
            />
            <MenuPopup sideOffset={2}>
              {nearby.map((each) => (
                <MenuItem key={each.id} onClick={() => begin(each)}>
                  {each.label}
                </MenuItem>
              ))}
            </MenuPopup>
          </Menu>
        </div>
        <div className="mac-airport-utility-internet">
          <Popover>
            <PopoverTrigger
              render={
                <ImageButton
                  aria-label="Internet, Connected"
                  className="mac-airport-utility-node"
                  style={NODE}
                  label={<NodeName status="available">Internet</NodeName>}
                >
                  <span className="mac-airport-utility-picture">
                    <NetworkMark />
                  </span>
                </ImageButton>
              }
            />
            <PopoverPopup side="right" style={{ width: 260 }}>
              <PopoverTitle>Internet</PopoverTitle>
              <Details>
                <FormRow kind="value" label="Status:">
                  Connected
                </FormRow>
                {INTERNET.map(([label, value]) => (
                  <FormRow key={label} kind="value" label={label}>
                    {value}
                  </FormRow>
                ))}
              </Details>
            </PopoverPopup>
          </Popover>
        </div>
        {stations.length > 0 ? (
          <>
            {/* Beside the row, not in it: the row scrolls sideways and the Internet does not. */}
            <span className="mac-airport-utility-trunk" aria-hidden="true" />
            <ul className="mac-airport-utility-stations" aria-label="Base stations">
              {stations.map((station) => (
                <li key={station.id}>
                  <Station station={station} onRename={(name) => rename(station, name)} />
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </WindowBody>
      <div role="status" className="mac-airport-utility-announcement">
        {announcement}
      </div>
      <Sheet open={asking} onOpenChange={setAsking}>
        <SheetPopup anchor={titleBar} width={440}>
          <SheetTitle>Set up “{device?.label}”</SheetTitle>
          <SheetDescription>
            This {device?.model} will create a new network. Nothing is really configured.
          </SheetDescription>
          <Form render={<div />} labelWidth={130}>
            <FormRow label="Network Name:">
              <TextField
                value={setup.network}
                onChange={(event) => change("network", event.currentTarget.value)}
                style={{ width: "100%" }}
              />
            </FormRow>
            <FormRow label="Base Station Name:">
              <TextField
                value={setup.name}
                onChange={(event) => change("name", event.currentTarget.value)}
                style={{ width: "100%" }}
              />
            </FormRow>
            <FormRow label="Password:">
              <SecureTextField
                value={setup.password}
                onChange={(event) => change("password", event.currentTarget.value)}
                style={{ width: "100%" }}
              />
            </FormRow>
            <FormRow label="Verify:">
              <SecureTextField
                value={setup.verify}
                onChange={(event) => change("verify", event.currentTarget.value)}
                style={{ width: "100%" }}
              />
            </FormRow>
          </Form>
          <Label
            textStyle="small"
            color="secondary"
            className="mac-airport-utility-problem"
            aria-live="polite"
          >
            {problem ?? ""}
          </Label>
          <SheetActions>
            <SheetClose>Cancel</SheetClose>
            <SheetClose
              render={<DefaultButton />}
              disabled={problem !== undefined}
              onClick={finish}
            >
              Done
            </SheetClose>
          </SheetActions>
        </SheetPopup>
      </Sheet>
    </Window>
  );
}
