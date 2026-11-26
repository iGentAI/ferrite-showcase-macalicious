import { BootCampAssistant } from "../boot-camp-assistant";

/**
 * Boot Camp Assistant as the reference screenshots show it: the Introduction step. Continue
 * goes through the steps, Go Back and Escape return, and Open Boot Camp Help opens a sheet.
 * The window has one size, so the box scrolls sideways on a narrow page; the margins leave
 * room for its shadow.
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
      <BootCampAssistant />
    </div>
  );
}
