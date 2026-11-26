import { afterEach, describe, expect, it } from "vitest";
import { changeTableShape, stepRuler } from "./textedit-document";
import { layoutPdf } from "./textedit-pdf";
import {
  paragraphsOfContent,
  paragraphsOfLines,
  paragraphsToHtml,
  type RtfParagraph,
  readRtf,
  writeRtf,
} from "./textedit-rtf";
import { htmlToContent } from "./textedit-server";
import {
  columnsOfCells,
  columnWidthFits,
  insertTable,
  mergeCells,
  moveBetweenCells,
  reshapeTable,
  setColumnWidth,
  widthOfColumns,
} from "./textedit-table";

/* Format > Table…'s Column Width, and a table's changes on the Undo stack. */

const TWO =
  '<table data-border="1"><tbody><tr><td><div>a</div></td><td><div>b</div></td></tr><tr><td><div>c</div></td><td><div>d</div></td></tr></tbody></table>';

const viewOf = (html: string) => {
  const node = document.createElement("div");
  node.append(htmlToContent(html, document));
  document.body.append(node);
  return { node, table: node.querySelector("table") as HTMLTableElement };
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("a column's width", () => {
  it("draws in a PDF, the others sharing the rest and all fitting the page", () => {
    const boxes = (widths: number[]) => {
      const cell = { paragraphs: paragraphsOfLines(["a"]) };
      const paragraphs: RtfParagraph[] = [
        { align: "left", runs: [], table: { border: 1, rows: [[cell, cell]], widths } },
      ];
      const [page] = layoutPdf(
        paragraphs,
        { paper: "letter", orientation: "portrait", scale: 100 },
        (text) => text.length * 6,
      );
      return page?.marks.flatMap((mark) => (mark.kind === "box" ? [mark.width] : []));
    };
    expect(boxes([90, 0])).toEqual([90, 378]);
    expect(boxes([600, 600])).toEqual([234, 234]);
  });
  it("is set and taken away", () => {
    const { table, node } = viewOf(TWO);
    setColumnWidth(table, [1], 144);
    expect(node.innerHTML).toContain('<colgroup><col><col width="144"></colgroup>');
    expect(widthOfColumns(table, [1])).toBe("144");
    expect(widthOfColumns(table, [0, 1])).toBe("");
    setColumnWidth(table, [1], null);
    expect(node.querySelector("colgroup")).toBeNull();
  });

  it("belongs to the column a cell stands in, counting merged cells", () => {
    const { table } = viewOf(
      '<table><tbody><tr><td colspan="2"><div>a</div></td><td><div>b</div></td></tr></tbody></table>',
    );
    const [merged, last] = [...(table.rows[0]?.cells ?? [])] as HTMLTableCellElement[];
    expect(columnsOfCells([last as HTMLTableCellElement])).toEqual([2]);
    expect(columnsOfCells([merged as HTMLTableCellElement])).toEqual([0, 1]);
  });

  it("follows a reshape, and goes with the last column that had one", () => {
    const { table } = viewOf(TWO);
    setColumnWidth(table, [1], 144);
    reshapeTable(table, 2, 3);
    expect(table.querySelectorAll("col")).toHaveLength(3);
    reshapeTable(table, 2, 1);
    expect(table.querySelector("colgroup")).toBeNull();
  });

  it("is taken by the sheet when empty or between 1 and 2000 points", () => {
    expect(["", "1", "2000", "0", "2001", "wide", "1.5"].map(columnWidthFits)).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
  });

  it("goes through RTF and the view's HTML", () => {
    const { node, table } = viewOf(TWO);
    setColumnWidth(table, [0], 90);
    setColumnWidth(table, [1], 200);
    const rtf = writeRtf(paragraphsOfContent(node));
    expect(rtf).toContain("\\cellx1800");
    expect(rtf).toContain("\\cellx5800");
    const { paragraphs } = readRtf(rtf);
    expect(paragraphs[0]?.table?.widths).toEqual([90, 200]);
    const shown = htmlToContent(paragraphsToHtml(paragraphs), document);
    expect([...shown.querySelectorAll("col")].map((each) => each.getAttribute("width"))).toEqual([
      "90",
      "200",
    ]);
  });

  it("is not read from a table of even columns", () => {
    const { node } = viewOf(TWO);
    const { paragraphs } = readRtf(writeRtf(paragraphsOfContent(node)));
    expect(paragraphs[0]?.table?.widths).toBeUndefined();
  });

  it("keeps a column set when another shares what is left in RTF", () => {
    const { node, table } = viewOf(TWO);
    setColumnWidth(table, [0], 90);
    const { paragraphs } = readRtf(writeRtf(paragraphsOfContent(node)));
    expect(paragraphs[0]?.table?.widths?.[0]).toBe(90);
  });
});

describe("a table's changes on the Undo stack", () => {
  it("take a reshape back and do it again, with the same cells", () => {
    const { node, table } = viewOf(TWO);
    const before = node.innerHTML;
    const first = table.rows[0]?.cells[0] as HTMLTableCellElement;
    changeTableShape(node, table, () => {
      reshapeTable(table, 3, 3);
      table.dataset.border = "2";
      setColumnWidth(table, [0], 72);
    });
    const after = node.innerHTML;
    expect(after).toContain('<col width="72">');
    expect(stepRuler(node, "undo")).toBe(true);
    expect(node.innerHTML).toBe(before);
    expect(node.querySelector("td")).toBe(first);
    expect(stepRuler(node, "undo")).toBe(false);
    expect(stepRuler(node, "redo")).toBe(true);
    expect(node.innerHTML).toBe(after);
  });

  it("bring back the text a smaller table lost", () => {
    const { node, table } = viewOf(TWO);
    changeTableShape(node, table, () => reshapeTable(table, 1, 1));
    expect(node.textContent).toBe("a");
    expect(stepRuler(node, "undo")).toBe(true);
    expect(node.textContent).toBe("abcd");
  });

  it("take Merge Cells back", () => {
    const { node, table } = viewOf(TWO);
    const before = node.innerHTML;
    const cells = [...(table.rows[0]?.cells ?? [])];
    changeTableShape(node, table, () => mergeCells(cells));
    expect(table.rows[0]?.cells).toHaveLength(1);
    expect(stepRuler(node, "undo")).toBe(true);
    expect(node.innerHTML).toBe(before);
  });

  it("take a new table back", () => {
    const { node } = viewOf("<div>text</div>");
    changeTableShape(node, null, () => insertTable(node, node.lastChild, 2, 2));
    expect(node.querySelectorAll("td")).toHaveLength(4);
    expect(stepRuler(node, "undo")).toBe(true);
    expect(node.innerHTML).toBe("<div>text</div>");
  });

  it("wait until what was typed since is taken back", () => {
    const { node, table } = viewOf(TWO);
    changeTableShape(node, table, () => reshapeTable(table, 3, 2));
    const typed = table.rows[0]?.cells[0]?.firstElementChild?.firstChild as Text;
    typed.data = "aa";
    expect(stepRuler(node, "undo")).toBe(false);
    typed.data = "a";
    expect(stepRuler(node, "undo")).toBe(true);
    expect(table.rows).toHaveLength(2);
  });

  it("take back the row Tab added in the last cell", () => {
    const { node, table } = viewOf(TWO);
    document.getSelection()?.collapse(table.rows[1]?.cells[1]?.firstElementChild as Element, 0);
    expect(moveBetweenCells(node, false)).toBe("added");
    expect(table.rows).toHaveLength(3);
    expect(stepRuler(node, "undo")).toBe(true);
    expect(table.rows).toHaveLength(2);
  });
});
