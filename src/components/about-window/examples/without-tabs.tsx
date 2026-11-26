import {
  AboutWindow,
  AboutWindowActions,
  AboutWindowFooter,
  AboutWindowOverview,
  AboutWindowTitle,
  AboutWindowVersion,
} from "macalicious/about-window";
import { PushButton } from "macalicious/push-button";

/** Stand-in artwork for an application icon. */
function Icon() {
  return (
    <svg width="128" height="128" viewBox="0 0 128 128" aria-hidden="true">
      <rect x="10" y="10" width="108" height="108" rx="24" fill="#5e6f8c" />
      <path d="M36 88l20-48h16l20 48H78l-4-10H54l-4 10zm22-22h12l-6-16z" fill="#ffffff" />
    </svg>
  );
}

/** Without tabs the window has the plain title bar and shows its title. */
export default function WithoutTabs() {
  return (
    <AboutWindow title="About Almanac" width={440}>
      <AboutWindowOverview image={<Icon />}>
        <AboutWindowTitle emphasized="Almanac" />
        <AboutWindowVersion label="Version">2.4 (1061)</AboutWindowVersion>
        <AboutWindowActions style={{ marginTop: 40 }}>
          <PushButton size="small">Acknowledgements…</PushButton>
        </AboutWindowActions>
      </AboutWindowOverview>
      <AboutWindowFooter>© 2019 Example Software. All rights reserved.</AboutWindowFooter>
    </AboutWindow>
  );
}
