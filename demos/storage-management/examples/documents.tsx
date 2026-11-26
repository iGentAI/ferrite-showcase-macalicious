import { StorageManagement } from "../storage-management";

/**
 * The window opened on a category: Documents, with its files in a table whose headings sort,
 * and the Delete… button for the selected file. No reference screenshot shows a category.
 */
export default function Documents() {
  return (
    <StorageManagement
      material="opaque"
      defaultSelectedId="documents"
      width="100%"
      height={420}
      style={{ maxWidth: 801 }}
    />
  );
}
