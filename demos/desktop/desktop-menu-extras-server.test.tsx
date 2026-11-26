// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AirPlayMenu } from "./desktop-menu-extras";

describe("the AirPlay menu on the server", () => {
  it("renders with no window to ask for a display", () => {
    expect(typeof window).toBe("undefined");
    expect(() =>
      renderToString(<AirPlayMenu titleProps={{}} preferences={() => {}} />),
    ).not.toThrow();
  });
});
