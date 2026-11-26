import { afterEach, describe, expect, it } from "vitest";
import { changeTableShape, stepRuler } from "./textedit-document";
import { readDocx, readOdt, writeDocx, writeOdt } from "./textedit-office";
import { layoutPdf, type MeasureText } from "./textedit-pdf";
import {
  linesOfParagraphs,
  paragraphsOfContent,
  paragraphsToHtml,
  type RtfParagraph,
  readRtf,
  writeRtf,
} from "./textedit-rtf";
import { htmlToContent } from "./textedit-server";
import {
  canMerge,
  cellsIn,
  columnsOfCells,
  mergeCells,
  moveBetweenCells,
  nestTable,
  reshapeTable,
  shapeLosesText,
  splitCell,
  tableAround,
  tableDepth,
  tableSize,
  unnestTable,
} from "./textedit-table";

/* Tables inside cells, and cells merged across rows, in the view and in every file they are kept in. */

const cellHtml = (text: string) => `<td><div>${text}</div></td>`;
const rowHtml = (...texts: string[]) => `<tr>${texts.map(cellHtml).join("")}</tr>`;
const THREE = `<table data-border="1"><tbody>${rowHtml("a", "b", "c")}${rowHtml("d", "e", "f")}${rowHtml("g", "h", "i")}</tbody></table>`;

const viewOf = (html: string) => {
  const node = document.createElement("div");
  node.append(htmlToContent(html, document));
  document.body.append(node);
  return { node, table: node.querySelector("table") as HTMLTableElement };
};

const cellNamed = (table: HTMLTableElement, text: string) =>
  [...table.querySelectorAll("td")].find(
    (cell) => cell.textContent === text,
  ) as HTMLTableCellElement;

const cellsOfRow = (table: HTMLTableElement, at: number) => [
  ...(table.rows[at] as HTMLTableRowElement).cells,
];

const shape = (table: HTMLTableElement) =>
  [...table.rows].map((row) =>
    [...row.cells].map((cell) => `${cell.textContent}:${cell.colSpan}x${cell.rowSpan}`),
  );

const rangeFrom = (from: Node, to: Node) => {
  const range = document.createRange();
  range.setStart(from, 0);
  range.setEnd(to, 0);
  return range;
};

const focusCell = () => {
  const node = document.getSelection()?.focusNode;
  return (node instanceof Element ? node : node?.parentElement)?.closest("td");
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("a table inside a cell", () => {
  it("goes after what the cell holds, with a line to go on in, and takes the place of an empty one", () => {
    const { table } = viewOf(THREE);
    const nested = nestTable(cellNamed(table, "b"));
    expect(tableDepth(nested)).toBe(1);
    expect(tableDepth(table)).toBe(0);
    expect(tableSize(nested)).toEqual({ rows: 2, columns: 2 });
    const cell = nested.parentElement as HTMLTableCellElement;
    expect([...cell.children].map((each) => each.tagName)).toEqual(["DIV", "TABLE", "DIV"]);
    expect(cell.firstElementChild?.textContent).toBe("b");

    const { table: empty } = viewOf(`<table><tbody>${rowHtml("<br>")}</tbody></table>`);
    const inEmpty = nestTable(empty.rows[0]?.cells[0] as HTMLTableCellElement);
    expect([...(inEmpty.parentElement as Element).children].map((each) => each.tagName)).toEqual([
      "TABLE",
      "DIV",
    ]);
  });

  it("is what the sheet's selection finds, and Tab goes round its own cells", () => {
    const { node, table } = viewOf(THREE);
    const nested = nestTable(cellNamed(table, "b"));
    const first = nested.rows[0]?.cells[0] as HTMLTableCellElement;
    expect(tableAround(node, first)).toBe(nested);
    expect(tableAround(node, cellNamed(table, "a"))).toBe(table);
    const range = rangeFrom(first, first);
    expect(cellsIn(nested, range)).toEqual([first]);
    expect(cellsIn(table, range)).toEqual([nested.parentElement]);
    const selection = document.getSelection() as Selection;
    selection.collapse(first, 0);
    expect(moveBetweenCells(node, false)).toBe("moved");
    expect(focusCell()).toBe(nested.rows[0]?.cells[1]);
    selection.collapse(nested.rows[1]?.cells[1] as Node, 0);
    expect(moveBetweenCells(node, false)).toBe("added");
    expect(tableSize(nested).rows).toBe(3);
    expect(tableSize(table).rows).toBe(3);
  });

  it("comes back from RTF and a draft where it was", () => {
    const { node, table } = viewOf(THREE);
    const nested = nestTable(cellNamed(table, "b"));
    (nested.rows[1]?.cells[0] as HTMLTableCellElement).textContent = "deep";
    const { paragraphs } = readRtf(writeRtf(paragraphsOfContent(node)));
    const read = viewOf(paragraphsToHtml(paragraphs)).table;
    const again = read.querySelector("table") as HTMLTableElement;
    expect(tableDepth(again)).toBe(1);
    expect(tableSize(again)).toEqual({ rows: 2, columns: 2 });
    expect(again.rows[1]?.cells[0]?.textContent).toBe("deep");
    expect(again.closest("td")?.parentElement?.parentElement?.parentElement).toBe(read);
    expect(tableSize(read)).toEqual({ rows: 3, columns: 3 });
  });

  it("goes back out, its text kept, and Undo brings it back with what its cells held", () => {
    const { node, table } = viewOf(THREE);
    const cell = cellNamed(table, "b");
    const nested = nestTable(cell);
    const inner = nested.rows[0]?.cells[1] as HTMLTableCellElement;
    (inner.firstElementChild as Element).textContent = "kept";
    const before = node.innerHTML;
    changeTableShape(node, table, () => unnestTable(nested));
    expect(cell.querySelector("table")).toBeNull();
    expect(cell.textContent).toBe("bkept");
    const after = node.innerHTML;
    expect(stepRuler(node, "undo")).toBe(true);
    expect(node.innerHTML).toBe(before);
    expect(inner.textContent).toBe("kept");
    expect(stepRuler(node, "redo")).toBe(true);
    expect(node.innerHTML).toBe(after);
  });

  it("leaves a line in a cell that held only the table", () => {
    const { table } = viewOf(`<table><tbody>${rowHtml("<br>")}</tbody></table>`);
    const cell = table.rows[0]?.cells[0] as HTMLTableCellElement;
    const nested = nestTable(cell);
    cell.lastElementChild?.remove();
    unnestTable(nested);
    expect(cell.innerHTML).toBe("<div><br></div>");
  });
});

describe("cells merged across rows", () => {
  it("can merge any rectangle and nothing else, and a drag from one cell to another is a rectangle", () => {
    const { table } = viewOf(THREE);
    const [a, b, d, e] = ["a", "b", "d", "e"].map((text) => cellNamed(table, text)) as [
      HTMLTableCellElement,
      HTMLTableCellElement,
      HTMLTableCellElement,
      HTMLTableCellElement,
    ];
    expect(canMerge([a, d])).toBe(true);
    expect(canMerge([a, b, d, e])).toBe(true);
    expect(canMerge([a, e])).toBe(false);
    expect(canMerge([a, b, d])).toBe(false);
    expect(canMerge([a])).toBe(false);
    expect(cellsIn(table, rangeFrom(a, d))).toEqual([a, d]);
    expect(cellsIn(table, rangeFrom(a, e))).toEqual([a, b, d, e]);
  });

  it("merges down a column, keeping every cell's text in the first, and splits back", () => {
    const { table } = viewOf(THREE);
    const [a, d] = [cellNamed(table, "a"), cellNamed(table, "d")];
    mergeCells([a, d]);
    expect(shape(table)).toEqual([
      ["ad:1x2", "b:1x1", "c:1x1"],
      ["e:1x1", "f:1x1"],
      ["g:1x1", "h:1x1", "i:1x1"],
    ]);
    expect(columnsOfCells([cellNamed(table, "e")])).toEqual([1]);
    splitCell(a);
    expect(shape(table)).toEqual([
      ["ad:1x1", "b:1x1", "c:1x1"],
      [":1x1", "e:1x1", "f:1x1"],
      ["g:1x1", "h:1x1", "i:1x1"],
    ]);
  });

  it("merges a block, and splits it back to the same grid, with the cell beside it in its place", () => {
    const { table } = viewOf(THREE);
    const cells = ["b", "c", "e", "f"].map((text) => cellNamed(table, text));
    mergeCells(cells);
    expect(shape(table)).toEqual([["a:1x1", "bcef:2x2"], ["d:1x1"], ["g:1x1", "h:1x1", "i:1x1"]]);
    splitCell(cells[0] as HTMLTableCellElement);
    expect(shape(table)).toEqual([
      ["a:1x1", "bcef:1x1", ":1x1"],
      ["d:1x1", ":1x1", ":1x1"],
      ["g:1x1", "h:1x1", "i:1x1"],
    ]);
  });

  it("drops a row the merged cell covers whole", () => {
    const { table } = viewOf(THREE);
    mergeCells([...cellsOfRow(table, 0), ...cellsOfRow(table, 1)]);
    expect(shape(table)).toEqual([["abcdef:3x1"], ["g:1x1", "h:1x1", "i:1x1"]]);
  });

  it("keeps the grid when the sheet makes the table another size", () => {
    const { table } = viewOf(THREE);
    mergeCells([cellNamed(table, "a"), cellNamed(table, "d")]);
    reshapeTable(table, 3, 4);
    expect(shape(table).map((row) => row.length)).toEqual([4, 3, 4]);
    expect(tableSize(table)).toEqual({ rows: 3, columns: 4 });
    reshapeTable(table, 3, 2);
    expect(shape(table)).toEqual([["ad:1x2", "b:1x1"], ["e:1x1"], ["g:1x1", "h:1x1"]]);
    reshapeTable(table, 1, 2);
    expect(shape(table)).toEqual([["ad:1x1", "b:1x1"]]);
  });

  it("asks before the sheet drops a column by what really stands in it", () => {
    const { table } = viewOf(THREE);
    mergeCells([cellNamed(table, "b"), cellNamed(table, "e")]);
    expect(shapeLosesText(table, 3, 3)).toBe(false);
    expect(shapeLosesText(table, 3, 2)).toBe(true);
    expect(shapeLosesText(table, 3, 1)).toBe(true);
  });

  it("goes round with Tab through the cells that are left", () => {
    const { node, table } = viewOf(THREE);
    mergeCells([cellNamed(table, "a"), cellNamed(table, "d")]);
    document.getSelection()?.collapse(cellNamed(table, "c"), 0);
    expect(moveBetweenCells(node, false)).toBe("moved");
    expect(focusCell()?.textContent).toBe("e");
  });

  const merged = () => {
    const { node, table } = viewOf(THREE);
    mergeCells(["b", "c", "e", "f"].map((text) => cellNamed(table, text)));
    mergeCells([cellNamed(table, "d"), cellNamed(table, "g")]);
    cellNamed(table, "dg").style.backgroundColor = "rgb(255, 234, 0)";
    return paragraphsOfContent(node);
  };
  const WANTED = [["a:1x1", "bcef:2x2"], ["dg:1x2"], ["h:1x1", "i:1x1"]];
  const shapeOf = (paragraphs: readonly RtfParagraph[]) =>
    shape(viewOf(paragraphsToHtml(paragraphs)).table);

  it("holds through the draft's HTML and a plain text's columns", () => {
    const paragraphs = merged();
    expect(shapeOf(paragraphs)).toEqual(WANTED);
    expect(linesOfParagraphs(paragraphs)).toEqual(["a\tb c e f", "d g\t", "\th\ti"]);
  });

  it("holds through RTF, in \\clvmgf and \\clvmrg, read back and written again the same", () => {
    const paragraphs = merged();
    const written = writeRtf(paragraphs);
    expect(written).toContain("\\clvmgf");
    expect(written).toContain("\\clvmrg");
    const read = readRtf(written).paragraphs;
    expect(shapeOf(read)).toEqual(WANTED);
    expect(read[0]?.table?.rows[1]?.[0]?.background).toBe("#ffea00");
    expect(writeRtf(read)).toBe(written);
  });

  it("reads a merge from another program's RTF, its covered cell's text kept", () => {
    const rtf =
      "{\\rtf1\\ansi\\trowd\\clvmgf\\cellx1000\\cellx2000\\pard\\intbl one\\cell two\\cell\\row" +
      "\\trowd\\clvmrg\\cellx1000\\cellx2000\\pard\\intbl below\\cell three\\cell\\row}";
    const table = readRtf(rtf).paragraphs[0]?.table;
    expect(table?.rows.map((row) => row.length)).toEqual([2, 1]);
    expect(table?.rows[0]?.[0]?.rows).toBe(2);
    expect(linesOfParagraphs(readRtf(rtf).paragraphs)).toEqual(["one below\ttwo", "\tthree"]);
  });

  it("holds through a merge across rows inside a nested table", () => {
    const { node, table } = viewOf(THREE);
    const nested = nestTable(cellNamed(table, "b"));
    mergeCells([nested.rows[0]?.cells[0], nested.rows[1]?.cells[0]] as HTMLTableCellElement[]);
    const read = viewOf(
      paragraphsToHtml(readRtf(writeRtf(paragraphsOfContent(node))).paragraphs),
    ).table;
    const again = read.querySelector("table") as HTMLTableElement;
    expect(again.rows[0]?.cells[0]?.rowSpan).toBe(2);
    expect(again.rows[1]?.cells.length).toBe(1);
    expect(tableSize(read)).toEqual({ rows: 3, columns: 3 });
  });

  it("holds through Word and OpenDocument files", async () => {
    const paragraphs = merged();
    expect(shapeOf(await readDocx(writeDocx(paragraphs)))).toEqual(WANTED);
    expect(shapeOf(await readOdt(writeOdt(paragraphs)))).toEqual(WANTED);
  });

  it("draws in a PDF as one box the height of its rows, and the page does not break between them", () => {
    const measure: MeasureText = (text) => text.length * 6;
    const LETTER = { paper: "letter", orientation: "portrait", scale: 100 } as const;
    const [page, ...others] = layoutPdf(merged(), LETTER, measure);
    expect(others).toEqual([]);
    const boxes = (page?.marks ?? []).flatMap((mark) => (mark.kind === "box" ? [mark] : []));
    expect(boxes).toHaveLength(5);
    const [a, wide, dg, h, i] = boxes as [
      (typeof boxes)[0],
      (typeof boxes)[0],
      (typeof boxes)[0],
      (typeof boxes)[0],
      (typeof boxes)[0],
    ];
    expect(wide.y).toBe(a.y);
    expect(dg.y).toBe(a.y + a.height);
    expect(dg.x).toBe(a.x);
    expect(h.x).toBe(a.x + a.width);
    expect(i.x).toBe(h.x + h.width);
    expect(wide.height).toBe(a.height + dg.height - h.height);
    expect(h.y).toBe(dg.y + dg.height - h.height);
    expect(dg.height).toBeGreaterThan(h.height);
    const texts = (page?.marks ?? []).flatMap((mark) => (mark.kind === "text" ? [mark.text] : []));
    expect(texts.join("")).toContain("dg");
  });
});
