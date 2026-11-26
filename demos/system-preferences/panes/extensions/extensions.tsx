"use client";

import { BorderedList, BorderedListRow, BorderedListRows } from "macalicious/bordered-list";
import { Box } from "macalicious/box";
import { Checkbox } from "macalicious/checkbox";
import { EmptyState } from "macalicious/empty-state";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { NewItemDot } from "macalicious/new-item-dot";
import { Separator } from "macalicious/separator";
import { TableView, type TableViewColumn } from "macalicious/table-view";
import { useId } from "react";
import { servedByDesktopApp } from "../../../desktop/desktop-server";
import { PaneAt, PaneFooter, PaneForm } from "../../form";
import { usePreference } from "../../pane";
import { ShareArtwork, type ShareIcon } from "./artwork";
import "./extensions.css";
import { Uncaptured } from "../uncaptured";
import { TodayExtensions } from "./today-extensions";
import { TODAY_OFF, TODAY_ORDER, TODAY_STARTS_OFF, todayWidgets } from "./today-widgets";

/** The settings box's top-left corner in the window frame. */
const BOX = { x: 248, y: 89 };

const SHARE_MENU = "share-menu";

/** The categories: id, title, and what the list says under it. Finder starts a second group. */
const CATEGORIES = [
  ["all", "All", "All third-party extensions"],
  ["actions", "Actions", "Markup"],
  ["finder-extensions", "Finder Extensions", "iCloud Drive"],
  ["photos-editing", "Photos Editing", "Markup"],
  ["quick-look", "Quick Look", "Mail and 4 more…"],
  [SHARE_MENU, "Share Menu", ""],
  ["today", "Today", "Calendar, Stocks, Weather"],
  ["finder", "Finder", "Quick Actions and Preview Pane"],
  ["touch-bar", "Touch Bar", "Quick Actions"],
] as const;

interface ShareExtension {
  id: ShareIcon;
  name: string;
  /** Part of macOS: always in the Share menu, its checkbox on and disabled. */
  builtIn?: boolean;
}

const SHARE_EXTENSIONS: readonly ShareExtension[] = [
  { id: "reading-list", name: "Add to Reading List" },
  { id: "mail", name: "Mail", builtIn: true },
  { id: "messages", name: "Messages", builtIn: true },
  { id: "airdrop", name: "AirDrop", builtIn: true },
  { id: "notes", name: "Notes" },
  { id: "photos", name: "Add to Photos" },
  { id: "people", name: "Add People", builtIn: true },
  { id: "reminders", name: "Reminders" },
  { id: "books", name: "Save to Books" },
];

/**
 * The list of share extensions: a column for the new-item dot and the checkbox, whose box
 * starts 20 pt from the list's edge, one for the 24 pt picture and one for the name.
 */
const COLUMNS: TableViewColumn[] = [
  { id: "on", width: 45 },
  { id: "icon", width: 28.5 },
  { id: "name" },
];

/** "Add to Reading List, Mail, and 6 more…": the first two names and how many follow. */
function summary(names: readonly string[]) {
  const [first, second, ...rest] = names;
  if (first === undefined) return "None";
  if (second === undefined) return first;
  return rest.length ? `${first}, ${second}, and ${rest.length} more…` : `${first}, ${second}`;
}

/** What is true of each category on the served desktop, where nothing can be installed. */
const SERVED_CATEGORIES: Readonly<Record<string, string>> = {
  all: "This desktop's apps are all its own, and nothing from elsewhere can be added to them.",
  actions: "Quick Actions in Finder and Preview are built in, and cannot be added to.",
  "finder-extensions": "Finder shows the drive kept for your account, and takes no extensions.",
  "photos-editing": "Photos edits with its own tools, and takes no extensions.",
  "quick-look": "Quick Look shows what Finder can read, and takes no extensions.",
  finder: "Finder's Quick Actions and preview are built in, and cannot be turned off.",
  "touch-bar": "A web page cannot reach a Touch Bar.",
};

/**
 * System Preferences > Extensions, with Share Menu selected. The list of categories selects
 * for real; only the Share Menu is captured, so in the library demo the other categories say so.
 * On the served desktop the checkboxes reach its Share menus (`shareExtensionOn`).
 *
 * Distances are those of reference/spec/apps/system-preferences-extensions.md, in points from
 * the top-left corner of the window frame.
 */
export function Extensions() {
  const [categoryId, setCategoryId] = usePreference<string>("extensions.category", SHARE_MENU);
  /** The share extensions that are switched on, besides the built-in ones. */
  const [enabled, setEnabled] = usePreference<readonly string[]>("extensions.shareMenu", [
    "reading-list",
    "notes",
    "photos",
    "reminders",
  ]);
  /** The extensions marked as new with a dot, until their checkbox is used. */
  const [fresh, setFresh] = usePreference<readonly string[]>("extensions.newExtensions", ["books"]);
  const id = useId();

  const isOn = (extension: ShareExtension) =>
    extension.builtIn === true || enabled.includes(extension.id);
  const toggle = (extension: ShareExtension) => {
    if (extension.builtIn) return;
    setEnabled(
      enabled.includes(extension.id)
        ? enabled.filter((item) => item !== extension.id)
        : [...enabled, extension.id],
    );
    if (fresh.includes(extension.id)) setFresh(fresh.filter((item) => item !== extension.id));
  };
  const category = CATEGORIES.find(([value]) => value === categoryId) ?? CATEGORIES[5];
  const shareSummary = summary(SHARE_EXTENSIONS.filter(isOn).map((extension) => extension.name));
  const [todayOrder] = usePreference<readonly string[]>(TODAY_ORDER, []);
  const [todayOff] = usePreference<readonly string[]>(TODAY_OFF, TODAY_STARTS_OFF);
  const todayOn = todayWidgets(todayOrder, todayOff)
    .filter((widget) => widget.on)
    .map((widget) => widget.name);

  return (
    <PaneForm>
      <PaneAt x={20} y={58.5}>
        <Label>Use Apple and third-party extensions to customize your Mac.</Label>
      </PaneAt>

      <PaneAt x={20} y={89}>
        <BorderedList style={{ width: 220, height: 363 }}>
          <BorderedListRows
            aria-label="Extension categories"
            rowHeight={42}
            value={[categoryId]}
            onValueChange={(value) => {
              const [next] = value;
              if (next !== undefined) setCategoryId(next);
            }}
          >
            {CATEGORIES.map(([value, title, subtitle]) => [
              value === "finder" ? (
                <div
                  key="divider"
                  role="presentation"
                  className="mac-system-preferences-extensions-divider"
                >
                  <Separator aria-hidden="true" />
                </div>
              ) : null,
              <BorderedListRow
                key={value}
                value={value}
                title={title}
                subtitle={
                  value === SHARE_MENU
                    ? shareSummary
                    : value === "today" && servedByDesktopApp()
                      ? summary(todayOn)
                      : subtitle
                }
                style={{ paddingInlineStart: 11 }}
              />,
            ])}
          </BorderedListRows>
        </BorderedList>
      </PaneAt>

      <PaneAt x={BOX.x} y={BOX.y}>
        <Box aria-label={category[1]} style={{ width: 400, height: 363 }}>
          {category[0] === SHARE_MENU ? (
            <PaneForm origin={BOX}>
              <PaneAt x={268} y={104.5}>
                <Label id={`${id}-share`}>Select extensions for sharing with others:</Label>
              </PaneAt>
              <PaneAt x={268} y={135}>
                {/* The frame of the pane's list; the table fills it to the border. */}
                <BorderedList style={{ width: 360, height: 297 }}>
                  <TableView
                    aria-labelledby={`${id}-share`}
                    columns={COLUMNS}
                    header="none"
                    selectionMode="none"
                    rowCount={SHARE_EXTENSIONS.length}
                    rowHeight={32}
                    getRowId={(row) => SHARE_EXTENSIONS[row]?.id ?? row}
                    getRowLabel={(row) => SHARE_EXTENSIONS[row]?.name ?? ""}
                    renderCell={(row, column) => {
                      const extension = SHARE_EXTENSIONS[row];
                      if (!extension) return null;
                      if (column.id === "icon") return <ShareArtwork icon={extension.id} />;
                      if (column.id === "name") {
                        return (
                          <Label
                            id={`${id}-share-${extension.id}`}
                            onClick={() => toggle(extension)}
                          >
                            {extension.name}
                          </Label>
                        );
                      }
                      const isNew = fresh.includes(extension.id);
                      return (
                        <>
                          <NewItemDot
                            visible={isNew}
                            aria-label={isNew ? "New" : undefined}
                            style={{ position: "relative", top: -0.5, marginLeft: 4 }}
                          />
                          <Checkbox
                            aria-labelledby={`${id}-share-${extension.id}`}
                            checked={isOn(extension)}
                            disabled={extension.builtIn}
                            onCheckedChange={() => toggle(extension)}
                            style={{ position: "relative", top: -0.5, marginLeft: 7 }}
                          />
                        </>
                      );
                    }}
                    style={{ width: 358, height: 295 }}
                  />
                </BorderedList>
              </PaneAt>
            </PaneForm>
          ) : (
            <div className="mac-system-preferences-extensions-empty">
              {servedByDesktopApp() ? (
                category[0] === "today" ? (
                  <TodayExtensions />
                ) : (
                  <div style={{ padding: 20 }}>
                    <Label>{SERVED_CATEGORIES[category[0]]}</Label>
                  </div>
                )
              ) : (
                <EmptyState>The {category[1]} extensions are not part of this demo.</EmptyState>
              )}
            </div>
          )}
        </Box>
      </PaneAt>

      <PaneFooter x={627} y={467}>
        <Uncaptured action="Help">
          <HelpButton />
        </Uncaptured>
      </PaneFooter>
    </PaneForm>
  );
}
