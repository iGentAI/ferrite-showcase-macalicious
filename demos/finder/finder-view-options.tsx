"use client";

import { Checkbox } from "macalicious/checkbox";
import { ColorWell } from "macalicious/color-well";
import { Label } from "macalicious/label";
import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { RadioButton, RadioGroup } from "macalicious/radio-button";
import { Separator } from "macalicious/separator";
import { Slider } from "macalicious/slider";
import type { TitleBarProps } from "macalicious/title-bar";
import { TitleBar } from "macalicious/title-bar";
import { Window, type WindowProps } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { type FinderView, sortDirection } from "./finder-data";
import type { FolderSettings } from "./finder-saved";
import { DEFAULT_LIST_COLUMNS, LIST_COLUMNS } from "./finder-views";
import "./finder.tokens.css";
import "./finder-view-options.css";

const TEXT_SIZES = [10, 11, 12, 13, 14, 15, 16];
const NOT_KEPT = "The drive does not keep this.";

export interface FinderViewOptionsProps extends Omit<WindowProps, "children"> {
  /** The folder or place the window's front tab shows. */
  folder: string;
  view: FinderView;
  /** The rows of Sort By. */
  sorts: readonly { column: string; label: string }[];
  /** The settings the view shows, with the defaults filled in. */
  settings: FolderSettings;
  /** Whether the folder keeps a view of its own. */
  alwaysOpens: boolean;
  iconSize: number;
  sortColumn: string;
  previewShown: boolean;
  onPreviewChange: (shown: boolean) => void;
  /** Changes what the folder keeps. */
  onKeep: (change: FolderSettings) => void;
  /** Use as Defaults: what this folder shows becomes what a folder without its own shows. */
  onUseAsDefaults: () => void;
  onClose?: () => void;
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
}

const VIEW_NAMES: Readonly<Record<FinderView, string>> = {
  icons: "icon",
  list: "list",
  columns: "column",
  gallery: "gallery",
};

/** Finder's View Options, ⌘J: what the folder shown looks like in the view it is shown in. */
export function FinderViewOptions({
  folder,
  view,
  sorts,
  settings,
  alwaysOpens,
  iconSize,
  sortColumn,
  previewShown,
  onPreviewChange,
  onKeep,
  onUseAsDefaults,
  onClose,
  onDragRegionPointerDown,
  ...windowProps
}: FinderViewOptionsProps) {
  const textSize = (
    <Label className="mac-finder-options-row">
      <span>Text size:</span>
      <PopUpButton
        aria-label="Text size"
        value={String(settings.text ?? 12)}
        onValueChange={(value) => onKeep({ text: Number(value) })}
      >
        {TEXT_SIZES.map((size) => (
          <PopUpButtonItem key={size} value={String(size)}>
            {size}
          </PopUpButtonItem>
        ))}
      </PopUpButton>
    </Label>
  );
  const columns = settings.columns ?? DEFAULT_LIST_COLUMNS;
  return (
    <Window
      {...windowProps}
      className="mac-finder-options"
      onKeyDown={(event) => {
        if (matchesMenuKeyEquivalent(event, "command+j")) {
          event.preventDefault();
          onClose?.();
        }
      }}
    >
      <TitleBar
        variant="utility"
        title={folder}
        controls={<WindowControls size="small" onClose={onClose} minimizeDisabled zoomDisabled />}
        onDragRegionPointerDown={onDragRegionPointerDown}
      />
      <div className="mac-finder-options-body">
        <Checkbox
          checked={alwaysOpens}
          onCheckedChange={(checked) => onKeep({ view: checked ? view : undefined })}
        >
          {`Always open in ${VIEW_NAMES[view]} view`}
        </Checkbox>
        <Separator />
        {view === "icons" || view === "list" ? (
          <Label className="mac-finder-options-row">
            <span>Sort By:</span>
            <PopUpButton
              aria-label="Sort By"
              value={sortColumn}
              onValueChange={(value) =>
                onKeep({
                  sort: { column: String(value), direction: sortDirection(String(value)) },
                })
              }
            >
              {sorts.map(({ column, label }) => (
                <PopUpButtonItem key={column} value={column}>
                  {label}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
          </Label>
        ) : null}
        {view === "icons" ? (
          <>
            <Label className="mac-finder-options-stack">
              <span>{`Icon size: ${iconSize} × ${iconSize}`}</span>
              <Slider
                aria-label="Icon size"
                size="small"
                min={32}
                max={160}
                step={16}
                value={iconSize}
                onValueChange={(value) => onKeep({ icon: value as number })}
              />
            </Label>
            <Label className="mac-finder-options-stack">
              <span>Grid spacing:</span>
              <Slider
                aria-label="Grid spacing"
                size="small"
                min={0}
                max={64}
                step={8}
                value={settings.grid ?? 0}
                onValueChange={(value) => onKeep({ grid: value as number })}
              />
            </Label>
            {textSize}
            <RadioGroup
              aria-label="Label position"
              value="bottom"
              className="mac-finder-options-group"
            >
              <span>Label position:</span>
              <RadioButton value="bottom">Bottom</RadioButton>
              <RadioButton value="right" disabled title="This view keeps names under their icons.">
                Right
              </RadioButton>
            </RadioGroup>
            <Checkbox
              checked={settings.itemInfo ?? false}
              onCheckedChange={(checked) => onKeep({ itemInfo: checked })}
            >
              Show item info
            </Checkbox>
            <Checkbox
              checked={settings.iconPreview ?? true}
              onCheckedChange={(checked) => onKeep({ iconPreview: checked })}
            >
              Show icon preview
            </Checkbox>
            <Separator />
            <RadioGroup
              aria-label="Background"
              value={settings.background && settings.background !== "white" ? "color" : "white"}
              className="mac-finder-options-group"
              onValueChange={(value) =>
                onKeep({ background: value === "color" ? "#d6e6f5" : "white" })
              }
            >
              <span>Background:</span>
              <RadioButton value="white">White</RadioButton>
              <RadioButton value="color">Color</RadioButton>
              <RadioButton value="picture" disabled title={NOT_KEPT}>
                Picture
              </RadioButton>
            </RadioGroup>
            {settings.background && settings.background !== "white" ? (
              <ColorWell
                aria-label="Background color"
                value={settings.background}
                onValueChange={(value) => onKeep({ background: String(value) })}
              />
            ) : null}
          </>
        ) : null}
        {view === "list" ? (
          <>
            <RadioGroup
              aria-label="Icon size"
              value={String(settings.listIcon ?? 16)}
              className="mac-finder-options-group"
              onValueChange={(value) => onKeep({ listIcon: Number(value) })}
            >
              <span>Icon size:</span>
              <RadioButton value="16">Small</RadioButton>
              <RadioButton value="32">Large</RadioButton>
            </RadioGroup>
            {textSize}
            <Separator />
            <span>Show Columns:</span>
            {LIST_COLUMNS.map((column) => (
              <Checkbox
                key={column.id}
                checked={columns.includes(column.id)}
                onCheckedChange={(checked) =>
                  onKeep({
                    columns: LIST_COLUMNS.map((each) => each.id).filter((id) =>
                      id === column.id ? checked : columns.includes(id),
                    ),
                  })
                }
              >
                {String(column.title)}
              </Checkbox>
            ))}
            <Checkbox disabled title="The drive does not keep when an item arrived in its folder.">
              Date Added
            </Checkbox>
            <Checkbox
              disabled
              title="The drive’s files have no versions; only an application has one."
            >
              Version
            </Checkbox>
            <Separator />
            <Checkbox
              checked={settings.relativeDates ?? false}
              onCheckedChange={(checked) => onKeep({ relativeDates: checked })}
            >
              Use relative dates
            </Checkbox>
            <Checkbox
              checked={settings.allSizes ?? false}
              onCheckedChange={(checked) => onKeep({ allSizes: checked })}
            >
              Calculate all sizes
            </Checkbox>
          </>
        ) : null}
        {view === "columns" ? (
          <>
            {textSize}
            <Checkbox
              checked={settings.showIcons ?? true}
              onCheckedChange={(checked) => onKeep({ showIcons: checked })}
            >
              Show icons
            </Checkbox>
            <Checkbox
              checked={settings.previewColumn ?? true}
              onCheckedChange={(checked) => onKeep({ previewColumn: checked })}
            >
              Show preview column
            </Checkbox>
          </>
        ) : null}
        {view === "gallery" ? (
          <>
            <Label className="mac-finder-options-stack">
              <span>Thumbnail size:</span>
              <Slider
                aria-label="Thumbnail size"
                size="small"
                min={38}
                max={102}
                step={16}
                value={settings.thumbnail ?? 54}
                onValueChange={(value) => onKeep({ thumbnail: value as number })}
              />
            </Label>
            <Checkbox checked={previewShown} onCheckedChange={onPreviewChange}>
              Show preview
            </Checkbox>
          </>
        ) : null}
        <Separator />
        <PushButton onClick={onUseAsDefaults}>Use as Defaults</PushButton>
      </div>
    </Window>
  );
}
