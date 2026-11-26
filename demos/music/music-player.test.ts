import { afterEach, describe, expect, it, vi } from "vitest";
import { type AudioLike, MusicPlayer, PLAYBACK_ERRORS, type PlaybackStore } from "./music-player";
import { DEFAULT_PLAYBACK, type LibrarySong, type MusicPlaybackState } from "./music-server";

class FakeAudio implements AudioLike {
  src = "";
  currentTime = 0;
  duration = Number.NaN;
  volume = 1;
  paused = true;
  playCalls = 0;
  error: { code: number } | null = null;
  private listeners = new Map<string, (() => void)[]>();
  play() {
    this.playCalls += 1;
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  removeAttribute() {
    this.src = "";
  }
  load() {}
  canPlayType(type: string) {
    return type.startsWith("audio/mpeg") || type.startsWith("audio/wav") ? "probably" : "";
  }
  addEventListener(type: string, listener: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  emit(type: string) {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }
}

const archive = (id: string, duration = 100): LibrarySong => ({
  id,
  title: `Song ${id}`,
  artist: "Artist",
  album: "Album",
  genre: "",
  year: null,
  track: null,
  duration,
  added: 0,
  artwork: null,
  source: {
    kind: "archive",
    item: "DWK255",
    files: { mp3: `${id} track.mp3`, ogg: `${id}.ogg` },
    license: "http://creativecommons.org/licenses/by/4.0/",
  },
});
const upload = (id: string): LibrarySong => ({
  ...archive(id),
  source: { kind: "file", file: `file-${id}`, name: `${id}.wav`, type: "audio/wav", size: 600_000 },
});

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(songs: LibrarySong[] = [archive("a"), archive("b"), archive("c")]) {
  const audio = new FakeAudio();
  const readFile = vi.fn(async (id: string) => new Blob([id], { type: "audio/wav" }));
  const revoked: string[] = [];
  let urls = 0;
  const player = new MusicPlayer({
    createAudio: () => audio,
    readFile,
    createObjectURL: () => {
      urls += 1;
      return `blob:${urls}`;
    },
    revokeObjectURL: (url) => revoked.push(url),
    // Reverses: a shuffle of [x, y, z] is [z, y, x].
    random: () => 0,
    saveDelayMs: 0,
  });
  player.setLibrary(songs);
  return { player, audio, readFile, revoked };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Another account's shared songs", () => {
  const borrowed = (id: string): LibrarySong => ({
    ...archive(id),
    id: `shared/chris/${id}`,
    source: {
      kind: "file",
      file: `shared/chris/${id}`,
      name: id,
      type: "audio/wav",
      size: 44,
    },
  });

  it("play from their route, and are saved in nothing of the person's", async () => {
    vi.useFakeTimers();
    const saved: MusicPlaybackState[] = [];
    const { player, readFile } = setup([upload("own")]);
    await player.connect({ load: async () => undefined, save: (p) => saved.push(p) });
    player.setBorrowed([borrowed("kelp")]);
    player.playQueue(["own", "shared/chris/kelp"], 1);
    await vi.runAllTimersAsync();
    expect(readFile).toHaveBeenLastCalledWith("shared/chris/kelp");
    expect(player.current()?.id).toBe("shared/chris/kelp");
    expect(player.isBorrowed("shared/chris/kelp")).toBe(true);
    expect(saved.at(-1)).toMatchObject({ queue: ["own"], index: 1, position: 0, recent: [] });
    expect(JSON.stringify(saved.at(-1))).not.toContain("kelp");
  });

  it("stop and lose what was read of them the moment the library ends", async () => {
    const { player, revoked } = setup([]);
    player.setBorrowed([borrowed("kelp")]);
    player.playQueue(["shared/chris/kelp"], 0);
    await flushPromises();
    expect(player.getState().playing).toBe(true);
    player.setBorrowed([]);
    expect(player.getState().playing).toBe(false);
    expect(player.current()).toBeUndefined();
    expect(revoked).toEqual(["blob:1"]);
  });
});

describe("Remember playback position", () => {
  it("starts a song that remembers from where it was left, and from its start once it ended", async () => {
    const { player, audio } = setup([{ ...archive("a"), rememberPosition: true }, archive("b")]);
    player.playQueue(["a", "b"]);
    await flushPromises();
    audio.duration = 100;
    audio.currentTime = 42;
    audio.emit("timeupdate");
    player.jump(1);
    await flushPromises();
    expect(player.getState().bookmarks).toEqual({ a: 42 });
    player.jump(0);
    await flushPromises();
    expect(player.getState().position).toBe(42);
    audio.emit("loadedmetadata");
    expect(audio.currentTime).toBe(42);
    audio.emit("ended");
    await flushPromises();
    expect(player.getState().bookmarks).toEqual({});
  });

  it("leaves a song that does not remember alone", async () => {
    const { player, audio } = setup([archive("a"), archive("b")]);
    player.playQueue(["a", "b"]);
    await flushPromises();
    audio.currentTime = 42;
    audio.emit("timeupdate");
    player.jump(1);
    await flushPromises();
    player.jump(0);
    await flushPromises();
    expect(player.getState().bookmarks).toBeUndefined();
    expect(player.getState().position).toBe(0);
  });
});

describe("crossfading", () => {
  /** Two songs of 100 seconds, the first playing; each element made is listed. */
  async function playing(seconds: number) {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    const made: FakeAudio[] = [];
    const player = new MusicPlayer({
      createAudio: () => {
        const audio = new FakeAudio();
        made.push(audio);
        return audio;
      },
      saveDelayMs: 0,
    });
    player.setLibrary([archive("a"), archive("b")]);
    player.setCrossfade(seconds);
    player.playQueue(["a", "b"]);
    await flushPromises();
    const first = made[0] as FakeAudio;
    first.duration = 100;
    return { player, made, first };
  }
  const reach = (audio: FakeAudio, at: number) => {
    audio.currentTime = at;
    audio.emit("timeupdate");
  };

  it("brings the next song in on a second element while the first plays out", async () => {
    const { player, made, first } = await playing(6);
    reach(first, 90);
    expect(made).toHaveLength(1);
    reach(first, 94);
    await flushPromises();
    const second = made[1] as FakeAudio;
    expect(player.current()?.id).toBe("b");
    expect(second.src).toContain("b%20track");
    expect(second.paused).toBe(false);
    expect(first.paused).toBe(false);
    expect(first.src).toContain("a%20track");
    expect(player.getState().plays).toEqual({ a: 1 });

    vi.advanceTimersByTime(3000);
    expect(first.volume).toBeCloseTo(Math.SQRT1_2, 1);
    expect(second.volume).toBeCloseTo(Math.SQRT1_2, 1);
    vi.advanceTimersByTime(3100);
    expect(first.paused).toBe(true);
    expect(first.src).toBe("");
    expect(second.volume).toBe(1);
  });

  it("counts the leaving element's events as nothing", async () => {
    const { player, first } = await playing(6);
    reach(first, 94);
    await flushPromises();
    first.currentTime = 99;
    first.emit("timeupdate");
    first.emit("ended");
    expect(player.current()?.id).toBe("b");
    expect(player.getState().position).not.toBe(99);
    expect(player.getState().plays).toEqual({ a: 1 });
  });

  it("stops the leaving song at a pause, and the other is whole at Play", async () => {
    const { player, made, first } = await playing(6);
    reach(first, 94);
    await flushPromises();
    player.pause();
    expect(first.paused).toBe(true);
    expect(first.src).toBe("");
    expect(made[1]?.volume).toBe(1);
  });

  it("does not crossfade under Repeat One, at the last song, or when off", async () => {
    const { player, made, first } = await playing(6);
    player.setRepeat("one");
    reach(first, 95);
    expect(made).toHaveLength(1);
    player.setRepeat("off");
    player.setCrossfade(0);
    reach(first, 96);
    expect(made).toHaveLength(1);
    expect(player.current()?.id).toBe("a");
    player.setCrossfade(6);
    player.jump(1);
    await flushPromises();
    first.duration = 100;
    reach(first, 97);
    expect(made).toHaveLength(1);
  });

  it("waits for Sound Check's measure before a song's sound starts", async () => {
    const audio = new FakeAudio();
    const player = new MusicPlayer({ createAudio: () => audio, saveDelayMs: 0 });
    player.setLibrary([archive("a")]);
    let measured = () => {};
    const gate = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          measured = resolve;
        }),
    );
    player.setBeforeSound(gate);
    player.playQueue(["a"]);
    await flushPromises();
    expect(gate).toHaveBeenCalledTimes(1);
    expect(audio.playCalls).toBe(0);
    measured();
    await flushPromises();
    expect(audio.playCalls).toBe(1);
  });
});

describe("Music's player", () => {
  it("Shuffle by Albums keeps each album together, in order, from the song chosen", async () => {
    const song = (id: string, album: string): LibrarySong => ({ ...archive(id), album });
    const { player } = setup([
      song("a1", "A"),
      song("a2", "A"),
      song("b1", "B"),
      song("b2", "B"),
      song("c1", "C"),
    ]);
    player.setShuffleBy("albums");
    player.setShuffle(true);
    player.playQueue(["a1", "a2", "b1", "b2", "c1"], 1);
    await flushPromises();
    // The chosen song's album first, from it round; the other albums whole.
    expect(player.getState().queue).toEqual(["a2", "a1", "c1", "b1", "b2"]);
    expect(player.getState().index).toBe(0);
    // Turned to songs, the song loaded stays first and the order chosen comes back with Shuffle off.
    player.setShuffleBy("songs");
    expect(player.getState().queue[player.getState().index]).toBe("a2");
    player.setShuffle(false);
    expect(player.getState().queue).toEqual(["a1", "a2", "b1", "b2", "c1"]);
  });

  it("Shuffle by Groupings holds a grouping together and treats the ungrouped as songs", async () => {
    const { player } = setup([
      { ...archive("a"), grouping: "G" },
      archive("b"),
      { ...archive("c"), grouping: "G" },
    ]);
    player.setShuffleBy("groupings");
    player.setShuffle(true);
    player.playQueue(["a", "b", "c"], 0);
    await flushPromises();
    expect(player.getState().queue).toEqual(["a", "c", "b"]);
  });

  it("playing on passes by a cleared checkbox, and a song skipped when shuffling while shuffled", async () => {
    const { player } = setup([
      archive("a"),
      { ...archive("b"), unchecked: true },
      { ...archive("c"), skipShuffle: true },
      archive("d"),
    ]);
    player.playQueue(["a", "b", "c", "d"], 0);
    await flushPromises();
    player.next();
    await flushPromises();
    expect(player.current()?.id).toBe("c");
    // Chosen by hand, a song with a cleared checkbox plays all the same.
    player.playQueue(["b", "c", "d"], 0);
    await flushPromises();
    expect(player.current()?.id).toBe("b");
    player.setShuffle(true);
    player.next();
    await flushPromises();
    expect(player.current()?.id).toBe("d");
  });

  it("starts a song at its start time, and ends it at its stop time", async () => {
    const { player, audio } = setup([{ ...archive("a"), start: 30, stop: 60 }, archive("b")]);
    player.playQueue(["a", "b"], 0);
    await flushPromises();
    audio.duration = 100;
    audio.emit("loadedmetadata");
    expect(audio.currentTime).toBe(30);
    audio.currentTime = 59;
    audio.emit("timeupdate");
    expect(player.current()?.id).toBe("a");
    audio.currentTime = 60;
    audio.emit("timeupdate");
    await flushPromises();
    expect(player.current()?.id).toBe("b");
    expect(player.getState().plays).toEqual({ a: 1 });
  });

  it("plays a song at its own volume adjustment, within what the element can do", async () => {
    const { player, audio } = setup([
      { ...archive("quiet"), volumeAdjust: -50 },
      { ...archive("loud"), volumeAdjust: 100 },
    ]);
    player.setVolume(80);
    player.playQueue(["quiet", "loud"], 0);
    await flushPromises();
    expect(audio.volume).toBeCloseTo(0.4);
    player.next();
    await flushPromises();
    expect(audio.volume).toBe(1);
  });

  it("keeps what Shuffle holds together across a reload", async () => {
    const stored: MusicPlaybackState = { ...DEFAULT_PLAYBACK, shuffleBy: "albums" };
    let saved: MusicPlaybackState | undefined;
    const store: PlaybackStore = {
      load: async () => stored,
      save: (playback) => {
        saved = playback;
      },
    };
    const { player } = setup();
    await player.connect(store);
    expect(player.getState().shuffleBy).toBe("albums");
    player.setVolume(50);
    player.flush();
    expect(saved?.shuffleBy).toBe("albums");
  });

  it("plays an Internet Archive song from archive.org in a format the browser plays, and skips", async () => {
    const { player, audio } = setup();
    player.playQueue(["a", "b", "c"], 1);
    await flushPromises();
    expect(audio.src).toBe("https://archive.org/download/DWK255/b%20track.mp3");
    expect(player.getState()).toMatchObject({ playing: true, index: 1, recent: ["b"] });
    expect(player.upNext().map((entry) => entry.song.id)).toEqual(["c"]);

    player.next();
    await flushPromises();
    expect(player.current()?.id).toBe("c");
    // Just begun: Previous goes to the song before; later it restarts the song.
    player.previous();
    await flushPromises();
    expect(player.current()?.id).toBe("b");
    audio.currentTime = 42;
    audio.emit("timeupdate");
    player.previous();
    expect(player.current()?.id).toBe("b");
    expect(audio.currentTime).toBe(0);
    expect(player.getState().recent).toEqual(["b", "c"]);
  });

  it("pauses, resumes, seeks and sets the volume on the audio element", async () => {
    const { player, audio } = setup();
    player.playQueue(["a"], 0);
    await flushPromises();
    player.toggle();
    expect(audio.paused).toBe(true);
    expect(player.getState().playing).toBe(false);
    player.toggle();
    expect(audio.paused).toBe(false);
    audio.emit("loadedmetadata");
    player.seek(61.5);
    expect(audio.currentTime).toBe(61.5);
    expect(player.getState().position).toBe(61.5);
    player.seek(500);
    expect(audio.currentTime).toBe(100);
    player.setVolume(35);
    expect(audio.volume).toBeCloseTo(0.35);
  });

  it("repeats one song, wraps under Repeat All, stops at the end otherwise, and counts plays", async () => {
    const { player, audio } = setup([archive("a"), archive("b")]);
    player.playQueue(["a", "b"], 0);
    await flushPromises();
    player.setRepeat("one");
    audio.emit("ended");
    await flushPromises();
    expect(player.current()?.id).toBe("a");
    expect(player.getState().plays).toEqual({ a: 1 });

    player.cycleRepeat();
    expect(player.getState().repeat).toBe("off");
    audio.emit("ended");
    await flushPromises();
    expect(player.current()?.id).toBe("b");
    audio.emit("ended");
    await flushPromises();
    expect(player.getState()).toMatchObject({ playing: false, index: 1, position: 0 });
    expect(player.getState().plays).toEqual({ a: 2, b: 1 });

    player.setRepeat("all");
    player.play();
    audio.emit("ended");
    await flushPromises();
    expect(player.current()?.id).toBe("a");
    expect(player.getState().playing).toBe(true);
  });

  it("shuffles what follows the song playing and puts the order back when shuffle ends", async () => {
    const { player } = setup([archive("a"), archive("b"), archive("c"), archive("d")]);
    player.playQueue(["a", "b", "c", "d"], 1);
    await flushPromises();
    player.setShuffle(true);
    const { queue, index, unshuffled } = player.getState();
    expect(queue[index]).toBe("b");
    expect(new Set(queue)).toEqual(new Set(["a", "b", "c", "d"]));
    expect(unshuffled).toEqual(["a", "b", "c", "d"]);
    player.setShuffle(false);
    expect(player.getState()).toMatchObject({
      queue: ["a", "b", "c", "d"],
      index: 1,
      unshuffled: [],
    });
  });

  it("moves an entry of Up Next by its place, and leaves the song loaded alone", async () => {
    const { player } = setup();
    player.playQueue(["a", "b", "c", "b"], 0);
    await flushPromises();
    player.moveInQueue(3, 1);
    expect(player.getState().queue).toEqual(["a", "b", "b", "c"]);
    player.moveInQueue(1, 4);
    expect(player.getState().queue).toEqual(["a", "b", "c", "b"]);
    // Onto itself, onto the song loaded, and the song loaded: nothing moves.
    player.moveInQueue(1, 2);
    player.moveInQueue(2, 0);
    player.moveInQueue(0, 2);
    expect(player.getState().queue).toEqual(["a", "b", "c", "b"]);
    expect(player.current()?.id).toBe("a");
  });

  it("edits Up Next: Play Next, Play Later, removing and jumping", async () => {
    const { player } = setup();
    player.playQueue(["a", "b"], 0);
    await flushPromises();
    player.playLater("c");
    player.playNext("c");
    expect(player.getState().queue).toEqual(["a", "c", "b", "c"]);
    player.removeFromQueue(3);
    player.removeFromQueue(0);
    expect(player.getState().queue).toEqual(["a", "c", "b"]);
    player.jump(2);
    await flushPromises();
    expect(player.current()?.id).toBe("b");
    player.playNext("not-in-library");
    expect(player.getState().queue).toEqual(["a", "c", "b"]);
    player.clearUpNext();
    expect(player.getState().queue).toEqual(["b"]);
  });

  it("starts the very entry chosen, when a song is listed twice or one before it is gone", async () => {
    const { player } = setup();
    player.playQueue(["a", "b", "a", "c"], 2);
    await flushPromises();
    expect(player.getState()).toMatchObject({ queue: ["a", "b", "a", "c"], index: 2 });
    expect(player.upNext().map((entry) => entry.song.id)).toEqual(["c"]);

    player.playQueue(["gone", "a", "b", "a"], 3);
    await flushPromises();
    expect(player.getState()).toMatchObject({ queue: ["a", "b", "a"], index: 2 });
    // A chosen entry that cannot be found starts the next one that can.
    player.playQueue(["a", "gone", "c"], 1);
    await flushPromises();
    expect(player.getState()).toMatchObject({ queue: ["a", "c"], index: 1 });
  });

  it("plays an uploaded song from its joined drive file, read once, and seeks once it is loaded", async () => {
    const { player, audio, readFile, revoked } = setup([
      upload("u1"),
      upload("u2"),
      upload("u3"),
      upload("u4"),
    ]);
    player.seek(30);
    player.playQueue(["u1", "u2", "u3", "u4"], 0);
    player.seek(12);
    await flushPromises();
    expect(readFile).toHaveBeenCalledWith("file-u1");
    expect(audio.src).toBe("blob:1");
    // The seek made while the file was read is applied when the browser has its length.
    audio.emit("loadedmetadata");
    expect(audio.currentTime).toBe(12);
    for (let n = 0; n < 3; n += 1) {
      player.next();
      await flushPromises();
    }
    expect(revoked).toEqual(["blob:1"]);
    player.jump(1);
    await flushPromises();
    expect(readFile).toHaveBeenCalledTimes(4);
    expect(audio.src).toBe("blob:2");
  });

  it("says when a song cannot be played instead of hanging", async () => {
    const { player, audio } = setup([
      {
        ...archive("o"),
        source: {
          kind: "archive",
          item: "DWK255",
          files: { ogg: "o.ogg" },
          license: "http://creativecommons.org/licenses/by/4.0/",
        },
      },
    ]);
    player.playQueue(["o"], 0);
    await flushPromises();
    expect(player.getState()).toMatchObject({
      playing: false,
      error: expect.stringContaining("formats"),
    });
    expect(audio.src).toBe("");
  });

  it("restores the stored playback paused and saves each change after it has read it", async () => {
    vi.useFakeTimers();
    const saved: MusicPlaybackState[] = [];
    let resolve: (value: MusicPlaybackState) => void = () => {};
    const store: PlaybackStore = {
      load: () => new Promise((r) => (resolve = r)),
      save: (playback) => saved.push(playback),
    };
    const { player, audio } = setup();
    const connected = player.connect(store);
    player.setVolume(10);
    vi.runAllTimers();
    expect(saved).toEqual([]);
    resolve({
      ...DEFAULT_PLAYBACK,
      queue: ["a", "b"],
      index: 1,
      position: 33,
      volume: 60,
      repeat: "all",
    });
    await connected;
    expect(player.getState()).toMatchObject({
      restored: true,
      playing: false,
      index: 1,
      position: 33,
      repeat: "all",
    });
    player.play();
    await vi.runAllTimersAsync();
    expect(audio.src).toContain("b%20track.mp3");
    audio.duration = 100;
    audio.emit("loadedmetadata");
    expect(audio.currentTime).toBe(33);
    expect(saved.at(-1)).toMatchObject({
      queue: ["a", "b"],
      index: 1,
      position: 33,
      recent: ["b"],
    });
  });

  it("answers the media keys through the Media Session API", async () => {
    const handlers = new Map<string, (details: MediaSessionActionDetails) => void>();
    const session = {
      metadata: null as unknown,
      playbackState: "none",
      setActionHandler: (action: string, handler: (d: MediaSessionActionDetails) => void) =>
        handlers.set(action, handler),
      setPositionState: vi.fn(),
    };
    vi.stubGlobal("navigator", { mediaSession: session });
    vi.stubGlobal(
      "MediaMetadata",
      class {
        constructor(public init: MediaMetadataInit) {}
      },
    );
    const { player, audio } = setup();
    player.playQueue(["a", "b"], 0);
    await flushPromises();
    expect((session.metadata as { init: MediaMetadataInit }).init).toMatchObject({
      title: "Song a",
      artist: "Artist",
    });
    expect(session.playbackState).toBe("playing");
    handlers.get("nexttrack")?.({ action: "nexttrack" });
    await flushPromises();
    expect(player.current()?.id).toBe("b");
    handlers.get("pause")?.({ action: "pause" });
    expect(audio.paused).toBe(true);
    audio.emit("loadedmetadata");
    handlers.get("seekto")?.({ action: "seekto", seekTime: 20 });
    expect(audio.currentTime).toBe(20);
    handlers.get("seekforward")?.({ action: "seekforward" });
    expect(audio.currentTime).toBe(30);
  });

  it("stops when the last window showing it closes", async () => {
    vi.useFakeTimers();
    const { player, audio } = setup();
    const first = player.attach();
    const second = player.attach();
    player.playQueue(["a"], 0);
    await vi.runAllTimersAsync();
    first();
    await vi.runAllTimersAsync();
    expect(audio.paused).toBe(false);
    second();
    await vi.runAllTimersAsync();
    expect(audio.paused).toBe(true);
    expect(audio.src).toBe("");
  });

  it("does not start a song deleted from the library while its file was read", async () => {
    let deliver: (blob: Blob) => void = () => {};
    const { player, audio } = setup([upload("u1"), upload("u2")]);
    player.setReadFile(() => new Promise((resolve) => (deliver = resolve)));
    player.playQueue(["u1"], 0);
    player.setLibrary([upload("u2")]);
    deliver(new Blob(["x"], { type: "audio/wav" }));
    await flushPromises();
    expect(audio.playCalls).toBe(0);
    expect(audio.src).toBe("");
    expect(player.getState().playing).toBe(false);
  });

  it("tells a song queued twice apart by its place when shuffled", async () => {
    const { player } = setup();
    // With this random source, from the second "a" (place 2) of [a, b, a, c] the order played
    // is a(2), b(1), c(3), a(0).
    player.setShuffle(true);
    player.playQueue(["a", "b", "a", "c"], 2);
    await flushPromises();
    expect(player.getState().queue).toEqual(["a", "b", "c", "a"]);
    // Shuffle off: the entry playing is the second "a", not the first.
    player.setShuffle(false);
    expect(player.getState()).toMatchObject({ queue: ["a", "b", "a", "c"], index: 2 });
    expect(player.upNext().map((entry) => entry.song.id)).toEqual(["c"]);

    player.setShuffle(true);
    player.playQueue(["a", "b", "a", "c"], 1);
    await flushPromises();
    // Played: b(1), a(2), c(3), a(0). Removing the "a" played second removes place 2, the
    // second "a" of the order chosen, not the first.
    expect(player.getState().queue).toEqual(["b", "a", "c", "a"]);
    player.removeFromQueue(1);
    expect(player.getState().unshuffled).toEqual(["a", "b", "c"]);
    player.setShuffle(false);
    expect(player.getState()).toMatchObject({ queue: ["a", "b", "c"], index: 1 });
  });

  it("reads the stored playback once per page, whatever connects later", async () => {
    const stored = { ...DEFAULT_PLAYBACK, queue: ["a", "b"], index: 1, plays: { a: 3 } };
    const first = vi.fn(async () => stored);
    const second = vi.fn(async () => ({ ...DEFAULT_PLAYBACK, queue: ["c"], plays: { a: 99 } }));
    const { player, audio } = setup();
    // Two windows connect at once, with stores of their own: one read, and its answer only.
    const connecting = player.connect({ load: first, save: () => {} });
    const again = player.connect({ load: second, save: () => {} });
    expect(again).toBe(connecting);
    await again;
    player.playQueue(["a"], 0);
    await flushPromises();
    audio.emit("ended");
    await flushPromises();
    // Music opened again later: nothing is read again, and the count is the stored one plus
    // the play heard, never added twice.
    await player.connect({ load: second, save: () => {} });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    expect(player.getState().plays).toEqual({ a: 4 });
  });

  it("waits for the stored playback before taking any command, then takes it as stored", async () => {
    vi.useFakeTimers();
    const saved: MusicPlaybackState[] = [];
    let resolve: (value: MusicPlaybackState) => void = () => {};
    const store: PlaybackStore = {
      load: () => new Promise((r) => (resolve = r)),
      save: (playback) => saved.push(playback),
    };
    const { player, audio } = setup();
    const connected = player.connect(store);
    // Every kind of command, before the read: none of them runs.
    player.playQueue(["c"], 0);
    player.setShuffle(true);
    player.setRepeat("one");
    player.setVolume(5);
    player.playLater("b");
    player.clearHistory();
    player.addGuests([archive("g")]);
    await vi.runAllTimersAsync();
    expect(audio.playCalls).toBe(0);
    expect(saved).toEqual([]);
    resolve({
      ...DEFAULT_PLAYBACK,
      queue: ["a", "b"],
      index: 1,
      volume: 40,
      repeat: "all",
      recent: ["b", "a"],
      plays: { a: 3, c: 1 },
    });
    await connected;
    expect(player.getState()).toMatchObject({
      queue: ["a", "b"],
      index: 1,
      shuffle: false,
      volume: 40,
      repeat: "all",
      recent: ["b", "a"],
      plays: { a: 3, c: 1 },
      guests: [],
    });
    // From then on, commands run and are saved.
    player.setVolume(70);
    await vi.runAllTimersAsync();
    expect(saved.at(-1)).toMatchObject({ volume: 70, plays: { a: 3, c: 1 } });
  });

  it("plays after a failed read, but never saves over the playback it could not read", async () => {
    vi.useFakeTimers();
    const saved: MusicPlaybackState[] = [];
    const load = vi.fn(async (): Promise<MusicPlaybackState | undefined> => {
      throw new Error("offline");
    });
    const { player, audio } = setup();
    await player.connect({ load, save: (playback) => saved.push(playback) });
    player.playQueue(["a"], 0);
    player.setVolume(90);
    player.flush();
    await vi.runAllTimersAsync();
    expect(audio.playCalls).toBe(1);
    expect(saved).toEqual([]);
    await player.connect({ load, save: (playback) => saved.push(playback) });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("keeps the length the browser found when the same song starts again", async () => {
    // The library does not know this song's length.
    const { player, audio } = setup([archive("a", 0)]);
    player.playQueue(["a"], 0);
    await flushPromises();
    audio.duration = 187;
    audio.emit("durationchange");
    expect(player.getState().duration).toBe(187);
    // Played again from the start (as Repeat One does): the length stays the browser's.
    player.playQueue(["a"], 0);
    await flushPromises();
    expect(player.getState().duration).toBe(187);
  });

  it("starts the loaded song from the place asked for, even before its length is known", async () => {
    const { player, audio } = setup();
    player.playQueue(["a"], 0);
    await flushPromises();
    // A seek to 0:40 made before the browser knows the song's length waits for it...
    player.seek(40);
    // ...and is dropped when the song is started again from the beginning first.
    player.playQueue(["a"], 0);
    await flushPromises();
    audio.duration = 100;
    audio.emit("loadedmetadata");
    expect(audio.currentTime).toBe(0);
  });

  it("keeps the place of each entry of a shuffled queue across a save and a reload", async () => {
    const saved: MusicPlaybackState[] = [];
    const { player } = setup();
    await player.connect({ load: async () => undefined, save: (p) => saved.push(p) });
    player.setShuffle(true);
    // From the second "a" (place 2): played a(2), b(1), c(3), a(0).
    player.playQueue(["a", "b", "a", "c"], 2);
    await flushPromises();
    player.flush();
    const stored = saved.at(-1) as MusicPlaybackState;
    expect(stored).toMatchObject({ queue: ["a", "b", "c", "a"], order: [2, 1, 3, 0] });

    const { player: again } = setup();
    await again.connect({ load: async () => stored, save: () => {} });
    again.setShuffle(false);
    // The entry playing is the second "a" of the order chosen, not the first.
    expect(again.getState()).toMatchObject({ queue: ["a", "b", "a", "c"], index: 2 });
  });

  it("keeps the unshuffled order whole when Up Next is edited while shuffled", async () => {
    const { player } = setup([archive("a"), archive("b"), archive("c")]);
    player.setShuffle(true);
    player.playQueue(["a", "b", "c"], 0);
    await flushPromises();
    player.playLater("b");
    player.removeFromQueue(player.getState().queue.lastIndexOf("b"));
    expect(player.getState().unshuffled.filter((id) => id === "b")).toHaveLength(1);
    player.clearUpNext();
    player.playLater("c");
    player.setShuffle(false);
    expect(player.getState().queue).toEqual(["a", "c"]);
    expect(player.current()?.id).toBe("a");
  });

  it("keeps the songs being added, and those still named, when guests pass their limit", async () => {
    const { player } = setup([]);
    const many = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, n) => archive(`${prefix}${n}`));
    player.addGuests(many("old", 150));
    player.playQueue(["old5"], 0);
    await flushPromises();
    const item = many("new", 100);
    player.addGuests(item);
    const ids = new Set(player.getState().guests.map((song) => song.id));
    expect(ids.size).toBe(200);
    expect(item.every((song) => ids.has(song.id))).toBe(true);
    expect(ids.has("old5")).toBe(true);
    player.playQueue(
      item.map((song) => song.id),
      0,
    );
    expect(player.current()?.id).toBe("new0");
  });

  it("keeps the guest that is playing when a full item of new songs is added", async () => {
    const { player } = setup([]);
    const many = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, n) => archive(`${prefix}${n}`));
    player.addGuests([archive("now")]);
    player.playQueue(["now"], 0);
    await flushPromises();
    player.addGuests(many("new", 200));
    expect(player.getState().guests).toHaveLength(200);
    expect(player.current()?.id).toBe("now");
  });

  it("passes over songs that are gone when Next and Previous are pressed while paused", async () => {
    const { player } = setup([archive("a"), archive("b"), archive("c")]);
    player.playQueue(["a", "b", "c"], 0);
    await flushPromises();
    player.pause();
    player.setLibrary([archive("a"), archive("c")]);
    player.next();
    expect(player.current()?.id).toBe("c");
    player.previous();
    expect(player.current()?.id).toBe("a");
  });

  it("clears what loading said when Next is pressed while paused", async () => {
    const { player } = setup([upload("u1"), archive("b", 77)]);
    player.setReadFile(() => new Promise(() => {}));
    player.playQueue(["u1", "b"], 0);
    player.pause();
    player.next();
    expect(player.getState()).toMatchObject({ loading: false, error: null, duration: 77 });
  });

  it("does not start a song that was paused while its file was read", async () => {
    let deliver: (blob: Blob) => void = () => {};
    const { player, audio } = setup([upload("u1")]);
    player.setReadFile(() => new Promise((resolve) => (deliver = resolve)));
    player.playQueue(["u1"], 0);
    player.pause();
    deliver(new Blob(["x"], { type: "audio/wav" }));
    await flushPromises();
    expect(audio.playCalls).toBe(0);
    expect(player.getState()).toMatchObject({ playing: false, loading: false });
    player.play();
    expect(audio.playCalls).toBe(1);
  });

  it("silences the song before at once when another starts, even if the new one fails", async () => {
    const { player, audio } = setup([archive("a"), upload("u")]);
    player.setReadFile(async () => {
      throw new Error("the drive is down");
    });
    player.playQueue(["a", "u"], 0);
    await flushPromises();
    expect(audio.paused).toBe(false);
    player.next();
    expect(audio.paused).toBe(true);
    expect(audio.src).toBe("");
    await flushPromises();
    expect(player.getState()).toMatchObject({ playing: false, error: PLAYBACK_ERRORS.unread });
  });

  it("gives watchers a new snapshot when the library it looks songs up in changes", () => {
    const { player } = setup([]);
    const before = player.getState();
    player.setLibrary([archive("a")]);
    expect(player.getState()).not.toBe(before);
  });

  it("keeps the place while a song plays, every few seconds, and when the page is hidden", async () => {
    vi.useFakeTimers();
    const saved: MusicPlaybackState[] = [];
    const { player, audio } = setup();
    await player.connect({ load: async () => undefined, save: (p) => saved.push(p) });
    player.playQueue(["a"], 0);
    await vi.runAllTimersAsync();
    const count = saved.length;
    for (const second of [2, 4, 6, 8]) {
      audio.currentTime = second;
      audio.emit("timeupdate");
    }
    await vi.runAllTimersAsync();
    expect(saved.length).toBe(count);
    audio.currentTime = 10.5;
    audio.emit("timeupdate");
    await vi.runAllTimersAsync();
    expect(saved.at(-1)?.position).toBe(10.5);
    audio.currentTime = 12;
    audio.emit("timeupdate");
    window.dispatchEvent(new Event("pagehide"));
    expect(saved.at(-1)?.position).toBe(12);
  });

  it("hands what is waiting to the store's save for leaving when the page goes", async () => {
    const saved: MusicPlaybackState[] = [];
    const left: MusicPlaybackState[] = [];
    const audio = new FakeAudio();
    const player = new MusicPlayer({ createAudio: () => audio, saveDelayMs: 60_000 });
    player.setLibrary([archive("a")]);
    await player.connect({
      load: async () => undefined,
      save: (p) => saved.push(p),
      saveOnLeave: (p) => left.push(p),
    });
    player.setVolume(25);
    // The change waits to be grouped; the page goes first.
    window.dispatchEvent(new Event("pagehide"));
    expect(left.at(-1)?.volume).toBe(25);
    expect(saved).toEqual([]);
    // Its grouped save was handed over, not sent besides.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(saved).toEqual([]);
  });

  it("keeps Internet Archive songs played without being added, while the queue names them", async () => {
    vi.useFakeTimers();
    const saved: MusicPlaybackState[] = [];
    const { player } = setup([upload("u")]);
    await player.connect({ load: async () => undefined, save: (p) => saved.push(p) });
    player.addGuests([archive("g1"), archive("g2"), upload("not-archive")]);
    player.playQueue(["g1"], 0);
    await vi.runAllTimersAsync();
    expect(player.current()?.id).toBe("g1");
    expect(saved.at(-1)?.guests.map((song) => song.id)).toEqual(["g1"]);

    const restored = new MusicPlayer({ createAudio: () => new FakeAudio(), saveDelayMs: 0 });
    restored.setLibrary([]);
    await restored.connect({ load: async () => saved.at(-1), save: () => {} });
    expect(restored.current()?.title).toBe("Song g1");
    expect(restored.upNext()).toEqual([]);
  });

  it("saves the playback again when songs it played as guests are added to the library", async () => {
    vi.useFakeTimers();
    const saved: MusicPlaybackState[] = [];
    const { player } = setup([]);
    await player.connect({ load: async () => undefined, save: (p) => saved.push(p) });
    player.addGuests([archive("g1"), archive("g2")]);
    player.playQueue(["g1", "g2"], 0);
    await vi.runAllTimersAsync();
    expect(saved.at(-1)?.guests?.map((song) => song.id)).toEqual(["g1", "g2"]);
    player.setLibrary([archive("g1"), archive("g2")]);
    await vi.runAllTimersAsync();
    expect(saved.at(-1)).toMatchObject({ queue: ["g1", "g2"], guests: [] });
    // Deleted from the library again, a song is gone: no guest copy of it is left to play.
    player.setLibrary([archive("g1")]);
    expect(player.lookup("g2")).toBeUndefined();
    expect(player.upNext()).toEqual([]);
  });

  it("restores no guest copy of a song the library holds, so deleting the song removes it", async () => {
    const { player } = setup([archive("g1")]);
    const stored = {
      ...DEFAULT_PLAYBACK,
      queue: ["g1", "g2"],
      index: 0,
      guests: [archive("g1"), archive("g2")],
    };
    await player.connect({ load: async () => stored, save: () => {} });
    expect(player.getState().guests.map((song) => song.id)).toEqual(["g2"]);
    player.setLibrary([]);
    expect(player.current()).toBeUndefined();
    expect(player.upNext().map(({ song }) => song.id)).toEqual(["g2"]);
  });

  it("restores the end of the queue as nothing loaded, not as its last song", async () => {
    const { player, audio } = setup();
    const stored = { ...DEFAULT_PLAYBACK, queue: ["a", "b"], index: 2 };
    await player.connect({ load: async () => stored, save: () => {} });
    expect(player.getState().index).toBe(2);
    expect(player.current()).toBeUndefined();
    player.play();
    expect(audio.playCalls).toBe(0);
    // Shuffle on and off again loads nothing either.
    player.setShuffle(true);
    expect(player.current()).toBeUndefined();
    player.setShuffle(false);
    expect(player.getState()).toMatchObject({ queue: ["a", "b"], index: 2 });
    player.play();
    expect(audio.playCalls).toBe(0);
  });

  it("shows no loading when the song already loaded starts again", async () => {
    const { player, audio } = setup();
    player.playQueue(["a"], 0);
    await flushPromises();
    audio.emit("playing");
    expect(player.getState().loading).toBe(false);
    player.playQueue(["a"], 0);
    await flushPromises();
    expect(player.getState()).toMatchObject({ playing: true, loading: false });
  });

  it("restores a paused song at its saved place with its length from the library, read before or after", async () => {
    const stored = { ...DEFAULT_PLAYBACK, queue: ["a"], index: 0, position: 33 };
    const { player } = setup([archive("a", 240)]);
    await player.connect({ load: async () => stored, save: () => {} });
    expect(player.getState()).toMatchObject({ playing: false, position: 33, duration: 240 });
    // The playback read before the library: the length arrives with the library.
    const { player: early } = setup([]);
    await early.connect({ load: async () => stored, save: () => {} });
    expect(early.getState().duration).toBe(0);
    early.setLibrary([archive("a", 240)]);
    expect(early.getState()).toMatchObject({ playing: false, position: 33, duration: 240 });
  });

  it("plays a restored song from its saved place once the media's metadata has loaded", async () => {
    const saves: MusicPlaybackState[] = [];
    const stored = { ...DEFAULT_PLAYBACK, queue: ["a"], index: 0, position: 33 };
    const { player, audio } = setup([archive("a", 240)]);
    await player.connect({ load: async () => stored, save: (state) => saves.push(state) });
    // A change that is not the place keeps the place saved.
    player.setVolume(40);
    await flushPromises();
    expect(saves.at(-1)?.position).toBe(33);
    player.play();
    await flushPromises();
    expect(audio.playCalls).toBe(1);
    // Not before the browser knows the song's length.
    expect(audio.currentTime).toBe(0);
    audio.emit("timeupdate");
    expect(player.getState().position).toBe(33);
    audio.duration = 240;
    audio.emit("loadedmetadata");
    expect(audio.currentTime).toBe(33);
    expect(player.getState().position).toBe(33);
  });

  it("starts a restored song that had finished from 0:00, by the library's length or the media's", async () => {
    // By the library's length, before anything loads.
    const atEnd = { ...DEFAULT_PLAYBACK, queue: ["a"], index: 0, position: 239.6 };
    const { player, audio } = setup([archive("a", 240)]);
    await player.connect({ load: async () => atEnd, save: () => {} });
    expect(player.getState().position).toBe(0);
    player.play();
    await flushPromises();
    audio.duration = 240;
    audio.emit("loadedmetadata");
    expect(audio.currentTime).toBe(0);
    // By the media's: the library's length was longer than the sound turns out to be.
    const past = { ...DEFAULT_PLAYBACK, queue: ["a"], index: 0, position: 200 };
    const { player: longer, audio: shorter } = setup([archive("a", 240)]);
    await longer.connect({ load: async () => past, save: () => {} });
    expect(longer.getState().position).toBe(200);
    longer.play();
    await flushPromises();
    shorter.duration = 180;
    shorter.emit("loadedmetadata");
    expect(shorter.currentTime).toBe(0);
    expect(longer.getState().position).toBe(0);
  });

  it("clamps a place sought before the song loads to the media's length, and keeps it there", async () => {
    const stored = { ...DEFAULT_PLAYBACK, queue: ["a"], index: 0, position: 33 };
    const { player, audio } = setup([archive("a", 240)]);
    await player.connect({ load: async () => stored, save: () => {} });
    // A place chosen replaces the saved one, and is not taken for a finished song.
    player.seek(230);
    player.play();
    await flushPromises();
    audio.duration = 200;
    audio.emit("loadedmetadata");
    expect(audio.currentTime).toBe(200);
    expect(player.getState().position).toBe(200);
  });

  it("forgets the saved place once another song is chosen", async () => {
    const stored = { ...DEFAULT_PLAYBACK, queue: ["a", "b"], index: 0, position: 33 };
    const { player, audio } = setup([archive("a", 240), archive("b", 240)]);
    await player.connect({ load: async () => stored, save: () => {} });
    player.next();
    await flushPromises();
    expect(player.current()?.id).toBe("b");
    expect(player.getState().position).toBe(0);
    audio.duration = 240;
    audio.emit("loadedmetadata");
    expect(audio.currentTime).toBe(0);
    // Nor does the library arriving again bring it back.
    player.setLibrary([archive("a", 240), archive("b", 240)]);
    expect(player.getState().position).toBe(0);
  });

  it("moves a song just played to the newest end of the play counts", async () => {
    const stored = { ...DEFAULT_PLAYBACK, plays: { a: 2, b: 2, c: 2 } };
    const { player, audio } = setup();
    await player.connect({ load: async () => stored, save: () => {} });
    player.playQueue(["a"], 0);
    await flushPromises();
    audio.emit("ended");
    expect(Object.entries(player.getState().plays)).toEqual([
      ["b", 2],
      ["c", 2],
      ["a", 3],
    ]);
  });

  it("stops at the end of the queue with nothing left loading and no seek pending", async () => {
    let finish: (blob: Blob) => void = () => {};
    const audio = new FakeAudio();
    const player = new MusicPlayer({
      createAudio: () => audio,
      readFile: () => new Promise<Blob>((resolve) => (finish = resolve)),
      createObjectURL: () => "blob:1",
      revokeObjectURL: () => {},
      saveDelayMs: 0,
    });
    player.setLibrary([upload("u")]);
    const stored = { ...DEFAULT_PLAYBACK, queue: ["u"], index: 0 };
    await player.connect({ load: async () => stored, save: () => {} });
    player.play();
    player.seek(33);
    expect(player.getState().loading).toBe(true);
    player.next();
    expect(player.getState()).toMatchObject({ playing: false, loading: false, position: 0 });
    // The read that was under way ends: nothing plays and no seek to 0:33 is made.
    finish(new Blob(["x"], { type: "audio/wav" }));
    await flushPromises();
    audio.duration = 100;
    audio.emit("loadedmetadata");
    expect(audio.playCalls).toBe(0);
    expect(audio.currentTime).toBe(0);
    expect(player.getState().position).toBe(0);
  });
});

describe("Music's player when a song cannot play", () => {
  /** A media element whose sound never starts arriving: its play promise waits, as a stalled
   * load's does in a browser. */
  class StuckAudio extends FakeAudio {
    override play() {
      this.playCalls += 1;
      this.paused = false;
      return new Promise<void>(() => {});
    }
  }

  function failing(
    songs: LibrarySong[],
    reachable: (url: string) => Promise<boolean> = async () => false,
    readFile: (id: string) => Promise<Blob> = async (id) => new Blob([id], { type: "audio/wav" }),
    audio: FakeAudio = new FakeAudio(),
  ) {
    const player = new MusicPlayer({
      createAudio: () => audio,
      readFile,
      createObjectURL: () => "blob:1",
      revokeObjectURL: () => {},
      saveDelayMs: 0,
      reachable,
      stallMs: 1_000,
    });
    player.setLibrary(songs);
    return { player, audio };
  }

  it("says an uploaded song's file cannot be decoded, stops, and Play loads it again", async () => {
    const { player, audio } = failing([upload("u")]);
    player.playQueue(["u"], 0);
    await flushPromises();
    expect(audio.src).toBe("blob:1");
    audio.error = { code: 4 };
    audio.emit("error");
    expect(player.getState()).toMatchObject({
      playing: false,
      loading: false,
      error: PLAYBACK_ERRORS.damaged,
    });
    expect(audio.paused).toBe(true);
    // Its sound is let go, so Play makes a new load rather than replaying a failed element.
    expect(audio.src).toBe("");
    audio.error = null;
    player.play();
    await flushPromises();
    expect(audio.src).toBe("blob:1");
    expect(audio.playCalls).toBe(2);
    expect(player.getState()).toMatchObject({ playing: true, error: null });
  });

  it("asks the Internet Archive again: an address that does not answer is unreachable", async () => {
    const reachable = vi.fn(async () => false);
    const { player, audio } = failing([archive("a")], reachable);
    player.playQueue(["a"], 0);
    await flushPromises();
    const url = audio.src;
    audio.error = { code: 2 };
    audio.emit("error");
    expect(player.getState()).toMatchObject({ playing: false, error: PLAYBACK_ERRORS.checking });
    await flushPromises();
    expect(reachable).toHaveBeenCalledWith(url);
    expect(player.getState()).toMatchObject({
      playing: false,
      loading: false,
      error: PLAYBACK_ERRORS.unreachable,
    });
    audio.error = null;
    player.play();
    await flushPromises();
    expect(audio.src).toBe(url);
    expect(audio.playCalls).toBe(2);
    expect(player.getState().error).toBeNull();
  });

  it("an Archive address that answers without playable sound is the Archive's failure, not a damaged file", async () => {
    const { player, audio } = failing([archive("a")], async () => true);
    player.playQueue(["a"], 0);
    await flushPromises();
    audio.error = { code: 4 };
    audio.emit("error");
    await flushPromises();
    expect(player.getState().error).toBe(PLAYBACK_ERRORS.refused);
    // A decode error of an Archive file is the file's own.
    player.play();
    await flushPromises();
    audio.error = { code: 3 };
    audio.emit("error");
    expect(player.getState().error).toBe(PLAYBACK_ERRORS.damaged);
  });

  it("keeps the place heard when a song fails part way, and Play goes on from there", async () => {
    const { player, audio } = failing([archive("a")], async () => false);
    player.playQueue(["a"], 0);
    await flushPromises();
    audio.duration = 100;
    audio.emit("loadedmetadata");
    audio.currentTime = 37;
    audio.emit("timeupdate");
    audio.error = { code: 2 };
    audio.emit("error");
    await flushPromises();
    expect(player.getState().position).toBe(37);
    player.play();
    await flushPromises();
    audio.emit("loadedmetadata");
    expect(audio.currentTime).toBe(37);
  });

  it("stops an Internet Archive song that never starts arriving, and says so", async () => {
    vi.useFakeTimers();
    const { player, audio } = failing([archive("a")], undefined, undefined, new StuckAudio());
    player.playQueue(["a"], 0);
    await vi.advanceTimersByTimeAsync(0);
    expect(player.getState().loading).toBe(true);
    await vi.advanceTimersByTimeAsync(999);
    expect(player.getState().error).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(player.getState()).toMatchObject({
      playing: false,
      loading: false,
      error: PLAYBACK_ERRORS.stalled,
    });
    expect(audio.paused).toBe(true);
  });

  it("does not stop a song that started playing, nor one paused while it loads", async () => {
    vi.useFakeTimers();
    const stuck = new StuckAudio();
    const { player, audio } = failing([archive("a"), archive("b")], undefined, undefined, stuck);
    player.playQueue(["a"], 0);
    await vi.advanceTimersByTimeAsync(0);
    audio.emit("playing");
    await vi.advanceTimersByTimeAsync(5_000);
    expect(player.getState()).toMatchObject({ playing: true, error: null });
    player.playQueue(["b"], 0);
    await vi.advanceTimersByTimeAsync(0);
    player.pause();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(player.getState()).toMatchObject({ playing: false, error: null });
  });

  it("says an uploaded song's file is gone from the drive, or could not be read", async () => {
    const gone = failing([upload("u")], undefined, async () => {
      throw Object.assign(new Error("No such file is on the drive."), { status: 404 });
    });
    gone.player.playQueue(["u"], 0);
    await flushPromises();
    expect(gone.player.getState()).toMatchObject({
      playing: false,
      loading: false,
      error: PLAYBACK_ERRORS.missing,
    });
    const failed = failing([upload("u")], undefined, async () => {
      throw new TypeError("Failed to fetch");
    });
    failed.player.playQueue(["u"], 0);
    await flushPromises();
    expect(failed.player.getState().error).toBe(PLAYBACK_ERRORS.unread);
  });
});
