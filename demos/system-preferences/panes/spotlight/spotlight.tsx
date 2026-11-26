"use client";

import { BorderedList } from "macalicious/bordered-list";
import { Checkbox } from "macalicious/checkbox";
import { EmptyState } from "macalicious/empty-state";
import { GradientButton } from "macalicious/gradient-button";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import {
  Popover,
  PopoverDescription,
  PopoverPopup,
  PopoverTitle,
  PopoverTrigger,
} from "macalicious/popover";
import { PushButton } from "macalicious/push-button";
import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";
import { TableView, type TableViewColumn } from "macalicious/table-view";
import { type ReactElement, useId, useState } from "react";
import { useDesktopDrop } from "../../../desktop/desktop-drag";
import { entryOf, useDrive } from "../../../desktop/desktop-files";
import { servedByDesktopApp } from "../../../desktop/desktop-server";
import { PaneAt, PaneFooter, PaneForm } from "../../form";
import { usePreference } from "../../pane";
import { Uncaptured } from "../uncaptured";
import { SpotlightArtwork } from "./artwork";

/** The tab view's top-left corner in the window frame: the strip is centred on the box's edge. */
const TABS = { x: 20, y: 112 };

const PRIVACY_COLUMNS: TableViewColumn[] = [{ id: "name" }];

/**
 * Spotlight's Privacy on the desktop: the drive's folders it leaves out of its results, added by
 * dragging them from Finder, as this desktop has no panel for choosing a folder.
 */
function PrivacyList() {
  const [kept, setKept] = usePreference<readonly string[]>("spotlight.privacy", []);
  const [selected, setSelected] = useState<string>();
  const drive = useDrive(kept.length > 0);
  const [refused, setRefused] = useState<string>();
  const listed = kept.flatMap((id) => {
    const entry = drive ? entryOf(drive, id) : undefined;
    return drive && !entry ? [] : [{ id, name: entry?.name ?? "" }];
  });
  const dropRef = useDesktopDrop<HTMLDivElement>({
    accepts: (item) => item.kind === "folder",
    refusal: () => "Spotlight keeps out folders. Drag a folder here.",
    sayRefusal: setRefused,
    onDrop: (items) => {
      setRefused(undefined);
      setKept([...new Set([...kept, ...items.map((item) => item.id)])]);
    },
  });
  return (
    <PaneForm origin={TABS}>
      <PaneAt x={88.5} y={149}>
        <Label textStyle="small">Prevent Spotlight from searching these folders:</Label>
      </PaneAt>
      <PaneAt x={88} y={171}>
        <div ref={dropRef}>
          <BorderedList style={{ width: 492, height: 282 }}>
            <TableView
              aria-label="Folders Spotlight leaves out"
              columns={PRIVACY_COLUMNS}
              header="none"
              alternatingRows
              rowCount={listed.length}
              rowHeight={22}
              style={{ width: 490, height: 280 }}
              getRowId={(row) => listed[row]?.id ?? ""}
              getRowLabel={(row) => listed[row]?.name ?? ""}
              value={selected === undefined ? [] : [selected]}
              onValueChange={(next) =>
                setSelected(next[0] === undefined ? undefined : String(next[0]))
              }
              renderCell={(row) => listed[row]?.name ?? ""}
            />
          </BorderedList>
        </div>
      </PaneAt>
      <PaneAt x={88} y={458}>
        <GradientButton
          glyph="remove"
          aria-label="Remove the selected folder"
          disabled={selected === undefined}
          style={{ width: 24 }}
          onClick={() => {
            setKept(kept.filter((id) => id !== selected));
            setSelected(undefined);
          }}
        />
      </PaneAt>
      <PaneAt x={122} y={460} width={458}>
        <Label textStyle="small" role="status">
          {refused ??
            "Drag a folder from Finder into the list. The Mac’s disks aren’t searched here."}
        </Label>
      </PaneAt>
    </PaneForm>
  );
}

/**
 * The categories of search results. The captures show the list down to Music and the top of
 * the next row; the rest are the categories Catalina lists after it.
 */
const CATEGORIES = [
  "Applications",
  "Bookmarks & History",
  "Calculator",
  "Contacts",
  "Conversion",
  "Definition",
  "Documents",
  "Events & Reminders",
  "Folders",
  "Fonts",
  "Images",
  "Mail & Messages",
  "Movies",
  "Music",
  "Other",
  "PDF Documents",
  "Presentations",
  "Siri Suggestions",
  "Spreadsheets",
  "System Preferences",
];

/** A column for the checkbox, whose box starts 5 pt from the list's edge, and one for the title. */
const COLUMNS: TableViewColumn[] = [{ id: "on", width: 23 }, { id: "title" }];

/** What a button of the served desktop says when pressed, where a Mac opens a sheet or a pane. */
function Says({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children: ReactElement<Record<string, unknown>>;
}) {
  return (
    <Popover>
      <PopoverTrigger render={children} />
      <PopoverPopup style={{ width: 280 }}>
        <PopoverTitle>{title}</PopoverTitle>
        <PopoverDescription>{text}</PopoverDescription>
      </PopoverPopup>
    </Popover>
  );
}

/** The key the desktop opens Spotlight with: Control-Space where a page gets it (`desktop.tsx`). */
const spotlightKeys = () =>
  /Mac/.test(navigator.platform)
    ? "Control-Option-Space opens Spotlight here, as your Mac keeps Command-Space for itself, and its icon in the menu bar opens it too. A web page cannot have Command-Space, and this key cannot be changed."
    : "Control-Space opens Spotlight here, and its icon in the menu bar opens it too. A web page cannot have Command-Space, and this key cannot be changed.";

const ABOUT_SEARCH =
  "What you type in Spotlight goes to this desktop's server to search your account. A single word also goes through the server to public dictionaries (Wiktionary, Free Dictionary, Datamuse and Wikipedia), unless Definition is off. Nothing else leaves for the Internet until you choose to search the web.";

const SUGGESTIONS_NOTE =
  "This desktop has no Spotlight Suggestions: Look Up shows Dictionary and nothing else.";

/**
 * System Preferences > Spotlight: the Search Results tab. On the served desktop the desktop's
 * Spotlight follows the checkboxes, the suggestions it does not have are dimmed, and Keyboard
 * Shortcuts and About say what is true there; elsewhere the checkboxes keep their state and change
 * no index. Privacy is not captured and says so.
 *
 * Distances are those of reference/spec/apps/system-preferences-spotlight.md, in points from
 * the top-left corner of the window frame.
 */
export function Spotlight() {
  const [tab, setTab] = usePreference<string>("spotlight.tab", "results");
  /** The categories that are switched off; every category is on in the captures. */
  const [excluded, setExcluded] = usePreference<readonly string[]>("spotlight.excluded", []);
  const [suggestions, setSuggestions] = usePreference("spotlight.suggestionsInLookUp", true);
  const id = useId();
  const served = servedByDesktopApp();

  const toggle = (category: string) =>
    setExcluded(
      excluded.includes(category)
        ? excluded.filter((name) => name !== category)
        : [...excluded, category],
    );

  return (
    <>
      <PaneForm>
        <PaneAt x={24} y={50}>
          <SpotlightArtwork />
        </PaneAt>
        <PaneAt x={86.5} y={58.5}>
          <Label style={{ whiteSpace: "nowrap" }}>
            {served ? (
              <>
                Spotlight helps you quickly find things on this desktop: applications, what is in
                <br />
                your account, sums, conversions and the meaning of a word.
              </>
            ) : (
              <>
                Spotlight helps you quickly find things on your computer and shows suggestions from
                the
                <br />
                Internet, iTunes, App Store, movie showtimes, locations nearby, and more.
              </>
            )}
          </Label>
        </PaneAt>
      </PaneForm>

      <TabView
        value={tab}
        onValueChange={(value) => setTab(value as string)}
        style={{ position: "absolute", left: TABS.x, top: TABS.y - 38, width: 628, height: 433 }}
      >
        <TabViewList aria-label="Spotlight">
          <TabViewTab value="results" style={{ width: 115, padding: 0 }}>
            Search Results
          </TabViewTab>
          <TabViewTab value="privacy" style={{ width: 69, padding: 0 }}>
            Privacy
          </TabViewTab>
        </TabViewList>
        <TabViewPanel value="results">
          <PaneForm origin={TABS}>
            <PaneAt x={88.5} y={149}>
              <Label id={`${id}-caption`} textStyle="small">
                Only selected categories will appear in Spotlight search results.
              </Label>
            </PaneAt>
            <PaneAt x={88} y={171}>
              {/* The frame of the pane's list; the table fills it to the border. */}
              <BorderedList style={{ width: 492, height: 317 }}>
                <TableView
                  aria-label="Categories"
                  aria-describedby={`${id}-caption`}
                  columns={COLUMNS}
                  header="none"
                  alternatingRows
                  selectionMode="none"
                  rowCount={CATEGORIES.length}
                  rowHeight={22}
                  getRowId={(row) => CATEGORIES[row] ?? row}
                  getRowLabel={(row) => CATEGORIES[row] ?? ""}
                  renderCell={(row, column) => {
                    const category = CATEGORIES[row] ?? "";
                    return column.id === "on" ? (
                      <Checkbox
                        aria-labelledby={`${id}-category-${row}`}
                        checked={!excluded.includes(category)}
                        onCheckedChange={() => toggle(category)}
                        style={{ margin: "-0.5px 0 0 2px" }}
                      />
                    ) : (
                      // The title sits 1.5 pt above the centre of its row, level with the box.
                      <Label
                        id={`${id}-category-${row}`}
                        onClick={() => toggle(category)}
                        style={{ position: "relative", top: -1.5 }}
                      >
                        {category}
                      </Label>
                    );
                  }}
                  style={{ width: 490, height: 315 }}
                />
              </BorderedList>
            </PaneAt>
            <PaneAt x={88} y={508}>
              <Checkbox
                checked={served ? false : suggestions}
                disabled={served}
                title={served ? SUGGESTIONS_NOTE : undefined}
                onCheckedChange={setSuggestions}
              >
                Allow Spotlight Suggestions in Look up
              </Checkbox>
            </PaneAt>
          </PaneForm>
        </TabViewPanel>
        <TabViewPanel value="privacy">
          {served ? (
            <PrivacyList />
          ) : (
            <EmptyState>The Privacy tab is not part of this demo.</EmptyState>
          )}
        </TabViewPanel>
      </TabView>

      <PaneForm>
        <PaneAt x={26} y={557}>
          {served ? (
            <Says title="Spotlight's keys" text={spotlightKeys()}>
              <PushButton style={{ width: 160, paddingInline: 0 }}>Keyboard Shortcuts…</PushButton>
            </Says>
          ) : (
            <Uncaptured action="Keyboard Shortcuts…">
              <PushButton style={{ width: 160, paddingInline: 0 }}>Keyboard Shortcuts…</PushButton>
            </Uncaptured>
          )}
        </PaneAt>
        <PaneAt x={429} y={557}>
          {served ? (
            <Says title="About Search & Privacy" text={ABOUT_SEARCH}>
              <PushButton style={{ width: 181, paddingInline: 0 }}>
                About Search & Privacy…
              </PushButton>
            </Says>
          ) : (
            <Uncaptured action="About Search & Privacy…">
              <PushButton style={{ width: 181, paddingInline: 0 }}>
                About Search & Privacy…
              </PushButton>
            </Uncaptured>
          )}
        </PaneAt>
        <PaneFooter x={622} y={557}>
          <Uncaptured action="Help">
            <HelpButton />
          </Uncaptured>
        </PaneFooter>
      </PaneForm>
    </>
  );
}
