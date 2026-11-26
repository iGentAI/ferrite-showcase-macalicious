import VisualFindMy from "./visual-find-my";

/**
 * Visual comparison target: as visual-find-my in a window that is not key, which is how the
 * Dark Aqua capture of Find My was taken: the window controls are grey.
 */
export default function VisualFindMyInactive() {
  return <VisualFindMy state="inactive" />;
}
