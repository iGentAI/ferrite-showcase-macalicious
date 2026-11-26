import { HelpViewer } from "../help-viewer";

/**
 * Visual comparison target: the whole of 10-15-Catalina-Light-Help.png, 1846 x 1536 px, i.e.
 * 923 x 768 pt: the 877 x 722 pt window at (23, 19) with its shadow around it, over the white
 * matte the comparison sets behind the capture's transparent margin.
 *
 * The capture shows the viewer as it opens: the welcome page with the table of contents beside
 * it and Welcome selected. The table of contents has the keyboard focus in the capture, which
 * the comparisons give it with a click on the selected row.
 */
export default function VisualWelcome() {
  return (
    <div style={{ width: 923, height: 768, background: "white", position: "relative" }}>
      <HelpViewer style={{ position: "absolute", left: 23, top: 19 }} />
    </div>
  );
}
