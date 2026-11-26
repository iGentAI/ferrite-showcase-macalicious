import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  WebView,
  WebViewError,
  WebViewFavorite,
  WebViewFavorites,
  WebViewProgress,
  WebViewReader,
  WebViewReaderTitle,
  WebViewTabOverview,
  WebViewTabThumbnail,
} from "./index";

describe("WebView", () => {
  it("shows its children as the page, on the page surface, and can take focus", async () => {
    const user = userEvent.setup();
    render(<WebView data-testid="view">Page</WebView>);
    const view = screen.getByTestId("view");
    expect(view).toHaveClass("mac-web-view");
    expect(view).toHaveAttribute("data-surface", "page");
    expect(view).not.toHaveAttribute("data-frame");
    expect(view).not.toHaveAttribute("role");
    expect(view).toHaveTextContent("Page");
    expect(screen.queryByTitle(/./)).not.toBeInTheDocument();
    // The keyboard reaches the view, so that the arrow keys scroll it.
    await user.tab();
    expect(view).toHaveFocus();
  });

  it("is a region named by its title", () => {
    render(<WebView title="Example page">Page</WebView>);
    expect(screen.getByRole("region", { name: "Example page" })).toHaveTextContent("Page");
  });

  it("reflects the surface", () => {
    render(
      <WebView surface="reader" data-testid="view">
        Page
      </WebView>,
    );
    expect(screen.getByTestId("view")).toHaveAttribute("data-surface", "reader");
  });

  it("frames a document in a sandboxed iframe named by the title", async () => {
    const user = userEvent.setup();
    render(<WebView src="https://example.com/" title="Example Domain" data-testid="view" />);
    const view = screen.getByTestId("view");
    const frame = screen.getByTitle("Example Domain");
    expect(frame.tagName).toBe("IFRAME");
    expect(view).toContainElement(frame);
    expect(frame).toHaveAttribute("src", "https://example.com/");
    expect(frame).toHaveAttribute("sandbox", "allow-scripts allow-forms");
    expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(view).toHaveAttribute("data-frame");
    // The frame is the scrolling, focusable thing; the view around it is neither.
    expect(view).not.toHaveAttribute("tabindex");
    expect(view).not.toHaveAttribute("role");
    expect(view).not.toHaveAttribute("aria-label");
    await user.tab();
    expect(view).not.toHaveFocus();
  });

  it("lets the sandbox, the referrer policy and other frame attributes be set", () => {
    const frameRef = createRef<HTMLIFrameElement>();
    render(
      <WebView
        src="https://example.com/"
        title="Example Domain"
        sandbox=""
        referrerPolicy="origin"
        frameProps={{ ref: frameRef, loading: "lazy", className: "own", name: "page" }}
      />,
    );
    const frame = screen.getByTitle("Example Domain");
    expect(frameRef.current).toBe(frame);
    expect(frame).toHaveAttribute("sandbox", "");
    expect(frame).toHaveAttribute("referrerpolicy", "origin");
    expect(frame).toHaveAttribute("loading", "lazy");
    expect(frame).toHaveAttribute("name", "page");
    expect(frame).toHaveClass("mac-web-view-frame", "own");
  });

  it("draws its children over the frame", () => {
    render(
      <WebView src="https://example.com/" title="Example Domain">
        <WebViewProgress value={25} aria-label="Loading" />
      </WebView>,
    );
    expect(screen.getByRole("progressbar", { name: "Loading" })).toBeInTheDocument();
    expect(screen.getByTitle("Example Domain")).toBeInTheDocument();
  });

  it("forwards ref, className, style and native attributes to the root", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <WebView ref={ref} className="extra" id="view" tabIndex={-1} style={{ height: 200 }}>
        Page
      </WebView>,
    );
    expect(ref.current).toHaveClass("mac-web-view", "extra");
    expect(ref.current).toHaveAttribute("id", "view");
    expect(ref.current).toHaveAttribute("tabindex", "-1");
    expect(ref.current?.style.height).toBe("200px");
  });
});

describe("WebViewProgress", () => {
  it("reports how much of the page has loaded", () => {
    const ref = createRef<HTMLDivElement>();
    render(<WebViewProgress ref={ref} value={40} aria-label="Loading" className="extra" />);
    const bar = screen.getByRole("progressbar", { name: "Loading" });
    expect(bar).toBe(ref.current);
    expect(bar).toHaveClass("mac-web-view-progress", "extra");
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(bar.firstElementChild?.getAttribute("style")).toContain("width: 40%");
  });

  it("follows min and max, and is indeterminate without a value", () => {
    const { rerender } = render(<WebViewProgress value={1} max={4} aria-label="Loading" />);
    const bar = screen.getByRole("progressbar");
    expect(bar.firstElementChild?.getAttribute("style")).toContain("width: 25%");
    rerender(<WebViewProgress value={null} aria-label="Loading" />);
    expect(bar).not.toHaveAttribute("aria-valuenow");
    expect(bar).toHaveAttribute("data-indeterminate");
  });
});

describe("WebViewFavorites", () => {
  it("is a section named by its heading, six tiles to a row", () => {
    render(
      <WebViewFavorites heading="Favorites">
        <WebViewFavorite href="https://example.com/" label="Example">
          E
        </WebViewFavorite>
      </WebViewFavorites>,
    );
    const section = screen.getByRole("region", { name: "Favorites" });
    expect(section).toHaveClass("mac-web-view-favorites");
    expect(screen.getByRole("heading", { level: 2, name: "Favorites" })).toBeInTheDocument();
    expect(section.style.getPropertyValue("--mac-web-view-columns")).toBe("6");
    expect(section).toContainElement(screen.getByRole("link", { name: "Example" }));
  });

  it("takes the number of columns, and needs no heading", () => {
    const ref = createRef<HTMLElement>();
    render(
      <WebViewFavorites ref={ref} columns={3} className="extra" style={{ marginTop: 4 }}>
        <WebViewFavorite href="https://example.com/" label="Example" />
      </WebViewFavorites>,
    );
    expect(ref.current).toHaveClass("mac-web-view-favorites", "extra");
    expect(ref.current).not.toHaveAttribute("aria-labelledby");
    expect(ref.current?.style.getPropertyValue("--mac-web-view-columns")).toBe("3");
    expect(ref.current?.style.marginTop).toBe("4px");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});

describe("WebViewFavorite", () => {
  it("is a link named by its label and detail, not by the tile's content", () => {
    const ref = createRef<HTMLAnchorElement>();
    render(
      <WebViewFavorite
        ref={ref}
        href="https://example.com/"
        label="News"
        detail="16 Websites"
        className="extra"
      >
        N
      </WebViewFavorite>,
    );
    const link = screen.getByRole("link", { name: "News 16 Websites" });
    expect(link).toBe(ref.current);
    expect(link).toHaveClass("mac-web-view-favorite", "extra");
    expect(link).toHaveAttribute("href", "https://example.com/");
    expect(screen.getByText("N")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders as a button that the pointer and the keyboard activate", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <WebViewFavorite label="Travel" render={<button type="button" />} onClick={onClick}>
        T
      </WebViewFavorite>,
    );
    const button = screen.getByRole("button", { name: "Travel" });
    expect(button).toHaveClass("mac-web-view-favorite");
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("ignores a click and is not followed with aria-disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <WebViewFavorite label="Travel" href="#travel" aria-disabled="true" onClick={onClick}>
        T
      </WebViewFavorite>,
    );
    const link = screen.getByRole("link", { name: "Travel" });
    await user.click(link);
    expect(onClick).not.toHaveBeenCalled();
    // dispatchEvent returns false when the default action, following the link, was prevented.
    expect(fireEvent.click(link)).toBe(false);
  });
});

describe("WebViewReader", () => {
  it("is an article with a first-level title", () => {
    const ref = createRef<HTMLElement>();
    const titleRef = createRef<HTMLHeadingElement>();
    render(
      <WebViewReader ref={ref} className="extra" lang="en">
        <WebViewReaderTitle ref={titleRef} className="own" id="title">
          About this page
        </WebViewReaderTitle>
        <p>Text</p>
      </WebViewReader>,
    );
    const article = screen.getByRole("article");
    expect(article).toBe(ref.current);
    expect(article).toHaveClass("mac-web-view-reader", "extra");
    expect(article).toHaveAttribute("lang", "en");
    const title = screen.getByRole("heading", { level: 1, name: "About this page" });
    expect(title).toBe(titleRef.current);
    expect(title).toHaveClass("mac-web-view-reader-title", "own");
    expect(title).toHaveAttribute("id", "title");
  });
});

describe("WebViewError", () => {
  it("shows a headline and the explanation", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <WebViewError ref={ref} title="Can’t Open the Page" className="extra" role="alert">
        The server can’t be found.
      </WebViewError>,
    );
    expect(ref.current).toHaveClass("mac-web-view-error", "extra");
    expect(screen.getByRole("alert")).toBe(ref.current);
    expect(screen.getByRole("heading", { level: 2, name: "Can’t Open the Page" })).toBeVisible();
    expect(ref.current).toHaveTextContent("The server can’t be found.");
  });

  it("renders no message element without children", () => {
    render(<WebViewError title="No page" data-testid="error" />);
    expect(screen.getByTestId("error").children).toHaveLength(1);
  });
});

describe("WebViewTabOverview", () => {
  it("is a named group of thumbnails, four to a row", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <WebViewTabOverview ref={ref} aria-label="Open tabs" className="extra">
        <WebViewTabThumbnail title="Example Domain" />
        <WebViewTabThumbnail variant="new-tab" aria-label="New Tab" />
      </WebViewTabOverview>,
    );
    const group = screen.getByRole("group", { name: "Open tabs" });
    expect(group).toBe(ref.current);
    expect(group).toHaveClass("mac-web-view-tab-overview", "extra");
    expect(group.style.getPropertyValue("--mac-web-view-columns")).toBe("4");
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("takes the number of columns", () => {
    render(<WebViewTabOverview columns={2} data-testid="overview" />);
    expect(screen.getByTestId("overview").style.getPropertyValue("--mac-web-view-columns")).toBe(
      "2",
    );
  });
});

describe("WebViewTabThumbnail", () => {
  it("is a button named by the page's title, with the miniature hidden from it", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    render(
      <WebViewTabThumbnail ref={ref} title="Example Domain" className="extra" onClick={onClick}>
        <span>miniature</span>
      </WebViewTabThumbnail>,
    );
    const button = screen.getByRole("button", { name: "Example Domain" });
    expect(button).toBe(ref.current);
    expect(button).toHaveClass("mac-web-view-thumbnail", "extra");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("data-variant", "page");
    expect(screen.getByText("miniature").parentElement).toHaveAttribute("aria-hidden", "true");
    await user.click(button);
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("does nothing while disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<WebViewTabThumbnail title="Example Domain" disabled onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Example Domain" });
    expect(button).toBeDisabled();
    await user.click(button);
    await user.tab();
    expect(button).not.toHaveFocus();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("is disabled on whatever element it is rendered as", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    // A link with a handler of its own, as an application's router link is.
    const link = () => createElement("a", { href: "#page", onClick });
    render(
      <>
        <WebViewTabThumbnail title="Disabled" disabled render={link()} onClick={onClick} />
        <WebViewTabThumbnail title="Enabled" render={link()} />
      </>,
    );
    const disabled = screen.getByRole("link", { name: "Disabled" });
    expect(disabled).toHaveAttribute("aria-disabled", "true");
    await user.click(disabled);
    expect(onClick).not.toHaveBeenCalled();
    // dispatchEvent returns false when the default action, following the link, was prevented.
    expect(fireEvent.click(disabled)).toBe(false);

    const enabled = screen.getByRole("link", { name: "Enabled" });
    expect(enabled).not.toHaveAttribute("aria-disabled");
    await user.click(enabled);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("draws the new-tab tile without a title or a miniature", () => {
    render(
      <WebViewTabThumbnail variant="new-tab" aria-label="New Tab">
        ignored
      </WebViewTabThumbnail>,
    );
    const button = screen.getByRole("button", { name: "New Tab" });
    expect(button).toHaveAttribute("data-variant", "new-tab");
    expect(button).toBeEmptyDOMElement();
  });

  it("renders another element through render", () => {
    render(
      <WebViewTabThumbnail title="Example Domain" render={<a href="https://example.com/" />} />,
    );
    const link = screen.getByRole("link", { name: "Example Domain" });
    expect(link).toHaveClass("mac-web-view-thumbnail");
    expect(link).toHaveAttribute("href", "https://example.com/");
  });
});
