import { describe, expect, it } from "vitest";
import {
  fitScale,
  movieFrameSize,
  panoramicStrips,
  SOUND_SIZE,
  steppedScale,
} from "./quicktime-player-size";

const ROOM = { width: 1400, height: 760 };
const HD = { width: 1280, height: 720 };

describe("panoramicStrips", () => {
  const widths = (strips: ReturnType<typeof panoramicStrips>) => strips.map((each) => each.dw);

  it("fills a wider frame to its edges, without a gap, and the full height", () => {
    const strips = panoramicStrips({ width: 640, height: 480 }, { width: 1440, height: 900 }, 8);
    expect(strips[0]?.dx).toBe(0);
    const last = strips[7];
    expect((last?.dx ?? 0) + (last?.dw ?? 0)).toBe(1440);
    for (const [index, strip] of strips.entries()) {
      expect(strip.sx).toBe(index * 80);
      expect(strip.dh).toBe(900);
      if (index > 0) {
        const before = strips[index - 1];
        expect(strip.dx).toBe((before?.dx ?? 0) + (before?.dw ?? 0));
      }
    }
  });

  it("keeps the centre's true shape and stretches more towards the ends", () => {
    const strips = panoramicStrips({ width: 640, height: 480 }, { width: 1440, height: 900 }, 8);
    // 900 / 480 scales the picture's height: 80 source pixels at the very centre are 150 wide.
    expect(widths(strips)).toEqual([219, 186, 163, 152, 152, 163, 186, 219]);
  });

  it("changes nothing where the frame has the movie's shape", () => {
    const strips = panoramicStrips({ width: 800, height: 400 }, { width: 800, height: 400 }, 4);
    expect(widths(strips)).toEqual([200, 200, 200, 200]);
  });

  it("stretches along the height in a frame narrower than the movie", () => {
    const strips = panoramicStrips({ width: 1000, height: 400 }, { width: 500, height: 400 }, 2);
    expect(strips.map((each) => [each.sy, each.sh, each.dy, each.dh, each.dw])).toEqual([
      [0, 200, 0, 200, 500],
      [200, 200, 200, 200, 500],
    ]);
  });
});

describe("movieFrameSize", () => {
  it("gives a movie its own size at actual size", () => {
    expect(movieFrameSize(HD, 1, ROOM)).toEqual(HD);
  });

  it("scales, keeping the shape", () => {
    expect(movieFrameSize(HD, 0.5, ROOM)).toEqual({ width: 640, height: 360 });
  });

  it("goes no narrower than the controller", () => {
    expect(movieFrameSize({ width: 320, height: 240 }, 1, ROOM)).toEqual({
      width: 480,
      height: 360,
    });
  });

  it("stays inside the room, keeping the shape", () => {
    expect(movieFrameSize({ width: 3840, height: 2160 }, 1, ROOM)).toEqual({
      width: 1351,
      height: 760,
    });
    expect(movieFrameSize({ width: 3000, height: 1000 }, 1, ROOM)).toEqual({
      width: 1400,
      height: 467,
    });
  });

  it("keeps a very tall movie inside the room, its shape within a pixel", () => {
    const frame = movieFrameSize({ width: 100, height: 10000 }, 1, ROOM);
    expect(frame).toEqual({ width: 8, height: 760 });
  });

  it("gives sound its small window, inside a smaller room too", () => {
    expect(movieFrameSize({ width: 0, height: 0 }, 1, ROOM)).toEqual(SOUND_SIZE);
    expect(movieFrameSize({ width: 0, height: 0 }, 1, { width: 400, height: 100 })).toEqual({
      width: 400,
      height: 100,
    });
  });
});

describe("steppedScale", () => {
  const step = (movie: { width: number; height: number }, now: number, by: number) => {
    const scale = steppedScale(movie, now, by, ROOM);
    return { scale, frame: movieFrameSize(movie, scale, ROOM) };
  };

  it("grows a movie the controller holds wider than itself, on the first step", () => {
    expect(step({ width: 320, height: 240 }, 1, 1.25).frame).toEqual({ width: 600, height: 450 });
  });

  it("shrinks a movie the room holds smaller than itself, on the first step", () => {
    const big = { width: 3840, height: 2160 };
    const before = movieFrameSize(big, 1, ROOM);
    const after = step(big, 1, 0.8).frame;
    expect(after.width).toBe(Math.round(before.width * 0.8));
    expect(after.width / after.height).toBeCloseTo(16 / 9, 2);
  });

  it("stops at the controller's width and at the room, and any step from there shows", () => {
    const small = { width: 320, height: 240 };
    const least = step(small, 1, 0.8);
    expect(least.frame.width).toBe(480);
    expect(step(small, least.scale, 1.25).frame.width).toBe(600);
    const most = step(HD, 1, 2);
    expect(most.frame).toEqual({ width: 1351, height: 760 });
    expect(step(HD, most.scale, 0.8).frame.width).toBe(1081);
  });
});

describe("fitScale", () => {
  it("is what makes the movie reach the room's nearer edge", () => {
    expect(fitScale({ width: 700, height: 100 }, ROOM)).toBe(2);
    expect(fitScale({ width: 100, height: 380 }, ROOM)).toBe(2);
  });
});
