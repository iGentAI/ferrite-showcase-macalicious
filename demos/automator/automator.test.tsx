import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Automator, type AutomatorProps } from "./automator";
import { createWorkflow, reduceWorkflow } from "./automator-data";

/*
 * jsdom has no layout, so a table is never measured and renders its first 40 rows: enough for
 * every list used here but the whole library, of which the first rows are looked at. Run
 * finishes at once (`stepInterval` 0) unless a test is about its timer.
 */
const open = (props: AutomatorProps = {}) => render(<Automator stepInterval={0} {...props} />);

const frame = () => screen.getByRole("region", { name: "Untitled" });
const button = (name: string) => screen.getByRole("button", { name });
/** A toolbar button that is disabled stays reachable, so it is marked with `aria-disabled`. */
const unavailable = (name: string) =>
  button(name).getAttribute("aria-disabled") === "true" || button(name).hasAttribute("disabled");
const outline = (name = "Action categories") => screen.getByRole("treegrid", { name });
const selectedCategory = (name?: string) =>
  within(outline(name))
    .getAllByRole("row")
    .filter((row) => row.getAttribute("aria-selected") === "true")
    .map((row) => row.textContent);
const list = (name = "Actions") => screen.getByRole("grid", { name });
/** The names a list shows, top to bottom. */
const listed = (name?: string) =>
  within(list(name))
    .queryAllByRole("row")
    .map((row) => row.textContent);
const selectedItem = (name?: string) =>
  within(list(name))
    .queryAllByRole("row")
    .filter((row) => row.getAttribute("aria-selected") === "true")
    .map((row) => row.textContent);
const item = (name: string, grid?: string) => within(list(grid)).getByText(name);
const description = () => screen.getByRole("region", { name: "Description" });
const workflow = () => screen.getByRole("region", { name: "Workflow" });
/** The steps of the workflow as "number name", in order. */
const steps = () =>
  within(workflow())
    .queryAllByRole("listitem")
    .map((step) => {
      const remove = within(step).getByRole("button", { name: /^Remove / });
      const name = remove.getAttribute("aria-label")?.replace("Remove ", "");
      return `${step.textContent?.match(/^\d+/)?.[0]} ${name}`;
    });
const placeholder = () =>
  within(workflow()).queryByText("Drag actions or files here to build your workflow.");
/** The cells of a table of the lower pane, row by row, without its header. */
const cells = (name = "Log") =>
  within(list(name))
    .queryAllByRole("row")
    .map((row) =>
      within(row)
        .queryAllByRole("gridcell")
        .map((cell) => cell.textContent),
    )
    .filter((row) => row.length > 0);

afterEach(() => {
  vi.useRealTimers();
});

describe("the window", () => {
  it("opens on the untitled, empty workflow of the capture", () => {
    open();
    expect(frame()).toHaveClass("mac-window", "mac-automator");
    expect(frame().style.width).toBe("1000px");
    expect(frame().style.height).toBe("868px");
    expect(selectedCategory()).toEqual(["Library"]);
    expect(listed().slice(0, 3)).toEqual([
      "Activate Fonts",
      "Add Attachments to Front Message",
      "Add Grid to PDF Documents",
    ]);
    expect(selectedItem()).toEqual(["Activate Fonts"]);
    const pane = within(description());
    expect(pane.getByRole("heading", { name: "Activate Fonts" })).toBeInTheDocument();
    expect(
      pane.getByText("This action activates the fonts passed from the previous action."),
    ).toBeInTheDocument();
    expect(pane.getByText("Input:").nextElementSibling).toHaveTextContent("Font Book typeface");
    expect(pane.getByText("Result:").nextElementSibling).toHaveTextContent("Font Book typeface");
    expect(pane.getByText("Version:").nextElementSibling).toHaveTextContent("5.0");
    expect(placeholder()).toBeInTheDocument();
    expect(cells()).toEqual([]);
    // Nothing to run and nothing to stop; a recording can start.
    expect(["Record", "Step", "Stop", "Run"].map(unavailable)).toEqual([false, true, true, true]);
  });

  it("passes window props to the library window and the hosting callbacks to its parts", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    const handlers = {
      onClose: vi.fn(),
      onMinimize: vi.fn(),
      onZoom: vi.fn(),
      onDragRegionPointerDown: vi.fn(),
      onDragRegionDoubleClick: vi.fn(),
    };
    open({
      ref,
      state: "inactive",
      width: 800,
      height: 520,
      className: "hosted",
      style: { position: "absolute", left: 12 },
      zoomRole: "zoom",
      ...handlers,
    });
    expect(ref.current).toBe(frame());
    expect(frame()).toHaveAttribute("data-window-state", "inactive");
    expect(frame()).toHaveClass("mac-window", "hosted");
    expect(frame().style.width).toBe("800px");
    expect(frame().style.height).toBe("520px");
    expect(frame().style.left).toBe("12px");

    await user.click(button("Close"));
    await user.click(button("Minimize"));
    await user.click(button("Zoom"));
    expect(handlers.onClose).toHaveBeenCalledTimes(1);
    expect(handlers.onMinimize).toHaveBeenCalledTimes(1);
    expect(handlers.onZoom).toHaveBeenCalledTimes(1);

    const bar = screen.getByText("Untitled");
    fireEvent.pointerDown(bar, { button: 0 });
    fireEvent.doubleClick(bar);
    expect(handlers.onDragRegionPointerDown).toHaveBeenCalledTimes(1);
    expect(handlers.onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("takes an id that names nothing for the default: every action, none selected", () => {
    open({
      defaultCategory: "nowhere",
      defaultSelectedId: "nothing",
      defaultWorkflow: ["nothing", "ask-for-text"],
    });
    expect(selectedCategory()).toEqual(["Library"]);
    expect(listed()[0]).toBe("Activate Fonts");
    expect(selectedItem()).toEqual([]);
    expect(within(description()).getByText("No Action Selected")).toBeInTheDocument();
    expect(steps()).toEqual(["1 Ask for Text"]);
  });
});

describe("the library", () => {
  it("lists the actions of the category chosen in the outline", async () => {
    const user = userEvent.setup();
    const onCategoryChange = vi.fn();
    open({ onCategoryChange });
    await user.click(within(outline()).getByText("Fonts"));
    expect(selectedCategory()).toEqual(["Fonts"]);
    expect(onCategoryChange).toHaveBeenLastCalledWith("fonts", "actions");
    expect(listed()).toEqual(["Activate Fonts", "Add to Font Library"]);

    await user.click(within(outline()).getByText("Recently Added"));
    expect(listed()).toEqual([
      "Change System Appearance",
      "Display Notification",
      "Take Screenshot",
    ]);

    await user.click(within(outline()).getByText("Library"));
    expect(listed()).toHaveLength(40);
    expect(onCategoryChange).toHaveBeenCalledTimes(3);
  });

  it("hands the selection to Library when its categories are collapsed", async () => {
    const user = userEvent.setup();
    const onCategoryChange = vi.fn();
    open({ defaultCategory: "fonts", onCategoryChange });
    expect(selectedCategory()).toEqual(["Fonts"]);
    // Library's triangle: the collapse leaves the selection on Fonts, which is then hidden.
    const triangle = outline().querySelector("button.mac-outline-view-triangle");
    await user.click(triangle as Element);
    expect(within(outline()).queryByText("Fonts")).not.toBeInTheDocument();
    expect(selectedCategory()).toEqual(["Library"]);
    expect(onCategoryChange).toHaveBeenCalledTimes(1);
    expect(onCategoryChange).toHaveBeenLastCalledWith("library", "actions");
    expect(listed()[1]).toBe("Add Attachments to Front Message");
  });

  it("lists the actions whose name contains the search text, in any letter case", async () => {
    const user = userEvent.setup();
    open();
    await user.type(screen.getByRole("searchbox", { name: "Search" }), "pdf ");
    expect(listed()).toEqual([
      "Add Grid to PDF Documents",
      "Apply Quartz Filter to PDF Documents",
      "Combine PDF Pages",
      "Compress Images in PDF Documents",
      "Watermark PDF Documents",
    ]);
    // The selected action is not listed: nothing is described until it is listed again.
    expect(within(description()).getByText("No Action Selected")).toBeInTheDocument();
    await user.click(button("Clear Search"));
    expect(selectedItem()).toEqual(["Activate Fonts"]);
    expect(within(description()).getByRole("heading", { name: "Activate Fonts" })).toBeVisible();
  });

  it("describes the action that is selected", () => {
    open();
    fireEvent.mouseDown(item("Ask for Text"));
    const pane = within(description());
    expect(pane.getByRole("heading", { name: "Ask for Text" })).toBeInTheDocument();
    expect(pane.getByText("Input:").nextElementSibling).toHaveTextContent("Text");
    expect(pane.getByText("Version:").nextElementSibling).toHaveTextContent("1.2");
  });

  it("switches the lists to the variables and back, and collects the variables added", async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole("radio", { name: "Variables" }));
    expect(selectedCategory("Variable categories")).toEqual(["Variables"]);
    expect(listed("Variables").slice(0, 2)).toEqual(["Applications", "Computer name"]);
    await user.click(within(outline("Variable categories")).getByText("User"));
    expect(listed("Variables")).toEqual(["Full name", "Short name"]);

    // A variable joins the workflow's variables, once, and the lower pane shows them.
    await user.dblClick(item("Short name", "Variables"));
    await user.dblClick(item("Short name", "Variables"));
    expect(cells("Workflow variables")).toEqual([["Short name", "sam"]]);
    expect(steps()).toEqual([]);
    expect(within(description()).getByText("Value:").nextElementSibling).toHaveTextContent("sam");

    await user.click(button("Log"));
    expect(screen.getByRole("grid", { name: "Log" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Actions" }));
    expect(selectedItem()).toEqual(["Activate Fonts"]);
  });

  it("hides and shows the library and the description pane", async () => {
    const user = userEvent.setup();
    open();
    await user.click(button("Hide Description"));
    expect(screen.queryByRole("region", { name: "Description" })).not.toBeInTheDocument();
    await user.click(button("Show Description"));
    expect(description()).toBeInTheDocument();

    expect(button("Library")).toHaveAttribute("aria-pressed", "true");
    await user.click(button("Library"));
    expect(button("Library")).toHaveAttribute("aria-pressed", "false");
    // The library keeps its place in the document, out of the accessibility tree.
    expect(screen.queryByRole("treegrid", { name: "Action categories" })).not.toBeInTheDocument();
    expect(workflow()).toBeVisible();
    await user.click(button("Library"));
    expect(outline()).toBeVisible();
  });
});

describe("the workflow", () => {
  it("takes actions as numbered steps, by double click, Return and the gear's command", async () => {
    const user = userEvent.setup();
    const onWorkflowChange = vi.fn();
    open({ onWorkflowChange });
    await user.dblClick(item("Ask for Text"));
    expect(steps()).toEqual(["1 Ask for Text"]);
    expect(placeholder()).not.toBeInTheDocument();

    // The grid has the focus after the click: Return adds the selected action again.
    await user.keyboard("{Enter}");
    fireEvent.mouseDown(item("Burn a Disc"));
    await user.click(button("Action"));
    await user.click(await screen.findByRole("menuitem", { name: "Add to Workflow" }));
    expect(steps()).toEqual(["1 Ask for Text", "2 Ask for Text", "3 Burn a Disc"]);
    expect(onWorkflowChange).toHaveBeenLastCalledWith([
      "ask-for-text",
      "ask-for-text",
      "burn-a-disc",
    ]);
  });

  it("lets a step be removed, and shows the placeholder again without steps", async () => {
    const user = userEvent.setup();
    const onWorkflowChange = vi.fn();
    open({ defaultWorkflow: ["activate-fonts", "ask-for-text", "burn-a-disc"], onWorkflowChange });
    expect(onWorkflowChange).not.toHaveBeenCalled();
    await user.click(button("Remove Ask for Text"));
    expect(steps()).toEqual(["1 Activate Fonts", "2 Burn a Disc"]);
    expect(onWorkflowChange).toHaveBeenLastCalledWith(["activate-fonts", "burn-a-disc"]);
    await user.click(button("Remove Activate Fonts"));
    await user.click(button("Remove Burn a Disc"));
    expect(placeholder()).toBeInTheDocument();
    expect(unavailable("Run")).toBe(true);
  });

  it("runs every step and logs each with its duration, then the whole run", async () => {
    const user = userEvent.setup();
    open({ defaultWorkflow: ["activate-fonts", "ask-for-text"] });
    expect(["Step", "Stop", "Run"].map(unavailable)).toEqual([false, true, false]);
    await user.click(button("Run"));
    // 25 ms for each character of a name: 14 and 12 characters.
    expect(cells()).toEqual([
      ["Activate Fonts completed", "0.350 seconds"],
      ["Ask for Text completed", "0.300 seconds"],
      ["Workflow completed", "0.650 seconds"],
    ]);
    expect(within(workflow()).getAllByRole("img", { name: "Completed" })).toHaveLength(2);
    expect(unavailable("Stop")).toBe(true);

    // A new run starts a new log.
    await user.click(button("Run"));
    expect(cells()).toHaveLength(3);
  });

  it("follows the log of a new run that is as long as the one the reader scrolled up in", async () => {
    const user = userEvent.setup();
    open({ defaultWorkflow: ["activate-fonts", "ask-for-text"] });
    await user.click(button("Run"));
    // jsdom has no layout: the scrolling element is given a height to scroll through.
    const viewport = list("Log").querySelector('[role="rowgroup"]') as HTMLElement;
    Object.defineProperty(viewport, "scrollHeight", { configurable: true, value: 500 });
    Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 100 });
    viewport.scrollTop = 0;
    fireEvent.scroll(viewport);

    await user.click(button("Run"));
    expect(cells()).toHaveLength(3);
    expect(viewport.scrollTop).toBe(500);
  });

  it("runs a step for each interval, can be stopped, and leaves no timer behind", () => {
    vi.useFakeTimers();
    const { unmount } = open({
      stepInterval: 1000,
      defaultWorkflow: ["activate-fonts", "ask-for-text"],
    });
    fireEvent.click(button("Run"));
    expect(["Record", "Step", "Stop", "Run"].map(unavailable)).toEqual([true, true, false, true]);
    expect(within(workflow()).getByRole("img", { name: "Running" })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(999));
    expect(cells()).toEqual([]);
    act(() => vi.advanceTimersByTime(1));
    expect(cells()).toEqual([["Activate Fonts completed", "0.350 seconds"]]);

    fireEvent.click(button("Stop"));
    act(() => vi.advanceTimersByTime(5000));
    expect(cells()).toEqual([
      ["Activate Fonts completed", "0.350 seconds"],
      ["Workflow stopped", "0.350 seconds"],
    ]);
    expect(["Stop", "Run"].map(unavailable)).toEqual([true, false]);
    // The step that ran keeps its mark until the next run starts.
    expect(within(workflow()).getAllByRole("img", { name: "Completed" })).toHaveLength(1);

    fireEvent.click(button("Run"));
    expect(within(workflow()).queryByRole("img", { name: "Completed" })).not.toBeInTheDocument();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("takes one step at a time with Step, between which the run can be stopped", async () => {
    const user = userEvent.setup();
    open({ defaultWorkflow: ["activate-fonts", "ask-for-text"] });
    await user.click(button("Step"));
    expect(cells()).toEqual([["Activate Fonts completed", "0.350 seconds"]]);
    expect(["Step", "Stop", "Run"].map(unavailable)).toEqual([false, false, false]);
    await user.click(button("Step"));
    expect(cells()[2]).toEqual(["Workflow completed", "0.650 seconds"]);
    expect(unavailable("Stop")).toBe(true);
  });

  it("records until Stop, which adds what was recorded as a step", async () => {
    const user = userEvent.setup();
    open({ defaultWorkflow: ["ask-for-text"] });
    await user.click(button("Record"));
    expect(button("Record")).toHaveAttribute("aria-pressed", "true");
    expect(["Step", "Stop", "Run"].map(unavailable)).toEqual([true, false, true]);
    await user.click(button("Stop"));
    expect(button("Record")).toHaveAttribute("aria-pressed", "false");
    expect(steps()).toEqual(["1 Ask for Text", "2 Watch Me Do"]);
  });

  it("keeps a run on its step when an earlier step is removed, and ends it with its last step", () => {
    // Between two timers of a run, which the window reaches only with real time.
    let state = createWorkflow(["activate-fonts", "ask-for-text", "burn-a-disc"]);
    state = reduceWorkflow(reduceWorkflow(state, { type: "run" }), { type: "advance" });
    state = reduceWorkflow(state, { type: "remove", key: 0 });
    expect(state.steps.map((step) => step.actionId)).toEqual(["ask-for-text", "burn-a-disc"]);
    expect([state.status, state.cursor]).toEqual(["running", 0]);
    state = reduceWorkflow(reduceWorkflow(state, { type: "advance" }), { type: "remove", key: 2 });
    expect(state.status).toBe("idle");
    expect(state.log.map((entry) => entry.text)).toEqual([
      "Activate Fonts completed",
      "Ask for Text completed",
      "Workflow stopped",
    ]);
  });
});
