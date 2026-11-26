import { SafariFloatingVideoStage } from "../safari-stage";

/**
 * Visual check target: the floating video over the top trailing part of the screen, with the
 * inactive Safari window where the Light capture has it.
 */
export default function VisualFloatingVideoLight() {
  return <SafariFloatingVideoStage capture="light" />;
}
