"use client";

import { Box } from "macalicious/box";
import { DefaultButton } from "macalicious/default-button";
import { Form, FormRow } from "macalicious/form";
import { Label } from "macalicious/label";
import { LevelIndicator } from "macalicious/level-indicator";
import { MenuRadioGroup, MenuRadioItem } from "macalicious/menu-item";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { ProgressBar } from "macalicious/progress-bar";
import { Separator } from "macalicious/separator";
import {
  Sheet,
  SheetActions,
  SheetClose,
  SheetDescription,
  SheetPopup,
  SheetTitle,
} from "macalicious/sheet";
import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";
import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";
import { SystemImage } from "macalicious/system-image";
import { TextField } from "macalicious/text-field";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarLabelledItem } from "macalicious/toolbar-labelled-item";
import { ToolbarPullDown } from "macalicious/toolbar-pop-up";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import { type CSSProperties, type ReactNode, useEffect, useId, useRef, useState } from "react";
import {
  DiskIcon,
  DriveGlyph,
  EjectGlyph,
  EraseGlyph,
  FirstAidGlyph,
  MountGlyph,
  PartitionGlyph,
  RestoreGlyph,
} from "./disk-utility-artwork";
import {
  abilities,
  addVolume,
  containerName,
  type DiskUtilityDisk,
  type DiskUtilityFact,
  type DiskUtilityTarget,
  type DiskUtilityVolume,
  defaultDisks,
  deleteVolume,
  eraseVolume,
  FORMATS,
  findTarget,
  firstAidSteps,
  restoreSources,
  restoreVolume,
  setMounted,
  summarize,
  targetName,
  targetVolumes,
} from "./disk-utility-data";
import "./disk-utility.tokens.css";
import "./disk-utility.css";

export interface DiskUtilityProps extends Omit<WindowProps, "children"> {
  /**
   * The disks the window opens with. The toolbar's commands change the window's own copy; a
   * later change of the prop is not followed.
   * @default defaultDisks
   */
  disks?: readonly DiskUtilityDisk[];
  /** Identifier of the selected disk, container or volume (controlled); `null` for none. */
  selection?: string | null;
  /**
   * Identifier of the row selected at first (uncontrolled).
   * @default "macintosh-ssd"
   */
  defaultSelection?: string | null;
  /**
   * Called with the identifier of the row the user selects or a command selects, and with
   * `null` when a command leaves nothing selected.
   */
  onSelectionChange?: (id: string | null) => void;
  /**
   * Whether the sidebar opens on the View menu's Show All Devices, with disks and containers
   * above their volumes, or on Show Only Volumes.
   * @default true
   */
  defaultShowAllDevices?: boolean;
  /**
   * Milliseconds First Aid spends on each line of its report.
   * @default 350
   */
  firstAidStepDuration?: number;
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

/** The sheet on the window: what it asks, and about which row. */
type Asked =
  | { kind: "add" | "delete" | "partition" | "erase" | "restore" | "info"; id: string }
  /** `step` is `null` while First Aid asks, then the number of report lines shown. */
  | { kind: "first-aid"; id: string; step: number | null };

/*
 * The toolbar. Disk Utility's chrome is 70 pt: its controls start 26 pt under the window's
 * top and its labels sit 1 pt lower than Console's (see the Toolbar page). The items are
 * where the captures have them in the 926 pt window: View at 8 pt, Volume at 102 pt, the
 * five buttons from 333.5 pt, Info 8 pt from the trailing edge. The two flexible spaces
 * share the room in the measured proportion, 172.5 to 302.5, so the group keeps its place
 * as the window is resized.
 */
const TOOLBAR = {
  height: 48,
  "--mac-toolbar-padding-top": "4px",
  "--mac-toolbar-gap": "0px",
} as CSSProperties;
const BUTTON = { width: 38, padding: 0 } as const;

function Item({ label, width, children }: { label: string; width: number; children: ReactNode }) {
  return (
    // As wide as its control: a label that is wider hangs over both sides, centred.
    <ToolbarLabelledItem label={label} style={{ width, gap: 3, overflow: "visible" }}>
      {children}
    </ToolbarLabelledItem>
  );
}

function Facts({ facts }: { facts: readonly DiskUtilityFact[] }) {
  return (
    <dl className="mac-disk-utility-column">
      {facts.map((fact) => (
        <div key={fact.label} className="mac-disk-utility-fact">
          <dt className="mac-disk-utility-fact-label">{fact.label}</dt>
          <dd className="mac-disk-utility-fact-value">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The detail pane: what Disk Utility shows for the selected row. */
function Detail({ target }: { target: DiskUtilityTarget }) {
  const summary = summarize(target);
  const nameId = useId();
  return (
    <section className="mac-disk-utility-detail" aria-labelledby={nameId}>
      <div className="mac-disk-utility-header">
        <DiskIcon external={target.disk.location === "external"} />
        <div className="mac-disk-utility-heading">
          <h2 id={nameId} className="mac-disk-utility-name">
            {summary.name}
          </h2>
          {summary.lines.map((line) => (
            <p key={line} className="mac-disk-utility-line">
              {line}
            </p>
          ))}
        </div>
        <div className="mac-disk-utility-capacity">
          <div className="mac-disk-utility-capacity-box">{summary.capacity}</div>
          {summary.caption ? (
            <div className="mac-disk-utility-capacity-caption">{summary.caption}</div>
          ) : null}
        </div>
      </div>
      <Separator />
      <div className="mac-disk-utility-usage">
        <LevelIndicator
          variant="storage"
          className="mac-disk-utility-bar"
          value={Math.round(summary.usedShare * 1000)}
          max={1000}
          aria-label="Used space"
          aria-valuetext={`${Math.round(summary.usedShare * 100)}% of ${summary.capacity}`}
        />
        <dl className="mac-disk-utility-legend">
          {summary.legend.map((entry) => (
            <div key={entry.key} className="mac-disk-utility-legend-entry" data-key={entry.key}>
              <dt className="mac-disk-utility-legend-label">{entry.label}</dt>
              <dd className="mac-disk-utility-legend-value">{entry.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <Separator />
      <Box
        variant="well"
        aria-label="Information"
        className="mac-disk-utility-facts"
        // The line of Disk Utility's table, through the box's documented variable.
        style={{ "--mac-box-well-border": "var(--mac-disk-utility-rule)" } as CSSProperties}
      >
        {/* The 12 pt text style. */}
        <Label textStyle="callout" render={<div />} style={{ display: "block" }}>
          <div className="mac-disk-utility-columns">
            <Facts facts={summary.leading} />
            <Facts facts={summary.trailing} />
          </div>
        </Label>
      </Box>
    </section>
  );
}

function VolumeRow({ volume, external }: { volume: DiskUtilityVolume; external: boolean }) {
  const mounted = volume.mountPoint !== null;
  return (
    <SidebarItem
      value={volume.id}
      label={
        mounted ? volume.name : <span className="mac-disk-utility-unmounted">{volume.name}</span>
      }
      icon={<DriveGlyph internal={!external} />}
      accessory={external && mounted && !volume.startup ? <EjectGlyph /> : undefined}
    />
  );
}

const SECTIONS = [
  ["internal", "Internal"],
  ["external", "External"],
] as const;

/**
 * The Disk Utility window of macOS 10.15: an icon-and-label toolbar, the outline of disks,
 * containers and volumes, and the selected row's capacity, usage and information. The disks
 * are data: First Aid, Erase, Restore, Unmount and the Volume buttons change the window's own
 * copy of it and nothing else.
 *
 * The root is the library's `Window`, which takes every prop that is not listed here, so a
 * window manager places, sizes and activates it; the window controls' and the title bar's
 * callbacks are handed to those parts.
 */
export function DiskUtility({
  disks: initialDisks = defaultDisks,
  selection: selectionProp,
  defaultSelection = "macintosh-ssd",
  onSelectionChange,
  defaultShowAllDevices = true,
  firstAidStepDuration = 350,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  width = 926,
  height = 571,
  state: windowState = "key",
  ...windowProps
}: DiskUtilityProps) {
  const [disks, setDisks] = useState(initialDisks);
  const [ownSelection, setOwnSelection] = useState(defaultSelection);
  const selection = selectionProp === undefined ? ownSelection : selectionProp;
  const select = (id: string | null) => {
    setOwnSelection(id);
    onSelectionChange?.(id);
  };
  const [showAllDevices, setShowAllDevices] = useState(defaultShowAllDevices);

  const chosen = findTarget(disks, selection);
  // Show Only Volumes lists no disk and no container. One that is selected there, by the
  // View menu, at first or by the host, hands the selection to its first volume, so that the
  // selected row is always one the sidebar shows. The host is told of the replacement once
  // for each such selection: again when it selects another unlisted row with the same first
  // volume, and not again when it only passes a new callback or when React replays the effect
  // (Strict Mode).
  const stray = !showAllDevices && chosen !== undefined && chosen.kind !== "volume";
  const replacement = stray ? (targetVolumes(chosen)[0]?.id ?? null) : undefined;
  const target = stray ? findTarget(disks, replacement) : chosen;
  const notify = useRef(onSelectionChange);
  useEffect(() => {
    notify.current = onSelectionChange;
  });
  const told = useRef<string | null>(null);
  useEffect(() => {
    if (replacement === undefined || replacement === selection) {
      told.current = null;
      return;
    }
    const event = JSON.stringify([selection, replacement]);
    if (told.current === event) return;
    told.current = event;
    setOwnSelection(replacement);
    notify.current?.(replacement);
  }, [replacement, selection]);
  const can = abilities(target);
  /** A dimmed toolbar button's reason, shown on hover; none while the button can act. */
  const why = (ok: boolean, text: string) =>
    ok ? undefined : target ? text : "Select a disk or volume in the sidebar.";
  const volume = target?.kind === "volume" ? target.volume : undefined;
  const unmounted = volume?.mountPoint === null;

  // The sheet hangs from the title bar. `asked` is kept while the sheet slides away.
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  const [asked, setAsked] = useState<Asked>();
  const [asking, setAsking] = useState(false);
  const [name, setName] = useState("Untitled");
  const [format, setFormat] = useState<string>(FORMATS[0]);
  const [source, setSource] = useState<string | null>(null);
  const about = findTarget(disks, asked?.id);
  const aboutName = about ? targetName(about) : "";
  // The other volumes that fit: what Restore can copy onto the volume the sheet is about.
  const sources = restoreSources(disks, about);
  const ask = (kind: Asked["kind"], row: DiskUtilityTarget | undefined = target) => {
    if (!row) return;
    setName(kind === "erase" ? targetName(row) : "Untitled");
    setFormat(FORMATS[0]);
    setSource(null);
    setAsked(kind === "first-aid" ? { kind, id: row.id, step: null } : { kind, id: row.id });
    setAsking(true);
  };

  const steps = asked?.kind === "first-aid" && about ? firstAidSteps(about) : [];
  const step = asked?.kind === "first-aid" ? asked.step : null;
  const running = asking && step !== null && step < steps.length;
  // One timer per line: `step` is a dependency so that each line starts the next.
  useEffect(() => {
    if (!running || step === null) return;
    const timer = setTimeout(
      () =>
        setAsked((current) =>
          current?.kind === "first-aid" && current.step !== null
            ? { ...current, step: current.step + 1 }
            : current,
        ),
      firstAidStepDuration,
    );
    return () => clearTimeout(timer);
  }, [running, step, firstAidStepDuration]);

  const add = () => {
    if (!about || about.kind === "disk") return;
    const added = addVolume(disks, about.container.id, name, format);
    setDisks(added.disks);
    if (added.id) select(added.id);
  };
  const erase = () => {
    if (!about) return;
    // Erasing a container or a disk erases every volume on it; the name goes to a volume.
    let next: readonly DiskUtilityDisk[] = disks;
    if (about.kind === "volume") next = eraseVolume(next, about.id, name, format);
    else {
      const containers = about.kind === "container" ? [about.container] : about.disk.containers;
      for (const container of containers) {
        for (const each of container.volumes) next = eraseVolume(next, each.id, each.name, format);
      }
    }
    setDisks(next);
  };
  const remove = () => {
    if (about?.kind !== "volume") return;
    setDisks(deleteVolume(disks, about.id));
    // The container takes the selection, or, where containers are not listed, the volume
    // that follows the deleted one in it (the one before it for the last).
    const rest = about.container.volumes.filter((each) => each.id !== about.id);
    const at = about.container.volumes.findIndex((each) => each.id === about.id);
    select(showAllDevices ? about.container.id : ((rest[at] ?? rest[rest.length - 1])?.id ?? null));
  };
  const restore = () => {
    const from = source ?? sources[0]?.id;
    if (about?.kind === "volume" && from) setDisks(restoreVolume(disks, about.id, from));
  };

  const rows = (location: DiskUtilityDisk["location"]) => {
    const listed = disks.filter((disk) => disk.location === location);
    const external = location === "external";
    if (!showAllDevices) {
      return listed.flatMap((disk) =>
        disk.containers.flatMap((container) =>
          container.volumes.map((each) => (
            <VolumeRow key={each.id} volume={each} external={external} />
          )),
        ),
      );
    }
    return listed.map((disk) => (
      <SidebarItem
        key={disk.id}
        value={disk.id}
        label={disk.name}
        icon={<DriveGlyph internal={!external} />}
        accessory={external ? <EjectGlyph /> : undefined}
        defaultExpanded
      >
        {disk.containers.map((container) => (
          <SidebarItem
            key={container.id}
            value={container.id}
            label={containerName(container)}
            icon={<DriveGlyph internal={!external} />}
            defaultExpanded
          >
            {container.volumes.map((each) => (
              <VolumeRow key={each.id} volume={each} external={external} />
            ))}
          </SidebarItem>
        ))}
      </SidebarItem>
    ));
  };

  let sheet: ReactNode = null;
  if (!asked || !about) sheet = null;
  else if (asked.kind === "first-aid" && step === null) {
    sheet = (
      <>
        <SheetTitle>Would you like to run First Aid on “{aboutName}”?</SheetTitle>
        <SheetDescription>
          First Aid will check the {about.kind} for errors. It will then repair the {about.kind} if
          necessary.
        </SheetDescription>
        <SheetActions>
          <SheetClose>Cancel</SheetClose>
          <DefaultButton onClick={() => setAsked({ kind: "first-aid", id: about.id, step: 0 })}>
            Run
          </DefaultButton>
        </SheetActions>
      </>
    );
  } else if (asked.kind === "first-aid") {
    const done = (step ?? 0) >= steps.length;
    sheet = (
      <>
        <SheetTitle>
          {done ? "First Aid process is complete." : `Running First Aid on “${aboutName}”`}
        </SheetTitle>
        <ProgressBar
          className="mac-disk-utility-progress"
          value={Math.round(((step ?? 0) / steps.length) * 100)}
          aria-label="First Aid progress"
          style={{ width: "100%" }}
        />
        <Label
          textStyle="small"
          render={<ol aria-label="Details" />}
          className="mac-disk-utility-log"
          style={{ display: "block" }}
        >
          {steps.slice(0, step ?? 0).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </Label>
        <SheetActions>
          <SheetClose render={<DefaultButton />} disabled={!done}>
            Done
          </SheetClose>
        </SheetActions>
      </>
    );
  } else if (asked.kind === "partition") {
    sheet = (
      <>
        <SheetTitle>Apple File System Space Sharing</SheetTitle>
        <SheetDescription>
          APFS volumes share storage space within a container, so there is no need to partition “
          {aboutName}” to make room for another volume. Would you like to add a volume to the
          container?
        </SheetDescription>
        <SheetActions>
          <SheetClose>Cancel</SheetClose>
          <DefaultButton disabled={!abilities(about).addVolume} onClick={() => ask("add", about)}>
            Add Volume
          </DefaultButton>
        </SheetActions>
      </>
    );
  } else if (asked.kind === "add" || asked.kind === "erase") {
    const adding = asked.kind === "add";
    sheet = (
      <>
        <SheetTitle>
          {adding ? "Add APFS volume to container?" : `Erase “${aboutName}”?`}
        </SheetTitle>
        <SheetDescription>
          {adding
            ? "APFS volumes share storage space within the container. The new volume takes space only as files are stored on it."
            : `Erasing “${aboutName}” will permanently erase all data stored on it. You can’t undo this action.`}
        </SheetDescription>
        <Form render={<div />} labelWidth={52} style={{ marginTop: 12 }}>
          {adding || about.kind === "volume" ? (
            <FormRow label="Name:">
              <TextField
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
                style={{ width: "100%" }}
              />
            </FormRow>
          ) : null}
          <FormRow label="Format:">
            <PopUpButton
              value={format}
              onValueChange={(value) => setFormat(String(value))}
              style={{ width: "100%" }}
            >
              {FORMATS.map((each) => (
                <PopUpButtonItem key={each} value={each}>
                  {each}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
          </FormRow>
        </Form>
        <SheetActions>
          <SheetClose>Cancel</SheetClose>
          <SheetClose
            render={<DefaultButton />}
            disabled={(adding || about.kind === "volume") && name.trim() === ""}
            onClick={adding ? add : erase}
          >
            {adding ? "Add" : "Erase"}
          </SheetClose>
        </SheetActions>
      </>
    );
  } else if (asked.kind === "delete") {
    sheet = (
      <>
        <SheetTitle>Delete APFS volume “{aboutName}”?</SheetTitle>
        <SheetDescription>
          Deleting “{aboutName}” will permanently erase all data stored on it and return its space
          to the container. You can’t undo this action.
        </SheetDescription>
        <SheetActions>
          <SheetClose>Cancel</SheetClose>
          <SheetClose render={<DefaultButton />} onClick={remove}>
            Delete
          </SheetClose>
        </SheetActions>
      </>
    );
  } else if (asked.kind === "restore") {
    sheet = (
      <>
        <SheetTitle>Restore to “{aboutName}”?</SheetTitle>
        <SheetDescription>
          Restoring will erase “{aboutName}” and replace its contents with a copy of the volume you
          choose. You can’t undo this action.
        </SheetDescription>
        <Form render={<div />} style={{ marginTop: 12 }}>
          <FormRow label="Restore from:">
            <PopUpButton
              value={source ?? sources[0]?.id ?? ""}
              onValueChange={(value) => setSource(String(value))}
              disabled={sources.length === 0}
              style={{ width: "100%" }}
            >
              {sources.map((each) => (
                <PopUpButtonItem key={each.id} value={each.id}>
                  {each.name}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
          </FormRow>
        </Form>
        <SheetActions>
          <SheetClose>Cancel</SheetClose>
          <SheetClose render={<DefaultButton />} disabled={sources.length === 0} onClick={restore}>
            Restore
          </SheetClose>
        </SheetActions>
      </>
    );
  } else {
    const summary = summarize(about);
    sheet = (
      <>
        <SheetTitle>“{aboutName}” Info</SheetTitle>
        <Label textStyle="callout" render={<div />} style={{ display: "block", marginTop: 8 }}>
          <Facts facts={[...summary.leading, ...summary.trailing]} />
        </Label>
        <SheetActions>
          <SheetClose render={<DefaultButton />}>Done</SheetClose>
        </SheetActions>
      </>
    );
  }

  return (
    // While its sheet is open the window is main, not key, and everything in it is held.
    <Window
      width={width}
      height={height}
      state={asking && windowState === "key" ? "main" : windowState}
      {...windowProps}
    >
      <TitleBar
        ref={setTitleBar}
        variant="unified"
        title="Disk Utility"
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
      >
        <Toolbar displayMode="icon-and-label" aria-label="Toolbar" inert={asking} style={TOOLBAR}>
          <Item label="View" width={46}>
            <ToolbarPullDown image={<SystemImage name="sidebar" />} style={{ width: 46 }}>
              <MenuRadioGroup
                value={showAllDevices ? "devices" : "volumes"}
                onValueChange={(value) => setShowAllDevices(value === "devices")}
              >
                <MenuRadioItem value="volumes">Show Only Volumes</MenuRadioItem>
                <MenuRadioItem value="devices">Show All Devices</MenuRadioItem>
              </MenuRadioGroup>
            </ToolbarPullDown>
          </Item>
          <ToolbarSpace width={48} />
          <Item label="Volume" width={59}>
            <ToolbarSegmentedControl tracking="momentary" style={{ width: 59 }}>
              <ToolbarSegment
                aria-label="Add Volume"
                disabled={!can.addVolume}
                title={why(
                  can.addVolume,
                  "Select a volume or container with room for another volume.",
                )}
                onClick={() => ask("add")}
                style={{ flex: "none", width: 30, padding: 0 }}
              >
                <SystemImage name="add" />
              </ToolbarSegment>
              <ToolbarSegment
                aria-label="Delete Volume"
                disabled={!can.deleteVolume}
                title={why(
                  can.deleteVolume,
                  "Select a volume other than the startup volume to delete it.",
                )}
                onClick={() => ask("delete")}
                style={{ padding: 0 }}
              >
                <SystemImage name="remove" />
              </ToolbarSegment>
            </ToolbarSegmentedControl>
          </Item>
          <ToolbarSpace style={{ flexGrow: 172.5 }} />
          <Item label="First Aid" width={38}>
            <ToolbarButton
              disabled={!can.firstAid}
              title={why(can.firstAid, "First Aid checks the selected disk or volume.")}
              onClick={() => ask("first-aid")}
              style={BUTTON}
            >
              <FirstAidGlyph />
            </ToolbarButton>
          </Item>
          <ToolbarSpace width={14.5} />
          <Item label="Partition" width={38}>
            <ToolbarButton
              disabled={!can.partition}
              title={why(can.partition, "Partition divides the selected disk.")}
              onClick={() => ask("partition")}
              style={BUTTON}
            >
              <PartitionGlyph />
            </ToolbarButton>
          </Item>
          <ToolbarSpace width={11.5} />
          <Item label="Erase" width={38}>
            <ToolbarButton
              disabled={!can.erase}
              title={why(
                can.erase,
                "The startup disk and volume can’t be erased while they are in use.",
              )}
              onClick={() => ask("erase")}
              style={BUTTON}
            >
              <EraseGlyph />
            </ToolbarButton>
          </Item>
          <ToolbarSpace width={9.5} />
          <Item label="Restore" width={38}>
            <ToolbarButton
              disabled={!can.restore}
              title={why(can.restore, "Restore works on a volume other than the startup volume.")}
              onClick={() => ask("restore")}
              style={BUTTON}
            >
              <RestoreGlyph />
            </ToolbarButton>
          </Item>
          <ToolbarSpace width={18.5} />
          <Item label={unmounted ? "Mount" : "Unmount"} width={38}>
            <ToolbarButton
              disabled={!can.mount}
              title={why(
                can.mount,
                "The startup volume can’t be unmounted; select another volume.",
              )}
              onClick={() => {
                if (volume) setDisks(setMounted(disks, volume.id, unmounted));
              }}
              style={BUTTON}
            >
              <MountGlyph mount={unmounted} />
            </ToolbarButton>
          </Item>
          <ToolbarSpace style={{ flexGrow: 302.5 }} />
          <Item label="Info" width={38}>
            <ToolbarButton disabled={!target} onClick={() => ask("info")} style={BUTTON}>
              <SystemImage name="info" />
            </ToolbarButton>
          </Item>
        </Toolbar>
      </TitleBar>
      <WindowBody inert={asking} style={{ display: "flex", overflow: "hidden" }}>
        <SplitView className="mac-disk-utility-split">
          <SplitViewPane defaultSize={253} minSize={160} maxSize={420}>
            <Sidebar
              aria-label="Devices"
              className="mac-disk-utility-sidebar"
              material="opaque"
              value={target ? target.id : null}
              onValueChange={select}
            >
              {SECTIONS.map(([location, title]) => {
                const items = rows(location);
                return items.length ? (
                  <SidebarSection key={location} title={title}>
                    {items}
                  </SidebarSection>
                ) : null;
              })}
            </Sidebar>
          </SplitViewPane>
          <SplitViewDivider aria-label="Resize the sidebar" />
          <SplitViewPane>{target ? <Detail target={target} /> : null}</SplitViewPane>
        </SplitView>
      </WindowBody>
      {/* Rendered in a portal, so the window stays the root element. */}
      <Sheet open={asking} onOpenChange={setAsking}>
        <SheetPopup anchor={titleBar} width={420}>
          {sheet}
        </SheetPopup>
      </Sheet>
    </Window>
  );
}
