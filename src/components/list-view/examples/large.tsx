import { ListView, ListViewRowDetail, ListViewRowTitle } from "macalicious/list-view";

const COUNT = 10000;

const title = (index: number) => `Message ${index + 1}`;

const renderRow = (index: number) => (
  <>
    <ListViewRowTitle>{title(index)}</ListViewRowTitle>
    <ListViewRowDetail lead={`${(index % 12) + 1}/${(index % 28) + 1}/19`}>
      Row {index + 1} of {COUNT}
    </ListViewRowDetail>
  </>
);

/**
 * Ten thousand rows: only the ones in view (and a few beyond) are in the document. Shift
 * extends the selection and Command adds a row to it or takes one out; typing "message 5000"
 * goes there.
 */
export default function Large() {
  return (
    <ListView
      aria-label="Messages"
      count={COUNT}
      rowHeight={56}
      separator="inset"
      selectionMode="multiple"
      defaultValue={[0]}
      renderRow={renderRow}
      getRowLabel={title}
      style={{ width: 248, height: 280 }}
    />
  );
}
