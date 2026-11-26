import { PageControl } from "macalicious/page-control";
import { useState } from "react";

const PAGES = ["Effects 1", "Normal", "Effects 2"];

/** Controlled: the page lives in the parent, which shows the matching content. */
export default function Controlled() {
  const [page, setPage] = useState(0);
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "center", width: 220 }}>
      <div aria-live="polite" style={{ font: "var(--mac-font-body)" }}>
        {PAGES[page]}
      </div>
      <PageControl
        count={PAGES.length}
        page={page}
        onPageChange={setPage}
        getPageLabel={(index) => PAGES[index] ?? ""}
        aria-label="Effects"
      />
    </div>
  );
}
