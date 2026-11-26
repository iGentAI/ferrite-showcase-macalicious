import { SafariSharingStage } from "../safari-stage";

/**
 * Visual comparison target: the window with one tab whose Share menu the comparison opens, as
 * in the Sharing captures of both appearances. The comparisons capture boxes of the stage:
 * the trailing end of the toolbar and two pieces of the menu's highlighted row; the menu's
 * rectangle is checked by pixels of the whole stage.
 */
export default function VisualSharing() {
  return <SafariSharingStage />;
}
