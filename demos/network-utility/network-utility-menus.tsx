import { onMenuKeyEquivalents } from "macalicious/lib/menu-key-commands";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { useEffect, useRef } from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { EditRows } from "../desktop/desktop-edit-rows";

const NOTHING_TO_EDIT = "Click in an address field or a tool's output first.";
const NO_OUTPUT = "This pane has printed nothing to keep.";

/**
 * Prints `text` from a frame of its own, which may run nothing. The frame stays a minute, since
 * the print dialog holds it, and is off screen rather than `display: none`, which some browsers
 * print as an empty page.
 */
export function printOutput(title: string, text: string) {
  document.querySelector("iframe[data-network-utility-print]")?.remove();
  const page = document.implementation.createHTMLDocument(title);
  const pre = page.createElement("pre");
  pre.textContent = text;
  page.body.append(pre);
  const frame = document.createElement("iframe");
  frame.dataset.networkUtilityPrint = title;
  frame.setAttribute("sandbox", "allow-same-origin allow-modals");
  frame.style.cssText = "position:fixed;inset-inline-end:0;bottom:0;width:0;height:0;border:0";
  frame.srcdoc = page.documentElement.outerHTML;
  frame.onload = () => frame.contentWindow?.print();
  document.body.append(frame);
  setTimeout(() => frame.remove(), 60_000);
}

/** Downloads `text` as a text file. */
export function saveOutput(title: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `Network Utility ${title}.txt`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Network Utility's rows in the desktop's menu bar, on the pane shown. */
export function useNetworkUtilityMenus({
  title,
  output,
  isKey,
  say,
}: {
  /** The pane shown. */
  title: string;
  /** What it has printed; empty for none. */
  output: string;
  /** Whether the window is the key window: only then do the keys act. */
  isKey: boolean;
  say: (message: string) => void;
}) {
  const can = output !== "";
  const latest = useRef({ title, output });
  latest.current = { title, output };
  useDesktopAppMenu(
    "network-utility",
    "File",
    <>
      <MenuItem
        keyEquivalent="command+s"
        disabled={!can}
        title={can ? undefined : NO_OUTPUT}
        onClick={() => saveOutput(title, output)}
      >
        Save Output…
      </MenuItem>
      <MenuItem
        keyEquivalent="command+p"
        disabled={!can}
        title={can ? undefined : NO_OUTPUT}
        onClick={() => printOutput(title, output)}
      >
        Print…
      </MenuItem>
      <MenuSeparator />
    </>,
  );
  useDesktopAppMenu("network-utility", "Edit", <EditRows nothing={NOTHING_TO_EDIT} say={say} />);
  useEffect(() => {
    if (!isKey) return;
    const when = (act: (title: string, text: string) => void) => () => {
      if (latest.current.output) act(latest.current.title, latest.current.output);
    };
    return onMenuKeyEquivalents(window, {
      "command+s": when(saveOutput),
      "command+p": when(printOutput),
    });
  }, [isKey]);
}
