"use client";

import { Checkbox } from "macalicious/checkbox";
import { ColorSwatch, ColorSwatchPicker, ThumbnailSwatch } from "macalicious/color-swatch-picker";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import {
  ACCENTS,
  type Accent,
  type Appearance,
  setAccent,
  setAppearance,
  setHighlight,
} from "macalicious/lib/appearance";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { RadioButton, RadioGroup } from "macalicious/radio-button";
import { useEffect, useId, useState } from "react";
import { servedByDesktopApp } from "../../../desktop/desktop-server";
import { PaneChoice } from "../../choice";
import { PaneFooter, PaneForm, PaneRow, PaneRule } from "../../form";
import { usePreference, usePreferences } from "../../pane";
import { AppearanceArtwork, BrowserArtwork } from "./artwork";
import { ASK_TO_KEEP_KEY, CLOSE_WINDOWS_KEY } from "./document-settings";
import "./general.css";
import { Uncaptured } from "../uncaptured";

const APPEARANCES = [
  ["light", "Light"],
  ["dark", "Dark"],
  ["auto", "Auto"],
] as const;

const HANDOFF_LIMIT = "A web page cannot reach your other devices, so this stays off.";

const capitalized = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

const isAccent = (name: string | null): name is Accent =>
  name !== null && (ACCENTS as readonly string[]).includes(name);

interface Theme {
  appearance: Appearance;
  /** `null` for an accent that is none of the eight: a custom one. */
  accent: Accent | null;
  /** `null` when the highlight follows a custom accent. */
  highlight: Accent | null;
}

/**
 * What the pane marks for an element. The appearance is the element's own: Light or Dark when
 * its attribute says so, and Auto without one, when it follows its surroundings (an ancestor
 * with an appearance, or the operating system). Auto names no appearance, so it is the true
 * choice for an element without the attribute wherever it is, and choosing it, which removes
 * the attribute, always holds. The accent has no such choice, so it is the one in effect: the
 * element's own or the nearest ancestor's, as the tokens inherit, and blue without any. The
 * highlight is the one in effect too: the colour named by the nearest element that sets one,
 * and the accent where that element only has an accent or says that it follows it.
 */
function readTheme(target: HTMLElement): Theme {
  const appearance = target.getAttribute("data-appearance");
  const accent = target.closest("[data-accent]")?.getAttribute("data-accent") ?? "blue";
  const highlight =
    target.closest("[data-highlight], [data-accent]")?.getAttribute("data-highlight") ?? null;
  const inEffect = isAccent(accent) ? accent : null;
  return {
    appearance: appearance === "light" || appearance === "dark" ? appearance : "auto",
    accent: inEffect,
    highlight: isAccent(highlight) ? highlight : inEffect,
  };
}

/**
 * System Preferences > General. Appearance, accent colour and highlight colour are real: they
 * set the attributes that theme the page through `macalicious/lib/appearance`. The other
 * settings keep their state and change nothing.
 *
 * The themed element is the only record of the appearance and the accent: the pane shows what
 * its attributes say (for the accent, also what it inherits), and follows them when something
 * else changes them, so the choice that is marked is always the one in effect. The settings
 * `general.appearance` and `general.accent`, given with `defaultSettings`, are applied to that
 * element once, when the pane first opens.
 *
 * Distances are those of reference/spec/apps/system-preferences-general.md, in points from
 * the top-left corner of the window frame.
 */
export function General() {
  const served = servedByDesktopApp();
  const { themeTarget } = usePreferences();
  const [seedAppearance, setSeedAppearance] = usePreference<Appearance | null>(
    "general.appearance",
    null,
  );
  const [seedAccent, setSeedAccent] = usePreference<Accent | null>("general.accent", null);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [hideMenuBar, setHideMenuBar] = usePreference("general.hideMenuBar", false);
  const [scrollBars, setScrollBars] = usePreference("general.scrollBars", "automatic");
  const [scrollClick, setScrollClick] = usePreference("general.scrollClick", "page");
  const [askToKeep, setAskToKeep] = usePreference(ASK_TO_KEEP_KEY, false);
  const [closeWindows, setCloseWindows] = usePreference(CLOSE_WINDOWS_KEY, true);
  const [handoff, setHandoff] = usePreference("general.handoff", true);
  const [smoothing, setSmoothing] = usePreference("general.fontSmoothing", true);
  const id = useId();

  // Apply the starting values once, then follow the element: its attributes are read now,
  // whenever they change and whenever another element becomes the target.
  useEffect(() => {
    const target = themeTarget ?? document.documentElement;
    if (seedAppearance !== null) {
      setAppearance(seedAppearance, target);
      setSeedAppearance(null);
    }
    if (seedAccent !== null) {
      setAccent(seedAccent, target);
      setHighlight("accent", target);
      setSeedAccent(null);
    }
    // The accent is inherited, so what is watched is the tree the element is in: attributes
    // anywhere in it, and nodes moving, which changes what the element inherits from. The
    // element may be outside the document, and may move from one tree to another.
    const observer = new MutationObserver(() => follow());
    let root: Node | null = null;
    const watch = () => {
      const next = target.getRootNode();
      if (next === root) return;
      root = next;
      const options: MutationObserverInit = {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["data-appearance", "data-accent", "data-highlight"],
      };
      observer.disconnect();
      observer.observe(target.ownerDocument, options);
      if (next !== target.ownerDocument) observer.observe(next, options);
    };
    const follow = () => {
      watch();
      const next = readTheme(target);
      setTheme((current) =>
        current?.appearance === next.appearance &&
        current.accent === next.accent &&
        current.highlight === next.highlight
          ? current
          : next,
      );
    };
    follow();
    return () => observer.disconnect();
  }, [themeTarget, seedAppearance, seedAccent, setSeedAppearance, setSeedAccent]);

  // Before the first effect (and on the server) nothing has been read yet.
  const appearance = theme?.appearance ?? seedAppearance ?? "auto";
  const accent = theme ? theme.accent : (seedAccent ?? "blue");
  const highlight = theme ? theme.highlight : (seedAccent ?? "blue");

  return (
    <PaneForm>
      <PaneRow y={56} label="Appearance:" labelId={`${id}-appearance`} labelOffset={28.5}>
        <ColorSwatchPicker
          aria-labelledby={`${id}-appearance`}
          value={appearance}
          onValueChange={(value) => {
            const target = themeTarget ?? document.documentElement;
            setAppearance(value as Appearance, target);
            setTheme(readTheme(target));
          }}
          style={{ marginLeft: 1 }}
        >
          {APPEARANCES.map(([value, label]) => (
            <ThumbnailSwatch key={value} value={value} label={label}>
              <AppearanceArtwork appearance={value} />
            </ThumbnailSwatch>
          ))}
        </ColorSwatchPicker>
      </PaneRow>

      <PaneRow y={139} label="Accent color:" labelId={`${id}-accent`}>
        <ColorSwatchPicker
          aria-labelledby={`${id}-accent`}
          // A custom accent is none of the swatches: none is marked.
          value={accent ?? "custom"}
          onValueChange={(value) => {
            const target = themeTarget ?? document.documentElement;
            setAccent(value as Accent, target);
            // As in Catalina, choosing an accent makes the highlight colour follow it.
            setHighlight("accent", target);
            setTheme(readTheme(target));
          }}
          style={{ marginLeft: 1 }}
        >
          {ACCENTS.map((color) => (
            <ColorSwatch key={color} value={color} aria-label={capitalized(color)} />
          ))}
        </ColorSwatchPicker>
      </PaneRow>

      {/* The pop-up buttons' boxes start half a point before their bezels, which are at
          x 250.5: the controls' column. */}
      <PaneRow y={168} label="Highlight color:" labelId={`${id}-highlight`} labelOffset={2.5}>
        <PopUpButton
          aria-labelledby={`${id}-highlight`}
          // A highlight that follows a custom accent is none of the items: none is shown.
          value={highlight}
          onValueChange={(value) => {
            if (!isAccent(value)) return;
            const target = themeTarget ?? document.documentElement;
            setHighlight(value, target);
            setTheme(readTheme(target));
          }}
          style={{ width: 150 }}
        >
          {ACCENTS.map((color) => (
            <PopUpButtonItem
              key={color}
              value={color}
              image={
                <span className="mac-system-preferences-general-chip" data-highlight={color} />
              }
            >
              {capitalized(color)}
            </PopUpButtonItem>
          ))}
        </PopUpButton>
      </PaneRow>

      <PaneRow y={200} label="Sidebar icon size:" labelId={`${id}-sidebar`} labelOffset={2.5}>
        <PaneChoice
          setting="general.sidebarIconSize"
          options={["Small", "Medium", "Large"]}
          initial="Medium"
          width={150}
          aria-labelledby={`${id}-sidebar`}
        />
      </PaneRow>

      <PaneRow y={229}>
        <Checkbox checked={hideMenuBar} onCheckedChange={setHideMenuBar}>
          Automatically hide and show the menu bar
        </Checkbox>
      </PaneRow>

      <PaneRule y={259} />

      <PaneRow y={277} label="Show scroll bars:" labelId={`${id}-scroll-bars`}>
        <RadioGroup
          aria-labelledby={`${id}-scroll-bars`}
          value={scrollBars}
          onValueChange={(value) => setScrollBars(value as string)}
          style={{ marginLeft: 1, gap: 4 }}
        >
          <RadioButton value="automatic">Automatically based on mouse or trackpad</RadioButton>
          <RadioButton value="scrolling">When scrolling</RadioButton>
          <RadioButton value="always">Always</RadioButton>
        </RadioGroup>
      </PaneRow>

      <PaneRow y={351} label="Click in the scroll bar to:" labelId={`${id}-scroll-click`}>
        <RadioGroup
          aria-labelledby={`${id}-scroll-click`}
          value={scrollClick}
          onValueChange={(value) => setScrollClick(value as string)}
          style={{ marginLeft: 1, gap: 4 }}
        >
          <RadioButton value="page">Jump to the next page</RadioButton>
          <RadioButton value="spot">Jump to the spot that’s clicked</RadioButton>
        </RadioGroup>
      </PaneRow>

      <PaneRule y={404} />

      <PaneRow y={420} label="Default web browser:" labelId={`${id}-browser`} labelOffset={2.5}>
        <PopUpButton
          aria-labelledby={`${id}-browser`}
          defaultValue="safari"
          title={served ? "Safari is the only web browser on this desktop." : undefined}
          style={{ width: 150 }}
        >
          <PopUpButtonItem value="safari" image={<BrowserArtwork />}>
            Safari
          </PopUpButtonItem>
        </PopUpButton>
      </PaneRow>

      <PaneRule y={457} />

      <PaneRow y={474}>
        <Checkbox checked={askToKeep} onCheckedChange={setAskToKeep}>
          Ask to keep changes when closing documents
        </Checkbox>
      </PaneRow>
      <PaneRow y={494}>
        <Checkbox
          checked={closeWindows}
          onCheckedChange={setCloseWindows}
          aria-describedby={`${id}-close-note`}
        >
          Close windows when quitting an app
        </Checkbox>
      </PaneRow>
      <PaneRow y={515.5}>
        <Label id={`${id}-close-note`} textStyle="small" style={{ marginLeft: 20.5 }}>
          When selected, open documents and windows will not be restored
          <br />
          when you re-open an app.
        </Label>
      </PaneRow>

      <PaneRow y={560} label="Recent items:" labelId={`${id}-recent`} labelOffset={2.5}>
        <PaneChoice
          setting="general.recentItems"
          options={["None", "5", "10", "15", "20", "30", "50"]}
          initial="10"
          width={66}
          aria-labelledby={`${id}-recent`}
        />
        <Label style={{ marginLeft: 8.5 }}>Documents, Apps, and Servers</Label>
      </PaneRow>

      <PaneRow y={597}>
        <Checkbox
          checked={handoff && !served}
          disabled={served}
          title={served ? HANDOFF_LIMIT : undefined}
          onCheckedChange={setHandoff}
        >
          Allow Handoff between this Mac and your iCloud devices
        </Checkbox>
      </PaneRow>
      {served ? (
        <PaneRow y={613}>
          <Label textStyle="small" color="secondary" style={{ marginLeft: 20.5 }}>
            {HANDOFF_LIMIT}
          </Label>
        </PaneRow>
      ) : null}

      <PaneRule y={627} />

      <PaneRow y={644}>
        <Checkbox checked={smoothing} onCheckedChange={setSmoothing}>
          Use font smoothing when available
        </Checkbox>
      </PaneRow>

      <PaneFooter right={21} y={642}>
        <Uncaptured action="Help">
          <HelpButton />
        </Uncaptured>
      </PaneFooter>
    </PaneForm>
  );
}
