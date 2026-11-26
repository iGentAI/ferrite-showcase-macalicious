import { afterEach, describe, expect, it, vi } from "vitest";
import { keepPdfWords, pdfWords } from "./preview-spotlight";

const pdf = (pages: readonly string[]) => ({
  pageCount: pages.length,
  text: async (page: number) => pages[page - 1] ?? "",
});

afterEach(() => vi.unstubAllGlobals());

describe("The words Preview gives Spotlight", () => {
  it("joins the pages, leaving out those without text", async () => {
    expect(await pdfWords(pdf(["Quarterly report", "", "Tide tables"]))).toBe(
      "Quarterly report Tide tables",
    );
  });

  it("keeps what the index keeps, and stops reading there", async () => {
    const text = vi.fn(async () => "x".repeat(3_000));
    const words = await pdfWords({ pageCount: 100, text });
    expect(words).toHaveLength(4_000);
    expect(text).toHaveBeenCalledTimes(2);
  });

  it("sends a drive file's words to the index, and nothing for a picture-only PDF", async () => {
    const fetch = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetch);
    await keepPdfWords("f1", pdf([""]));
    expect(fetch).not.toHaveBeenCalled();
    await keepPdfWords("f1", pdf(["Tide tables"]));
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/api/spotlight/pdf-text");
    expect(JSON.parse(String(init.body))).toEqual({ file: "f1", text: "Tide tables" });
  });
});
