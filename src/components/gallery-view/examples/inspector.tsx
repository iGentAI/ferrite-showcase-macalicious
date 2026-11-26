import { GalleryView } from "macalicious/gallery-view";
import { useState } from "react";

const files = [
  { id: "a", name: "Aurora.jpg", size: "2.1 MB" },
  { id: "b", name: "Bay.jpg", size: "3.4 MB" },
  { id: "c", name: "Canyon.jpg", size: "1.8 MB" },
  { id: "d", name: "Dunes.jpg", size: "4.0 MB" },
  { id: "e", name: "Estuary.jpg", size: "2.7 MB" },
];

// Stand-in pictures, drawn here: a two-colour gradient per item.
const art = (index: number) =>
  `linear-gradient(160deg, hsl(${index * 47} 55% 60%), hsl(${index * 47 + 60} 60% 30%))`;

const idOf = (index: number) => files[index]?.id ?? index;
const label = (index: number) => files[index]?.name ?? "";
const preview = (index: number) => (
  <div style={{ height: "100%", maxWidth: "100%", aspectRatio: "4 / 3", background: art(index) }} />
);
const thumbnail = (index: number) => (
  <div style={{ width: 48, height: 36, background: art(index) }} />
);

/** The inspector pane shows the details of the selected file; the selection is controlled. */
export default function Inspector() {
  const [value, setValue] = useState<(string | number)[]>(["b"]);
  const file = files.find((entry) => entry.id === value[0]);
  return (
    <GalleryView
      aria-label="Pictures"
      count={files.length}
      getItemId={idOf}
      getItemLabel={label}
      renderPreview={preview}
      renderThumbnail={thumbnail}
      value={value}
      onValueChange={setValue}
      inspector={
        file && (
          <div style={{ padding: 20 }}>
            <div style={{ font: "var(--mac-font-body-emphasized)" }}>{file.name}</div>
            <div
              style={{
                font: "var(--mac-font-control-small)",
                color: "var(--mac-color-label-secondary)",
              }}
            >
              JPEG image - {file.size}
            </div>
          </div>
        )
      }
      style={{ width: 620, maxWidth: "100%", height: 260 }}
    />
  );
}
