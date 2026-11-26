import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addressOfLink, linkAddressNodes, mailLinkedText } from "./mail-links";

const asked = vi.hoisted(() => vi.fn());
vi.mock("../desktop/desktop-reach", () => ({ askToReach: asked }));

beforeEach(() => asked.mockClear());

describe("mail addresses in a message's text", () => {
  it("open a New Message from plain text, leaving the words and web addresses as they are", () => {
    render(
      <p>{mailLinkedText("Write to martin@macalicious or see https://a.example/x@y now.")}</p>,
    );
    expect(screen.getByRole("paragraph")).toHaveTextContent(
      "Write to martin@macalicious or see https://a.example/x@y now.",
    );
    expect(screen.getByRole("link", { name: "https://a.example/x@y" })).toHaveAttribute(
      "href",
      "https://a.example/x@y",
    );
    fireEvent.click(screen.getByRole("link", { name: "martin@macalicious" }));
    expect(asked).toHaveBeenCalledWith({
      app: "mail",
      to: "martin@macalicious",
      name: "martin@macalicious",
    });
  });

  it("open one from styled text, and skip what is a link already", () => {
    const root = document.createElement("div");
    root.innerHTML = "<b>ada@example.com</b> <a href='https://a.example'>bo@example.com</a>";
    linkAddressNodes(root);
    const links = root.querySelectorAll("a");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "mailto:ada@example.com");
    links[0]?.click();
    expect(asked).toHaveBeenCalledWith(
      expect.objectContaining({ app: "mail", to: "ada@example.com" }),
    );
    expect(links[1]).toHaveAttribute("href", "https://a.example");
  });

  it("say which address a mailto: link names", () => {
    expect(addressOfLink("mailto:ada@example.com?subject=Hi")).toBe("ada@example.com");
    expect(addressOfLink("https://a.example")).toBeNull();
  });
});
