"use client";

import { BorderedList } from "macalicious/bordered-list";
import { Checkbox } from "macalicious/checkbox";
import { GradientButton, GradientButtonGroup } from "macalicious/gradient-button";
import {
  InspectorPanel,
  InspectorPanelHeader,
  InspectorPanelItem,
  InspectorPanelList,
  type InspectorPanelProps,
  InspectorPanelSection,
} from "macalicious/inspector-panel";
import { cn } from "macalicious/lib/cn";
import { LockButton } from "macalicious/lock-button";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { TableView, type TableViewColumn } from "macalicious/table-view";
import { TextField } from "macalicious/text-field";
import { TextView } from "macalicious/text-view";
import { TokenField } from "macalicious/token-field";
import { WindowControls } from "macalicious/window-controls";
import { type ClipboardEvent, type KeyboardEvent, useRef, useState } from "react";
import { applicationsFor } from "./finder-applications";
import { ItemIcon } from "./finder-artwork";
import { useCustomIcon } from "./finder-custom-icon";
import {
  ancestry,
  type FinderNode,
  formatDate,
  formatSize,
  isContainer,
  kindText,
  listing,
  parentPath,
  resolve,
} from "./finder-data";
import "./finder.tokens.css";
import "./finder-panels.css";

/**
 * What the file system of the demo does not record about an item and the Info window of the
 * reference screenshot shows: when it was created, and the facts its document carries. Keyed by
 * the item's name.
 */
const EXTRAS: Record<string, { created: string; facts: readonly [string, string][] }> = {
  "Aqua and Bondi.pdf": {
    created: "2016-12-31 13:17",
    facts: [
      ["Version", "1.4"],
      ["Pages", "81"],
      ["Resolution", "1024×748"],
      ["Security", "None"],
      ["Content Creator", "iBooks Author"],
      ["Encoding software", "Mac OS X 10.10.5 Quartz PDFContext"],
    ],
  },
};

/** The Size row: bytes and the size on disk, or how many items a container holds. */
function sizeText(root: FinderNode, path: string, node: FinderNode): string {
  if (isContainer(node)) {
    const count = listing(root, path).length;
    return `${count} ${count === 1 ? "item" : "items"}`;
  }
  if (node.size === undefined) return "--";
  return `${node.size.toLocaleString("en-US")} bytes (${formatSize(node.size)} on disk)`;
}

/** The application an item opens with, as a node, so that it is drawn with the demo's icon. */
const applicationNode = (name: string): FinderNode => ({ name, kind: "application" });

/**
 * What the host knows and Get Info then says, as on the desktop served by Ferrite (the person's drive): why the
 * permissions cannot be changed. The served Finder passes `FINDER_INFO_HOST`; without it the window is drawn as
 * captured, as in an example.
 */
export interface FinderInfoHost {
  /** Why Sharing & Permissions cannot be edited: the drive is the person's alone. */
  permissions: string;
}

/** The facts of the person's drive on the desktop served by Ferrite. */
export const FINDER_INFO_HOST: FinderInfoHost = {
  permissions:
    "Only you can read and write the files on your drive; they cannot be shared with other users or groups.",
};

/**
 * Open with: the application that opens the item, the default first, and Change All, which makes the chosen one the
 * default for every document of the kind. `onChangeAll` keeps it, where a host does; without one the choice lasts
 * while the window is open, as captured.
 */
function OpenWith({
  applications,
  onChangeAll,
}: {
  applications: readonly string[];
  onChangeAll?: (name: string) => void;
}) {
  const [standard, setStandard] = useState(applications[0]);
  const [chosen, setChosen] = useState(applications[0]);
  return (
    <div className="mac-finder-info-open-with">
      <PopUpButton
        size="small"
        aria-label="Open with"
        className="mac-finder-info-open-with-application"
        value={chosen}
        onValueChange={(next) => {
          if (next) setChosen(next);
        }}
      >
        {applications.map((name) => (
          <PopUpButtonItem
            key={name}
            value={name}
            image={<ItemIcon node={applicationNode(name)} size={16} />}
          >
            {name === standard ? `${name} (default)` : name}
          </PopUpButtonItem>
        ))}
      </PopUpButton>
      <p className="mac-finder-info-open-with-help">
        Use this application to open all documents like this one.
      </p>
      <PushButton
        size="small"
        className="mac-finder-info-open-with-change"
        disabled={chosen === standard}
        onClick={() => {
          setStandard(chosen);
          if (chosen) onChangeAll?.(chosen);
        }}
      >
        Change All...
      </PushButton>
    </div>
  );
}

type Who = "person" | "pair" | "group";

interface Permission {
  name: string;
  privilege: string;
  who: Who;
}

/** The owner's row, which cannot be removed. */
const OWNER = "shackett (Me)";

/**
 * Why Stationery pad, Locked and Hide extension are dimmed where the host keeps none of them
 * (no `onFlagChange`): neither the demo's file system nor the person's drive on Ferrite keeps
 * them (a drive entry keeps its name, folder, tags and dates), so a tick would change nothing and
 * be gone with the window.
 */
export const ITEM_FLAGS_NOT_KEPT = "This file system does not keep this setting.";

/** The settings of an item that the General and Name & Extension sections show as checkboxes. */
export type FinderItemFlag = "stationery" | "locked" | "hideExtension";

const PERMISSIONS: readonly Permission[] = [
  { name: OWNER, privilege: "Read & Write", who: "person" },
  { name: "staff", privilege: "Read only", who: "pair" },
  { name: "everyone", privilege: "Read only", who: "group" },
];

/** The groups the add button offers, in order: the first that is not listed is added. */
const MORE_GROUPS = ["admin", "wheel"];

const PERMISSION_COLUMNS: TableViewColumn[] = [
  { id: "name", title: "Name", width: 116 },
  { id: "privilege", title: "Privilege" },
];

/* Stand-in glyphs for a user, a group and everyone, drawn for this demo: a head and shoulders,
   once, twice and three times, in the row's own colour. */
const HEAD = "M7 1.5a2.6 2.6 0 1 0 0 5.2a2.6 2.6 0 0 0 0-5.2z";
const SHOULDERS = "M2 13c0-3.2 2-4.8 5-4.8s5 1.6 5 4.8z";
const WHO: Record<Who, readonly [x: number, opacity: number][]> = {
  person: [[0, 1]],
  pair: [
    [-2.5, 0.55],
    [2, 1],
  ],
  group: [
    [-4, 0.4],
    [4, 0.4],
    [0, 1],
  ],
};

function WhoGlyph({ who }: { who: Who }) {
  return (
    <svg viewBox="-4 0 22 14" width="22" height="14" fill="currentColor" aria-hidden="true">
      {WHO[who].map(([x, opacity]) => (
        <g key={x} transform={`translate(${x} 0)`} fillOpacity={opacity}>
          <path d={HEAD} />
          <path d={SHOULDERS} />
        </g>
      ))}
    </svg>
  );
}

/**
 * Sharing & Permissions: who may read and write the item. With the host's `reason` the list is locked for good (the
 * drive is the person's alone, so there is no one to share it with): the lock and the add and remove buttons are dimmed,
 * saying why. Without it, as captured: the list is locked at first, a click on the lock unlocks it (the demo asks for no
 * password), and then the add button adds the next group and the remove button removes the selected row, the owner's
 * excepted.
 */
function Permissions({ reason }: { reason?: string }) {
  const [rows, setRows] = useState(PERMISSIONS);
  const [selected, setSelected] = useState<string>();
  const [unlocked, setUnlocked] = useState(false);
  const locked = reason !== undefined || !unlocked;
  const next = MORE_GROUPS.find((name) => rows.every((row) => row.name !== name));
  const removable = rows.some((row) => row.name === selected) && selected !== OWNER;
  return (
    <div className="mac-finder-info-permissions">
      <p className="mac-finder-info-permissions-summary">You can read and write</p>
      <BorderedList className="mac-finder-info-permissions-list">
        <TableView
          aria-label="Sharing & Permissions"
          columns={PERMISSION_COLUMNS}
          rowCount={rows.length}
          rowHeight={16}
          size="mini"
          alternatingRows
          getRowId={(row) => rows[row]?.name ?? row}
          getRowLabel={(row) => rows[row]?.name ?? ""}
          renderCell={(row, column) => {
            const entry = rows[row];
            if (!entry) return null;
            if (column.id === "privilege") return entry.privilege;
            return (
              <span className="mac-finder-info-permissions-name">
                <WhoGlyph who={entry.who} />
                {entry.name}
              </span>
            );
          }}
          value={selected === undefined ? [] : [selected]}
          onValueChange={(value) => setSelected(value[0] === undefined ? undefined : `${value[0]}`)}
        />
      </BorderedList>
      <div className="mac-finder-info-permissions-bar">
        <GradientButtonGroup aria-label="Edit users and groups">
          <GradientButton
            glyph="add"
            aria-label="Add a group"
            disabled={locked || next === undefined}
            title={reason}
            onClick={() => {
              if (!next) return;
              setRows([...rows, { name: next, privilege: "Read only", who: "pair" }]);
              setSelected(next);
            }}
          />
          <GradientButton
            glyph="remove"
            aria-label="Remove the selected user or group"
            disabled={locked || !removable}
            title={reason}
            onClick={() => {
              setRows(rows.filter((row) => row.name !== selected));
              setSelected(undefined);
            }}
          />
        </GradientButtonGroup>
        <LockButton
          size="small"
          className="mac-finder-info-permissions-lock"
          state={locked ? "locked" : "unlocked"}
          disabled={reason !== undefined}
          title={reason}
          onClick={() => setUnlocked(!unlocked)}
        />
      </div>
    </div>
  );
}

export interface FinderInfoProps extends Omit<InspectorPanelProps, "title" | "icon" | "children"> {
  /** The file system the item is in. */
  root: FinderNode;
  /** The path of the item the window describes. Nothing is rendered when no item is there. */
  path: string;
  /** Called with the item's path and its new tags when the tags field changes them. */
  onTagsChange?: (path: string, tags: string[]) => void;
  /**
   * Keeps the item's Stationery pad, Locked and Hide extension settings: called with the item's
   * path, the setting and its new value. Left out where nothing keeps them, as on the desktop
   * today: the three checkboxes are then dimmed, with `ITEM_FLAGS_NOT_KEPT` as their tooltip,
   * rather than ticking without effect.
   */
  onFlagChange?: (path: string, flag: FinderItemFlag, checked: boolean) => void;
  /** Renames the item. Without it the name is shown and cannot be edited. */
  onRename?: (path: string, name: string) => void;
  /** Keeps the comments, called as they leave the field. Without it they last while the window is open. */
  onCommentChange?: (path: string, comment: string) => void;
  /**
   * A paste on the item's header: `picture` is what the clipboard holds, or `undefined` when it holds
   * no picture. Without it an item keeps its own icon.
   */
  onIconPaste?: (path: string, picture: File | undefined) => void;
  /** Delete on the item's header, while a pasted picture is its icon. */
  onIconRemove?: (path: string) => void;
  /** The applications that open the item, the default first, instead of the demo's list. */
  openers?: readonly string[];
  /** Keeps the application Change All chose for documents like this one. */
  onChangeOpener?: (name: string) => void;
  /**
   * What the host knows of the item and the window then says (`FINDER_INFO_HOST`, passed by the Finder served by
   * Ferrite): the permissions are locked for good, dimmed with their reason. Without it the window is drawn as captured.
   */
  host?: FinderInfoHost;
}

/** The tags a summary shows: those every one of `lists` has. */
export const sharedTags = (lists: readonly (readonly string[])[]): readonly string[] =>
  (lists[0] ?? []).filter((tag) => lists.every((list) => list.includes(tag)));

/** `tags` of one item after the shared ones went from `before` to `after`; its own others stay. */
export const withSharedTags = (
  tags: readonly string[],
  before: readonly string[],
  after: readonly string[],
): string[] => [...new Set([...tags.filter((tag) => !before.includes(tag)), ...after])];

/**
 * The Info window for several items together: how many, their size, and what they share. Locked,
 * tags and comments set here go to each of them.
 */
export function FinderSummaryInfo({
  root,
  paths,
  onLockedChange,
  onTagsChange,
  onCommentChange,
  onClose,
  controls,
  className,
  ...props
}: Omit<InspectorPanelProps, "title" | "icon" | "children"> & {
  root: FinderNode;
  paths: readonly string[];
  onLockedChange?: (checked: boolean) => void;
  /** Keeps the tags of each item: its path, then all its tags. */
  onTagsChange?: (changes: readonly (readonly [string, string[]])[]) => void;
  /** Keeps one comment on them all, called as it leaves the field. */
  onCommentChange?: (comment: string) => void;
}) {
  const nodes = paths.flatMap((path) => resolve(root, path) ?? []);
  const shared = sharedTags(nodes.map((node) => node.tags ?? []));
  const firstComment = nodes[0]?.comment ?? "";
  const oneComment = nodes.every((node) => (node.comment ?? "") === firstComment);
  const [comment, setComment] = useState(oneComment ? firstComment : "");
  const size = nodes.reduce((total, node) => total + (node.size ?? 0), 0);
  const kinds = [...new Set(nodes.map(kindText))];
  const places = [...new Set(paths.map(parentPath))];
  const title = nodes.length === 1 ? "1 item" : `${nodes.length} items`;
  const first = nodes[0];
  return (
    <InspectorPanel
      title={`${title} Info`}
      icon={first ? <ItemIcon node={first} size={16} /> : undefined}
      onClose={onClose}
      controls={
        controls !== undefined ? (
          controls
        ) : (
          <WindowControls onClose={onClose} zoomRole="zoom" minimizeDisabled zoomDisabled />
        )
      }
      className={cn("mac-finder-info", className)}
      {...props}
    >
      <InspectorPanelHeader
        icon={first ? <ItemIcon node={first} size={32} /> : undefined}
        title={title}
        detail={formatSize(size)}
      >
        {onTagsChange ? (
          <div className="mac-finder-info-tags">
            <TokenField
              aria-label="Tags"
              className="mac-finder-info-tags-field"
              placeholder={shared.length > 0 ? undefined : "Add Tags..."}
              value={[...shared]}
              onValueChange={(next) =>
                onTagsChange(
                  paths.flatMap((path) => {
                    const node = resolve(root, path);
                    return node
                      ? [[path, withSharedTags(node.tags ?? [], shared, next)] as const]
                      : [];
                  }),
                )
              }
            />
          </div>
        ) : null}
      </InspectorPanelHeader>
      <InspectorPanelSection title="General:" defaultOpen>
        <InspectorPanelList>
          <InspectorPanelItem label="Kind:">
            {kinds.length === 1 ? kinds[0] : "Multiple kinds"}
          </InspectorPanelItem>
          <InspectorPanelItem label="Size:">
            {`${size.toLocaleString("en-US")} bytes for ${nodes.length} items`}
          </InspectorPanelItem>
          <InspectorPanelItem label="Where:">
            {places.length === 1
              ? ancestry(root, places[0] as string)
                  .map((entry) => entry.node.name)
                  .join(" ▸ ")
              : "Multiple locations"}
          </InspectorPanelItem>
        </InspectorPanelList>
        <div className="mac-finder-info-checks">
          <Checkbox
            size="small"
            disabled={!onLockedChange}
            checked={nodes.length > 0 && nodes.every((node) => node.locked)}
            onCheckedChange={(checked) => onLockedChange?.(checked)}
          >
            Locked
          </Checkbox>
        </div>
      </InspectorPanelSection>
      {onCommentChange ? (
        <InspectorPanelSection title="Comments:">
          <div className="mac-finder-info-comments">
            <TextView
              aria-label="Comments"
              placeholder={oneComment ? undefined : "Multiple comments"}
              value={comment}
              onValueChange={setComment}
              onBlur={() => {
                if (comment !== (oneComment ? firstComment : "")) onCommentChange(comment);
              }}
            />
          </div>
        </InspectorPanelSection>
      ) : null}
    </InspectorPanel>
  );
}

/**
 * Finder's Get Info window for one item: the library's inspector panel with the item's facts
 * in the sections of the reference screenshot. It shows the item of `root` at `path`, and what the
 * host keeps it changes through its callbacks: the tags, the name, the comments, the settings and the
 * default application. What the host does not keep stays in the window while it is open, and
 * Stationery pad, Locked and Hide extension are dimmed, with the reason as their tooltip.
 *
 * Every other prop goes to the `InspectorPanel`: `state`, `style`, `ref`, `onClose`. The window
 * can only be closed, so its minimize and zoom buttons are disabled unless `controls` is given.
 */
export function FinderInfo({
  root,
  path,
  onTagsChange,
  onFlagChange,
  onRename,
  onCommentChange,
  onIconPaste,
  onIconRemove,
  openers,
  onChangeOpener,
  host,
  onClose,
  controls,
  className,
  ...props
}: FinderInfoProps) {
  const node = resolve(root, path);
  const custom = useCustomIcon(node?.id);
  const [comments, setComments] = useState(node?.comment ?? "");
  const [name, setName] = useState(node?.name ?? "");
  const named = useRef(node?.name);
  if (node && named.current !== node.name) {
    named.current = node.name;
    setName(node.name);
  }
  if (!node) return null;
  const keepName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== node.name) onRename?.(path, trimmed);
    else setName(node.name);
  };
  /** A checkbox for one of the item's settings: the host's to keep, dimmed where it keeps none. */
  const flag = (flagName: FinderItemFlag) => ({
    disabled: !onFlagChange,
    title: onFlagChange ? undefined : ITEM_FLAGS_NOT_KEPT,
    ...(onFlagChange ? { checked: Boolean(node[flagName]) } : {}),
    onCheckedChange: (checked: boolean) => onFlagChange?.(path, flagName, checked),
  });

  const extras = EXTRAS[node.name];
  const where = ancestry(root, parentPath(path))
    .map((entry) => entry.node.name)
    .join(" ▸ ");
  const modified = formatDate(node.modified, "long");
  const applications = openers ?? applicationsFor(node.kind);
  const iconTakesPaste = onIconPaste !== undefined && !node.locked;

  return (
    <InspectorPanel
      title={`${node.name} Info`}
      icon={<ItemIcon node={node} size={16} />}
      onClose={onClose}
      controls={
        controls !== undefined ? (
          controls
        ) : (
          <WindowControls onClose={onClose} zoomRole="zoom" minimizeDisabled zoomDisabled />
        )
      }
      className={cn("mac-finder-info", className)}
      {...props}
    >
      <InspectorPanelHeader
        icon={<ItemIcon node={node} size={32} />}
        title={node.name}
        detail={formatSize(node.size)}
        subtitle={`Modified: ${modified}`}
        {...(iconTakesPaste
          ? {
              className: "mac-finder-info-pasted-icon",
              role: "group",
              "aria-label": `Icon of ${node.name}: paste a picture to replace it`,
              tabIndex: 0,
              onPaste(event: ClipboardEvent<HTMLDivElement>) {
                // A browser sends a paste to the selection, which can be any text in the header.
                if (document.activeElement !== event.currentTarget) return;
                const files = [...event.clipboardData.files];
                onIconPaste(
                  path,
                  files.find((file) => file.type.startsWith("image/")),
                );
              },
              onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
                if (event.target !== event.currentTarget) return;
                // The browser pastes only if the desktop's menu keys leave the key alone: Edit > Paste
                // would otherwise take it, into the folder Finder shows.
                if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v") {
                  event.stopPropagation();
                } else if (custom && (event.key === "Delete" || event.key === "Backspace")) {
                  event.preventDefault();
                  onIconRemove?.(path);
                }
              },
            }
          : undefined)}
      >
        <div className="mac-finder-info-tags">
          <TokenField
            aria-label="Tags"
            className="mac-finder-info-tags-field"
            placeholder={node.tags?.length ? undefined : "Add Tags..."}
            value={node.tags ?? []}
            onValueChange={(tags) => onTagsChange?.(path, tags)}
          />
        </div>
      </InspectorPanelHeader>

      <InspectorPanelSection title="General:" defaultOpen>
        <InspectorPanelList>
          <InspectorPanelItem label="Kind:">{kindText(node)}</InspectorPanelItem>
          <InspectorPanelItem label="Size:">{sizeText(root, path, node)}</InspectorPanelItem>
          <InspectorPanelItem label="Where:">{where}</InspectorPanelItem>
          <InspectorPanelItem label="Created:">
            {formatDate(extras?.created ?? node.created ?? node.modified, "long")}
          </InspectorPanelItem>
          <InspectorPanelItem label="Modified:">{modified}</InspectorPanelItem>
        </InspectorPanelList>
        <div className="mac-finder-info-checks">
          <Checkbox size="small" {...flag("stationery")}>
            Stationery pad
          </Checkbox>
          <Checkbox size="small" {...flag("locked")}>
            Locked
          </Checkbox>
        </div>
      </InspectorPanelSection>

      <InspectorPanelSection title="More Info:" defaultOpen>
        <div className="mac-finder-info-facts">
          <InspectorPanelList>
            <InspectorPanelItem label="Last opened:">
              {formatDate(node.opened ?? node.modified)}
            </InspectorPanelItem>
            {node.kind === "image" && (
              <InspectorPanelItem label="Dimensions:">{node.dimensions ?? "--"}</InspectorPanelItem>
            )}
            {extras?.facts.map(([label, value]) => (
              <InspectorPanelItem key={label} label={`${label}:`}>
                {value}
              </InspectorPanelItem>
            ))}
          </InspectorPanelList>
        </div>
      </InspectorPanelSection>

      <InspectorPanelSection title="Name & Extension:" defaultOpen>
        <div className="mac-finder-info-name">
          <TextField
            aria-label="Name & Extension"
            className="mac-finder-info-name-field"
            value={onRename ? name : node.name}
            readOnly={!onRename || node.locked}
            title={node.locked ? "This item is locked. Unlock it to rename it." : undefined}
            onChange={(event) => setName(event.currentTarget.value)}
            onBlur={keepName}
            onKeyDown={(event) => {
              if (event.key === "Enter") keepName();
            }}
          />
          <Checkbox size="small" className="mac-finder-info-name-check" {...flag("hideExtension")}>
            Hide extension
          </Checkbox>
        </div>
      </InspectorPanelSection>

      <InspectorPanelSection title="Comments:">
        <div className="mac-finder-info-comments">
          <TextView
            aria-label="Comments"
            value={comments}
            onValueChange={setComments}
            onBlur={() => {
              if (comments !== (node.comment ?? "")) onCommentChange?.(path, comments);
            }}
          />
        </div>
      </InspectorPanelSection>

      {applications.length > 0 && (
        <InspectorPanelSection title="Open with:" defaultOpen>
          <OpenWith
            key={node.id ?? path}
            applications={applications}
            onChangeAll={onChangeOpener}
          />
        </InspectorPanelSection>
      )}

      <InspectorPanelSection title="Preview:">
        <div className="mac-finder-info-preview">
          <ItemIcon node={node} size={128} />
        </div>
      </InspectorPanelSection>

      <InspectorPanelSection title="Sharing & Permissions:" defaultOpen>
        <Permissions key={path} reason={host?.permissions} />
      </InspectorPanelSection>
    </InspectorPanel>
  );
}
