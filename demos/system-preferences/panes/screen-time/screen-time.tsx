"use client";

import { BorderedListGroupRow, BorderedListRow, BorderedListRows } from "macalicious/bordered-list";
import { Box } from "macalicious/box";
import { EmptyState } from "macalicious/empty-state";
import { HelpButton } from "macalicious/help-button";
import { ImageView } from "macalicious/image-view";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { ScopeBar, ScopeBarButton, ScopeBarGroup, ScopeBarLabel } from "macalicious/scope-bar";
import { Segment, SegmentedControl } from "macalicious/segmented-control";
import { Separator } from "macalicious/separator";
import { TableView, type TableViewColumn } from "macalicious/table-view";
import { type ReactNode, useId } from "react";
import { PaneAt, PaneFooter, PaneForm } from "../../form";
import { usePreference } from "../../pane";
import { APP_PICTURES, Chevron, SECTION_PICTURES } from "./artwork";
import { Charts } from "./charts";
import { DAYS, type Day } from "./usage";
import "./screen-time.css";
import { Uncaptured } from "../uncaptured";

/** The name that stands in for the account of the person who took the screenshots. */
const USER = { name: "Alex", initials: "AM" };

/** The detail region's top-left corner in the window frame: it fills the pane from x 173. */
const DETAIL = { x: 173, y: 38 };
/** The well of the charts, and the well of the table under it; they share one line. */
const USAGE = { x: 196, y: 58 };
const TABLE = { x: 196, y: 346.5 };

/** The sections of the list, in three groups: a line after the first, Options at the foot. */
const SECTIONS = [
  [
    ["app-usage", "App Usage"],
    ["notifications", "Notifications"],
    ["pickups", "Pickups"],
  ],
  [
    ["downtime", "Downtime"],
    ["app-limits", "App Limits"],
    ["always-allowed", "Always Allowed"],
    ["content-and-privacy", "Content & Privacy"],
  ],
  [["options", "Options"]],
] as const;

const COLUMNS: TableViewColumn[] = [
  { id: "name", width: 253 },
  { id: "time", width: 113 },
  { id: "limits" },
];

function sectionRows(group: (typeof SECTIONS)[number]) {
  return group.map(([value, title]) => {
    const Picture = SECTION_PICTURES[value];
    return (
      <BorderedListRow
        key={value}
        value={value}
        title={title}
        leading={Picture && <Picture style={{ margin: "0 3px 0 11px" }} />}
        style={{ marginBottom: 2 }}
      />
    );
  });
}

/** The usage of a day: the wells of the charts and of the table of apps, and the footer. */
function AppUsage({
  day,
  days,
  today,
  onDayChange,
}: {
  day: Day;
  days: readonly Day[];
  today: Day;
  onDayChange: (day: string) => void;
}) {
  const [show, setShow] = usePreference<string>("screen-time.show", "apps");
  const [app, setApp] = usePreference<string>("screen-time.app", "all");
  const id = useId();
  const index = days.indexOf(day);
  const title = (item: Day) => `${item === today ? "Today" : item.weekday}, ${item.date}`;

  return (
    <>
      <PaneAt x={USAGE.x} y={USAGE.y}>
        <Box
          variant="content"
          aria-labelledby={`${id}-usage`}
          style={{ width: 452, height: 289.5 }}
        >
          <PaneForm origin={USAGE}>
            <PaneAt x={212} y={72}>
              <Label id={`${id}-usage`}>Usage</Label>
            </PaneAt>
            <PaneAt x={212} y={88.5}>
              <Label textStyle="large-value">{day.total}</Label>
            </PaneAt>

            {/* The date ends where its arrows do, whatever the font: 154.5 pt from the edge. */}
            <PaneFooter right={154.5} y={69.5}>
              <PopUpButton
                aria-label="Day"
                bordered={false}
                value={day.id}
                onValueChange={(value) => {
                  if (value != null) onDayChange(value);
                }}
              >
                {days.map((item) => (
                  <PopUpButtonItem key={item.id} value={item.id}>
                    {title(item)}
                  </PopUpButtonItem>
                ))}
              </PopUpButton>
            </PaneFooter>
            <PaneAt x={521} y={69}>
              <SegmentedControl
                aria-label="Change the day"
                trackingMode="momentary"
                variant="separated"
                distribution="fit"
              >
                <Segment
                  aria-label="Previous day"
                  onClick={() => {
                    const previous = days[index - 1];
                    if (previous) onDayChange(previous.id);
                  }}
                  style={{ width: 24 }}
                >
                  <Chevron />
                </Segment>
                <Segment onClick={() => onDayChange(today.id)} style={{ width: 68 }}>
                  Today
                </Segment>
                <Segment
                  aria-label="Next day"
                  disabled={day === today}
                  onClick={() => {
                    const next = days[index + 1];
                    if (next) onDayChange(next.id);
                  }}
                  style={{ width: 24 }}
                >
                  <Chevron forward />
                </Segment>
              </SegmentedControl>
            </PaneAt>

            <Charts day={day} />
          </PaneForm>
        </Box>
      </PaneAt>

      <PaneAt x={TABLE.x} y={TABLE.y}>
        <Box variant="content" aria-label="Apps" style={{ width: 452, height: 205.5 }}>
          <ScopeBar style={{ height: 26 }}>
            <ScopeBarLabel id={`${id}-show`}>Show:</ScopeBarLabel>
            <ScopeBarGroup
              aria-labelledby={`${id}-show`}
              value={show}
              onValueChange={(value) => setShow(value as string)}
            >
              <ScopeBarButton value="apps">Apps</ScopeBarButton>
              <ScopeBarButton value="categories">Categories</ScopeBarButton>
            </ScopeBarGroup>
          </ScopeBar>
          {show === "apps" ? (
            <TableView
              aria-label="Apps"
              header="none"
              alternatingRows
              columns={COLUMNS}
              rowCount={day.apps.length}
              rowHeight={38}
              getRowId={(row) => day.apps[row]?.id ?? row}
              getRowLabel={(row) => day.apps[row]?.name ?? ""}
              renderCell={(row, column) => {
                const item = day.apps[row];
                if (!item || column.id === "limits") return null;
                if (column.id === "time") return <Label color="secondary">{item.time}</Label>;
                const Picture = APP_PICTURES[item.id];
                return (
                  <span className="mac-system-preferences-screen-time-app">
                    {Picture && <Picture />}
                    {item.name}
                  </span>
                );
              }}
              value={[app]}
              onValueChange={(value) => {
                const [next] = value;
                if (typeof next === "string") setApp(next);
              }}
              style={{ height: 177.5 }}
            />
          ) : (
            <div className="mac-system-preferences-screen-time-empty">
              <EmptyState>The list of categories is not part of this demo.</EmptyState>
            </div>
          )}
          <PaneForm origin={TABLE}>
            <PaneAt x={453} y={353}>
              <Label textStyle="small">Time</Label>
            </PaneAt>
            <PaneAt x={565.5} y={353}>
              <Label textStyle="small">Limits</Label>
            </PaneAt>
          </PaneForm>
        </Box>
      </PaneAt>

      <PaneAt x={474} y={575.5}>
        <Label textStyle="small" color="secondary">
          Updated today at {today.updated}
        </Label>
      </PaneAt>
    </>
  );
}

/** The pane's frame: the account and the list of sections, and the box of the section chosen. */
export function ScreenTimeFrame({
  picture,
  name,
  section,
  onSectionChange,
  children,
}: {
  picture: ReactNode;
  name: string;
  section: string;
  onSectionChange: (section: string) => void;
  children: ReactNode;
}) {
  const sectionName = SECTIONS.flat().find(([value]) => value === section)?.[1];
  return (
    <PaneForm>
      <PaneAt x={37.5} y={65}>
        <ImageView mask="circle" width={98} height={98}>
          {picture}
        </ImageView>
      </PaneAt>
      <PaneAt x={0} y={172.5} width={173} style={{ justifyContent: "center" }}>
        <Label>{name}</Label>
      </PaneAt>

      <PaneAt x={0} y={213}>
        <BorderedListRows
          aria-label="Screen Time"
          rowHeight={32}
          value={[section]}
          onValueChange={(value) => {
            const [next] = value;
            if (next !== undefined) onSectionChange(next);
          }}
          style={{ width: 173, height: 400 }}
        >
          {sectionRows(SECTIONS[0])}
          {/* A line between the groups, in the 23 pt of a group row. */}
          <BorderedListGroupRow aria-hidden="true">
            <Separator style={{ margin: "10px 0 0 5px" }} />
          </BorderedListGroupRow>
          {sectionRows(SECTIONS[1])}
          {/* Options stays at the foot of the pane. */}
          <BorderedListGroupRow aria-hidden="true" style={{ height: 98 }} />
          {sectionRows(SECTIONS[2])}
        </BorderedListRows>
      </PaneAt>

      <PaneAt x={DETAIL.x} y={DETAIL.y}>
        <Box edges="leading" aria-label={sectionName} style={{ width: 495, height: 575 }}>
          {children}
        </Box>
      </PaneAt>
    </PaneForm>
  );
}

/**
 * System Preferences > Screen Time, showing App Usage. The list of sections selects; only App
 * Usage is captured, so the other sections say so. The two captures report two days: the
 * setting `screen-time.today` says which of them is today (October 3 in Aqua, October 4 in
 * Dark Aqua), and the pop-up button and the buttons beside it step through the days up to
 * today. The charts and the table are those of the day shown; nothing is measured.
 *
 * Distances are those of reference/spec/apps/system-preferences-screen-time.md, in points from
 * the top-left corner of the window frame.
 */
export function ScreenTime() {
  const [section, setSection] = usePreference<string>("screen-time.section", "app-usage");
  const [todayId] = usePreference<string>("screen-time.today", "2019-10-03");
  const [dayId, setDayId] = usePreference<string | null>("screen-time.day", null);
  const [picture] = usePreference<"monogram" | "none">("screen-time.picture", "monogram");

  const today = DAYS.find((item) => item.id === todayId) ?? DAYS[0];
  const days = DAYS.slice(0, today ? DAYS.indexOf(today) + 1 : 0);
  const day = days.find((item) => item.id === dayId) ?? today;
  const sectionName = SECTIONS.flat().find(([value]) => value === section)?.[1];

  return (
    <ScreenTimeFrame
      picture={picture === "monogram" ? USER.initials : null}
      name={USER.name}
      section={section}
      onSectionChange={setSection}
    >
      {section === "app-usage" && day && today ? (
        <PaneForm origin={DETAIL}>
          <AppUsage day={day} days={days} today={today} onDayChange={setDayId} />
          <PaneFooter x={627} y={572}>
            <Uncaptured action="Help">
              <HelpButton />
            </Uncaptured>
          </PaneFooter>
        </PaneForm>
      ) : (
        <EmptyState>
          {section === "options"
            ? "The options are not part of this demo."
            : `The ${sectionName} section is not part of this demo.`}
        </EmptyState>
      )}
    </ScreenTimeFrame>
  );
}
