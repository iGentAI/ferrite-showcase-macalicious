"use client";

import {
  BorderedList,
  BorderedListGroupRow,
  BorderedListRow,
  BorderedListRows,
} from "macalicious/bordered-list";
import { Box } from "macalicious/box";
import { Checkbox } from "macalicious/checkbox";
import { EmptyState } from "macalicious/empty-state";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { servedByDesktopApp } from "../../../desktop/desktop-server";
import { PaneAt, PaneFooter, PaneForm } from "../../form";
import { usePreference } from "../../pane";
import { AccessibilityEmblem, CategoryArtwork, type CategoryIcon } from "./artwork";
import "./accessibility.css";
import { Uncaptured } from "../uncaptured";
import { SERVED_GROUPS, ServedCategory } from "./served-accessibility";

/** The box of the selected category: its top-left corner in the window frame. */
const BOX = { x: 218, y: 58 };

const OVERVIEW = "overview";

interface Category {
  id: CategoryIcon;
  name: string;
}

/**
 * The categories the captures show, under their headings. The list of Catalina goes on below
 * Captions; no capture shows what follows, so the list ends there.
 */
const GROUPS: readonly { heading?: string; categories: readonly Category[] }[] = [
  { categories: [{ id: OVERVIEW, name: "Overview" }] },
  {
    heading: "Vision",
    categories: [
      { id: "voiceover", name: "VoiceOver" },
      { id: "zoom", name: "Zoom" },
      { id: "display", name: "Display" },
      { id: "speech", name: "Speech" },
      { id: "descriptions", name: "Descriptions" },
    ],
  },
  {
    heading: "Hearing",
    categories: [
      { id: "audio", name: "Audio" },
      { id: "captions", name: "Captions" },
    ],
  },
];

const CATEGORIES = GROUPS.flatMap((group) => group.categories);

/**
 * System Preferences > Accessibility, with Overview selected. The list of categories selects
 * for real; only the Overview is captured, so in the library demo the other categories say so. On
 * the served desktop they are `served-accessibility.tsx`, with the list's Motor and General groups.
 * The checkbox keeps its state, and on the served desktop puts `accessibility-extra.tsx` in the menu
 * bar.
 *
 * Distances are those of reference/spec/apps/system-preferences-accessibility.md, in points
 * from the top-left corner of the window frame.
 */
export function Accessibility() {
  const [categoryId, setCategoryId] = usePreference<string>("accessibility.category", OVERVIEW);
  const [menuBar, setMenuBar] = usePreference("accessibility.showStatusInMenuBar", false);

  const served = servedByDesktopApp();
  const groups: readonly {
    heading?: string;
    categories: readonly { id: string; name: string; icon?: CategoryIcon }[];
  }[] = served ? [...GROUPS, ...SERVED_GROUPS] : GROUPS;
  const category =
    groups.flatMap((group) => group.categories).find((item) => item.id === categoryId) ??
    CATEGORIES[0];

  return (
    <PaneForm>
      <PaneAt x={16} y={58}>
        <BorderedList style={{ width: 194, height: 370 }}>
          <BorderedListRows
            aria-label="Accessibility features"
            rowHeight={40}
            value={[categoryId]}
            onValueChange={(value) => {
              const [next] = value;
              if (next !== undefined) setCategoryId(next);
            }}
          >
            {groups.map((group) => [
              group.heading === undefined ? null : (
                <BorderedListGroupRow
                  key={group.heading}
                  style={{ height: 21, paddingInlineStart: 9 }}
                >
                  {group.heading}
                </BorderedListGroupRow>
              ),
              group.categories.map(({ id, name }) => {
                // The first row is a point shorter than the others. A row's picture fills it
                // from 2 pt under its top edge, which puts the title a point under the middle.
                const height = id === OVERVIEW ? 39 : 40;
                return (
                  <BorderedListRow
                    key={id}
                    value={id}
                    title={name}
                    leading={
                      <CategoryArtwork
                        icon={
                          (CATEGORIES.some((each) => each.id === id)
                            ? id
                            : OVERVIEW) as CategoryIcon
                        }
                        height={height - 2}
                        style={{ marginRight: 1.5 }}
                      />
                    }
                    style={{ minHeight: height, paddingTop: 2 }}
                  />
                );
              }),
            ])}
          </BorderedListRows>
        </BorderedList>
      </PaneAt>

      <PaneAt x={BOX.x} y={BOX.y}>
        <Box aria-label={category?.name} style={{ width: 434, height: 370 }}>
          {category?.id === OVERVIEW ? (
            <PaneForm origin={BOX}>
              <PaneAt x={406.5} y={123}>
                <AccessibilityEmblem />
              </PaneAt>
              <PaneAt x={BOX.x} y={188.5} width={434} style={{ justifyContent: "center" }}>
                <p className="mac-system-preferences-accessibility-headline">
                  Accessibility features adapt your Mac to your
                  <br />
                  individual needs.
                </p>
              </PaneAt>
              <PaneAt x={BOX.x} y={241} width={434} style={{ justifyContent: "center" }}>
                <Label align="center">
                  Your Mac can be customized to support your vision, hearing,
                  <br />
                  physical motor, and learning & literacy requirements.
                </Label>
              </PaneAt>
            </PaneForm>
          ) : served && category ? (
            <ServedCategory id={category.id} />
          ) : (
            <div className="mac-system-preferences-accessibility-empty">
              <EmptyState>The {category?.name} settings are not part of this demo.</EmptyState>
            </div>
          )}
        </Box>
      </PaneAt>

      <PaneAt x={16} y={443}>
        <Checkbox checked={menuBar} onCheckedChange={setMenuBar}>
          Show Accessibility status in menu bar
        </Checkbox>
      </PaneAt>
      <PaneFooter x={631} y={440}>
        <Uncaptured action="Help">
          <HelpButton />
        </Uncaptured>
      </PaneFooter>
    </PaneForm>
  );
}
