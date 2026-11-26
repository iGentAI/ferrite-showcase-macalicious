import { FinderGoToFolder } from "../finder-dialogs";
import { AT_CAPTURE, CaptureStage, ignore } from "../finder-dialogs-visual";

/**
 * Visual comparison target: 10-15-Catalina-Light-Finder-Go-To-Folder.png and its Dark
 * counterpart, the whole capture with the window's shadow (1082 x 516 px, 541 x 258 pt; the
 * dialog's frame is 429 x 146 pt at 56, 38), with the keyboard in the combo box as the dialog
 * has it when it opens.
 */
export default function VisualGoToFolder() {
  return (
    <CaptureStage width={541} height={258} darkWindow="#303031">
      {(stage) => (
        <FinderGoToFolder
          open
          onOpenChange={ignore}
          folders={["~/Documents/"]}
          onGo={() => false}
          container={stage}
          style={AT_CAPTURE}
        />
      )}
    </CaptureStage>
  );
}
