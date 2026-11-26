import { EmptyState } from "macalicious/empty-state";
import { SearchField } from "macalicious/search-field";
import { useState } from "react";

const MAILBOXES = ["Inbox", "Drafts", "Sent", "Junk", "Trash"];

/**
 * An empty search result. The pane is a live region, so the message is announced when it
 * appears.
 */
export default function NoResults() {
  const [query, setQuery] = useState("Archive");
  const matches = MAILBOXES.filter((name) => name.toLowerCase().includes(query.toLowerCase()));
  return (
    <div style={{ display: "grid", gap: 8, width: 260 }}>
      <SearchField
        aria-label="Search mailboxes"
        value={query}
        onValueChange={setQuery}
        style={{ width: "100%" }}
      />
      <div
        role="status"
        style={{
          height: 96,
          overflow: "auto",
          background: "var(--mac-color-control-background)",
          font: "var(--mac-font-body)",
          color: "var(--mac-color-label)",
        }}
      >
        {matches.length === 0 ? (
          <EmptyState>No Results</EmptyState>
        ) : (
          <ul style={{ margin: 0, padding: "4px 8px", listStyle: "none" }}>
            {matches.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
