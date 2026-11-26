import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuItem } from "macalicious/menu-item";
import { afterEach, describe, expect, it, vi } from "vitest";
import { takePendingLookUp } from "../dictionary/dictionary-desktop";
import { onDesktopEffects } from "./desktop-effects";
import { takeOpenUrlRequests } from "./desktop-open-url";
import {
  onSharedText,
  registerTextReceivers,
  reportSelection,
  ServicesItems,
  shareText,
  startServices,
  takeSharedText,
} from "./desktop-services";

const APPS = ["dictionary", "safari", "notes", "mail", "stickies"];
const stops: (() => void)[] = [];

afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  takeSharedText("notes");
  takePendingLookUp();
  takeOpenUrlRequests();
});

/** The text field `text` selected in, for a press that remembers it. */
function selecting(text: string) {
  stops.push(startServices());
  const field = document.createElement("textarea");
  field.value = text;
  document.body.append(field);
  field.focus();
  field.select();
  return field;
}

/** A text field with `text` selected, and the press on the menu bar that remembers it. */
function pressMenuBarWith(text: string) {
  stops.push(startServices());
  const field = document.createElement("textarea");
  field.value = text;
  const bar = document.createElement("div");
  bar.setAttribute("role", "menubar");
  document.body.append(field, bar);
  field.focus();
  field.select();
  bar.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  field.remove();
  bar.remove();
}

async function rows(apps = APPS) {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  render(
    <Menu>
      <MenuTrigger>Services</MenuTrigger>
      <MenuPopup>
        <ServicesItems
          apps={apps}
          from="textedit"
          none={<MenuItem disabled>None apply</MenuItem>}
        />
      </MenuPopup>
    </Menu>,
  );
  await user.click(screen.getByRole("button", { name: "Services" }));
  return user;
}

describe("the Services submenu", () => {
  it("takes what a frame reports selected, until a press elsewhere in the page", async () => {
    stops.push(startServices());
    stops.push(registerTextReceivers([{ id: "dictionary" }]));
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const shown = () =>
      render(
        <Menu>
          <MenuTrigger>Services</MenuTrigger>
          <MenuPopup>
            <ServicesItems from="safari" none={<MenuItem disabled>None apply</MenuItem>} />
          </MenuPopup>
        </Menu>,
      );
    reportSelection("harbour");
    document.body.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    const first = shown();
    await user.click(screen.getByRole("button", { name: "Services" }));
    expect(await screen.findByRole("menuitem", { name: "Look Up in Dictionary" })).toBeTruthy();
    first.unmount();

    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    document.body.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    shown();
    await user.click(screen.getByRole("button", { name: "Services" }));
    expect(await screen.findByRole("menuitem", { name: "None apply" })).toBeTruthy();
  });

  it("goes by the text selected as a context menu opened, without being told the apps", async () => {
    stops.push(
      registerTextReceivers([{ id: "dictionary" }, { id: "notes", takesSharedText: true }]),
    );
    const field = selecting("harbour");
    field.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    field.remove();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <Menu>
        <MenuTrigger>Services</MenuTrigger>
        <MenuPopup>
          <ServicesItems from="notes" none={<MenuItem disabled>None apply</MenuItem>} />
        </MenuPopup>
      </Menu>,
    );
    await user.click(screen.getByRole("button", { name: "Services" }));
    expect(await screen.findByRole("menuitem", { name: "Look Up in Dictionary" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "New Note With Selection" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Search the Web" })).toBeNull();
  });

  it("has nothing to offer with no text selected", async () => {
    pressMenuBarWith("");
    await rows();
    expect(await screen.findByRole("menuitem", { name: "None apply" })).toBeInTheDocument();
  });

  it("looks the selected text up in Dictionary", async () => {
    pressMenuBarWith("harbour");
    const user = await rows();
    await user.click(await screen.findByRole("menuitem", { name: "Look Up in Dictionary" }));
    expect(takePendingLookUp()).toBe("harbour");
  });

  it("offers Open URL only for a web address, and hands it to Safari", async () => {
    pressMenuBarWith("https://example.com/a");
    const user = await rows();
    await user.click(await screen.findByRole("menuitem", { name: "Open URL" }));
    expect(takeOpenUrlRequests()).toEqual([{ url: "https://example.com/a", from: "textedit" }]);
  });

  it("lists no Open URL for plain words, and searches the web instead", async () => {
    pressMenuBarWith("moon landing");
    const user = await rows();
    await screen.findByRole("menuitem", { name: "Search the Web" });
    expect(screen.queryByRole("menuitem", { name: "Open URL" })).toBeNull();
    await user.click(screen.getByRole("menuitem", { name: "Search the Web" }));
    expect(takeOpenUrlRequests()[0]?.url).toContain("moon");
  });

  it("lists a text service only once its application takes text", async () => {
    pressMenuBarWith("buy flowers");
    stops.push(registerTextReceivers([{ id: "notes", takesSharedText: true }, { id: "mail" }]));
    const user = await rows();
    await user.click(await screen.findByRole("menuitem", { name: "New Note With Selection" }));
    expect(screen.queryByRole("menuitem", { name: "New Email With Selection" })).toBeNull();
    expect(takeSharedText("notes")).toEqual([{ text: "buy flowers", to: "notes" }]);
  });

  it("has nothing to offer when the desktop lacks the applications", async () => {
    pressMenuBarWith("harbour");
    await rows([]);
    expect(await screen.findByRole("menuitem", { name: "None apply" })).toBeInTheDocument();
  });
});

describe("handing text to an application", () => {
  it("opens the application, and an open window hears it instead of its being kept", () => {
    stops.push(registerTextReceivers([{ id: "notes", takesSharedText: true }]));
    const opened = vi.fn();
    stops.push(onDesktopEffects(opened));
    const heard = vi.fn();
    stops.push(onSharedText("notes", heard));
    expect(shareText("notes", "hello")).toBe(true);
    expect(opened).toHaveBeenCalledWith([{ open: "notes" }]);
    expect(heard).toHaveBeenCalledWith({ text: "hello", to: "notes" });
    expect(takeSharedText("notes")).toEqual([]);
  });

  it("refuses an application that takes no text, and keeps every hand-off in order", () => {
    expect(shareText("notes", "hello")).toBe(false);
    stops.push(registerTextReceivers([{ id: "notes", takesSharedText: true }]));
    for (let n = 0; n < 25; n += 1) expect(shareText("notes", `text ${n}`)).toBe(true);
    const kept = takeSharedText("notes");
    expect(kept).toHaveLength(25);
    expect(kept[0]?.text).toBe("text 0");
    expect(kept.at(-1)?.text).toBe("text 24");
  });
});
