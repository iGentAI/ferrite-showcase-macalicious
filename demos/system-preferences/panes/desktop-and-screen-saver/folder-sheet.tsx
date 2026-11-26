"use client";

import { DefaultButton } from "macalicious/default-button";
import { OutlineView, type OutlineViewItem } from "macalicious/outline-view";
import { PushButton } from "macalicious/push-button";
import { SheetActions } from "macalicious/sheet";
import { useState } from "react";
import {
  childrenOf,
  type Drive,
  homeFolders,
  inTrash,
  useDrive,
} from "../../../desktop/desktop-files";
import { PaneSheet } from "../../pane-sheet";
import { FolderIcon } from "./artwork";

interface FolderItem extends OutlineViewItem {
  name: string;
}

const folderItems = (
  drive: Drive,
  folders: readonly { id: string; name: string }[],
): FolderItem[] =>
  folders
    .filter((folder) => !inTrash(drive, folder.id))
    .map(({ id, name }) => ({
      id,
      name,
      children: folderItems(
        drive,
        childrenOf(drive, id).filter((entry) => entry.kind === "folder"),
      ),
    }));

/** The sheet in which the person chooses a folder of their drive to add to the sources. */
export function DriveFolderSheet({
  window: frame,
  onChoose,
  onCancel,
}: {
  window: Element;
  onChoose: (folder: string) => void;
  onCancel: () => void;
}) {
  const drive = useDrive();
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<readonly (string | number)[]>([]);
  const items = drive ? folderItems(drive, homeFolders(drive)) : [];
  return (
    <PaneSheet frame={frame} title="Choose a folder of your drive" width={420} onClose={onCancel}>
      <OutlineView
        aria-label="Folders of your drive"
        size="small"
        rowHeight={20}
        indentation={12}
        items={items}
        getItemLabel={(item) => item.name}
        renderCell={(item) => (
          <span className="mac-system-preferences-desktop-and-screen-saver-source">
            <FolderIcon />
            {item.name}
          </span>
        )}
        expanded={expanded}
        onExpandedChange={setExpanded}
        value={selected === null ? [] : [selected]}
        onValueChange={(value) => {
          const [next] = value;
          setSelected(next === undefined ? null : String(next));
        }}
        style={{ height: 220, margin: "12px 0" }}
      />
      <SheetActions>
        <PushButton onClick={onCancel}>Cancel</PushButton>
        <DefaultButton
          disabled={selected === null}
          onClick={() => selected !== null && onChoose(selected)}
        >
          Add
        </DefaultButton>
      </SheetActions>
    </PaneSheet>
  );
}
