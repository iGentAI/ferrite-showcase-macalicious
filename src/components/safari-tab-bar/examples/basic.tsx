import { SafariTab, SafariTabBar } from "macalicious/safari-tab-bar";

export default function Basic() {
  return (
    <SafariTabBar aria-label="Tabs" defaultValue="example" style={{ width: 460 }}>
      <SafariTab value="start">Start Page</SafariTab>
      <SafariTab value="example">Example Domain</SafariTab>
      <SafariTab value="docs">Documentation</SafariTab>
    </SafariTabBar>
  );
}
