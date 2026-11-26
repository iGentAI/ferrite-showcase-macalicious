import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Stocks } from "./stocks";
import { lightMarket, type StockQuote } from "./stocks-data";
import { DEFAULT_WATCHLIST, DesktopStocks, moveSymbol } from "./stocks-desktop";

/*
 * Reordering the watchlist: Share > Move Up and Move Down, Option-Up/Down Arrow on a row, and a
 * row dragged onto another. The window asks its owner to move a symbol (`onMoveSymbol`); the
 * desktop saves the new order in the person's watchlist (`stocks-desktop.tsx`), and
 * `e2e/stocks-journey.mjs` checks it on the server, after a reload, and for another person.
 */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const list = () => screen.getByRole("list", { name: "Symbols" });
/** The symbols the watchlist lists, top to bottom. */
const order = () =>
  within(list())
    .getAllByRole("listitem")
    .map((item) => item.querySelector(".mac-stock-row-symbol")?.textContent ?? "");
const rowOf = (symbol: string) =>
  within(list())
    .getAllByRole("listitem")
    .find(
      (item) => item.querySelector(".mac-stock-row-symbol")?.textContent === symbol,
    ) as HTMLElement;
const rowButton = (symbol: string) =>
  rowOf(symbol).querySelector("button.mac-stock-row-main") as HTMLButtonElement;

/** A drag's data, as the browser hands it to the rows. */
function transfer() {
  const data = new Map<string, string>();
  return {
    effectAllowed: "",
    dropEffect: "",
    setData: (type: string, value: string) => data.set(type, value),
    getData: (type: string) => data.get(type) ?? "",
  };
}

/** `Stocks` over the demo's market, with its owner moving the symbols it is asked to. */
function Reorderable() {
  const [quotes, setQuotes] = useState<readonly StockQuote[]>(lightMarket.quotes);
  return (
    <Stocks
      market={{ ...lightMarket, quotes }}
      onMoveSymbol={(symbol, to) =>
        setQuotes((all) => {
          const moved = moveSymbol(
            all.map((quote) => quote.symbol),
            symbol,
            to,
          );
          return moved.map((each) => all.find((quote) => quote.symbol === each) as StockQuote);
        })
      }
    />
  );
}

describe("moving a symbol in a list", () => {
  it("puts it at the place given, within the list", () => {
    expect(moveSymbol(["A", "B", "C", "D"], "A", 2)).toEqual(["B", "C", "A", "D"]);
    expect(moveSymbol(["A", "B", "C", "D"], "D", 0)).toEqual(["D", "A", "B", "C"]);
    expect(moveSymbol(["A", "B"], "A", 9)).toEqual(["B", "A"]);
    expect(moveSymbol(["A", "B"], "B", -3)).toEqual(["B", "A"]);
    expect(moveSymbol(["A", "B"], "Z", 0)).toEqual(["A", "B"]);
  });
});

describe("reordering the watchlist", () => {
  it("moves the symbol shown with Share > Move Up and Move Down, dimmed at the ends", async () => {
    const user = userEvent.setup();
    render(<Reorderable />);
    const before = order();
    const [first, second] = before;
    await user.click(rowButton(first as string));
    await user.click(screen.getByRole("button", { name: "Share" }));
    expect(await screen.findByRole("menuitem", { name: "Move Up" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(screen.getByRole("menuitem", { name: "Move Down" }));
    expect(order()).toEqual([second, first, ...before.slice(2)]);
    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.click(await screen.findByRole("menuitem", { name: "Move Up" }));
    expect(order()).toEqual(before);
    // The last symbol cannot go further down.
    await user.click(rowButton(before.at(-1) as string));
    await user.click(screen.getByRole("button", { name: "Share" }));
    expect(await screen.findByRole("menuitem", { name: "Move Down" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("moves a row with Option-Up and Option-Down Arrow, the plain arrows still moving the focus", async () => {
    const user = userEvent.setup();
    render(<Reorderable />);
    const before = order();
    const third = before[2] as string;
    rowButton(third).focus();
    await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
    expect(order().indexOf(third)).toBe(1);
    expect(rowButton(third)).toHaveFocus();
    await user.keyboard("{Alt>}{ArrowDown}{ArrowDown}{/Alt}");
    expect(order().indexOf(third)).toBe(3);
    await user.keyboard("{ArrowUp}");
    expect(order().indexOf(third)).toBe(3);
    expect(rowButton(order()[2] as string)).toHaveFocus();
  });

  it("moves a row dragged onto another to that row's place", () => {
    render(<Reorderable />);
    const before = order();
    const last = before.at(-1) as string;
    const first = before[0] as string;
    const data = transfer();
    fireEvent.dragStart(rowOf(last), { dataTransfer: data });
    expect(rowOf(last)).toHaveAttribute("data-dragging");
    fireEvent.dragOver(rowOf(first), { dataTransfer: data });
    fireEvent.drop(rowOf(first), { dataTransfer: data });
    fireEvent.dragEnd(rowOf(last), { dataTransfer: data });
    expect(order()).toEqual([last, ...before.slice(0, -1)]);
    expect(rowOf(last)).not.toHaveAttribute("data-dragging");
  });

  it("offers no reordering while a search filters the list, or without onMoveSymbol", async () => {
    const user = userEvent.setup();
    const moved = vi.fn();
    const view = render(<Stocks onMoveSymbol={moved} />);
    await user.type(screen.getByRole("searchbox", { name: "Search" }), "a");
    const shown = order()[0] as string;
    expect(rowOf(shown)).not.toHaveAttribute("draggable");
    await user.click(rowButton(shown));
    await user.click(screen.getByRole("button", { name: "Share" }));
    expect(await screen.findByRole("menuitem", { name: "Move Down" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(moved).not.toHaveBeenCalled();
    view.unmount();
    render(<Stocks />);
    await user.click(rowButton(order()[0] as string));
    await user.click(screen.getByRole("button", { name: "Share" }));
    await screen.findByRole("menuitem", { name: "Copy Symbol" });
    expect(screen.queryByRole("menuitem", { name: "Move Down" })).toBeNull();
  });
});

describe("reordering the watchlist on the desktop", () => {
  /** The watchlist route over one document, and the order of every save. */
  function serve() {
    const doc = { symbols: [...DEFAULT_WATCHLIST] as string[], rev: 1 };
    const saves: string[][] = [];
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input), "http://desktop.test");
        if (url.pathname === "/api/stocks/watchlist") {
          if (init?.method === "PUT") {
            const body = JSON.parse(String(init.body)) as { symbols: string[]; rev: number };
            if (body.rev !== doc.rev) return json({ symbols: doc.symbols, rev: doc.rev }, 409);
            doc.symbols = body.symbols;
            doc.rev += 1;
            saves.push(body.symbols);
            return json({ symbols: doc.symbols, rev: doc.rev });
          }
          return json({ symbols: doc.symbols, rev: doc.rev, session: "s1" });
        }
        if (url.pathname === "/api/stocks/quotes")
          return json({ quotes: [], missing: [], source: "CNBC", at: Date.now() });
        if (url.pathname === "/api/stocks/alerts") return json({ alerts: null, rev: 0 });
        if (url.pathname === "/api/stocks/news") return json({ stories: [] });
        if (url.pathname === "/api/stocks/chart")
          return json({ symbol: "X", range: "1D", points: [] });
        return json({ error: "not found" }, 404);
      }),
    );
    return { doc, saves };
  }

  it("saves every new order in the person's watchlist", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    const { doc, saves } = serve();
    render(<DesktopStocks />);
    await waitFor(() => expect(order()).toEqual([...DEFAULT_WATCHLIST]));
    await user.click(rowButton("AAPL"));
    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.click(await screen.findByRole("menuitem", { name: "Move Up" }));
    await waitFor(() => expect(doc.symbols).toEqual([".DJI", ".SPX", "AAPL", ".IXIC"]));
    rowButton("AAPL").focus();
    await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
    await waitFor(() => expect(doc.symbols).toEqual([".DJI", "AAPL", ".SPX", ".IXIC"]));
    const data = transfer();
    fireEvent.dragStart(rowOf(".IXIC"), { dataTransfer: data });
    fireEvent.dragOver(rowOf(".DJI"), { dataTransfer: data });
    fireEvent.drop(rowOf(".DJI"), { dataTransfer: data });
    fireEvent.dragEnd(rowOf(".IXIC"), { dataTransfer: data });
    await waitFor(() => expect(doc.symbols).toEqual([".IXIC", ".DJI", "AAPL", ".SPX"]));
    expect(order()).toEqual([".IXIC", ".DJI", "AAPL", ".SPX"]);
    expect(saves).toHaveLength(3);
  });
});
