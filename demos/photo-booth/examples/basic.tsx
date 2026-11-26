import { PhotoBooth } from "../photo-booth";

/**
 * Page through the effects with the dots and the arrows, and choose a preview: the window
 * turns to the camera view with that effect, where Take Photo counts down from three and adds
 * a picture to the strip. Effects returns to the browser.
 */
export default function Basic() {
  return <PhotoBooth />;
}
