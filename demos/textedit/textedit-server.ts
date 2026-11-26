import {
  cleanProperties,
  type TextEditDocument,
  type TextEditProperties,
  type TextEditRuler,
} from "./textedit-data";
import { isPlainEncoding } from "./textedit-encodings";
import { PICTURE_SOURCE } from "./textedit-picture";

/**
 * TextEdit's half on the `macalicious-desktop` Ferrite application
 * (`ferrite-apps/desktop/src/apps/textedit`): the document in the window, saved as it changes
 * (`{ draft }`), with the drive file it is when it has one. The documents themselves are files of
 * the person's drive (`textedit-files.ts`).
 */
export const TEXTEDIT_DRAFT_URL = "/api/textedit/draft";
/**
 * The largest draft request TextEdit sends, in bytes: the gateway refuses a request over 262,144 bytes (and the
 * server a document over 262,144 characters, `MAX_DOCUMENT_CHARS`), less room for the request's own fields.
 */
export const TEXTEDIT_DRAFT_MAX_BYTES = 262_144 - 1_024;

/** A document as the server keeps it: the rich text view's paragraphs as `html`. */
export interface StoredDocument {
  name: string;
  format: "rich" | "plain";
  lines: string[];
  html?: string;
  ruler?: { first: number; head: number; tail: number; tabStops: number[] };
  properties?: TextEditProperties;
}

/** Elements kept from stored rich text: those the view and its commands make. */
const KEPT = new Set([
  "DIV",
  "P",
  "BR",
  "SPAN",
  "FONT",
  "B",
  "I",
  "U",
  "S",
  "STRIKE",
  "STRONG",
  "EM",
  "SUB",
  "SUP",
  "UL",
  "OL",
  "LI",
  "BLOCKQUOTE",
  "PRE",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "A",
  "TABLE",
  "COLGROUP",
  "COL",
  "TBODY",
  "THEAD",
  "TFOOT",
  "TR",
  "TD",
  "TH",
  "IMG",
]);
/** Elements dropped with everything in them; any other element is replaced by its content. */
const DROPPED = new Set([
  "SCRIPT",
  "STYLE",
  "TEMPLATE",
  "NOSCRIPT",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "SVG",
  "MATH",
  "TITLE",
  "HEAD",
  "LINK",
  "META",
  "PICTURE",
  "VIDEO",
  "AUDIO",
  "CANVAS",
  "FORM",
  "INPUT",
  "TEXTAREA",
  "SELECT",
  "BUTTON",
]);
/** The style properties kept: those the format bar, the ruler and the Font rows write. */
const STYLES = [
  "text-align",
  "line-height",
  "margin-top",
  "margin-bottom",
  "margin-inline-start",
  "margin-inline-end",
  "text-indent",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "text-decoration",
  "text-decoration-line",
  "color",
  "background-color",
  "letter-spacing",
  "tab-size",
  "font-kerning",
  "font-variant-ligatures",
  "vertical-align",
  "-webkit-text-stroke-width",
  "-webkit-text-stroke-color",
  "-webkit-text-fill-color",
] as const;
/** The attributes kept, each with the values it may have. */
const ATTRIBUTES: Record<string, RegExp> = {
  "data-spacing": /^\d(\.\d)?$/,
  "data-list": /^[a-z]{1,20}$/,
  "data-list-start": /^\d{1,6}$/,
  "data-tabs": /^(\d{1,5}(\.\d{1,3})?[lcrd])?( \d{1,5}(\.\d{1,3})?[lcrd]){0,99}$/,
  "data-border": /^[0-3]$/,
  // The most a browser takes, 1000.
  colspan: /^([1-9]\d{0,2}|1000)$/,
  rowspan: /^([1-9]\d{0,2}|1000)$/,
  color: /^#?[0-9a-z]{1,20}$/i,
  face: /^[\w ,'"-]{1,200}$/,
  size: /^[1-7]$/,
  "data-page-break": /^$/,
  dir: /^(ltr|rtl|auto)$/,
  // A web address, which `Add Link` gives, or an attachment's drive file: a stored one is not trusted.
  href: /^(https?:\/\/[^\s<>"]{1,2000}|drive:[A-Za-z0-9]{1,64})$/i,
  // An attachment is one character to the caret.
  contenteditable: /^false$/,
  src: PICTURE_SOURCE,
  width: /^\d{1,5}$/,
  height: /^\d{1,5}$/,
};

/**
 * Stored rich text as nodes of `target`, rebuilt from the elements, styles and attributes the
 * view writes and nothing else: no script, handler, picture but a PNG or JPEG held in the text, or
 * address other than a web link or a drive file survives, whatever the stored text holds. The text is parsed into the content of a `template`
 * element, which belongs to an inert document without a browsing context: nothing in it runs,
 * and no picture, frame or other resource it names is fetched.
 */
export function htmlToContent(html: string, target: Document): DocumentFragment {
  const template = target.createElement("template");
  template.innerHTML = html;
  const parsed = template.content;
  const out = target.createDocumentFragment();
  const copy = (from: Node, into: Node) => {
    for (const child of from.childNodes) {
      if (child.nodeType === 3) {
        into.appendChild(target.createTextNode(child.nodeValue ?? ""));
        continue;
      }
      if (child.nodeType !== 1) continue;
      const element = child as HTMLElement;
      const tag = element.tagName.toUpperCase();
      if (DROPPED.has(tag)) continue;
      if (tag === "IMG" && !PICTURE_SOURCE.test(element.getAttribute("src") ?? "")) continue;
      if (
        !KEPT.has(tag) ||
        (tag === "A" && !ATTRIBUTES.href?.test(element.getAttribute("href") ?? ""))
      ) {
        copy(element, into);
        continue;
      }
      const made = target.createElement(
        tag === "TH" ? "td" : tag === "THEAD" || tag === "TFOOT" ? "tbody" : tag.toLowerCase(),
      );
      for (const property of STYLES) {
        const value = element.style?.getPropertyValue(property) ?? "";
        if (value && !/url\(|expression|javascript:|[<>\\]/i.test(value)) {
          made.style.setProperty(property, value);
        }
      }
      for (const [name, allowed] of Object.entries(ATTRIBUTES)) {
        const value = element.getAttribute(name);
        if (value !== null && allowed.test(value)) made.setAttribute(name, value);
      }
      if (made.dataset.listStart) {
        made.style.setProperty("counter-set", `list-item ${made.dataset.listStart}`);
      }
      copy(element, made);
      into.appendChild(made);
    }
  };
  copy(parsed, out);
  return out;
}

/** A rich text document's paragraphs as HTML. */
export function contentToHtml(content: DocumentFragment): string {
  const holder = content.ownerDocument.createElement("div");
  holder.append(content.cloneNode(true));
  return holder.innerHTML;
}

/** A document as the server keeps it; `html`, when given, replaces its content's. */
export function documentToServer(document: TextEditDocument, html?: string): StoredDocument {
  const rich = document.format === "rich";
  const markup = rich
    ? (html ?? (document.content ? contentToHtml(document.content) : undefined))
    : undefined;
  return {
    name: document.name,
    format: document.format,
    lines: document.lines.length > 0 ? [...document.lines] : [""],
    ...(markup !== undefined ? { html: markup } : undefined),
    ...(rich && document.ruler
      ? { ruler: { ...document.ruler, tabStops: [...document.ruler.tabStops] } }
      : undefined),
    ...(rich && document.properties ? { properties: document.properties } : undefined),
  };
}

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function rulerFromServer(value: unknown): TextEditRuler | undefined | false {
  if (value === undefined) return undefined;
  const ruler = value as Record<string, unknown> | null;
  if (
    typeof ruler !== "object" ||
    ruler === null ||
    !isNumber(ruler.first) ||
    !isNumber(ruler.head) ||
    !isNumber(ruler.tail) ||
    !Array.isArray(ruler.tabStops) ||
    !ruler.tabStops.every(isNumber)
  ) {
    return false;
  }
  return { first: ruler.first, head: ruler.head, tail: ruler.tail, tabStops: ruler.tabStops };
}

/** A stored document, its formats rebuilt in `target`, or `undefined` when it is not one. */
export function documentFromServer(value: unknown, target: Document): TextEditDocument | undefined {
  const stored = value as Record<string, unknown> | null;
  if (
    typeof stored !== "object" ||
    stored === null ||
    typeof stored.name !== "string" ||
    (stored.format !== "rich" && stored.format !== "plain") ||
    !Array.isArray(stored.lines) ||
    stored.lines.length === 0 ||
    !stored.lines.every((line) => typeof line === "string") ||
    (stored.html !== undefined && typeof stored.html !== "string")
  ) {
    return undefined;
  }
  const ruler = rulerFromServer(stored.ruler);
  if (ruler === false) return undefined;
  const rich = stored.format === "rich";
  const properties =
    rich && typeof stored.properties === "object" && stored.properties !== null
      ? cleanProperties(
          Object.fromEntries(
            Object.entries(stored.properties).filter(([, value]) => typeof value === "string"),
          ),
        )
      : undefined;
  return {
    name: stored.name,
    format: stored.format,
    lines: stored.lines as string[],
    ...(rich && typeof stored.html === "string"
      ? { content: htmlToContent(stored.html, target) }
      : undefined),
    ...(rich && ruler ? { ruler } : undefined),
    ...(properties ? { properties } : undefined),
  };
}

/** The draft of a `GET /draft` reply: the document, whether it is edited, and its drive file. */
export interface TextEditDraft {
  document: TextEditDocument;
  edited: boolean;
  /**
   * Whether the draft holds changes not yet written into its drive file. A draft saved before
   * this was kept says `edited` instead.
   */
  unwritten?: boolean;
  /** Whether Format > Prevent Editing holds the document. */
  readOnly?: boolean;
  /**
   * The drive file the document is, when it has one (`servedByDesktopApp()` only), with the
   * file's version the document was read from or last saved as.
   */
  file?: { id: string; name: string; version?: number; encoding?: string };
}

/** A draft's drive file, when it names a well-formed one. */
function fileOf(
  value: unknown,
): { id: string; name: string; version?: number; encoding?: string } | undefined {
  const file = value as
    | { id?: unknown; name?: unknown; version?: unknown; encoding?: unknown }
    | null
    | undefined;
  if (
    typeof file?.id !== "string" ||
    !/^[A-Za-z0-9]{1,64}$/.test(file.id) ||
    typeof file.name !== "string" ||
    file.name === ""
  ) {
    return undefined;
  }
  const version =
    typeof file.version === "number" && Number.isSafeInteger(file.version) && file.version >= 0
      ? file.version
      : undefined;
  const encoding =
    typeof file.encoding === "string" && isPlainEncoding(file.encoding)
      ? { encoding: file.encoding }
      : undefined;
  return version === undefined
    ? { id: file.id, name: file.name, ...encoding }
    : { id: file.id, name: file.name, version, ...encoding };
}

/**
 * The draft of a `GET` reply. `null` when the session has saved none; `undefined` when the
 * reply holds something TextEdit cannot read, which must not be saved over.
 */
export function draftFromServer(
  reply: unknown,
  target: Document,
): TextEditDraft | null | undefined {
  const draft = (reply as { draft?: unknown } | null)?.draft;
  if (draft === null) return null;
  const edited = (draft as { edited?: unknown } | undefined)?.edited;
  const unwritten = (draft as { unwritten?: unknown } | undefined)?.unwritten;
  const document = documentFromServer(draft, target);
  if (!document || typeof edited !== "boolean") return undefined;
  const file = fileOf((draft as { file?: unknown }).file);
  const state = {
    ...(typeof unwritten === "boolean" ? { edited, unwritten } : { edited }),
    ...((draft as { readOnly?: unknown }).readOnly === true ? { readOnly: true } : undefined),
  };
  return file ? { document, ...state, file } : { document, ...state };
}
