"use client";

import { Checkbox } from "macalicious/checkbox";
import { ColorWell } from "macalicious/color-well";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PreferencesToolbar, PreferencesToolbarItem } from "macalicious/preferences-toolbar";
import {
  PreferencesWindow,
  PreferencesWindowForm,
  PreferencesWindowPane,
  type PreferencesWindowProps,
  PreferencesWindowRow,
} from "macalicious/preferences-window";
import { useDesktopSetting } from "../desktop/desktop-personal";
import { PreviewGlyph } from "./preview-artwork";
import { PREVIEW_SETTINGS, readColor, readScale, type ScaleChoice } from "./preview-settings";

/** Why the choices of how files share a window are dimmed. */
const ONE_WINDOW =
  "Pictures dropped or opened together share a window with a thumbnail each; any other file opens in the one window Preview has on this desktop.";

/** The canvas behind a document until the person chooses another (`--mac-preview-canvas`). */
const DEFAULT_BACKGROUND = "#ececec";

export type PreviewPreferencesProps = Omit<
  PreferencesWindowProps,
  "toolbar" | "children" | "modal" | "title"
>;

function DocumentRows({
  backgroundKey,
  scaleKey,
  pixelLabel,
}: {
  backgroundKey: string;
  scaleKey: string;
  pixelLabel: string;
}) {
  const [background, setBackground] = useDesktopSetting(
    backgroundKey,
    readColor,
    DEFAULT_BACKGROUND,
  );
  const [scale, setScale] = useDesktopSetting<ScaleChoice>(scaleKey, readScale, "pixel");
  return (
    <>
      <PreferencesWindowRow label="Window background:">
        <ColorWell
          aria-label="Window background"
          value={background}
          onValueChange={(next) => setBackground(String(next))}
        />
      </PreferencesWindowRow>
      <PreferencesWindowRow label="Define 100% scale as:">
        <PopUpButton
          aria-label="Define 100% scale as"
          value={scale}
          onValueChange={(next) => next && setScale(next as ScaleChoice)}
        >
          <PopUpButtonItem value="pixel">{pixelLabel}</PopUpButtonItem>
          <PopUpButtonItem value="paper">Size on screen equals size on printout</PopUpButtonItem>
        </PopUpButton>
      </PreferencesWindowRow>
    </>
  );
}

/** Preview's Preferences, kept with the person's other settings and read by every window. */
export function PreviewPreferences(props: PreviewPreferencesProps) {
  return (
    <PreferencesWindow
      title="Preview Preferences"
      width={520}
      defaultValue="images"
      toolbar={
        <PreferencesToolbar aria-label="Preview preferences">
          <PreferencesToolbarItem value="images" icon={<PreviewGlyph name="crop" size={24} />}>
            Images
          </PreferencesToolbarItem>
          <PreferencesToolbarItem value="pdf" icon={<PreviewGlyph name="note" size={24} />}>
            PDF
          </PreferencesToolbarItem>
          <PreferencesToolbarItem value="signatures" icon={<PreviewGlyph name="sign" size={24} />}>
            Signatures
          </PreferencesToolbarItem>
        </PreferencesToolbar>
      }
      {...props}
    >
      <PreferencesWindowPane value="images">
        <PreferencesWindowForm>
          <DocumentRows
            backgroundKey={PREVIEW_SETTINGS.imageBackground}
            scaleKey={PREVIEW_SETTINGS.imageScale}
            pixelLabel="1 image pixel equals 1 screen pixel"
          />
          <PreferencesWindowRow label="When opening files:">
            <Checkbox disabled checked title={ONE_WINDOW}>
              Open each file in its own window
            </Checkbox>
          </PreferencesWindowRow>
        </PreferencesWindowForm>
      </PreferencesWindowPane>
      <PreferencesWindowPane value="pdf">
        <PreferencesWindowForm>
          <DocumentRows
            backgroundKey={PREVIEW_SETTINGS.pdfBackground}
            scaleKey={PREVIEW_SETTINGS.pdfScale}
            pixelLabel="1 point equals 1 screen pixel"
          />
        </PreferencesWindowForm>
      </PreferencesWindowPane>
      <PreferencesWindowPane value="signatures">
        <PreferencesWindowForm>
          <Label>
            Make and delete signatures in a document, from Tools › Annotate › Signature: they are
            kept for this account.
          </Label>
        </PreferencesWindowForm>
      </PreferencesWindowPane>
    </PreferencesWindow>
  );
}
