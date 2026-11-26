import { SafariTab, SafariTabBar } from "macalicious/safari-tab-bar";

/** A stand-in page icon: a rounded square in the colour given. Not a real site's artwork. */
function Icon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <rect x="1" y="1" width="14" height="14" rx="3.5" fill={color} />
    </svg>
  );
}

/**
 * Tabs with page icons, as Safari shows them when "Show website icons in tabs" is on. The
 * icon sits before the title and the pair is centred in the tab.
 */
export default function Icons() {
  return (
    <SafariTabBar aria-label="Tabs" defaultValue="example" style={{ width: 460 }}>
      <SafariTab value="start" icon={<Icon color="var(--mac-color-system-orange)" />}>
        Start Page
      </SafariTab>
      <SafariTab value="example" icon={<Icon color="var(--mac-color-system-blue)" />}>
        Example Domain
      </SafariTab>
      <SafariTab value="docs" icon={<Icon color="var(--mac-color-system-green)" />}>
        Documentation with a title that does not fit
      </SafariTab>
    </SafariTabBar>
  );
}
