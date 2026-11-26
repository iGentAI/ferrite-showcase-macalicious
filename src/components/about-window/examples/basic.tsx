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
import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";

/** Stand-in artwork: the macOS badge is Apple's and is not part of the library. */
function Badge() {
  return (
    <svg width="153" height="153" viewBox="0 0 153 153" aria-hidden="true">
      <circle cx="76.5" cy="76.5" r="73" fill="#5e6f8c" stroke="#e4e4e9" strokeWidth="7" />
      <path d="M12 98q30-34 52-14t38-22 36 26q-10 46-63 55-46-4-63-45z" fill="#33415c" />
    </svg>
  );
}

export default function Basic() {
  return (
    <AboutWindow
      title="About This Mac"
      tabs={
        <AboutWindowTabs aria-label="Sections">
          <AboutWindowTab value="overview">Overview</AboutWindowTab>
          <AboutWindowTab value="displays">Displays</AboutWindowTab>
          <AboutWindowTab value="storage">Storage</AboutWindowTab>
        </AboutWindowTabs>
      }
    >
      <AboutWindowPanel value="overview">
        <AboutWindowOverview image={<Badge />}>
          <AboutWindowTitle emphasized="macOS">Catalina</AboutWindowTitle>
          <AboutWindowVersion label="Version">10.15</AboutWindowVersion>
          <AboutWindowDetails>
            <AboutWindowDetail label="MacBook Pro (15-inch, 2019)" />
            <AboutWindowDetail label="Processor">2.3 GHz 8-Core Intel Core i9</AboutWindowDetail>
            <AboutWindowDetail label="Memory">16 GB 2400 MHz DDR4</AboutWindowDetail>
            <AboutWindowDetail label="Startup Disk">Macintosh SSD</AboutWindowDetail>
          </AboutWindowDetails>
          <AboutWindowActions>
            <PushButton size="small">System Report…</PushButton>
            <PushButton size="small">Software Update…</PushButton>
          </AboutWindowActions>
        </AboutWindowOverview>
        <AboutWindowFooter>
          Stand-in text for the copyright line.{" "}
          <AboutWindowLink href="#license">License Agreement</AboutWindowLink>
        </AboutWindowFooter>
      </AboutWindowPanel>
      <AboutWindowPanel value="displays" style={{ padding: 20 }}>
        <Label>Built-in Retina Display, 15.4-inch (2880 × 1800)</Label>
      </AboutWindowPanel>
      <AboutWindowPanel value="storage" style={{ padding: 20 }}>
        <Label>Macintosh SSD: 201.46 GB available of 499.96 GB</Label>
      </AboutWindowPanel>
    </AboutWindow>
  );
}
