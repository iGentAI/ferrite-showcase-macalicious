import { ImageWell } from "macalicious/image-well";
import { useEffect, useState } from "react";

/**
 * A controlled well: the application keeps the image. Here it turns the file into an object
 * URL and releases the previous one; an application would upload or store the file.
 */
export default function Controlled() {
  const [picture, setPicture] = useState<{ url: string; name: string } | null>(null);
  useEffect(() => {
    if (!picture) return;
    return () => URL.revokeObjectURL(picture.url);
  }, [picture]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 17 }}>
      <ImageWell
        aria-label="User picture"
        src={picture ? picture.url : null}
        onImageChange={(file) =>
          setPicture(file ? { url: URL.createObjectURL(file), name: file.name } : null)
        }
        style={{ width: 64, height: 64 }}
      />
      <span style={{ font: "var(--mac-font-control-regular)", color: "var(--mac-color-label)" }}>
        {picture ? picture.name : "Drop, paste or choose a picture"}
      </span>
    </div>
  );
}
