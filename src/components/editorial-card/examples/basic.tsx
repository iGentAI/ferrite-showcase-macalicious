import { EditorialCard } from "macalicious/editorial-card";

/** An editorial panel. The artwork is a gradient drawn here: the library ships none. */
export default function Basic() {
  return (
    <EditorialCard
      eyebrow="Collection"
      title="Act Fast!"
      artwork={
        <span
          style={{
            background:
              "linear-gradient(135deg, var(--mac-color-system-teal), var(--mac-color-system-green))",
          }}
        />
      }
      style={{ width: 462, maxWidth: "100%" }}
    >
      These games push your reaction time to the limit.
    </EditorialCard>
  );
}
