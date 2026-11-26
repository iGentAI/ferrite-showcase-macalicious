import { ShelfPager } from "macalicious/shelf-pager";

/** The chevrons around a strip of content that has side margins of its own. */
export default function Basic() {
  return (
    <ShelfPager previousDisabled style={{ width: 420, maxWidth: "100%" }}>
      <div
        style={{
          margin: "0 40px",
          height: 120,
          borderRadius: 8,
          background:
            "linear-gradient(135deg, var(--mac-color-system-indigo), var(--mac-color-system-teal))",
        }}
      />
    </ShelfPager>
  );
}
