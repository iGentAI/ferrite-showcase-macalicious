import type { CSSProperties } from "react";
import { Messages } from "../messages";
import { defaultConversations } from "../messages-data";

/* The one conversation of the captures: the default conversations' first. */
const CAPTURED = defaultConversations.slice(0, 1);

/*
 * The list's material is vibrant in the captures and takes its tint from the desktop picture
 * behind the window, which is not reproduced. The scene gives the list, its selected row and
 * the line beside it the tints measured in the captures, as flat colours, and paints the
 * desktop a stand-in colour: the list and the line through the demo's two hooks, the selected
 * row through the token the list view draws an emphasised selection with, set for the scene.
 */
const SCENE = {
  position: "relative",
  overflow: "hidden",
  height: 520,
  background: "var(--mac-messages-visual-desktop)",
  "--mac-messages-list-background": "var(--mac-messages-visual-list)",
  "--mac-color-selected-content-background": "var(--mac-messages-visual-selection)",
  "--mac-messages-divider-color": "var(--mac-messages-visual-divider)",
} as CSSProperties;

/**
 * The scene of 10-15-Catalina-Light-Messages.png and 10-15-Catalina-Dark-Messages.png: the
 * Messages window, inactive, behind its key Preferences window. The outer box is the region
 * the comparisons crop, from the Preferences window's left edge to the Messages window's
 * right edge and as high as the Messages window: 1038 x 520 pt in the Aqua capture, where the
 * Preferences window is 308 pt left of the Messages window's corner and 140 pt under it, and
 * 1070 x 520 pt in the Dark Aqua one, where it is 340 pt left and 101 pt under, a day later
 * (the times read "Yesterday").
 */
export function MessagesScene({ later = false }: { later?: boolean }) {
  const left = later ? 340 : 308;
  return (
    <div style={{ ...SCENE, width: 730 + left }}>
      <Messages
        material="opaque"
        defaultConversations={CAPTURED}
        now={later ? "2019-10-08T10:00" : "2019-10-07T15:27"}
        defaultPreferencesOpen
        preferencesOffset={{ x: -left, y: later ? 101 : 140 }}
        style={{ position: "absolute", left, top: 0 }}
      />
    </div>
  );
}

/** Visual comparison target for the Aqua capture. */
export default function VisualWindow() {
  return <MessagesScene />;
}
