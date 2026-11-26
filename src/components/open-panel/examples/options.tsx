import { Checkbox } from "macalicious/checkbox";
import { ListView, ListViewRowTitle } from "macalicious/list-view";
import { OpenPanel } from "macalicious/open-panel";
import { PushButton } from "macalicious/push-button";
import { useState } from "react";

const files = ["Notes.rtf", "Budget.rtf", "Read Me.html"];
const renderRow = (index: number) => <ListViewRowTitle>{files[index]}</ListViewRowTitle>;

/**
 * The application's own buttons at the leading end of the bottom bar, and its accessory view,
 * which the Options button shows and hides. Without a sidebar the browser fills the width.
 */
export default function Options() {
  const [options, setOptions] = useState(true);
  const [selected, setSelected] = useState<(string | number)[]>([]);
  return (
    <OpenPanel
      width={480}
      height={300}
      style={{ maxWidth: "100%" }}
      locations={[{ value: "documents", label: "Documents" }]}
      location="documents"
      openDisabled={selected.length === 0}
      leading={
        <>
          <PushButton>New Document</PushButton>
          <PushButton aria-expanded={options} onClick={() => setOptions(!options)}>
            Options
          </PushButton>
        </>
      }
      accessory={
        options ? <Checkbox defaultChecked>Ignore rich text commands</Checkbox> : undefined
      }
    >
      <ListView
        aria-label="Documents"
        count={files.length}
        rowHeight={24}
        renderRow={renderRow}
        getRowLabel={(index) => files[index] ?? ""}
        value={selected}
        onValueChange={setSelected}
      />
    </OpenPanel>
  );
}
