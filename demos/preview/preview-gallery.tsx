"use client";

import { ListView } from "macalicious/list-view";
import { useEffect, useRef } from "react";
import type { DriveEntry } from "../desktop/desktop-files";

/** The side of the square a picture's thumbnail fits. */
const SIDE = 96;

type LoadImage = (blob: Blob) => Promise<{
  image: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}>;

/** A picture's thumbnail, read from the drive when its row comes into the list. */
function GalleryThumbnail({
  file,
  read,
  loadImage,
}: {
  file: DriveEntry;
  read: (id: string) => Promise<Blob>;
  loadImage: LoadImage;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    void (async () => {
      const picture = await loadImage(await read(file.id));
      try {
        const target = canvas.current;
        if (!live || !target) return;
        const scale = SIDE / Math.max(picture.width, picture.height);
        target.width = Math.max(1, Math.round(picture.width * scale * 2));
        target.height = Math.max(1, Math.round(picture.height * scale * 2));
        target.style.width = `${target.width / 2}px`;
        target.style.height = `${target.height / 2}px`;
        target.getContext("2d")?.drawImage(picture.image, 0, 0, target.width, target.height);
      } finally {
        picture.release();
      }
    })().catch((error: unknown) => {
      console.warn(`Preview could not draw a thumbnail of “${file.name}” (${error})`);
    });
    return () => {
      live = false;
    };
  }, [file.id, file.name, read, loadImage]);
  return (
    <span className="mac-preview-app-thumbnail">
      <span className="mac-preview-app-thumbnail-page">
        <canvas ref={canvas} />
      </span>
      <span className="mac-preview-app-thumbnail-label">{file.name}</span>
    </span>
  );
}

/** The pictures that share a window, in the sidebar: choosing one shows it. */
export function PreviewGallery({
  files,
  current,
  read,
  loadImage,
  onChoose,
}: {
  files: readonly DriveEntry[];
  current: string;
  read: (id: string) => Promise<Blob>;
  loadImage: LoadImage;
  onChoose: (file: DriveEntry) => void;
}) {
  return (
    <ListView
      aria-label="Pictures"
      className="mac-preview-rows mac-preview-app-thumbnails"
      count={files.length}
      rowHeight={132}
      getRowId={(index) => files[index]?.id ?? index}
      getRowLabel={(index) => files[index]?.name ?? ""}
      value={[current]}
      onValueChange={(value) => {
        const file = files.find((each) => each.id === value[0]);
        if (file && file.id !== current) onChoose(file);
      }}
      renderRow={(index) => {
        const file = files[index];
        return file ? <GalleryThumbnail file={file} read={read} loadImage={loadImage} /> : null;
      }}
    />
  );
}
