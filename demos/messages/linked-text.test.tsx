import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { linkedText, linkPieces, linkTextNodes } from "./linked-text";

// Web addresses in message text open in Safari (`openUrl`); `linkAddress` is the real one.
const openUrl = vi.hoisted(() => vi.fn());
vi.mock("../desktop/desktop-open-url", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../desktop/desktop-open-url")>()),
  openUrl: (...args: unknown[]) => openUrl(...args),
}));

const TEXT =
  "Map: https://Example.com/a?b=1, not javascript:alert(1) nor https://user@evil.test/x <b>x</b>";

describe("links in message text", () => {
  afterEach(() => openUrl.mockReset());

  it("makes only safe web addresses links, and keeps every character of the text", () => {
    const pieces = linkPieces(TEXT);
    expect(pieces.map((piece) => piece.text).join("")).toBe(TEXT);
    expect(pieces.filter((piece) => piece.href)).toEqual([
      { text: "https://Example.com/a?b=1", href: "https://example.com/a?b=1" },
    ]);
    expect(linkedText("No address here.", "messages")).toBe("No address here.");
  });

  it("renders text as text, and a click asks Safari instead of leaving the desktop", () => {
    const { container } = render(<p>{linkedText(TEXT, "messages")}</p>);
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toBe(TEXT);
    const link = screen.getByRole("link", { name: "https://Example.com/a?b=1" });
    expect(link.getAttribute("href")).toBe("https://example.com/a?b=1");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    // `false`: the link's own navigation was stopped.
    expect(fireEvent.click(link)).toBe(false);
    expect(openUrl).toHaveBeenCalledWith("https://example.com/a?b=1", "messages");
  });

  it("links the text nodes of a styled message, and unwraps a link it cannot open", () => {
    const root = document.createElement("div");
    const bold = document.createElement("b");
    bold.append("see https://example.com/x.");
    const bad = document.createElement("a");
    bad.setAttribute("href", "javascript:alert(1)");
    bad.append("bad");
    const good = document.createElement("a");
    good.setAttribute("href", "https://Ok.test");
    good.setAttribute("target", "_top");
    good.append("ok");
    root.append(bold, " ", bad, " ", good);
    document.body.append(root);
    linkTextNodes(root, "mail");
    expect(root.textContent).toBe("see https://example.com/x. bad ok");
    const links = [...root.querySelectorAll("a")];
    expect(
      links.map((a) => [a.textContent, a.getAttribute("href"), a.getAttribute("rel")]),
    ).toEqual([
      ["https://example.com/x", "https://example.com/x", "noopener noreferrer"],
      ["ok", "https://ok.test/", "noopener noreferrer"],
    ]);
    expect(links[0]?.parentElement?.tagName).toBe("B");
    expect(links[1]?.hasAttribute("target")).toBe(false);
    expect(fireEvent.click(links[0] as HTMLAnchorElement)).toBe(false);
    expect(fireEvent.click(links[1] as HTMLAnchorElement)).toBe(false);
    expect(openUrl.mock.calls).toEqual([
      ["https://example.com/x", "mail"],
      ["https://ok.test/", "mail"],
    ]);
    root.remove();
  });
});
