"use client";

import { BorderedList, BorderedListRow, BorderedListRows } from "macalicious/bordered-list";
import { Checkbox } from "macalicious/checkbox";
import { EmptyState } from "macalicious/empty-state";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { LevelIndicator } from "macalicious/level-indicator";
import { PushButton } from "macalicious/push-button";
import { Separator } from "macalicious/separator";
import { TableView, type TableViewColumn } from "macalicious/table-view";
import { type CSSProperties, useId } from "react";
import { PaneAt, PaneFooter, PaneForm } from "../../form";
import { usePreference } from "../../pane";
import { Uncaptured } from "../uncaptured";
import { AccountPicture, AppArtwork, type AppIcon, PageArtwork, type PageIcon } from "./artwork";
import "./apple-id.css";

const ICLOUD = "icloud";

interface Page {
  id: PageIcon;
  title: string;
  subtitle?: string;
  /** A page that cannot be opened: Media & Purchases is not signed in, as captured. */
  disabled?: boolean;
  /** Where the row's box puts its lines, so that each baseline is the measured one. */
  style: CSSProperties;
}

/** A row's text starts 18.5 pt in; the tile's box is 27.25 pt wide (artwork.tsx). */
const ROW: CSSProperties = { paddingInlineStart: 18.5, height: 34, paddingBlockStart: 2 };

/** The pages of the account, in three groups with a line between them. */
const PAGES: readonly (readonly Page[])[] = [
  [
    { id: "overview", title: "Overview", style: ROW },
    { id: "name-phone-email", title: "Name, Phone, Email", style: ROW },
    { id: "password-security", title: "Password & Security", style: ROW },
    { id: "payment-shipping", title: "Payment & Shipping", style: ROW },
  ],
  [
    {
      id: ICLOUD,
      title: "iCloud",
      style: { ...ROW, height: 32, paddingBlockStart: 0, paddingBlockEnd: 1 },
    },
    {
      id: "media-purchases",
      title: "Media & Purchases",
      subtitle: "Not Signed In",
      disabled: true,
      style: { ...ROW, height: 46, paddingBlockStart: 0, paddingBlockEnd: 8 },
    },
  ],
  [
    {
      id: "device",
      title: "Alex’s MacBook Pro",
      subtitle: "This MacBook Pro 15″",
      style: { ...ROW, height: 42, paddingBlockStart: 4 },
    },
  ],
];

/** The apps that can keep their data in iCloud, in the order of the capture. */
const APPS: readonly (readonly [AppIcon, string])[] = [
  ["icloud-drive", "iCloud Drive"],
  ["photos", "Photos"],
  ["mail", "Mail"],
  ["contacts", "Contacts"],
  ["calendars", "Calendars"],
  ["reminders", "Reminders"],
  ["safari", "Safari"],
  ["notes", "Notes"],
  ["siri", "Siri"],
];

/**
 * The list of apps: the checkbox, whose box starts 9 pt from the list's edge; the 32 pt
 * picture; the name; and the button of the one app that has options.
 */
const COLUMNS: TableViewColumn[] = [
  { id: "on", width: 36 },
  { id: "icon", width: 37 },
  { id: "name" },
  { id: "options", width: 101, align: "right" },
];

/** The plan's size and what is left of it, in gigabytes, as captured. */
const STORAGE = { total: 5, available: 4.81 };

/**
 * System Preferences > Apple ID, on the iCloud page. The sidebar selects the pages of the
 * account; only iCloud is captured, so the other pages say so, and Media & Purchases is not
 * signed in. The checkboxes of the apps and Optimize Mac Storage keep their state and move no
 * data; Options and Manage say that no screenshot shows their sheets.
 *
 * The storage is the library's capacity bar, which is Disk Utility's: 24 pt with one fill.
 * Catalina's is 19 pt, with a part for each kind of data and its caption inside.
 *
 * The settings `apple-id.name` and `apple-id.page` hold the account's name and the open page.
 *
 * Distances are those of reference/spec/apps/system-preferences-apple-id.md, in points from
 * the top-left corner of the window frame.
 */
export function AppleId() {
  const [name] = usePreference("apple-id.name", "Alex Morgan");
  const [pageId, setPageId] = usePreference<string>("apple-id.page", ICLOUD);
  /** The apps that are switched off: all nine are on in the captures. */
  const [off, setOff] = usePreference<readonly string[]>("apple-id.appsOff", []);
  const [optimize, setOptimize] = usePreference("apple-id.optimizeStorage", true);
  const id = useId();

  const page = PAGES.flat().find((item) => item.id === pageId);
  const toggle = (app: string) =>
    setOff(off.includes(app) ? off.filter((item) => item !== app) : [...off, app]);
  const used = STORAGE.total - STORAGE.available;

  return (
    <PaneForm>
      <div className="mac-system-preferences-apple-id-detail" />
      <Separator
        aria-hidden="true"
        orientation="vertical"
        style={{ position: "absolute", top: 0, bottom: 0, left: 192 }}
      />

      {/* The column of the account: the picture and the name are centred 96 pt from the edge. */}
      <PaneAt x={47} y={65}>
        <AccountPicture />
      </PaneAt>
      <PaneAt x={0} y={172} width={192} style={{ justifyContent: "center" }}>
        <Label textStyle="emphasized">{name}</Label>
      </PaneAt>
      <PaneAt x={0} y={221}>
        <BorderedListRows
          aria-label="Apple ID"
          rowHeight={32}
          value={[pageId]}
          onValueChange={(value) => {
            const [next] = value;
            if (next !== undefined) setPageId(next);
          }}
          style={{ width: 192, height: 287 }}
        >
          {PAGES.map((group, index) => [
            index > 0 ? (
              <div
                key={`divider-${group[0]?.id}`}
                role="presentation"
                data-gap={index === 1 ? "wide" : undefined}
                className="mac-system-preferences-apple-id-divider"
              >
                <Separator aria-hidden="true" />
              </div>
            ) : null,
            group.map((item) => (
              <BorderedListRow
                key={item.id}
                value={item.id}
                title={item.title}
                subtitle={item.subtitle}
                disabled={item.disabled}
                leading={<PageArtwork icon={item.id} dimmed={item.disabled} />}
                style={item.style}
              />
            )),
          ])}
        </BorderedListRows>
      </PaneAt>

      {pageId === ICLOUD ? (
        <>
          <PaneAt x={215} y={60}>
            <Label id={`${id}-apps`} textStyle="emphasized">
              Apps on this Mac using iCloud:
            </Label>
          </PaneAt>
          <PaneAt x={215} y={86}>
            {/* The frame of the pane's list; the table fills it to the border. */}
            <BorderedList style={{ width: 433, height: 318.5 }}>
              <TableView
                aria-labelledby={`${id}-apps`}
                columns={COLUMNS}
                header="none"
                selectionMode="none"
                alternatingRows
                rowCount={APPS.length}
                rowHeight={36}
                getRowId={(row) => APPS[row]?.[0] ?? row}
                getRowLabel={(row) => APPS[row]?.[1] ?? ""}
                renderCell={(row, column) => {
                  const app = APPS[row];
                  if (!app) return null;
                  const [appId, title] = app;
                  if (column.id === "icon") {
                    return (
                      <span
                        className="mac-system-preferences-apple-id-cell"
                        style={{ marginInlineStart: -3 }}
                      >
                        <AppArtwork icon={appId} />
                      </span>
                    );
                  }
                  if (column.id === "name") {
                    return (
                      <Label
                        id={`${id}-app-${appId}`}
                        onClick={() => toggle(appId)}
                        style={{ position: "relative", top: 1 }}
                      >
                        {title}
                      </Label>
                    );
                  }
                  if (column.id === "options") {
                    return appId === "icloud-drive" ? (
                      <span
                        className="mac-system-preferences-apple-id-cell"
                        style={{
                          justifyContent: "flex-end",
                          marginInlineEnd: 9.5,
                          paddingTop: 2.5,
                        }}
                      >
                        <Uncaptured action="Options…">
                          <PushButton
                            size="small"
                            aria-label="iCloud Drive Options…"
                            style={{ width: 85, paddingInline: 0 }}
                          >
                            Options…
                          </PushButton>
                        </Uncaptured>
                      </span>
                    ) : null;
                  }
                  return (
                    <span
                      className="mac-system-preferences-apple-id-cell"
                      style={{ marginInlineStart: 6, paddingTop: 1 }}
                    >
                      <Checkbox
                        aria-labelledby={`${id}-app-${appId}`}
                        checked={!off.includes(appId)}
                        onCheckedChange={() => toggle(appId)}
                      />
                    </span>
                  );
                }}
                style={{ width: 431, height: 316.5 }}
              />
            </BorderedList>
          </PaneAt>

          <PaneAt x={225} y={414.5}>
            <Checkbox
              aria-describedby={`${id}-optimize-note`}
              checked={optimize}
              onCheckedChange={setOptimize}
            >
              Optimize Mac Storage
            </Checkbox>
          </PaneAt>
          <PaneAt x={240} y={435}>
            <Label id={`${id}-optimize-note`} textStyle="small" style={{ whiteSpace: "pre" }}>
              {
                "The full contents of iCloud Drive will be stored on this Mac if you have\nenough space. Older Documents will be stored only in iCloud when space is\nneeded."
              }
            </Label>
          </PaneAt>

          <PaneAt x={215} y={493.5} style={{ gap: "0.3em" }}>
            <Label id={`${id}-storage`} textStyle="emphasized">
              iCloud Storage:
            </Label>
            <Label>
              {STORAGE.total} GB ({STORAGE.available} GB Available)
            </Label>
          </PaneAt>
          {/* The library's bar is 24 pt high: it is centred on the 19 pt bar of the capture. */}
          <PaneAt x={215} y={515}>
            <LevelIndicator
              variant="storage"
              aria-labelledby={`${id}-storage`}
              max={STORAGE.total}
              value={used}
              getAriaValueText={() =>
                `${used.toFixed(2)} GB of ${STORAGE.total} GB used, ${STORAGE.available} GB available`
              }
              style={{ width: 338 }}
            />
          </PaneAt>
          <PaneAt x={561} y={516}>
            <Uncaptured action="Manage…">
              <PushButton style={{ width: 87, paddingInline: 0 }}>Manage…</PushButton>
            </Uncaptured>
          </PaneAt>
          <PaneFooter x={627} y={557}>
            <Uncaptured action="Help">
              <HelpButton />
            </Uncaptured>
          </PaneFooter>
        </>
      ) : (
        <div className="mac-system-preferences-apple-id-empty">
          <EmptyState>The {page?.title ?? "selected"} page is not part of this demo.</EmptyState>
        </div>
      )}
    </PaneForm>
  );
}
