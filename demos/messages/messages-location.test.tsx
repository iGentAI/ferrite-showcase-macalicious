import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LOCATION_REFUSED, NO_LOCATION, SendLocationButton } from "./messages-location";

const setGeolocation = (value: unknown) =>
  Object.defineProperty(navigator, "geolocation", { configurable: true, value });

afterEach(() => {
  Reflect.deleteProperty(navigator, "geolocation");
});

describe("Send My Current Location", () => {
  it("sends where the browser says the person is, as a link", async () => {
    setGeolocation({
      getCurrentPosition: (done: (position: unknown) => void) =>
        done({ coords: { latitude: 52.37021, longitude: 4.89517 } }),
    });
    const onSend = vi.fn();
    render(<SendLocationButton onSend={onSend} />);
    await userEvent.click(screen.getByRole("button", { name: "Send My Current Location" }));
    expect(onSend).toHaveBeenCalledWith(
      "My current location: https://maps.apple.com/?ll=52.37021,4.89517",
    );
  });

  it("sends nothing and says so when the browser refuses", async () => {
    setGeolocation({
      getCurrentPosition: (_: unknown, refuse: () => void) => refuse(),
    });
    const onSend = vi.fn();
    render(<SendLocationButton onSend={onSend} />);
    await userEvent.click(screen.getByRole("button", { name: "Send My Current Location" }));
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe(LOCATION_REFUSED);
  });

  it("is dimmed, with the reason, in a browser without a position", () => {
    render(<SendLocationButton onSend={() => {}} />);
    const button = screen.getByRole("button", { name: "Send My Current Location" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.getAttribute("title")).toBe(NO_LOCATION);
  });
});
