"use client";

import {
  type RichTextCommand,
  type RichTextFormat,
  type RichTextSelectionKeeper,
  readRichTextFormat,
  richTextKeyCommand,
  runRichTextCommand,
} from "macalicious/lib/rich-text";
import { ScrollView } from "macalicious/scroll-view";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import type { TextSubstitutions } from "../desktop/text-substitutions";
import { type NoteFile, type NotesNote, summarize } from "./notes-data";
import { type EditMenuTarget, EditorEditItems } from "./notes-edit-menu";
import {
  lineStyleAt,
  NotesEditor,
  type NotesParagraphStyle,
  nodeAt,
  noteEditState,
  setLineStyle,
} from "./notes-editor";
import { NotesFormatItems, whenMenusClosed } from "./notes-menus";

export interface NoteWindowProps extends Omit<WindowProps, "children"> {
  note: NotesNote;
  /** Changes with what the main window edits: the window then shows the note anew. */
  revision: number | string;
  onEdit: (
    id: string,
    lines: string[],
    attachment: boolean,
    picture?: string,
    html?: string,
    files?: NoteFile[],
  ) => void;
  onQuickLook: (file: NoteFile) => void;
  spellCheck: boolean;
  textReplacement: boolean;
  substitutions: { readonly current: TextSubstitutions };
  controlsProps?: WindowControlsProps;
  onDragRegionPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  onDragRegionDoubleClick?: (event: MouseEvent<HTMLElement>) => void;
}

/**
 * One note in a window of its own, as Open in New Window and a double click in the note list open
 * it. While it is the window last used, the menu bar's Edit and Format act on this note.
 */
export function NoteWindow({
  note,
  revision,
  onEdit,
  onQuickLook,
  spellCheck,
  textReplacement,
  substitutions,
  controlsProps,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  ...props
}: NoteWindowProps) {
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  const [editors] = useState(() => new Map<string, HTMLDivElement>());
  const [keepers] = useState(() => new Map<string, RichTextSelectionKeeper>());
  const [format, setFormat] = useState<RichTextFormat | null>(null);
  const [paragraph, setParagraph] = useState<NotesParagraphStyle | null>(null);
  const editable = !note.locked && note.deleted === undefined;

  const target = useCallback(() => {
    const editor = editors.get(note.id);
    const keeper = keepers.get(note.id);
    return editable && editor && keeper ? { editor, keeper } : null;
  }, [editors, keepers, note.id, editable]);

  const reread = useCallback(
    (editor: HTMLElement) => {
      const state = noteEditState(editor);
      onEdit(note.id, state.lines, state.attachment, state.picture, state.html, state.files);
    },
    [note.id, onEdit],
  );
  const follow = useCallback((editor: HTMLElement) => {
    const selection = editor.ownerDocument.getSelection();
    const at = selection && selection.rangeCount > 0 ? nodeAt(selection.getRangeAt(0)) : null;
    setFormat(readRichTextFormat(editor));
    setParagraph(at && editor.contains(at) ? lineStyleAt(editor, at) : null);
  }, []);
  useEffect(() => {
    const changed = () => {
      const editor = editors.get(note.id);
      const anchor = document.getSelection()?.anchorNode;
      if (editor && anchor && editor.contains(anchor)) follow(editor);
    };
    document.addEventListener("selectionchange", changed);
    return () => document.removeEventListener("selectionchange", changed);
  }, [editors, note.id, follow]);

  const textCommand = useCallback(
    (command: RichTextCommand) => {
      const place = target();
      if (!place) return;
      place.keeper.restore();
      runRichTextCommand(place.editor, command);
      reread(place.editor);
      follow(place.editor);
    },
    [target, reread, follow],
  );
  const paragraphStyle = useCallback(
    (style: NotesParagraphStyle) => {
      const place = target();
      if (!place) return;
      const range = place.keeper.restore();
      if (setLineStyle(place.editor, style, nodeAt(range))) reread(place.editor);
      follow(place.editor);
    },
    [target, reread, follow],
  );
  const keys = (event: KeyboardEvent<HTMLElement>) => {
    const command = richTextKeyCommand(event.nativeEvent);
    if (!command || command === "show-fonts" || command === "show-colors") return;
    event.preventDefault();
    textCommand(command);
  };

  const formatMenu = useMemo(
    () => (
      <NotesFormatItems
        status={{ editable, format, paragraph }}
        noPanels
        onChoose={() => whenMenusClosed(document, () => target()?.keeper.restore())}
        onParagraphStyle={paragraphStyle}
        onTextCommand={textCommand}
      />
    ),
    [editable, format, paragraph, paragraphStyle, textCommand, target],
  );
  useDesktopAppMenu("notes", "Format", formatMenu, titleBar);
  const editTarget = useCallback((): EditMenuTarget | null => {
    const editor = editors.get(note.id);
    if (!editor) return null;
    const keeper = keepers.get(note.id);
    return {
      element: editor,
      restore: () => (keeper ? keeper.restore() : editor.focus({ preventScroll: true })),
      editable,
      rich: true,
      document: note.id,
    };
  }, [editors, keepers, note.id, editable]);
  const editMenu = useMemo(() => <EditorEditItems target={editTarget} />, [editTarget]);
  useDesktopAppMenu("notes", "Edit", editMenu, titleBar);

  return (
    <Window aria-label={summarize(note).title} {...props} className="mac-notes">
      <TitleBar
        ref={setTitleBar}
        title={summarize(note).title}
        controls={<WindowControls {...controlsProps} />}
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />
      <WindowBody background="content" onKeyDown={keys}>
        <ScrollView
          style={
            {
              height: "100%",
              background: "var(--mac-notes-editor-background)",
              "--mac-text-view-background": "transparent",
            } as CSSProperties
          }
          viewportProps={{ className: "mac-notes-paper" }}
        >
          <div className="mac-notes-page">
            <div className="mac-notes-date">{note.edited}</div>
            <NotesEditor
              key={revision}
              note={note}
              onEdit={onEdit}
              onQuickLook={onQuickLook}
              registry={editors}
              keepers={keepers}
              spellCheck={spellCheck}
              textReplacement={textReplacement}
              substitutions={substitutions}
            />
          </div>
        </ScrollView>
      </WindowBody>
    </Window>
  );
}
