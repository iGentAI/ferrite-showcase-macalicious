import { describe, expect, it } from "vitest";
import { CAMERA_NOTICE, cameraProblem } from "./photo-booth-desktop";

const refused = (name: string) => new DOMException("The browser refused.", name);

describe("why Photo Booth has no camera", () => {
  it("tells a refusal from a missing camera and a busy one, by the browser's error", () => {
    expect(cameraProblem(refused("NotAllowedError"))).toBe("denied");
    expect(cameraProblem(refused("SecurityError"))).toBe("denied");
    expect(cameraProblem(refused("NotFoundError"))).toBe("missing");
    expect(cameraProblem(refused("OverconstrainedError"))).toBe("missing");
    expect(cameraProblem(refused("NotReadableError"))).toBe("busy");
    expect(cameraProblem(refused("AbortError"))).toBe("busy");
    expect(cameraProblem(new Error("something else"))).toBe("busy");
    expect(cameraProblem("not an error")).toBe("busy");
  });

  it("says each in words that tell the person what happened and what to do", () => {
    expect(CAMERA_NOTICE.denied).toMatch(/not allowed to use the camera.*Allow camera access/);
    expect(CAMERA_NOTICE.missing).toMatch(/^No camera is connected/);
    expect(CAMERA_NOTICE.busy).toMatch(/could not be started/);
    expect(CAMERA_NOTICE.unsupported).toMatch(/cannot use a camera/);
    expect(CAMERA_NOTICE.ready).toBeNull();
  });
});
