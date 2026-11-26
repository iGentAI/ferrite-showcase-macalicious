import { ScriptEditor } from "../script-editor";

/**
 * Type in the script and press Compile, the hammer: the script is checked, indented and
 * coloured. Run, the triangle, also shows a result. The three buttons of the bottom bar
 * choose the view under the script, and the two at the end of the toolbar show and hide the
 * panes.
 */
export default function Basic() {
  return <ScriptEditor width="100%" height={560} style={{ maxWidth: 700 }} />;
}
