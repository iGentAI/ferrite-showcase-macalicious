import { FinderConnectToServer } from "../finder-dialogs";
import { AT_CAPTURE, CaptureStage, ignore } from "../finder-dialogs-visual";

/**
 * Visual comparison target: 10-15-Catalina-Light-Finder-Connect-to-Server.png and its Dark
 * counterpart, the whole capture with the window's shadow (1196 x 686 px, 598 x 343 pt; the
 * dialog's frame is 486 x 231 pt at 56, 38): the address of the capture in the combo box, which
 * has the keyboard, no favorite servers, and the help button enabled. The gear of the Action
 * button is Apple's artwork: the library's `action` image stands in for it and the comparisons
 * mask it.
 */
export default function VisualConnectToServer() {
  return (
    <CaptureStage width={598} height={343} darkWindow="#303031">
      {(stage) => (
        <FinderConnectToServer
          open
          onOpenChange={ignore}
          servers={["smb://castle.local"]}
          defaultAddress="smb://castle.local"
          favorites={[]}
          onFavoritesChange={ignore}
          onConnect={ignore}
          onBrowse={ignore}
          onHelp={ignore}
          container={stage}
          style={AT_CAPTURE}
        />
      )}
    </CaptureStage>
  );
}
