import { HOME, RECENTS } from "../finder-data";
import { VisualWindow } from "../finder-visual";

/**
 * Visual comparison target: 10-15-Catalina-Light-Finder-Home.png, the 1105 x 732 pt frame
 * (crop x=112 y=76 w=2210 h=1464): three tabs with the home folder shown, 160 pt icons.
 */
export default function VisualHome() {
  return (
    <VisualWindow
      width={1105}
      height={732}
      defaultTabs={[RECENTS, HOME, `${HOME}/Documents`]}
      defaultActiveTab={1}
      defaultIconSize={160}
    />
  );
}
