import { Dictation } from "macalicious/dictation";

/** The panel while the user speaks: the application supplies the level and ends dictation. */
export default function Basic() {
  return <Dictation level={0.4} onDone={() => {}} onCancel={() => {}} />;
}
