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
import { PushButton } from "macalicious/push-button";

/**
 * Visual comparison target: the About This Mac window, cropped at its frame from the
 * full-screen capture (1172 x 706 px, 586 x 353 pt). The desktop picture shows at the four
 * corners and around the frame, so the box clips the shadow and the comparisons mask the
 * corners.
 *
 * The macOS Catalina badge is Apple's artwork: a plain ring stands in for it and the
 * comparisons mask it. The light capture shows no serial number and the dark one does, so the
 * value is left out and masked too. The capture's legal text sits 5.5 pt to the left of the
 * window's centre, which the padding reproduces. The tabs and the buttons are given the
 * capture's widths (their titles are a little wider in the fallback font, so the buttons'
 * padding is reduced to keep them whole). The dark capture's window background is the tinted
 * #303032, not the catalog window colour.
 */
export default function VisualAboutThisMac() {
  return (
    <div
      style={{
        width: 586,
        height: 353,
        overflow: "hidden",
        ["--mac-color-window-background" as string]: "var(--mac-color-window-background-tinted)",
      }}
    >
      <AboutWindow
        title="About This Mac"
        height={353}
        tabs={
          <AboutWindowTabs aria-label="Sections">
            <AboutWindowTab value="overview" style={{ width: 69 }}>
              Overview
            </AboutWindowTab>
            <AboutWindowTab value="displays" style={{ width: 64 }}>
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
        <AboutWindowPanel value="overview">
          <AboutWindowOverview
            image={
              <svg width="153" height="153" viewBox="0 0 153 153" aria-hidden="true">
                <circle
                  cx="76.5"
                  cy="76.5"
                  r="73"
                  fill="#8e8e93"
                  stroke="#d1d1d6"
                  strokeWidth="7"
                />
              </svg>
            }
          >
            <AboutWindowTitle emphasized="macOS">Catalina</AboutWindowTitle>
            <AboutWindowVersion label="Version">10.15 Beta (19A582a)</AboutWindowVersion>
            <AboutWindowDetails>
              <AboutWindowDetail label="MacBook Pro (15-inch, 2019)" />
              <AboutWindowDetail label="Processor">2.3 GHz 8-Core Intel Core i9</AboutWindowDetail>
              <AboutWindowDetail label="Memory">16 GB 2400 MHz DDR4</AboutWindowDetail>
              <AboutWindowDetail label="Startup Disk">Macintosh SSD</AboutWindowDetail>
              <AboutWindowDetail label="Graphics">Intel UHD Graphics 630 1536 MB</AboutWindowDetail>
              <AboutWindowDetail label="Serial Number" />
            </AboutWindowDetails>
            <AboutWindowActions>
              <PushButton size="small" style={{ width: 103, paddingInline: 6 }}>
                System Report…
              </PushButton>
              <PushButton size="small" style={{ width: 114, paddingInline: 6 }}>
                Software Update…
              </PushButton>
            </AboutWindowActions>
          </AboutWindowOverview>
          <AboutWindowFooter style={{ paddingInlineEnd: 31 }}>
            ™ and © 1983-2019 Apple Inc. All Rights Reserved.{" "}
            <AboutWindowLink href="#license">License Agreement</AboutWindowLink>
          </AboutWindowFooter>
        </AboutWindowPanel>
      </AboutWindow>
    </div>
  );
}
