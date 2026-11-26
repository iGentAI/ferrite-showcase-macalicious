import { SafariFloatingVideoStage } from "../safari-stage";

/**
 * Visual check target: the floating video over the top trailing part of the screen, with the
 * inactive Safari window where the Dark capture has it.
 */
export default function VisualFloatingVideoDark() {
  return <SafariFloatingVideoStage capture="dark" />;
}
