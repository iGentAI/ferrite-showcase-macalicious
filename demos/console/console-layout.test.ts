import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConsoleMessage, ConsoleSearchComparison, ConsoleSearchField } from "./console-data";
import {
  arrange,
  categoryToken,
  copyableMessages,
  messagesOfLogFile,
  parseQuery,
  processToken,
  withLevels,
} from "./console-data";
import { readLayout } from "./console-desktop";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a log file's lines", () => {
  it("reads a system log line's time, process and id, and adds no year", () => {
    const [row] = messagesOfLogFile("Oct  3 10:11:12 mac installd[412]: done\n");
    expect(row).toMatchObject({
      id: 1,
      date: "",
      time: "Oct 3 10:11:12",
      process: "installd",
      pid: 412,
      message: "done",
    });
  });

  it("reads back what Save a Copy As wrote", () => {
    const saved = "Error\t2026-11-03 13:42:33.987000+0000\tfiles\tit broke";
    const [row] = messagesOfLogFile(saved);
    expect(row).toMatchObject({
      type: "error",
      date: "2026-11-03",
      time: "13:42:33.987000+0000",
      process: "files",
      message: "it broke",
    });
    expect(row && copyableMessages([row])).toBe(saved);
  });

  it("keeps any other line as its text, leaves out blank lines, and keeps every line", () => {
    const rows = messagesOfLogFile("one\n\n  \ntwo\r\nthree\n");
    expect(rows.map((row) => [row.id, row.message])).toEqual([
      [1, "one"],
      [2, "two"],
      [3, "three"],
    ]);
    const long = Array.from({ length: 5001 }, (_, n) => `line ${n}`).join("\n");
    const all = messagesOfLogFile(long);
    expect(all).toHaveLength(5001);
    expect(all[0]?.message).toBe("line 0");
    expect(all.at(-1)?.message).toBe("line 5000");
  });
});

describe("Console's search", () => {
  const message = (id: number, process: string, category: string, text: string) =>
    ({
      id,
      type: "default",
      process,
      subsystem: "com.example.sub",
      category,
      message: text,
      activity: 0,
    }) as ConsoleMessage;
  const messages = [
    message(1, "This Page", "error", "it broke"),
    message(2, "files", "upload", "PUT answered 200"),
    message(3, "desktop", "error", "it broke too"),
  ];
  const ids = (query: string) => arrange(messages, { query }).map((row) => row.id);

  it("looks for the plain words where the pop-ups say, and compares as they say", () => {
    const found = (
      query: string,
      searchField: ConsoleSearchField,
      searchComparison: ConsoleSearchComparison,
    ) => arrange(messages, { query, searchField, searchComparison }).map((row) => row.id);
    expect(found("error", "any", "contains")).toEqual([1, 3]);
    expect(found("com.example", "any", "contains")).toEqual([1, 2, 3]);
    expect(found("error", "message", "contains")).toEqual([]);
    expect(found("it broke", "message", "is")).toEqual([1]);
    expect(found("it", "message", "begins")).toEqual([1, 3]);
    expect(found("too", "message", "ends")).toEqual([3]);
    expect(found("broke", "message", "excludes")).toEqual([2]);
    expect(found("upload", "category", "is")).toEqual([2]);
    expect(found("desk", "process", "begins")).toEqual([3]);
  });

  it("narrows to a field, excludes with a minus, and finds the other words as one phrase", () => {
    expect(ids('process:"this page"')).toEqual([1]);
    expect(ids("-process:files")).toEqual([1, 3]);
    expect(ids("category:error broke too")).toEqual([3]);
    expect(ids("message:answered")).toEqual([2]);
    expect(ids("too broke")).toEqual([]);
    expect(ids("it category:error broke")).toEqual([1, 3]);
    expect(ids("it process:desktop broke too")).toEqual([3]);
  });

  it("finds a category whose name has a space or a quote by its own token", () => {
    const rows = [message(1, "a", 'my "odd" category', "one"), message(2, "b", "my", "two")];
    const query = categoryToken('my "odd" category');
    expect(arrange(rows, { query }).map((row) => row.id)).toEqual([1]);
  });

  it("keeps a colon that names no field as text", () => {
    expect(parseQuery("note: hello")).toEqual({ tokens: [], text: "note: hello" });
  });

  it("quotes a process with a space, and can hide it", () => {
    expect(processToken("files")).toBe("process:files");
    expect(processToken("This Page", true)).toBe('-process:"This Page"');
  });

  it.each(["This Page", 'My "App"', "back\\slash", 'both \\" here', 'a"b'])(
    "finds and excludes the process named %s by its own token",
    (name) => {
      const rows = [message(1, name, "", "one"), message(2, "other", "", "two")];
      expect(arrange(rows, { query: processToken(name) }).map((row) => row.id)).toEqual([1]);
      expect(arrange(rows, { query: processToken(name, true) }).map((row) => row.id)).toEqual([2]);
    },
  );
});

describe("Console's kept layout", () => {
  it("keeps a log file's source only while the file is on the list", () => {
    const logFiles = [{ id: "f1", name: "a.log" }, { id: 7 }];
    expect(readLayout({ logFiles, source: "log-file:f1" })).toEqual({
      logFiles: [{ id: "f1", name: "a.log" }],
      source: "log-file:f1",
    });
    expect(readLayout({ source: "log-file:f1" })).toEqual({});
  });

  it("takes only what the window can show", () => {
    expect(
      readLayout({
        source: "crash-reports",
        scope: "errors",
        infoShown: false,
        sidebarSize: 0,
        includeInfo: true,
      }),
    ).toEqual({
      source: "crash-reports",
      scope: "errors",
      infoShown: false,
      sidebarSize: 0,
      includeInfo: true,
    });
    expect(readLayout({ source: "nowhere", scope: "x", sidebarSize: 9999 })).toEqual({});
    expect(readLayout("no")).toBeUndefined();
  });

  it("leaves out Info and Debug messages until they are chosen", () => {
    const messages = [
      { id: 1, type: "default" },
      { id: 2, type: "info" },
      { id: 3, type: "debug" },
      { id: 4, type: "error" },
    ] as unknown as readonly ConsoleMessage[];
    const ids = (info: boolean, debug: boolean) =>
      withLevels(messages, info, debug).map((message) => message.id);
    expect(ids(false, false)).toEqual([1, 4]);
    expect(ids(true, false)).toEqual([1, 2, 4]);
    expect(ids(false, true)).toEqual([1, 3, 4]);
    expect(ids(true, true)).toEqual([1, 2, 3, 4]);
  });
});
