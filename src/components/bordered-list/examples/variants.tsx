import {
  BorderedList,
  BorderedListGroupRow,
  BorderedListRow,
  BorderedListRows,
} from "macalicious/bordered-list";
import { GradientButton } from "macalicious/gradient-button";
import { TableView } from "macalicious/table-view";

const folders = ["Public Folder", "Documents", "Movies", "Music", "Pictures"];

/**
 * Left: group rows, a disabled row and a disabled bar, as the user list of a locked pane.
 * Right: a table view as the list, striped, with a detached pair of buttons below it.
 */
export default function Variants() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 20 }}>
      <BorderedList
        style={{ width: 170, height: 180 }}
        footerLabel="Edit users"
        footer={
          <>
            <GradientButton glyph="add" aria-label="Add a user" disabled />
            <GradientButton glyph="remove" aria-label="Remove the selected user" disabled />
          </>
        }
      >
        <BorderedListRows aria-label="Users" rowHeight={34} defaultValue={["stephen"]}>
          <BorderedListGroupRow>Current User</BorderedListGroupRow>
          <BorderedListRow value="stephen" title="Stephen" subtitle="Admin" />
          <BorderedListGroupRow>Other Users</BorderedListGroupRow>
          <BorderedListRow value="guest" title="Guest User" subtitle="Off" disabled />
        </BorderedListRows>
      </BorderedList>
      <BorderedList
        style={{ width: 195, height: 150 }}
        footerPlacement="detached"
        footerLabel="Edit shared folders"
        footer={
          <>
            <GradientButton glyph="add" aria-label="Add a folder" />
            <GradientButton glyph="remove" aria-label="Remove the selected folder" />
          </>
        }
      >
        <TableView
          aria-label="Shared folders"
          columns={[{ id: "name", title: "Shared Folders" }]}
          rowCount={folders.length}
          renderCell={(row) => folders[row]}
          getRowLabel={(row) => folders[row] ?? ""}
          rowHeight={18}
          size="small"
          alternatingRows
          defaultValue={[0]}
        />
      </BorderedList>
    </div>
  );
}
