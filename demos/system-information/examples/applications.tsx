import { SystemInformation } from "../system-information";

/**
 * A report that lists things: Software > Applications is a table whose headings sort, over the
 * details of the row that is selected.
 */
export default function Applications() {
  return (
    <SystemInformation
      width="100%"
      height={520}
      style={{ maxWidth: 751 }}
      defaultSelectedId="software/applications"
      defaultExpanded={["software"]}
    />
  );
}
