import { useState } from "react";
import { Safari } from "../safari";

/**
 * A video in Picture in Picture, as in the capture: the window floats in a corner of the screen,
 * here the box around the Safari window, while another application's window is in front.
 */
export default function PictureInPictureExample() {
  const [screen, setScreen] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setScreen} style={{ position: "relative", width: 1040, height: 640 }}>
      <Safari
        state="inactive"
        width={960}
        height={580}
        style={{ position: "absolute", left: 0, top: 60 }}
        defaultTabs={["https://harbor.example/", "https://reel.example/"]}
        defaultActiveTab={1}
        defaultPictureInPicture
        pictureInPictureContainer={screen}
        pictureInPictureWidth={400}
      />
    </div>
  );
}
