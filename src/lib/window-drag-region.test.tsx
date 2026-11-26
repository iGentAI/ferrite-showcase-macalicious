import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Checkbox } from "../components/checkbox";
import { Switch } from "../components/switch";
import { TitleBar } from "../components/title-bar";
import { isWindowDragRegion, windowDragRegion } from "./window-drag-region";

describe("windowDragRegion", () => {
  it("marks the element and reports a primary press and a double-click on its surface", () => {
    const onDown = vi.fn();
    const onDouble = vi.fn();
    render(
      <div data-testid="strip" {...windowDragRegion(onDown, onDouble)}>
        <span>Label</span>
      </div>,
    );
    const strip = screen.getByTestId("strip");
    expect(strip).toHaveAttribute("data-window-drag-region", "");

    fireEvent.pointerDown(strip, { button: 0 });
    fireEvent.pointerDown(screen.getByText("Label"), { button: 0 });
    expect(onDown).toHaveBeenCalledTimes(2);
    fireEvent.pointerDown(strip, { button: 2 });
    expect(onDown).toHaveBeenCalledTimes(2);

    fireEvent.doubleClick(strip);
    expect(onDouble).toHaveBeenCalledTimes(1);
  });

  it("leaves a press on a control, a slider, a source list, editable text or an opted-out element alone", () => {
    const onDown = vi.fn();
    const onDouble = vi.fn();
    render(
      <div {...windowDragRegion(onDown, onDouble)}>
        <button type="button">Close</button>
        <input aria-label="Search" />
        <div role="slider" aria-label="Volume" aria-valuenow={1} tabIndex={0} />
        <div role="tree" aria-label="Lists">
          <div role="treeitem" aria-selected="false" tabIndex={-1}>
            Today
          </div>
        </div>
        <span data-window-no-drag="">Handle</span>
        <div contentEditable="plaintext-only" suppressContentEditableWarning>
          <b>Draft</b>
        </div>
        <div contentEditable suppressContentEditableWarning>
          Note
        </div>
      </div>,
    );
    for (const element of [
      screen.getByRole("button", { name: "Close" }),
      screen.getByRole("textbox", { name: "Search" }),
      screen.getByRole("slider", { name: "Volume" }),
      screen.getByText("Today"),
      screen.getByText("Handle"),
      screen.getByText("Draft"),
      screen.getByText("Note"),
    ]) {
      fireEvent.pointerDown(element, { button: 0 });
      fireEvent.doubleClick(element);
    }
    expect(onDown).not.toHaveBeenCalled();
    expect(onDouble).not.toHaveBeenCalled();
  });

  it("still reports a press on text that is marked as not editable", () => {
    const onDown = vi.fn();
    render(
      <div {...windowDragRegion(onDown)}>
        <span contentEditable={false}>Fixed</span>
      </div>,
    );
    fireEvent.pointerDown(screen.getByText("Fixed"), { button: 0 });
    expect(onDown).toHaveBeenCalledTimes(1);
  });

  it("needs neither callback", () => {
    render(<div data-testid="strip" {...windowDragRegion()} />);
    fireEvent.pointerDown(screen.getByTestId("strip"), { button: 0 });
    fireEvent.doubleClick(screen.getByTestId("strip"));
    expect(screen.getByTestId("strip")).toHaveAttribute("data-window-drag-region");
  });

  it("lets a handler that saw the press first cancel it: one on the window or one on a child", () => {
    const onDown = vi.fn();
    const onDouble = vi.fn();
    render(
      <div
        data-testid="window"
        onPointerDownCapture={(event) => event.preventDefault()}
        onDoubleClickCapture={(event) => event.preventDefault()}
      >
        <div data-testid="strip" {...windowDragRegion(onDown, onDouble)} />
      </div>,
    );
    fireEvent.pointerDown(screen.getByTestId("strip"), { button: 0 });
    fireEvent.doubleClick(screen.getByTestId("strip"));
    expect(onDown).not.toHaveBeenCalled();
    expect(onDouble).not.toHaveBeenCalled();
  });

  it("still reports a press after a child's handler that does not cancel it", () => {
    const onDown = vi.fn();
    const onChild = vi.fn();
    render(
      <div {...windowDragRegion(onDown)}>
        <span onPointerDown={onChild}>Decoration</span>
      </div>,
    );
    fireEvent.pointerDown(screen.getByText("Decoration"), { button: 0 });
    expect(onChild).toHaveBeenCalledTimes(1);
    expect(onDown).toHaveBeenCalledTimes(1);
  });
});

/*
 * Every kind of control that once moved or zoomed the window when pressed: each one is pressed
 * and double-clicked inside a `windowDragRegion()` strip and inside a `TitleBar`, and neither
 * surface may report it. The library's own checkbox and switch are among them.
 */
const CONTROLS: [kind: string, control: ReactNode, pressed: () => HTMLElement][] = [
  [
    "a library checkbox",
    <Checkbox key="c">Show all</Checkbox>,
    () => screen.getByRole("checkbox", { name: "Show all" }),
  ],
  [
    "the title of a library checkbox",
    <Checkbox key="c">Show all</Checkbox>,
    () => screen.getByText("Show all"),
  ],
  [
    "an ARIA checkbox",
    // biome-ignore lint/a11y/useSemanticElements: the role itself is what is tested.
    <span key="c" role="checkbox" aria-checked="false" tabIndex={0}>
      Mute
    </span>,
    () => screen.getByRole("checkbox", { name: "Mute" }),
  ],
  [
    "a library switch",
    <Switch key="s" aria-label="Wi-Fi" />,
    () => screen.getByRole("switch", { name: "Wi-Fi" }),
  ],
  [
    "an ARIA switch",
    <span key="s" role="switch" aria-checked="true" tabIndex={0}>
      Sync
    </span>,
    () => screen.getByRole("switch", { name: "Sync" }),
  ],
  [
    "a combo box",
    <span key="c" role="combobox" aria-expanded="false" aria-controls="sizes" tabIndex={0}>
      <b>42</b>
    </span>,
    () => screen.getByText("42"),
  ],
  [
    "an option of a list box",
    <div key="l" role="listbox" aria-label="Sizes">
      <div role="option" aria-selected="false" tabIndex={-1}>
        Large
      </div>
    </div>,
    () => screen.getByText("Large"),
  ],
  [
    "the background of a list box",
    <div key="l" role="listbox" aria-label="Fonts" />,
    () => screen.getByRole("listbox", { name: "Fonts" }),
  ],
  [
    "a link",
    <a key="a" href="#help">
      Help
    </a>,
    () => screen.getByRole("link", { name: "Help" }),
  ],
  [
    "an ARIA link",
    // biome-ignore lint/a11y/useSemanticElements: the role itself is what is tested.
    <span key="a" role="link" tabIndex={0}>
      <i>More</i>
    </span>,
    () => screen.getByText("More"),
  ],
  [
    "a label",
    <label key="l" htmlFor="remember">
      <span>Remember</span>
    </label>,
    () => screen.getByText("Remember"),
  ],
  [
    "a menu item",
    <div key="m" role="menuitem" tabIndex={-1}>
      Open
    </div>,
    () => screen.getByText("Open"),
  ],
  [
    "a spin button",
    <div key="n" role="spinbutton" aria-valuenow={3} aria-label="Copies" tabIndex={0} />,
    () => screen.getByRole("spinbutton", { name: "Copies" }),
  ],
  // Every other role the test excludes, pressed on text inside an element that carries it. Before
  // this change the title bar left none of these alone, and the strip only the slider and tree.
  ...[
    "grid",
    "menu",
    "menubar",
    "menuitemcheckbox",
    "menuitemradio",
    "scrollbar",
    "searchbox",
    "slider",
    "textbox",
    "tree",
    "treegrid",
    "treeitem",
  ].map((role): [string, ReactNode, () => HTMLElement] => [
    `an element with role ${role}`,
    <div key={role} role={role} tabIndex={-1}>
      <span>Inside the {role}</span>
    </div>,
    () => screen.getByText(`Inside the ${role}`),
  ]),
  [
    "an element with two roles, the second a control",
    <div key="r" role="presentation switch" tabIndex={-1}>
      Both
    </div>,
    () => screen.getByText("Both"),
  ],
  [
    "an option outside a list box",
    <div key="p" role="option" aria-selected="false" tabIndex={-1}>
      Lone option
    </div>,
    () => screen.getByText("Lone option"),
  ],
  [
    "the summary of a disclosure",
    <details key="d">
      <summary>
        <span>Details</span>
      </summary>
    </details>,
    () => screen.getByText("Details"),
  ],
  [
    "an option element",
    <datalist key="o" id="choices">
      <option value="Choice">Choice</option>
    </datalist>,
    () => document.querySelector("option") as HTMLElement,
  ],
  [
    "a linked area of an image map",
    <map key="m" name="places">
      <area href="#north" alt="North" shape="rect" coords="0,0,10,10" />
    </map>,
    () => document.querySelector("area") as HTMLElement,
  ],
  [
    "a video with controls",
    <video key="v" controls aria-label="Clip">
      <track kind="captions" />
    </video>,
    () => document.querySelector("video") as HTMLElement,
  ],
  [
    "an audio element with controls",
    <audio key="a" controls aria-label="Sound">
      <track kind="captions" />
    </audio>,
    () => document.querySelector("audio") as HTMLElement,
  ],
];

describe.each(["windowDragRegion", "TitleBar"])("a control in a %s", (surface) => {
  it.each(CONTROLS)(
    "pressing or double-clicking %s neither moves nor zooms the window",
    (_kind, control, pressed) => {
      const onDown = vi.fn();
      const onDouble = vi.fn();
      render(
        surface === "TitleBar" ? (
          <TitleBar
            title="Window"
            data-testid="surface"
            onDragRegionPointerDown={onDown}
            onDragRegionDoubleClick={onDouble}
          >
            {control}
          </TitleBar>
        ) : (
          <div data-testid="surface" {...windowDragRegion(onDown, onDouble)}>
            {control}
          </div>
        ),
      );
      const element = pressed();
      fireEvent.pointerDown(element, { button: 0 });
      fireEvent.doubleClick(element);
      expect(onDown).not.toHaveBeenCalled();
      expect(onDouble).not.toHaveBeenCalled();

      // The surface beside the control still moves and zooms the window.
      fireEvent.pointerDown(screen.getByTestId("surface"), { button: 0 });
      fireEvent.doubleClick(screen.getByTestId("surface"));
      expect(onDown).toHaveBeenCalledTimes(1);
      expect(onDouble).toHaveBeenCalledTimes(1);
    },
  );
});

describe("isWindowDragRegion", () => {
  afterEach(() => {
    for (const frame of document.querySelectorAll("iframe")) frame.remove();
  });

  it("is false, without throwing, for no target and for a target that is not in an element", () => {
    expect(isWindowDragRegion(null)).toBe(false);
    expect(isWindowDragRegion(window)).toBe(false);
    expect(isWindowDragRegion(document)).toBe(false);
    expect(isWindowDragRegion(new EventTarget())).toBe(false);
  });

  it("judges a text node by the element it is in", () => {
    const surface = document.createElement("div");
    surface.innerHTML = "<span>Title</span><button>OK</button>";
    expect(isWindowDragRegion(surface.querySelector("span")?.firstChild ?? null)).toBe(true);
    expect(isWindowDragRegion(surface.querySelector("button")?.firstChild ?? null)).toBe(false);
  });

  it("judges an element of another document or frame as one of its own", () => {
    const frame = document.createElement("iframe");
    document.body.append(frame);
    const other = frame.contentDocument as Document;
    other.body.innerHTML =
      '<div id="bar"><span id="title">Title</span><span role="checkbox" id="box"><i id="tick"></i></span><label id="label">Name</label></div>';
    const title = other.getElementById("title") as Element;
    // The frame has its own Element, so `instanceof` would call every one of these no element.
    expect(title instanceof Element).toBe(false);

    expect(isWindowDragRegion(title)).toBe(true);
    expect(isWindowDragRegion(other.getElementById("bar"))).toBe(true);
    expect(isWindowDragRegion(other.getElementById("tick"))).toBe(false);
    expect(isWindowDragRegion(other.getElementById("label"))).toBe(false);

    const detached = document.implementation.createHTMLDocument("");
    detached.body.innerHTML = '<p>Text</p><a href="#x">Link</a>';
    expect(isWindowDragRegion(detached.querySelector("p"))).toBe(true);
    expect(isWindowDragRegion(detached.querySelector("a"))).toBe(false);
  });
});
