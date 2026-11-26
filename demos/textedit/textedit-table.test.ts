import { afterEach, describe, expect, it } from "vitest";
import { paragraphsOf, readLines, setParagraphFormat } from "./textedit-document";
import {
  linesOfParagraphs,
  paragraphsOfContent,
  paragraphsToHtml,
  readRtf,
  writeRtf,
} from "./textedit-rtf";
import { htmlToContent } from "./textedit-server";
import {
  canMerge,
  cellsIn,
  childHoldingEnd,
  insertTable,
  mergeCells,
  moveBetweenCells,
  normalizeTables,
  reshapeTable,
  shapeLosesText,
  splitCell,
  tableAround,
  tableSize,
  tableSizeFits,
} from "./textedit-table";

/* Tables in TextEdit: their shape, what the paragraph commands do in them, and a file and a draft. */

const view = (html: string) => {
  const element = document.createElement("div");
  element.append(htmlToContent(html, document));
  document.body.append(element);
  return element;
};

const SIMPLE =
  '<div>before</div><table data-border="2"><tbody><tr><td colspan="2" style="background-color: rgb(255, 234, 0)"><div>wide</div></td></tr><tr><td><div><b>a</b></div></td><td><div>b</div><div>c</div></td></tr></tbody></table><div>after</div>';

const rowsOf = (element: HTMLElement) =>
  [...(element.querySelector("table") as HTMLTableElement).rows].map((row) =>
    [...row.cells].map((cell) => cell.innerText ?? cell.textContent),
  );

afterEach(() => {
  document.body.innerHTML = "";
});

describe("a table in a file and a draft", () => {
  it("keeps its rows, spans, border, background and styled paragraphs through RTF", () => {
    const written = writeRtf(paragraphsOfContent(view(SIMPLE)));
    expect(written).toContain("\\trowd");
    expect(written).toContain("\\clmgf");
    const { paragraphs } = readRtf(written);
    expect(paragraphs).toHaveLength(3);
    const table = paragraphs[1]?.table;
    expect(table?.border).toBe(2);
    expect(table?.rows.map((row) => row.map((cell) => cell.span ?? 1))).toEqual([[2], [1, 1]]);
    expect(table?.rows[0]?.[0]?.background).toBe("#ffea00");
    expect(table?.rows[1]?.[1]?.paragraphs.map((each) => each.runs[0]?.text)).toEqual(["b", "c"]);
    expect(table?.rows[1]?.[0]?.paragraphs[0]?.runs[0]?.style.bold).toBe(true);
    expect(linesOfParagraphs(paragraphs)).toEqual(["before", "wide", "a\tb c", "after"]);
  });

  it("comes back the same from a file's paragraphs, through what the server keeps", () => {
    const shown = view(
      paragraphsToHtml(readRtf(writeRtf(paragraphsOfContent(view(SIMPLE)))).paragraphs),
    );
    const table = shown.querySelector("table") as HTMLTableElement;
    expect(table.dataset.border).toBe("2");
    expect(table.rows[0]?.cells[0]?.colSpan).toBe(2);
    expect(rowsOf(shown)).toEqual([["wide"], ["a", "bc"]]);
  });

  it("reads a table another program wrote, as rows of cells", () => {
    const rtf =
      "{\\rtf1\\ansi{\\colortbl;\\red255\\green0\\blue0;}\\trowd\\clcbpat1\\cellx1000\\cellx2000\\pard\\intbl one\\cell two\\cell\\row\\pard after\\par}";
    const { paragraphs } = readRtf(rtf);
    expect(paragraphs[0]?.table?.rows[0]?.map((cell) => cell.paragraphs[0]?.runs[0]?.text)).toEqual(
      ["one", "two"],
    );
    expect(paragraphs[0]?.table?.rows[0]?.[0]?.background).toBe("#ff0000");
    expect(paragraphs[1]?.runs[0]?.text).toBe("after");
  });

  it("keeps tables inside tables, however deep, with their shape, through a file", () => {
    const deep =
      '<table data-border="1"><tbody><tr><td><div>one</div><table data-border="2"><tbody><tr><td colspan="2" style="background-color: rgb(255, 234, 0);"><div>wide</div></td></tr><tr><td><div>two</div><table data-border="0"><tbody><tr><td><div>three</div></td></tr></tbody></table></td><td><div>four</div></td></tr></tbody></table><div>after</div></td><td><div>five</div></td></tr></tbody></table>';
    const written = writeRtf(paragraphsOfContent(view(deep)));
    expect(written).toContain("\\itap3");
    const shown = view(paragraphsToHtml(readRtf(written).paragraphs));
    const [outer, middle, inner] = shown.querySelectorAll("table");
    expect(outer?.rows[0]?.cells[1]?.textContent).toBe("five");
    expect(outer?.rows[0]?.cells[0]?.lastElementChild?.textContent).toBe("after");
    expect(middle?.dataset.border).toBe("2");
    expect(middle?.rows[0]?.cells[0]?.colSpan).toBe(2);
    expect(middle?.rows[0]?.cells[0]?.style.backgroundColor).toBe("rgb(255, 234, 0)");
    expect(middle?.rows[1]?.cells[1]?.textContent).toBe("four");
    expect(inner?.rows[0]?.cells[0]?.textContent).toBe("three");
    expect(inner?.parentElement?.closest("td")?.children).toHaveLength(2);
  });

  it("keeps two tables in a row in a cell apart, and an empty line after a table", () => {
    const inner = (border: number, rows: number) =>
      `<table data-border="${border}"><tbody>${"<tr><td><div>x</div></td></tr>".repeat(rows)}</tbody></table>`;
    const cell = (content: string) =>
      view(`<table><tbody><tr><td>${content}</td></tr></tbody></table>`);
    const through = (node: HTMLElement) =>
      view(paragraphsToHtml(readRtf(writeRtf(paragraphsOfContent(node))).paragraphs));
    const shapes = (node: HTMLElement) =>
      [...(node.querySelector("td") as HTMLElement).children].map((child) =>
        child instanceof HTMLTableElement
          ? `table ${child.dataset.border} ${child.rows.length}`
          : child.textContent,
      );
    expect(shapes(through(cell(`${inner(1, 2)}${inner(3, 1)}`)))).toEqual([
      "table 1 2",
      "table 3 1",
    ]);
    expect(shapes(through(cell(`${inner(2, 1)}<div></div>`)))).toEqual(["table 2 1", ""]);
  });

  it("keeps two tables in a row at the top of a document apart", () => {
    const table = (border: number, rows: number) =>
      `<table data-border="${border}"><tbody>${"<tr><td><div>x</div></td></tr>".repeat(rows)}</tbody></table>`;
    const back = view(
      paragraphsToHtml(
        readRtf(writeRtf(paragraphsOfContent(view(`${table(1, 2)}${table(3, 1)}`)))).paragraphs,
      ),
    );
    expect(
      [...back.children].map((each) => [
        each.getAttribute("data-border"),
        (each as HTMLTableElement).rows.length,
      ]),
    ).toEqual([
      ["1", 2],
      ["3", 1],
    ]);
  });

  it("ends a table at \\intbl0", () => {
    const { paragraphs } = readRtf(
      "{\\rtf1\\ansi\\trowd\\cellx1000\\intbl one\\cell\\row\\intbl0 after\\par}",
    );
    expect(paragraphs[0]?.table?.rows[0]?.[0]?.paragraphs[0]?.runs[0]?.text).toBe("one");
    expect(paragraphs[1]?.runs[0]?.text).toBe("after");
  });

  it("has only plain rows and cells after a file or a paste", () => {
    const html =
      '<table data-border="3"><thead><tr><th colspan="2">h</th></tr></thead><tbody><tr><td>b</td></tr></tbody><tfoot><tr><td>f</td></tr></tfoot></table>';
    const pasted = document.createElement("div");
    pasted.innerHTML = html;
    document.body.append(pasted);
    const text = pasted.querySelector("th")?.firstChild as Text;
    document.getSelection()?.collapse(text, 1);
    normalizeTables(pasted);
    expect(document.getSelection()?.anchorNode).toBe(text);
    for (const shown of [view(html), pasted]) {
      expect(shown.querySelectorAll("thead, tfoot, th, table > tr")).toHaveLength(0);
      expect(
        [...shown.querySelectorAll("table > tbody > tr > td")].map((cell) => cell.textContent),
      ).toEqual(["h", "b", "f"]);
      expect(shown.querySelector("td")?.colSpan).toBe(2);
    }
  });

  it("keeps a span as wide as a browser takes", () => {
    const shown = view('<table><tbody><tr><td colspan="100">a</td></tr></tbody></table>');
    expect(shown.querySelector("td")?.colSpan).toBe(100);
    const rtf = readRtf(writeRtf(paragraphsOfContent(shown)));
    expect(view(paragraphsToHtml(rtf.paragraphs)).querySelector("td")?.colSpan).toBe(100);
  });

  it("keeps every level of tables nine deep", () => {
    let html = "<div>deepest</div>";
    for (let level = 9; level >= 1; level -= 1) {
      html = `<table data-border="${level % 4}"><tbody><tr><td>${html}</td><td><div>beside ${level}</div></td></tr></tbody></table>`;
    }
    const back = view(
      paragraphsToHtml(readRtf(writeRtf(paragraphsOfContent(view(html)))).paragraphs),
    );
    const tables = [...back.querySelectorAll("table")];
    expect(tables.map((each) => each.dataset.border)).toEqual(
      [1, 2, 3, 0, 1, 2, 3, 0, 1].map(String),
    );
    expect(tables.map((each) => each.rows[0]?.cells[1]?.textContent)).toEqual(
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => `beside ${level}`),
    );
    expect(tables.at(-1)?.rows[0]?.cells[0]?.textContent).toBe("deepest");
  });

  it("keeps the text of a cell merged into the one before it", () => {
    const { paragraphs } = readRtf(
      "{\\rtf1\\ansi\\trowd\\clmgf\\cellx1000\\clmrg\\cellx2000\\pard\\intbl one\\cell\\pard\\intbl two\\cell\\row\\pard after\\par}",
    );
    const again = readRtf(writeRtf(paragraphs)).paragraphs;
    const cells = again[0]?.table?.rows[0];
    expect(cells).toHaveLength(1);
    expect(cells?.[0]?.span).toBe(2);
    expect(cells?.[0]?.paragraphs.map((each) => each.runs[0]?.text)).toEqual(["one", "two"]);
  });

  it("does not believe a file's nesting without limit", () => {
    const { paragraphs } = readRtf(
      "{\\rtf1\\ansi\\pard\\intbl\\itap2000000000 deep\\nestcell\\pard\\intbl\\itap1\\cell\\row\\pard after\\par}",
    );
    expect(linesOfParagraphs(paragraphs).join(" ")).toContain("deep");
    expect(paragraphs.at(-1)?.runs[0]?.text).toBe("after");
  });

  it("keeps nothing but a table's own attributes from stored text", () => {
    const shown = view(
      '<table data-border="9" onclick="x()"><tr><th colspan="x" onmouseover="y()">head</th></tr></table>',
    );
    expect(shown.innerHTML).toBe("<table><tbody><tr><td>head</td></tr></tbody></table>");
  });
});

describe("the shape of a table", () => {
  it("says which shapes take text away", () => {
    const node = view(SIMPLE);
    const table = node.querySelector("table") as HTMLTableElement;
    expect(shapeLosesText(table, 2, 2)).toBe(false);
    expect(shapeLosesText(table, 3, 4)).toBe(false);
    expect(shapeLosesText(table, 1, 2)).toBe(true);
    expect(shapeLosesText(table, 2, 1)).toBe(true);
    // The merged cell only gets narrower: it keeps its text. The row below loses a cell with text.
    const narrow = view(
      '<table><tbody><tr><td colspan="2"><div>wide</div></td></tr><tr><td><div></div></td><td><div></div></td></tr></tbody></table>',
    ).querySelector("table") as HTMLTableElement;
    expect(shapeLosesText(narrow, 2, 1)).toBe(false);
  });

  it("goes after the child of the view that holds the end of the selection", () => {
    const node = view(`${SIMPLE}<div>last</div>`);
    const table = node.querySelector("table") as HTMLTableElement;
    const range = document.createRange();
    range.setStart(node.firstElementChild as Element, 0);
    range.setEnd(table.rows[1]?.cells[0] as Element, 1);
    const after = childHoldingEnd(node, range);
    expect(after).toBe(table);
    const made = insertTable(node, after, 1, 1);
    expect(made.previousElementSibling).toBe(table);
    expect(childHoldingEnd(node, null)?.textContent).toBe("last");
  });

  it("keeps a table with nothing in it when its cell is merged, and asks before shrinking it away", () => {
    const node = view(
      '<table><tbody><tr><td><div>a</div></td><td><table data-border="2"><tbody><tr><td><div></div></td></tr></tbody></table></td></tr></tbody></table>',
    );
    const outer = node.querySelector("table") as HTMLTableElement;
    expect(shapeLosesText(outer, 1, 1)).toBe(true);
    mergeCells([...(outer.rows[0]?.cells ?? [])]);
    const inner = outer.rows[0]?.cells[0]?.querySelector("table");
    expect(inner?.dataset.border).toBe("2");
    const back = view(paragraphsToHtml(readRtf(writeRtf(paragraphsOfContent(node))).paragraphs));
    expect(back.querySelector("table table")?.getAttribute("data-border")).toBe("2");
  });

  it("adds a row with Tab without changing the rows there are", () => {
    const node = view(
      "<table><tbody><tr><td><div>one</div></td></tr><tr><td><div>a</div></td><td><div>b</div></td></tr></tbody></table>",
    );
    const table = node.querySelector("table") as HTMLTableElement;
    document.getSelection()?.selectAllChildren(table.rows[1]?.cells[1] as Node);
    expect(moveBetweenCells(node, false)).toBe("added");
    expect([...table.rows].map((row) => row.cells.length)).toEqual([1, 2, 2]);
  });

  it("holds to its limits only the size fields the person changed", () => {
    const now = { rows: 150, columns: 25 };
    expect(tableSizeFits("150", "25", now)).toBe(true);
    expect(tableSizeFits("100", "25", now)).toBe(true);
    expect(tableSizeFits("150", "20", now)).toBe(true);
    expect(tableSizeFits("120", "25", now)).toBe(false);
    expect(tableSizeFits("150", "21", now)).toBe(false);
    expect(tableSizeFits("101", "2", { rows: 2, columns: 2 })).toBe(false);
    expect(tableSizeFits("0", "25", now)).toBe(false);
  });

  it("adds rows after the last, a file's several sections included", () => {
    const node = view(
      "<table><tbody><tr><td><div>A</div></td></tr></tbody><tbody><tr><td><div>B</div></td></tr></tbody></table>",
    );
    reshapeTable(node.querySelector("table") as HTMLTableElement, 3, 1);
    expect(rowsOf(node)).toEqual([["A"], ["B"], [""]]);
  });

  it("goes first for a range at the view's start, and counts bare text among the view's children", () => {
    const node = view("<div>one</div><div>two</div>");
    node.insertBefore(document.createTextNode("bare"), node.lastChild);
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, 0);
    const first = insertTable(node, childHoldingEnd(node, range), 1, 1);
    expect(node.firstChild).toBe(first);
    first.remove();
    range.setStart(node, 2);
    range.setEnd(node, 2);
    const between = insertTable(node, childHoldingEnd(node, range), 1, 1);
    expect(between.previousSibling?.textContent).toBe("bare");
    expect(between.nextSibling?.textContent).toBe("two");
  });

  it("keeps the selected characters when a command wraps a cell's bare nodes", () => {
    const node = view(
      "<table><tbody><tr><td>a<b>b</b>c</td><td>d<i>e</i>f</td><td>g</td></tr></tbody></table>",
    );
    const cells = [...((node.querySelector("table") as HTMLTableElement).rows[0]?.cells ?? [])];
    const [first, second] = cells;
    const range = document.createRange();
    range.setStart(first as Node, 1);
    range.setEnd(second as Node, 3);
    expect(range.toString()).toBe("bcdef");
    const touched = paragraphsOf(node, range);
    expect(touched.map((each) => each.textContent)).toEqual(["abc", "def"]);
    expect(range.toString()).toBe("bcdef");
  });

  it("has lines for plain text, its cells a tab apart", () => {
    expect(readLines(view(SIMPLE))).toEqual(["before", "wide", "a\tb c", "after"]);
  });

  it("goes in after a paragraph, with a line after it at the end of the document", () => {
    const node = view("<div>first</div>");
    const table = insertTable(node, node.firstElementChild as HTMLElement, 2, 3);
    expect(tableSize(table)).toEqual({ rows: 2, columns: 3 });
    expect([...node.children].map((each) => each.tagName)).toEqual(["DIV", "TABLE", "DIV"]);
  });

  it("grows and shrinks, a merged cell included", () => {
    const node = view(SIMPLE);
    const table = node.querySelector("table") as HTMLTableElement;
    reshapeTable(table, 3, 3);
    expect(tableSize(table)).toEqual({ rows: 3, columns: 3 });
    expect([...table.rows].map((row) => row.cells.length)).toEqual([2, 3, 3]);
    reshapeTable(table, 1, 1);
    expect(tableSize(table)).toEqual({ rows: 1, columns: 1 });
    expect(table.rows[0]?.cells[0]?.textContent).toBe("wide");
  });

  it("merges cells side by side, keeping their text, and splits them again", () => {
    const node = view(
      "<table><tbody><tr><td><div>a</div></td><td><div>b</div></td><td><div>c</div></td></tr><tr><td><div>d</div></td><td><div>e</div></td><td><div>f</div></td></tr></tbody></table>",
    );
    const table = node.querySelector("table") as HTMLTableElement;
    const first = table.rows[0]?.cells[0] as HTMLTableCellElement;
    const second = table.rows[0]?.cells[1] as HTMLTableCellElement;
    const below = table.rows[1]?.cells[1] as HTMLTableCellElement;
    expect(canMerge([first, below])).toBe(false);
    expect(canMerge([first])).toBe(false);
    mergeCells([first, second]);
    expect(rowsOf(node)[0]).toEqual(["ab", "c"]);
    expect(tableSize(table).columns).toBe(3);
    splitCell(first);
    expect(table.rows[0]?.cells).toHaveLength(3);
    expect(first.hasAttribute("colspan")).toBe(false);
  });

  it("finds the table and the cells of a selection", () => {
    const node = view(SIMPLE);
    const table = node.querySelector("table") as HTMLTableElement;
    const range = document.createRange();
    range.selectNodeContents(table.rows[1] as HTMLElement);
    expect(tableAround(node, range.commonAncestorContainer)).toBe(table);
    expect(cellsIn(table, range).map((cell) => cell.textContent)).toEqual(["a", "bc"]);
    expect(tableAround(node, node.firstChild)).toBeNull();
  });

  it("goes between cells with Tab, and adds a row after the last", () => {
    const node = view(
      "<table><tbody><tr><td><div>a</div></td><td><div>b</div></td></tr></tbody></table><div>out</div>",
    );
    const table = node.querySelector("table") as HTMLTableElement;
    const selection = document.getSelection() as Selection;
    selection.collapse(table.rows[0]?.cells[0] as Element, 0);
    expect(moveBetweenCells(node, false)).toBe("moved");
    expect(selection.anchorNode?.textContent).toContain("b");
    expect(moveBetweenCells(node, false)).toBe("added");
    expect(table.rows).toHaveLength(2);
    selection.collapse(node.lastElementChild as Element, 0);
    expect(moveBetweenCells(node, false)).toBeNull();
  });
});

describe("the paragraph commands in a table", () => {
  it("act on the paragraphs of the cell the selection is in", () => {
    const node = view(SIMPLE);
    const cell = (node.querySelector("table") as HTMLTableElement).rows[1]?.cells[1] as HTMLElement;
    const range = document.createRange();
    range.selectNodeContents(cell);
    expect(paragraphsOf(node, range).map((each) => each.textContent)).toEqual(["b", "c"]);
    setParagraphFormat(node, range, { align: "center" });
    expect(cell.querySelectorAll('[style*="center"]')).toHaveLength(2);
    expect((node.querySelector("table") as HTMLElement).style.textAlign).toBe("");
  });

  it("act on every cell's paragraphs when the selection crosses a table", () => {
    const node = view(SIMPLE);
    const range = document.createRange();
    range.selectNodeContents(node);
    expect(paragraphsOf(node, range).map((each) => each.textContent)).toEqual([
      "before",
      "wide",
      "a",
      "b",
      "c",
      "after",
    ]);
  });

  it("leave alone the cells a selection across two cells does not touch", () => {
    const node = view(
      "<table><tbody><tr><td><div>a</div></td><td><div>b</div></td></tr><tr><td><div>c</div></td><td><div>d</div></td></tr></tbody></table>",
    );
    const table = node.querySelector("table") as HTMLTableElement;
    const range = document.createRange();
    range.setStart(table.rows[0]?.cells[0] as Element, 0);
    range.setEnd(table.rows[0]?.cells[1] as Element, 1);
    setParagraphFormat(node, range, { align: "center" });
    expect(
      [...table.querySelectorAll("td > div")].map((each) => (each as HTMLElement).style.textAlign),
    ).toEqual(["center", "center", "", ""]);
  });

  it("give bare text in the cells a selection crosses a paragraph of its own", () => {
    const node = view("<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>");
    const table = node.querySelector("table") as HTMLTableElement;
    const range = document.createRange();
    range.setStart(table.rows[0]?.cells[0]?.firstChild as Text, 0);
    range.setEnd(table.rows[0]?.cells[1]?.firstChild as Text, 1);
    setParagraphFormat(node, range, { align: "right" });
    expect(table.querySelectorAll('td > div[style*="right"]')).toHaveLength(2);
  });
});
