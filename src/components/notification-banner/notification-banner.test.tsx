import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { NotificationBanner } from "./index";

describe("NotificationBanner", () => {
  it("is an article with the app, the time, the title, the subtitle and the message", () => {
    render(
      <NotificationBanner app="Music" time="now" title="Every Breaking Wave" subtitle="U2">
        Songs of Innocence
      </NotificationBanner>,
    );
    const banner = screen.getByRole("article");
    expect(banner).toHaveClass("mac-notification-banner");
    for (const text of ["Music", "now", "Every Breaking Wave", "U2", "Songs of Innocence"]) {
      expect(within(banner).getByText(text)).toBeInTheDocument();
    }
    expect(within(banner).queryByRole("button")).not.toBeInTheDocument();
  });

  it("leaves out what it is not given", () => {
    render(<NotificationBanner app="Music" data-testid="banner" />);
    const banner = screen.getByTestId("banner");
    expect(banner.querySelector(".mac-notification-banner-time")).toBeNull();
    expect(banner.querySelector(".mac-notification-banner-title")).toBeNull();
    expect(banner.querySelector(".mac-notification-banner-subtitle")).toBeNull();
    expect(banner.querySelector(".mac-notification-banner-body")).toBeNull();
    expect(banner.querySelector(".mac-notification-banner-thumbnail")).toBeNull();
  });

  it("hides the icon from assistive technology and shows the thumbnail", () => {
    render(
      <NotificationBanner
        app="Music"
        icon={<svg data-testid="icon" />}
        thumbnail={<img alt="Album cover" src="data:," />}
      />,
    );
    expect(screen.getByTestId("icon").parentElement).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("img", { name: "Album cover" })).toBeInTheDocument();
  });

  it("makes its text a button when it can be opened, by pointer and by keyboard", async () => {
    const onOpen = vi.fn();
    render(
      <NotificationBanner app="Music" title="Every Breaking Wave" onOpen={onOpen}>
        U2
      </NotificationBanner>,
    );
    const open = screen.getByRole("button", { name: /Every Breaking Wave/ });
    expect(open).toHaveAccessibleName("Every Breaking Wave U2");
    await userEvent.click(open);
    expect(onOpen).toHaveBeenCalledTimes(1);
    open.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onOpen).toHaveBeenCalledTimes(3);
  });

  it("has a clear button that does not open the notification", async () => {
    const onOpen = vi.fn();
    const onClear = vi.fn();
    render(
      <NotificationBanner
        app="Music"
        title="Every Breaking Wave"
        onOpen={onOpen}
        onClear={onClear}
      />,
    );
    const clear = screen.getByRole("button", { name: "Clear" });
    await userEvent.click(clear);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
    clear.focus();
    await userEvent.keyboard("{Enter}");
    expect(onClear).toHaveBeenCalledTimes(2);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("reaches the clear button before the text with Tab", async () => {
    render(<NotificationBanner app="Music" title="Wave" onOpen={() => {}} onClear={() => {}} />);
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Clear" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Wave" })).toHaveFocus();
  });

  it("takes the name of the clear button", () => {
    render(<NotificationBanner app="Music" onClear={() => {}} clearLabel="Dismiss" />);
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });

  it("forwards ref, className, style and attributes to the root", () => {
    const ref = createRef<HTMLElement>();
    render(
      <NotificationBanner
        ref={ref}
        app="Music"
        className="extra"
        id="n1"
        style={{ width: 280 }}
        aria-label="Music notification"
      />,
    );
    expect(ref.current?.tagName).toBe("ARTICLE");
    expect(ref.current).toHaveClass("mac-notification-banner", "extra");
    expect(ref.current).toHaveAttribute("id", "n1");
    expect(ref.current).toHaveStyle({ width: "280px" });
    expect(screen.getByRole("article", { name: "Music notification" })).toBe(ref.current);
  });
});
