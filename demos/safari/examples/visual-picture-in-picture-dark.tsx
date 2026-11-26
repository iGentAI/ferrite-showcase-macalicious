import { SafariPictureInPictureStage } from "../safari-stage";

/**
 * Visual comparison target: the inactive window with two tabs behind the floating video, as
 * captured in Dark appearance: its toolbar and tab bar up to the video.
 */
export default function VisualPictureInPictureDark() {
  return <SafariPictureInPictureStage capture="dark" />;
}
