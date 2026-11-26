import { FaceTime } from "../facetime";

/**
 * The window as the reference captures show it: no recent calls. Type a name in the field:
 * an Audio and a Video button appear under the list, and Return places a video call. A panel
 * over the camera preview names who is called until End is pressed; the call then heads the
 * list. Nothing is dialled, and no camera or microphone is asked for.
 */
export default function Basic() {
  return <FaceTime width="100%" style={{ minWidth: 560, maxWidth: 652 }} />;
}
