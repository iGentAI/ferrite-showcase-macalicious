import { BorderedList, BorderedListRow, BorderedListRows } from "macalicious/bordered-list";
import { GradientButton } from "macalicious/gradient-button";
import { StatusDot } from "macalicious/status-dot";

/**
 * Visual comparison target: the top of the service list of the Network preference pane, a
 * 170 x 400 pt bordered list of 42 pt two-line rows with an attached bar of add, remove and
 * action buttons, on the window background. The first row is selected while the list does
 * not have the keyboard focus. Reference crop (2x pixels) x=144 y=266 w=356 h=190, i.e. 178 x 95 pt: the list
 * starts 4 pt inside the crop and is cut off by it.
 * The service icons at the rows' trailing edge are Apple artwork and are not reproduced. In
 * this pane the add and remove cells are 24 pt wide and the action cell 28 pt.
 */
export default function VisualNetworkTop() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 178,
        height: 95,
        background: "light-dark(#ececec, #2f3031)",
      }}
    >
      <BorderedList
        style={{ position: "absolute", left: 4, top: 4, width: 170, height: 400 }}
        footerLabel="Edit services"
        footer={
          <>
            <GradientButton glyph="add" aria-label="Add" style={{ width: 26 }} />
            <GradientButton glyph="remove" aria-label="Remove" style={{ width: 26 }} />
            <GradientButton glyph="action" aria-label="Action" style={{ width: 30 }} />
          </>
        }
      >
        <BorderedListRows aria-label="Network services" rowHeight={42} value={["wifi"]}>
          <BorderedListRow
            value="wifi"
            title="Wi-Fi"
            subtitle="Connected"
            leading={<StatusDot status="available" />}
          />
          <BorderedListRow
            value="bluetooth"
            title="Bluetooth PAN"
            subtitle="Not Connected"
            leading={<StatusDot status="unavailable" />}
          />
        </BorderedListRows>
      </BorderedList>
    </div>
  );
}
