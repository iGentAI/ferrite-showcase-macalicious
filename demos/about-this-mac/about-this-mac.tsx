"use client";

import {
  AboutWindow,
  AboutWindowActions,
  AboutWindowDetail,
  AboutWindowDetails,
  AboutWindowFooter,
  AboutWindowLink,
  AboutWindowOverview,
  AboutWindowPanel,
  AboutWindowTab,
  AboutWindowTabs,
  AboutWindowTitle,
  AboutWindowVersion,
} from "macalicious/about-window";
import { BorderlessButton } from "macalicious/borderless-button";
import { ImageView } from "macalicious/image-view";
import { Label } from "macalicious/label";
import { LevelIndicator } from "macalicious/level-indicator";
import { PushButton } from "macalicious/push-button";
import type { TitleBarProps } from "macalicious/title-bar";
import type { WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import { type ReactNode, useState } from "react";
import {
  ABOUT_THIS_MAC_DETAILS,
  ABOUT_THIS_MAC_TABS,
  type AboutThisMacDisplay,
  type AboutThisMacInfo,
  type AboutThisMacLinkSection,
  type AboutThisMacTab,
  type AboutThisMacVolume,
  availability,
  defaultDisplays,
  defaultInfo,
  defaultVolume,
  formatSize,
  resolveTab,
  serviceSections,
  supportSections,
  uncategorizedSize,
  usedSize,
} from "./about-this-mac-data";
import "./about-this-mac.tokens.css";
import "./about-this-mac.css";

export interface AboutThisMacProps extends Omit<WindowProps, "children" | "title"> {
  /**
   * The selected tab (controlled): `"overview"`, `"displays"`, `"storage"`, `"support"` or
   * `"service"`. An id that names no tab shows Overview.
   */
  tab?: AboutThisMacTab;
  /**
   * The tab selected at first (uncontrolled).
   * @default "overview"
   */
  defaultTab?: AboutThisMacTab;
  /** Called with the id of the tab chosen in the title bar. */
  onTabChange?: (tab: AboutThisMacTab) => void;
  /**
   * What the Overview pane says about the computer. Facts that are left out keep the values of
   * the light capture; an empty one leaves its line out (the serial number keeps its label).
   * @default defaultInfo
   */
  info?: Partial<AboutThisMacInfo>;
  /**
   * The rows under the model, as label and value, in place of the Processor, Memory, Startup
   * Disk, Graphics and Serial Number rows of `info`: for a host whose facts are not those of a
   * computer. A row with an empty value is left out.
   */
  details?: readonly (readonly [label: string, value: string])[];
  /**
   * The line under the disk's name in the Storage pane, in place of "… available of …": for a
   * volume whose capacity is not known. With it, a volume with no capacity (`0`) shows no bar.
   */
  /**
   * Further lines the version shows, one per click on it, as a Mac's version cycles through its
   * build and serial number. Without them the version is plain text.
   */
  versionDetails?: readonly string[];
  /** Draws the used space as one coloured segment per category, with swatches in the legend. */
  coloredUsage?: boolean;
  storageSummary?: string;
  /**
   * The displays of the Displays pane.
   * @default defaultDisplays
   */
  displays?: readonly AboutThisMacDisplay[];
  /** Shown beside Displays Preferences…: what a host can or cannot say about other displays. */
  displaysNote?: ReactNode;
  /**
   * The startup disk of the Storage pane, with sizes in bytes.
   * @default defaultVolume
   */
  volume?: AboutThisMacVolume;
  /** Called when System Report… is chosen: a host opens System Information. */
  onSystemReport?: () => void;
  /** Called when Software Update… is chosen. */
  onSoftwareUpdate?: () => void;
  /** Called when Displays Preferences… is chosen. */
  onDisplaysPreferences?: () => void;
  /** Called when Manage… is chosen: a host opens Storage Management. */
  onManageStorage?: () => void;
  /**
   * Called with the id of a link of the Support or the Service pane, or `"license-agreement"`
   * for the link of the footer. The window opens nothing itself.
   */
  onLink?: (id: string) => void;
  /** For the window controls: a window manager's close command. */
  onClose?: WindowControlsProps["onClose"];
  /** For the window controls: a window manager's minimize command. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** For the window controls: a window manager's zoom command. */
  onZoom?: WindowControlsProps["onZoom"];
  /**
   * For the window controls: what the green button does, were it enabled.
   * @default "zoom"
   */
  zoomRole?: WindowControlsProps["zoomRole"];
  /** For the window controls: disables minimize. */
  minimizeDisabled?: boolean;
  /**
   * For the window controls: disables zoom. About This Mac has a fixed size, so its zoom
   * button is disabled unless a host says otherwise.
   * @default true
   */
  zoomDisabled?: boolean;
  /** For the title bar: a window manager starts moving the window here. */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /** For the title bar: a window manager zooms the window here. */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
}

/** The headed groups of links of the Support and the Service pane. */
function Links({
  sections,
  onLink,
}: {
  sections: readonly AboutThisMacLinkSection[];
  onLink: ((id: string) => void) | undefined;
}) {
  return (
    <div className="mac-about-this-mac-resources">
      {sections.map((section) => (
        <section key={section.heading} className="mac-about-this-mac-section">
          <h2 className="mac-about-this-mac-heading">
            <Label textStyle="emphasized">{section.heading}</Label>
          </h2>
          {section.description ? (
            <Label
              textStyle="small"
              render={<p />}
              selectable
              className="mac-about-this-mac-description"
            >
              {section.description}
            </Label>
          ) : null}
          {section.links.length > 0 ? (
            <ul className="mac-about-this-mac-links">
              {section.links.map((link) => (
                <li key={link.id}>
                  {/* A link of these panes reports to the host and has no address, so it is
                      the library's borderless button in the link colour. */}
                  <BorderlessButton color="link" onClick={() => onLink?.(link.id)}>
                    <Label textStyle="small" color="link">
                      {link.title}
                    </Label>
                  </BorderlessButton>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  );
}

/** How many colours the storage segments cycle through (`[data-tone]` in the stylesheet). */
const SEGMENT_TONES = 6;

/**
 * The About This Mac window of macOS 10.15: the library's about window with its five tabs.
 * Overview is the pane of the reference screenshots; Displays, Storage, Support and Service
 * are provisional, as no screenshot shows them. The macOS badge, the display and the disk are
 * plain stand-ins: the library ships no artwork. Nothing is read from the machine.
 *
 * The root is the library's `AboutWindow`, whose root is a `Window`: it takes every prop that
 * is not listed here, so a window manager places and activates it; the window controls'
 * callbacks are handed to the controls and the drag region's to the about window's title bar.
 */
export function AboutThisMac({
  tab,
  defaultTab = "overview",
  onTabChange,
  info,
  details,
  versionDetails,
  coloredUsage = false,
  storageSummary,
  displays = defaultDisplays,
  displaysNote,
  volume = defaultVolume,
  onSystemReport,
  onSoftwareUpdate,
  onDisplaysPreferences,
  onManageStorage,
  onLink,
  onClose,
  onMinimize,
  onZoom,
  zoomRole = "zoom",
  minimizeDisabled,
  zoomDisabled = true,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  width = 586,
  height = 353,
  ...windowProps
}: AboutThisMacProps) {
  const [ownTab, setOwnTab] = useState(defaultTab);
  const [versionLine, setVersionLine] = useState(0);
  // The window always shows a pane: an id that names no tab stands for Overview.
  const current = resolveTab(tab ?? ownTab);
  const facts = { ...defaultInfo, ...info };
  const diskName = volume.name || "Startup Disk";
  const capacity = Number.isFinite(volume.capacity) && volume.capacity > 0 ? volume.capacity : 0;
  const used = usedSize(volume);
  const uncategorized = uncategorizedSize(volume);

  return (
    <AboutWindow
      title="About This Mac"
      width={width}
      height={height}
      {...windowProps}
      value={current}
      onValueChange={(value) => {
        const next = resolveTab(value);
        if (next === current) return;
        setOwnTab(next);
        onTabChange?.(next);
      }}
      onDragRegionPointerDown={onDragRegionPointerDown}
      onDragRegionDoubleClick={onDragRegionDoubleClick}
      controls={
        <WindowControls
          onClose={onClose}
          onMinimize={onMinimize}
          onZoom={onZoom}
          zoomRole={zoomRole}
          minimizeDisabled={minimizeDisabled}
          zoomDisabled={zoomDisabled}
        />
      }
      tabs={
        <AboutWindowTabs aria-label="Sections">
          {ABOUT_THIS_MAC_TABS.map((entry) => (
            <AboutWindowTab key={entry.id} value={entry.id} style={{ width: entry.width }}>
              {entry.title}
            </AboutWindowTab>
          ))}
        </AboutWindowTabs>
      }
    >
      <AboutWindowPanel value="overview">
        <AboutWindowOverview
          image={
            <ImageView
              mask="circle"
              width={153}
              height={153}
              className="mac-about-this-mac-badge"
            />
          }
        >
          {facts.systemName || facts.releaseName ? (
            <AboutWindowTitle emphasized={facts.systemName || undefined}>
              {facts.releaseName}
            </AboutWindowTitle>
          ) : null}
          {facts.version ? (
            <AboutWindowVersion label="Version">
              {versionDetails && versionDetails.length > 0 ? (
                <button
                  type="button"
                  className="mac-about-this-mac-version"
                  onClick={() => setVersionLine((line) => line + 1)}
                >
                  {[facts.version, ...versionDetails][versionLine % (versionDetails.length + 1)]}
                </button>
              ) : (
                facts.version
              )}
            </AboutWindowVersion>
          ) : null}
          <AboutWindowDetails>
            {facts.model ? <AboutWindowDetail label={facts.model} /> : null}
            {details
              ? details.map(([label, value]) =>
                  value ? (
                    <AboutWindowDetail key={label} label={label}>
                      {value}
                    </AboutWindowDetail>
                  ) : null,
                )
              : ABOUT_THIS_MAC_DETAILS.map(([label, key]) =>
                  facts[key] || key === "serialNumber" ? (
                    <AboutWindowDetail key={key} label={label}>
                      {facts[key] || undefined}
                    </AboutWindowDetail>
                  ) : null,
                )}
          </AboutWindowDetails>
          <AboutWindowActions>
            {/* The capture's widths: the titles are a little wider in the fallback font, so
                the padding is reduced to keep them whole. */}
            <PushButton
              size="small"
              style={{ width: 103, paddingInline: 6 }}
              onClick={() => onSystemReport?.()}
            >
              System Report…
            </PushButton>
            <PushButton
              size="small"
              style={{ width: 114, paddingInline: 6 }}
              onClick={() => onSoftwareUpdate?.()}
            >
              Software Update…
            </PushButton>
          </AboutWindowActions>
        </AboutWindowOverview>
        {/* The capture's legal text sits 5.5 pt to the left of the window's centre. */}
        <AboutWindowFooter style={{ paddingInlineEnd: 31 }}>
          {facts.copyright}{" "}
          <AboutWindowLink
            href="#license-agreement"
            onClick={(event) => {
              event.preventDefault();
              onLink?.("license-agreement");
            }}
          >
            License Agreement
          </AboutWindowLink>
        </AboutWindowFooter>
      </AboutWindowPanel>

      <AboutWindowPanel value="displays" className="mac-about-this-mac-pane">
        <div className="mac-about-this-mac-displays">
          {displays.length === 0 ? (
            <Label color="secondary">No displays are connected.</Label>
          ) : (
            displays.map((display) => (
              <figure key={display.id} className="mac-about-this-mac-display">
                <ImageView width={176} height={110} className="mac-about-this-mac-screen" />
                <figcaption className="mac-about-this-mac-caption">
                  <Label textStyle="emphasized">{display.name}</Label>
                  <Label textStyle="small">{display.size}</Label>
                  {display.graphics ? (
                    <Label textStyle="small" color="secondary">
                      {display.graphics}
                    </Label>
                  ) : null}
                </figcaption>
              </figure>
            ))
          )}
        </div>
        <div className="mac-about-this-mac-pane-actions">
          {displaysNote ? (
            <div className="mac-about-this-mac-displays-note">{displaysNote}</div>
          ) : null}
          <PushButton size="small" onClick={() => onDisplaysPreferences?.()}>
            Displays Preferences…
          </PushButton>
        </div>
      </AboutWindowPanel>

      <AboutWindowPanel value="storage" className="mac-about-this-mac-pane">
        <div className="mac-about-this-mac-storage">
          <div className="mac-about-this-mac-disk">
            <ImageView width={64} height={64} className="mac-about-this-mac-drive" />
            <Label textStyle="small" align="center">
              {diskName}
            </Label>
            <Label textStyle="small" color="secondary" align="center">
              {volume.kind}
            </Label>
          </div>
          <div className="mac-about-this-mac-usage">
            <div className="mac-about-this-mac-usage-head">
              <div className="mac-about-this-mac-caption">
                <h2 className="mac-about-this-mac-heading">
                  <Label textStyle="emphasized">{diskName}</Label>
                </h2>
                <Label textStyle="small">{storageSummary ?? availability(volume)}</Label>
              </div>
              <PushButton size="small" onClick={() => onManageStorage?.()}>
                Manage…
              </PushButton>
            </div>
            {coloredUsage && capacity > 0 ? (
              <div
                className="mac-about-this-mac-segments"
                role="img"
                aria-label={`${diskName}: ${formatSize(used)} used of ${formatSize(capacity)}`}
              >
                {volume.categories.map((category, index) => (
                  <span
                    key={category.id}
                    className="mac-about-this-mac-segment"
                    data-tone={index % SEGMENT_TONES}
                    style={{ width: `${(category.size / capacity) * 100}%` }}
                  />
                ))}
                {uncategorized > 0 ? (
                  <span
                    className="mac-about-this-mac-segment"
                    data-tone={volume.categories.length % SEGMENT_TONES}
                    style={{ width: `${(uncategorized / capacity) * 100}%` }}
                  />
                ) : null}
              </div>
            ) : capacity > 0 || storageSummary === undefined ? (
              <LevelIndicator
                variant="storage"
                aria-label={`${diskName} storage`}
                aria-valuetext={`${formatSize(used)} used of ${formatSize(capacity)}`}
                value={used}
                max={capacity > 0 ? capacity : 1}
              />
            ) : null}
            {volume.categories.length > 0 || uncategorized > 0 ? (
              <ul className="mac-about-this-mac-legend" aria-label="Storage by category">
                {volume.categories.map((category, index) => (
                  <li key={category.id} className="mac-about-this-mac-legend-item">
                    {coloredUsage ? (
                      <span
                        className="mac-about-this-mac-segment"
                        data-swatch=""
                        data-tone={index % SEGMENT_TONES}
                      />
                    ) : null}
                    <Label textStyle="small" truncate>
                      {category.name}
                    </Label>
                    <Label textStyle="small" color="secondary">
                      {formatSize(category.size)}
                    </Label>
                  </li>
                ))}
                {/* What is in use and no category accounts for, so the list covers the bar. */}
                {uncategorized > 0 ? (
                  <li className="mac-about-this-mac-legend-item">
                    {coloredUsage ? (
                      <span
                        className="mac-about-this-mac-segment"
                        data-swatch=""
                        data-tone={volume.categories.length % SEGMENT_TONES}
                      />
                    ) : null}
                    <Label textStyle="small" truncate>
                      Uncategorized
                    </Label>
                    <Label textStyle="small" color="secondary">
                      {formatSize(uncategorized)}
                    </Label>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        </div>
      </AboutWindowPanel>

      <AboutWindowPanel value="support" className="mac-about-this-mac-pane">
        <Links sections={supportSections} onLink={onLink} />
      </AboutWindowPanel>

      <AboutWindowPanel value="service" className="mac-about-this-mac-pane">
        <Links sections={serviceSections} onLink={onLink} />
      </AboutWindowPanel>
    </AboutWindow>
  );
}
