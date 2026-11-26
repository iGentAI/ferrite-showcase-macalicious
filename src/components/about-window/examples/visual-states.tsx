import {
  AboutWindow,
  AboutWindowPanel,
  AboutWindowTab,
  AboutWindowTabs,
} from "macalicious/about-window";

/**
 * State checks (no screenshot shows them): the top of an About window, 586 x 60 pt, with the
 * tab control where About This Mac has it. The tabs have the capture's widths, so the control
 * starts 134.5 pt from the window's edge and its cells end at 203.5, 267.5, 329.5, 392.5 and
 * 451.5 pt. The comparisons click a tab, move with the arrow keys, or set the window
 * inactive, and read the fills and the focus ring.
 */
export default function VisualStates() {
  return (
    <div style={{ width: 586, height: 60, overflow: "hidden" }}>
      <AboutWindow
        title="About This Mac"
        height={120}
        tabs={
          <AboutWindowTabs aria-label="Sections">
            <AboutWindowTab id="about-visual-overview" value="overview" style={{ width: 69 }}>
              Overview
            </AboutWindowTab>
            <AboutWindowTab id="about-visual-displays" value="displays" style={{ width: 64 }}>
              Displays
            </AboutWindowTab>
            <AboutWindowTab value="storage" style={{ width: 62 }}>
              Storage
            </AboutWindowTab>
            <AboutWindowTab value="support" style={{ width: 63 }}>
              Support
            </AboutWindowTab>
            <AboutWindowTab value="service" style={{ width: 59 }}>
              Service
            </AboutWindowTab>
          </AboutWindowTabs>
        }
      >
        <AboutWindowPanel value="overview" />
        <AboutWindowPanel value="displays" />
      </AboutWindow>
    </div>
  );
}
