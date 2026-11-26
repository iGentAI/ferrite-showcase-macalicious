import { describe, expect, it } from "vitest";
import { muxWebm } from "./quicktime-player-webm";

/** The elements directly inside `data`: ID as hex, and their content. */
function elements(data: Uint8Array) {
  const found: { id: string; body: Uint8Array }[] = [];
  let at = 0;
  while (at < data.length) {
    const first = data[at] as number;
    const idLength = first >= 0x80 ? 1 : first >= 0x40 ? 2 : first >= 0x20 ? 3 : 4;
    const id = Buffer.from(data.subarray(at, at + idLength)).toString("hex");
    at += idLength;
    const sizeByte = data[at] as number;
    let length: number;
    if (sizeByte & 0x80) {
      length = sizeByte & 0x7f;
      at += 1;
    } else {
      length = Number(
        new DataView(data.buffer, data.byteOffset + at).getBigUint64(0) & 0xffffffffffffffn,
      );
      at += 8;
    }
    found.push({ id, body: data.subarray(at, at + length) });
    at += length;
  }
  return found;
}

const frame = (track: 1 | 2, ms: number, key: boolean) => ({
  track,
  timestamp: ms * 1000,
  key,
  data: new Uint8Array([track, ms & 0xff]),
});

const read = async (blob: Blob) => {
  const all = new Uint8Array(await blob.arrayBuffer());
  const [header, segment] = elements(all);
  if (!header || !segment) throw new Error("not two top-level elements");
  return { header, parts: elements(segment.body) };
};

describe("muxWebm", () => {
  const tracks = {
    video: { codec: "V_VP9" as const, width: 640, height: 480 },
    audio: {
      sampleRate: 48_000,
      channels: 2,
      head: new Uint8Array([79, 112, 117, 115, 72, 101, 97, 100, 1, 2, 0x38, 1]),
    },
  };

  it("writes a WebM of Info, Tracks, Cues and Clusters in that order", async () => {
    const blob = muxWebm(tracks, [frame(1, 0, true), frame(2, 0, true)], 1);
    expect(blob.type).toBe("video/webm");
    const { header, parts } = await read(blob);
    expect(header.id).toBe("1a45dfa3");
    expect(Buffer.from(header.body).includes(Buffer.from("webm"))).toBe(true);
    expect(parts.map((part) => part.id)).toEqual(["1549a966", "1654ae6b", "1c53bb6b", "1f43b675"]);
  });

  it("says the length in Info, in milliseconds", async () => {
    const { parts } = await read(muxWebm(tracks, [frame(1, 0, true)], 2.5));
    const duration = elements(parts[0]?.body ?? new Uint8Array()).find((e) => e.id === "4489");
    expect(
      new DataView(duration?.body.buffer as ArrayBuffer, duration?.body.byteOffset).getFloat64(0),
    ).toBe(2500);
  });

  it("opens a cluster on a picture's key frame after two seconds, and its cue names where it stands", async () => {
    const blob = muxWebm(
      tracks,
      [
        frame(1, 0, true),
        frame(1, 1000, false),
        frame(1, 2100, false),
        frame(2, 2100, true),
        frame(1, 2200, true),
        frame(1, 2300, false),
      ],
      3,
    );
    const { parts } = await read(blob);
    const clusters = parts.filter((part) => part.id === "1f43b675");
    expect(clusters).toHaveLength(2);
    expect(
      elements(clusters[0]?.body ?? new Uint8Array()).filter((e) => e.id === "a3"),
    ).toHaveLength(4);
    const second = elements(clusters[1]?.body ?? new Uint8Array());
    expect(second[0]?.id).toBe("e7");
    expect([...(second[0]?.body ?? [])]).toEqual([0x08, 0x98]);
    // Track 1, 100 ms past the cluster, not a key frame.
    expect([...(second[2]?.body ?? [])].slice(0, 4)).toEqual([0x81, 0, 100, 0]);

    const cues = elements(parts.find((part) => part.id === "1c53bb6b")?.body ?? new Uint8Array());
    const position = (cue: { body: Uint8Array }) => {
      const places = elements(cue.body).find((e) => e.id === "b7")?.body ?? new Uint8Array();
      const at = elements(places).find((e) => e.id === "f1")?.body ?? new Uint8Array();
      return Number(new DataView(at.buffer, at.byteOffset).getBigUint64(0));
    };
    const whole = new Uint8Array(await blob.arrayBuffer());
    const dataStart = elements(whole)[0]?.body.length ?? 0;
    // The header's own ID and size, then the Segment's ID and eight-byte size.
    const segmentData = 4 + 1 + dataStart + 4 + 8;
    const atCue = cues.map((cue) => [
      ...whole.subarray(segmentData + position(cue), segmentData + position(cue) + 4),
    ]);
    expect(atCue).toEqual([
      [0x1f, 0x43, 0xb6, 0x75],
      [0x1f, 0x43, 0xb6, 0x75],
    ]);
  });

  it("marks a file of sound alone as audio, with clusters at any frame", async () => {
    const blob = muxWebm({ audio: tracks.audio }, [frame(2, 0, true), frame(2, 2500, true)], 3);
    expect(blob.type).toBe("audio/webm");
    const { parts } = await read(blob);
    expect(parts.filter((part) => part.id === "1f43b675")).toHaveLength(2);
  });
});
