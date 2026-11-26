import { News } from "../news";

/**
 * News with the sidebar and the layout of the reference screenshot and invented stories. Click
 * a channel for its stories and a story to read it; Back returns, and the Share button, which
 * works while a story is open, opens a menu that copies its headline or saves it. The window
 * takes the width the page gives it, up to the captured 1222 pt; the margins leave room for
 * its shadow.
 */
export default function Basic() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: "100%",
        overflowX: "auto",
        padding: "31px 48px 67px",
      }}
    >
      <News width="100%" style={{ minWidth: 760, maxWidth: 1222 }} />
    </div>
  );
}
