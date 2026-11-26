import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { useDesktopAppMenuItems } from "../../desktop/desktop-app-menus";
import { MailCompose } from "../mail-compose";

/**
 * The Format menu a New Message window gives the desktop's menu bar: select a word, then choose
 * Format > Font > Bold, or an alignment under Format > Text.
 */
export default function FormatMenu() {
  const items = useDesktopAppMenuItems("mail", "Format");
  return (
    <div style={{ display: "grid", gap: 12, width: "100%" }}>
      <MenuBar aria-label="Mail menus">
        <MenuBarMenu title="Format">{items}</MenuBarMenu>
      </MenuBar>
      <MailCompose
        width="100%"
        height={320}
        style={{ maxWidth: 640 }}
        defaultDraft={{
          to: ["Ines Lindqvist"],
          cc: [],
          subject: "The north trail",
          body: "If the weather holds, the north trail.",
        }}
      />
    </div>
  );
}
