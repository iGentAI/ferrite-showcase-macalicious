import { Home } from "../home";

/**
 * Home with the accessories and scenes of the reference screenshots. Click a tile to switch an
 * accessory, a scene to run it, and the toolbar to change the view or the home. The window
 * takes the width the page gives it, up to the captured 914 pt, and its tiles wrap; the margins
 * leave room for its shadow.
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
      <Home width="100%" style={{ minWidth: 600, maxWidth: 914 }} />
    </div>
  );
}
