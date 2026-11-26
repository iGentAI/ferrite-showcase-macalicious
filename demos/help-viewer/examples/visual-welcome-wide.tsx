import { HelpViewer } from "../help-viewer";

/**
 * Visual comparison target: the whole of 10-15-Catalina-Dark-Help.png, 1846 x 1536 px, i.e.
 * 923 x 768 pt: the 877 x 722 pt window at (23, 19) with its shadow around it, over the white
 * matte the comparison sets behind the capture's transparent margin.
 *
 * The Dark Aqua capture has the table of contents hidden, so the welcome page takes the whole
 * window. The page itself is white in this appearance too; only the bar is dark.
 */
export default function VisualWelcomeWide() {
  return (
    <div style={{ width: 923, height: 768, background: "white", position: "relative" }}>
      <HelpViewer defaultSidebarOpen={false} style={{ position: "absolute", left: 23, top: 19 }} />
    </div>
  );
}
