import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentProps, createRef } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  AboutWindow,
  AboutWindowActions,
  AboutWindowDetail,
  AboutWindowDetails,
  AboutWindowFooter,
  AboutWindowLink,
  AboutWindowOverview,
  AboutWindowPanel,
  AboutWindowTab,
  AboutWindowTabs,
  AboutWindowTitle,
  AboutWindowVersion,
} from "./index";

interface AboutProps extends Partial<ComponentProps<typeof AboutWindow>> {
  list?: Partial<ComponentProps<typeof AboutWindowTabs>>;
  storage?: Partial<ComponentProps<typeof AboutWindowTab>>;
  overview?: Partial<ComponentProps<typeof AboutWindowTab>>;
}

function About({ list, storage, overview, ...props }: AboutProps) {
  return (
    <AboutWindow
      title="About This Mac"
      data-testid="window"
      tabs={
        <AboutWindowTabs aria-label="Sections" {...list}>
          <AboutWindowTab value="overview" {...overview}>
            Overview
          </AboutWindowTab>
          <AboutWindowTab value="displays">Displays</AboutWindowTab>
          <AboutWindowTab value="storage" {...storage}>
            Storage
          </AboutWindowTab>
        </AboutWindowTabs>
      }
      {...props}
    >
      <AboutWindowPanel value="overview">Overview pane</AboutWindowPanel>
      <AboutWindowPanel value="displays">Displays pane</AboutWindowPanel>
      <AboutWindowPanel value="storage">Storage pane</AboutWindowPanel>
    </AboutWindow>
  );
}

const tab = (name: string) => screen.getByRole("tab", { name });
const selected = () => screen.getByRole("tab", { selected: true }).textContent;

describe("AboutWindow", () => {
  it("is a key window named by its title, with the tabs in its title bar and the first pane", () => {
    render(<About />);
    const frame = screen.getByRole("region", { name: "About This Mac" });
    expect(frame).toBe(screen.getByTestId("window"));
    expect(frame).toHaveClass("mac-window", "mac-about-window");
    expect(frame).toHaveAttribute("data-window-state", "key");
    expect(frame).toHaveStyle({ width: "586px" });
    const list = within(frame).getByRole("tablist", { name: "Sections" });
    expect(list).toHaveClass("mac-about-window-tabs");
    expect(list.closest(".mac-title-bar")).toHaveAttribute("data-variant", "title-hidden");
    expect(within(list).getAllByRole("tab")).toHaveLength(3);
    expect(tab("Overview")).toHaveClass("mac-about-window-tab");
    expect(selected()).toBe("Overview");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Overview pane");
    expect(screen.getByRole("tabpanel")).toHaveClass("mac-about-window-panel");
    // The bar has no room for the title: it only names the window.
    expect(screen.queryByText("About This Mac")).not.toBeInTheDocument();
  });

  it("shows the pane of the tab that is clicked and reports it", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<About onValueChange={onValueChange} />);
    await user.click(tab("Displays"));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[0]).toBe("displays");
    expect(selected()).toBe("Displays");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Displays pane");
    expect(screen.queryByText("Overview pane")).not.toBeInTheDocument();
  });

  it("reports a press on its title bar, and not one on a control or a tab, for a window manager", async () => {
    const user = userEvent.setup();
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <About
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    for (const control of [screen.getByRole("button", { name: /close/i }), tab("Displays")]) {
      await user.pointer([{ keys: "[MouseLeft>]", target: control }, { keys: "[/MouseLeft]" }]);
      await user.dblClick(control);
    }
    expect(onDragRegionPointerDown).not.toHaveBeenCalled();
    expect(onDragRegionDoubleClick).not.toHaveBeenCalled();
    const bar = screen
      .getByTestId("window")
      .querySelector("[data-window-drag-region]") as HTMLElement;
    await user.pointer([{ keys: "[MouseLeft>]", target: bar }, { keys: "[/MouseLeft]" }]);
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);
    await user.dblClick(bar);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("starts on defaultValue, or on the first tab that is not disabled", () => {
    const { unmount } = render(<About defaultValue="storage" />);
    expect(selected()).toBe("Storage");
    unmount();
    render(<About overview={{ disabled: true }} />);
    expect(selected()).toBe("Displays");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Displays pane");
  });

  it("renders the first pane on the server, also when the tabs are grouped in a fragment", () => {
    const grouped = (
      <>
        <AboutWindowTab value="overview" disabled>
          Overview
        </AboutWindowTab>
        <AboutWindowTab value="displays">Displays</AboutWindowTab>
      </>
    );
    const html = renderToString(
      <AboutWindow
        title="About"
        tabs={
          <AboutWindowTabs>
            {false}
            {grouped}
            <AboutWindowTab value="storage">Storage</AboutWindowTab>
          </AboutWindowTabs>
        }
      >
        <AboutWindowPanel value="overview">Overview pane</AboutWindowPanel>
        <AboutWindowPanel value="displays">Displays pane</AboutWindowPanel>
        <AboutWindowPanel value="storage">Storage pane</AboutWindowPanel>
      </AboutWindow>,
    );
    expect(html).toContain("Displays pane");
    expect(html).not.toContain("Overview pane");
    expect(html).not.toContain("Storage pane");
  });

  it("renders the pane named by defaultValue on the server when a component supplies the tabs", () => {
    function Tabs() {
      return (
        <AboutWindowTabs>
          <AboutWindowTab value="overview">Overview</AboutWindowTab>
          <AboutWindowTab value="storage">Storage</AboutWindowTab>
        </AboutWindowTabs>
      );
    }
    const html = renderToString(
      <AboutWindow title="About" tabs={<Tabs />} defaultValue="storage">
        <AboutWindowPanel value="overview">Overview pane</AboutWindowPanel>
        <AboutWindowPanel value="storage">Storage pane</AboutWindowPanel>
      </AboutWindow>,
    );
    expect(html).toContain("Storage pane");
    expect(html).not.toContain("Overview pane");
  });

  it("follows a controlled value", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(<About value="overview" onValueChange={onValueChange} />);
    await user.click(tab("Storage"));
    expect(onValueChange.mock.calls[0]?.[0]).toBe("storage");
    expect(selected()).toBe("Overview");
    rerender(<About value="storage" onValueChange={onValueChange} />);
    expect(selected()).toBe("Storage");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Storage pane");
  });

  it("selects with the arrow keys, wrapping round, from one tab stop", async () => {
    const user = userEvent.setup();
    render(<About controls={null} />);
    await user.tab();
    expect(tab("Overview")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(tab("Displays")).toHaveFocus();
    expect(selected()).toBe("Displays");
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(tab("Storage")).toHaveFocus();
    expect(selected()).toBe("Storage");
    // The next Tab leaves the control for the pane.
    await user.tab();
    expect(screen.getByRole("tabpanel")).toHaveFocus();
  });

  it("only moves the focus with the arrow keys when activateOnFocus is off", async () => {
    const user = userEvent.setup();
    render(<About controls={null} list={{ activateOnFocus: false }} />);
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(tab("Displays")).toHaveFocus();
    expect(selected()).toBe("Overview");
    await user.keyboard("{Enter}");
    expect(selected()).toBe("Displays");
    await user.keyboard("{ArrowRight} ");
    expect(selected()).toBe("Storage");
  });

  it("cycles through the tabs on Control-Tab and Control-Shift-Tab, once per press", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<About controls={null} onValueChange={onValueChange} storage={{ disabled: true }} />);
    await user.tab();
    await user.keyboard("{Control>}{Tab}{/Control}");
    expect(selected()).toBe("Displays");
    expect(tab("Displays")).toHaveFocus();
    // Storage is disabled: the next one is the first again.
    await user.keyboard("{Control>}{Tab}{/Control}");
    expect(selected()).toBe("Overview");
    await user.keyboard("{Control>}{Shift>}{Tab}{/Shift}{/Control}");
    expect(selected()).toBe("Displays");
    expect(onValueChange.mock.calls.map((call) => call[0])).toEqual([
      "displays",
      "overview",
      "displays",
    ]);
  });

  it("cycles on Control-Tab when the tabs do not activate on focus, and leaves a prevented key alone", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { unmount } = render(
      <About controls={null} onValueChange={onValueChange} list={{ activateOnFocus: false }} />,
    );
    await user.tab();
    await user.keyboard("{Control>}{Tab}{/Control}");
    expect(selected()).toBe("Displays");
    expect(onValueChange).toHaveBeenCalledTimes(1);
    unmount();

    render(<About controls={null} list={{ onKeyDown: (event) => event.preventDefault() }} />);
    await user.tab();
    await user.keyboard("{Control>}{Tab}{/Control}");
    expect(selected()).toBe("Overview");
  });

  it("does not select a disabled tab", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<About onValueChange={onValueChange} storage={{ disabled: true }} />);
    expect(tab("Storage")).toHaveAttribute("aria-disabled", "true");
    await user.click(tab("Storage"));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(selected()).toBe("Overview");
  });

  it("has window controls with zoom disabled, and reports the close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<About onClose={onClose} />);
    expect(screen.getByRole("button", { name: "Minimize" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Zoom" })).toBeDisabled();
    const close = screen.getByRole("button", { name: "Close" });
    await user.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
    close.focus();
    await user.keyboard("{Enter}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("takes other window controls, or none", () => {
    const { unmount } = render(<About controls={<button type="button">Shut</button>} />);
    expect(screen.getByRole("button", { name: "Shut" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    unmount();
    render(<About controls={null} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows its title in a plain title bar when it has no tabs", () => {
    render(
      <AboutWindow title="About Almanac">
        <AboutWindowFooter>Legal text</AboutWindowFooter>
      </AboutWindow>,
    );
    const frame = screen.getByRole("region", { name: "About Almanac" });
    expect(within(frame).getByText("About Almanac")).toBeInTheDocument();
    expect(frame.querySelector(".mac-title-bar")).toHaveAttribute("data-variant", "standard");
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(within(frame).getByText("Legal text")).toBeInTheDocument();
  });

  it("hides a pane that is kept mounted while another is shown", async () => {
    const user = userEvent.setup();
    render(
      <AboutWindow
        title="About"
        tabs={
          <AboutWindowTabs>
            <AboutWindowTab value="overview">Overview</AboutWindowTab>
            <AboutWindowTab value="storage">Storage</AboutWindowTab>
          </AboutWindowTabs>
        }
      >
        <AboutWindowPanel value="overview" keepMounted>
          Overview pane
        </AboutWindowPanel>
        <AboutWindowPanel value="storage" keepMounted>
          Storage pane
        </AboutWindowPanel>
      </AboutWindow>,
    );
    const overview = screen.getByText("Overview pane");
    const storage = screen.getByText("Storage pane");
    expect(overview).not.toHaveAttribute("hidden");
    expect(storage).toHaveAttribute("hidden");
    await user.click(tab("Storage"));
    expect(overview).toHaveAttribute("hidden");
    expect(storage).not.toHaveAttribute("hidden");
  });

  it("takes the window state", () => {
    render(<About state="inactive" />);
    expect(screen.getByTestId("window")).toHaveAttribute("data-window-state", "inactive");
  });

  it("sets its size, and merges className, style, ref and other props on the window", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <About width={640} height={353} className="mine" style={{ left: 40 }} ref={ref} id="about" />,
    );
    const frame = screen.getByTestId("window");
    expect(ref.current).toBe(frame);
    expect(frame).toHaveClass("mac-about-window", "mine");
    expect(frame).toHaveStyle({ width: "640px", height: "353px", left: "40px" });
    expect(frame).toHaveAttribute("id", "about");
  });

  it("forwards ref, className and props on the tab control, a tab and a pane", () => {
    const list = createRef<HTMLDivElement>();
    const item = createRef<HTMLElement>();
    const pane = createRef<HTMLDivElement>();
    render(
      <AboutWindow
        tabs={
          <AboutWindowTabs ref={list} className="my-list" aria-label="Sections">
            <AboutWindowTab ref={item} className="my-tab" value="one" data-testid="one">
              One
            </AboutWindowTab>
          </AboutWindowTabs>
        }
      >
        <AboutWindowPanel ref={pane} className="my-pane" value="one" id="pane">
          Pane
        </AboutWindowPanel>
      </AboutWindow>,
    );
    expect(list.current).toBe(screen.getByRole("tablist"));
    expect(list.current).toHaveClass("mac-about-window-tabs", "my-list");
    expect(item.current).toBe(screen.getByTestId("one"));
    expect(item.current).toHaveClass("mac-about-window-tab", "my-tab");
    expect(pane.current).toBe(screen.getByRole("tabpanel"));
    expect(pane.current).toHaveClass("mac-about-window-panel", "my-pane");
    expect(pane.current).toHaveAttribute("id", "pane");
  });
});

describe("AboutWindowOverview and its parts", () => {
  function Overview() {
    return (
      <AboutWindowOverview image={<img src="badge.png" alt="macOS badge" />} data-testid="overview">
        <AboutWindowTitle emphasized="macOS">Catalina</AboutWindowTitle>
        <AboutWindowVersion label="Version">10.15</AboutWindowVersion>
        <AboutWindowDetails aria-label="Hardware">
          <AboutWindowDetail label="MacBook Pro (15-inch, 2019)" />
          <AboutWindowDetail label="Memory">16 GB</AboutWindowDetail>
          <AboutWindowDetail>No label</AboutWindowDetail>
        </AboutWindowDetails>
        <AboutWindowActions data-testid="actions">
          <button type="button">System Report…</button>
        </AboutWindowActions>
      </AboutWindowOverview>
    );
  }

  it("lays out a picture and a column of text", () => {
    render(<Overview />);
    const overview = screen.getByTestId("overview");
    expect(overview).toHaveClass("mac-about-window-overview");
    expect(screen.getByRole("img", { name: "macOS badge" }).parentElement).toHaveClass(
      "mac-about-window-image",
    );
    expect(screen.getByTestId("actions").parentElement).toHaveClass("mac-about-window-content");
    expect(screen.getByTestId("actions")).toHaveClass("mac-about-window-actions");
    expect(screen.getByRole("button", { name: "System Report…" })).toBeInTheDocument();
  });

  it("has a heading with a bold beginning, and a version line with a bold label", () => {
    render(<Overview />);
    const heading = screen.getByRole("heading", { level: 1, name: "macOS Catalina" });
    expect(heading).toHaveClass("mac-about-window-title");
    expect(screen.getByText("macOS")).toHaveClass("mac-about-window-title-emphasized");
    expect(screen.getByText("Version")).toHaveClass("mac-about-window-version-label");
    expect(screen.getByText("Version").parentElement).toHaveTextContent("Version 10.15");
  });

  it("renders a title and a version without the bold part", () => {
    render(
      <>
        <AboutWindowTitle>Almanac</AboutWindowTitle>
        <AboutWindowVersion data-testid="version">2.4</AboutWindowVersion>
      </>,
    );
    expect(screen.getByRole("heading", { name: "Almanac" }).children).toHaveLength(0);
    expect(screen.getByTestId("version").children).toHaveLength(0);
  });

  it("lists the details as rows of a label and a value", () => {
    render(<Overview />);
    const list = screen.getByRole("list", { name: "Hardware" });
    expect(list).toHaveClass("mac-about-window-details");
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "MacBook Pro (15-inch, 2019)",
      "Memory 16 GB",
      "No label",
    ]);
    expect(screen.getByText("Memory")).toHaveClass("mac-about-window-detail-label");
    expect(screen.getByText("16 GB")).toHaveClass("mac-about-window-detail-value");
    expect(rows[0]?.children).toHaveLength(1);
  });

  it("forwards ref, className and props on every part", () => {
    const refs = {
      overview: createRef<HTMLDivElement>(),
      title: createRef<HTMLHeadingElement>(),
      version: createRef<HTMLParagraphElement>(),
      details: createRef<HTMLUListElement>(),
      detail: createRef<HTMLLIElement>(),
      actions: createRef<HTMLDivElement>(),
      footer: createRef<HTMLParagraphElement>(),
      link: createRef<HTMLAnchorElement>(),
    };
    render(
      <>
        <AboutWindowOverview ref={refs.overview} className="mine" id="overview">
          <AboutWindowTitle ref={refs.title} className="mine" id="title" />
          <AboutWindowVersion ref={refs.version} className="mine" id="version" />
          <AboutWindowDetails ref={refs.details} className="mine" id="details">
            <AboutWindowDetail ref={refs.detail} className="mine" id="detail" />
          </AboutWindowDetails>
          <AboutWindowActions ref={refs.actions} className="mine" id="actions" />
        </AboutWindowOverview>
        <AboutWindowFooter ref={refs.footer} className="mine" id="footer">
          <AboutWindowLink ref={refs.link} className="mine" id="link" href="#license">
            License Agreement
          </AboutWindowLink>
        </AboutWindowFooter>
      </>,
    );
    for (const [name, ref] of Object.entries(refs)) {
      expect(ref.current).toHaveAttribute("id", name);
      expect(ref.current).toHaveClass("mine");
    }
    expect(refs.overview.current).toHaveClass("mac-about-window-overview");
    expect(refs.footer.current).toHaveClass("mac-about-window-footer");
  });

  it("has links in its legal text that the keyboard reaches", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <AboutWindowFooter>
        All Rights Reserved.{" "}
        <AboutWindowLink href="#license" onClick={onClick}>
          License Agreement
        </AboutWindowLink>
      </AboutWindowFooter>,
    );
    const link = screen.getByRole("link", { name: "License Agreement" });
    expect(link).toHaveClass("mac-about-window-link");
    expect(link).toHaveAttribute("href", "#license");
    await user.tab();
    expect(link).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.click(link);
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});
