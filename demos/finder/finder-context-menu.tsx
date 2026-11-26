import { MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator } from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import type { ReactNode } from "react";
import { CLEAN_REASON, type FinderMenuCommands, Row } from "./finder-menus";

/** What a secondary click landed on in a Finder window. */
export type FinderContextTarget =
  | { kind: "background" }
  | { kind: "items" }
  /** A sidebar row or a path bar item: `path` is the place it stands for. */
  | { kind: "place"; path: string; from: "sidebar" | "path" };

export interface FinderContextAction {
  title: string;
  run: () => void;
  /** Tells two rows of one title apart: a saved workflow's id. */
  id?: string;
}

/** What the rows need beyond the menu bar's commands. */
export interface FinderContextCommands {
  commands: FinderMenuCommands;
  /** How many items are selected. */
  count: number;
  /** The one folder selected, opened in a new tab; `undefined` while it is anything else. */
  openInTab?: () => void;
  /** Whether every selected item is in the Trash. */
  inTrash: boolean;
  newFolderWithSelection: { enabled: boolean; run: () => void };
  deleteNow: { enabled: boolean; run: () => void };
  /** The Share menu's rows for the selection. */
  shareRows: ReactNode;
  /** The tag rows for the selection. */
  tagRows: ReactNode;
  /** What Quick Actions and Services offer for the selection: only what it can do. */
  quickActions: readonly FinderContextAction[];
  services: readonly FinderContextAction[];
  /** Whether the place at `path` can be shown in a tab, and what its rows do. */
  place: (path: string) => {
    open: () => void;
    openInTab?: () => void;
    getInfo?: () => void;
    remove?: () => void;
    /** Why Eject is dimmed, on a disk that has the row. */
    ejectReason?: string;
  };
}

export function OpenWithRows({ commands }: { commands: FinderMenuCommands }) {
  if (commands.openWith.length === 0) return null;
  return (
    <Submenu>
      <SubmenuTrigger>Open With</SubmenuTrigger>
      <SubmenuPopup>
        {commands.openWith.map(({ id, name, open }, index) => (
          <MenuItem key={id} onClick={open}>
            {index === 0 ? `${name} (default)` : name}
          </MenuItem>
        ))}
      </SubmenuPopup>
    </Submenu>
  );
}

/** The rows of a Finder window's contextual menu for `target`. */
export function FinderContextRows({
  target,
  context,
}: {
  target: FinderContextTarget;
  context: FinderContextCommands;
}) {
  const c = context.commands;
  if (target.kind === "place") {
    const place = context.place(target.path);
    return (
      <>
        <MenuItem onClick={place.open}>Open</MenuItem>
        {place.openInTab ? <MenuItem onClick={place.openInTab}>Open in New Tab</MenuItem> : null}
        {place.getInfo ? (
          <>
            <MenuSeparator />
            <MenuItem onClick={place.getInfo}>Get Info</MenuItem>
          </>
        ) : null}
        {place.remove ? <MenuItem onClick={place.remove}>Remove from Sidebar</MenuItem> : null}
        {place.ejectReason ? (
          <MenuItem disabled title={place.ejectReason} data-reason={place.ejectReason}>
            Eject
          </MenuItem>
        ) : null}
      </>
    );
  }
  if (target.kind === "background") {
    return (
      <>
        <Row command={c.newFolder}>New Folder</Row>
        <MenuSeparator />
        <Row command={c.getInfo}>Get Info</Row>
        <MenuSeparator />
        <Row command={c.paste}>{c.pasteTitle}</Row>
        {c.drive ? <Row command={c.moveHere}>{c.moveHereTitle}</Row> : null}
        <MenuSeparator />
        <Submenu>
          <SubmenuTrigger>View</SubmenuTrigger>
          <SubmenuPopup>
            <MenuRadioGroup
              value={c.view}
              onValueChange={(view) => c.setView(view as typeof c.view)}
            >
              {c.views.map(({ view, label }) => (
                <MenuRadioItem key={view} value={view}>
                  as {label}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </SubmenuPopup>
        </Submenu>
        <Submenu>
          <SubmenuTrigger>Sort By</SubmenuTrigger>
          <SubmenuPopup>
            <MenuRadioGroup value={c.sort} onValueChange={(column) => c.setSort(String(column))}>
              {c.sorts.map(({ column, label }) => (
                <MenuRadioItem key={column} value={column}>
                  {label}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </SubmenuPopup>
        </Submenu>
        <MenuSeparator />
        <MenuItem disabled title={CLEAN_REASON} data-reason={CLEAN_REASON}>
          Clean Up
        </MenuItem>
        <Submenu>
          <SubmenuTrigger disabled={!c.iconsShown}>Clean Up By</SubmenuTrigger>
          <SubmenuPopup>
            {c.sorts.map(({ column, label }) => (
              <MenuItem key={column} onClick={() => c.setSort(column)}>
                {label}
              </MenuItem>
            ))}
          </SubmenuPopup>
        </Submenu>
        <Row command={c.viewOptions}>
          {c.viewOptionsShown ? "Hide View Options" : "Show View Options"}
        </Row>
      </>
    );
  }
  if (context.inTrash) {
    return (
      <>
        <Row command={c.putBack}>Put Back</Row>
        <Row command={context.deleteNow}>Delete Immediately…</Row>
        <MenuSeparator />
        <Row command={c.getInfo}>Get Info</Row>
        <Row command={c.quickLook}>{c.quickLookTitle}</Row>
      </>
    );
  }
  return (
    <>
      {context.count > 1 ? (
        <>
          <Row command={context.newFolderWithSelection}>
            {`New Folder with Selection (${context.count} Items)`}
          </Row>
          <MenuSeparator />
        </>
      ) : null}
      <Row command={c.open}>Open</Row>
      {context.openInTab ? <MenuItem onClick={context.openInTab}>Open in New Tab</MenuItem> : null}
      <OpenWithRows commands={c} />
      <MenuSeparator />
      {c.drive ? <Row command={c.trash}>Move to Trash</Row> : null}
      <MenuSeparator />
      <Row command={c.getInfo}>Get Info</Row>
      {c.drive ? (
        <>
          <Row command={c.rename}>{c.renameTitle}</Row>
          <Row command={c.compress}>{c.compressTitle}</Row>
          <Row command={c.duplicate}>Duplicate</Row>
          <Row command={c.makeAlias}>Make Alias</Row>
        </>
      ) : null}
      <Row command={c.quickLook}>{c.quickLookTitle}</Row>
      <MenuSeparator />
      <Row command={c.copy}>{c.copyTitle}</Row>
      <Submenu>
        <SubmenuTrigger>Share</SubmenuTrigger>
        <SubmenuPopup>{context.shareRows}</SubmenuPopup>
      </Submenu>
      {context.quickActions.length > 0 ? (
        <Submenu>
          <SubmenuTrigger>Quick Actions</SubmenuTrigger>
          <SubmenuPopup>
            {context.quickActions.map(({ title, run, id }) => (
              <MenuItem key={id ?? title} onClick={run}>
                {title}
              </MenuItem>
            ))}
          </SubmenuPopup>
        </Submenu>
      ) : null}
      {context.services.length > 0 ? (
        <Submenu>
          <SubmenuTrigger>Services</SubmenuTrigger>
          <SubmenuPopup>
            {context.services.map(({ title, run }) => (
              <MenuItem key={title} onClick={run}>
                {title}
              </MenuItem>
            ))}
          </SubmenuPopup>
        </Submenu>
      ) : null}
      <MenuSeparator />
      {context.tagRows}
    </>
  );
}
