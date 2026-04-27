import TurndownService from "turndown";
import type { ExtractionResult } from "../shared/types";

const cleanupSelectors = [
  "nav",
  "aside",
  "header",
  "footer",
  "[role='navigation']",
  "[aria-label*='breadcrumb' i]",
  "[class*='breadcrumb' i]",
  "[class*='sidebar' i]",
  "[class*='toc' i]",
  "[class*='table-of-content' i]",
  "[class*='feedback' i]",
  "[class*='edit' i]",
  "[class*='pagination' i]",
  "[class*='prev' i]",
  "[class*='next' i]",
  "script",
  "style",
  "noscript",
  "svg",
  "iframe"
];

export function extractPageContent(): ExtractionResult {
  const root = chooseContentRoot();
  if (!root) {
    return {
      ok: false,
      reason: "content-root-not-found",
      message: "Could not find a docs content container.",
      url: location.href,
      title: document.title
    };
  }

  const clone = cleanClone(root);
  const markdown = normalizeMarkdown(createTurndownService().turndown(clone));
  const html = clone.innerHTML;
  const title =
    normalizeSpace(root.querySelector("h1")?.textContent) ||
    normalizeSpace(document.querySelector("h1")?.textContent) ||
    normalizeSpace(document.title) ||
    location.href;

  if (markdown.length < 40) {
    return {
      ok: false,
      reason: "content-too-short",
      message: "Extracted content was too short to export.",
      url: location.href,
      title,
      selector: selectorLabel(root),
      markdownLength: markdown.length
    };
  }

  return {
    ok: true,
    url: location.href,
    title,
    selector: selectorLabel(root),
    markdown,
    htmlLength: html.length,
    markdownLength: markdown.length
  };
}

const nav2mdGlobal = globalThis as typeof globalThis & {
  nav2mdExtractPageContent?: () => ExtractionResult;
};

nav2mdGlobal.nav2mdExtractPageContent = extractPageContent;

function createTurndownService() {
  const service = new TurndownService({
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "_",
    headingStyle: "atx",
    hr: "---"
  });

  service.addRule("fencedCodeBlockWithLanguage", {
    filter: (node) => {
      return (
        node.nodeName === "PRE" &&
        node.firstChild !== null &&
        node.firstChild.nodeName === "CODE"
      );
    },
    replacement: (_content, node) => {
      const code = (node as Element).querySelector("code");
      const className = code?.getAttribute("class") || "";
      const language = className.match(/language-([a-z0-9_-]+)/i)?.[1] || "";
      return `\n\n\`\`\`${language}\n${(code?.textContent || "").replace(/\n+$/, "")}\n\`\`\`\n\n`;
    }
  });

  service.addRule("markdownTable", {
    filter: "table",
    replacement: (_content, node) => tableMarkdown(node as HTMLTableElement)
  });

  return service;
}

function chooseContentRoot(): HTMLElement | null {
  const preferredSelectors = [
    "main",
    "article",
    "[role='main']",
    ".theme-doc-markdown",
    ".markdown",
    ".markdown-body",
    ".docMainContainer",
    ".docs-content",
    ".docs-container",
    ".content",
    "#content"
  ];

  const preferred = preferredSelectors
    .flatMap((selector) => Array.from(document.querySelectorAll<HTMLElement>(selector)))
    .filter((element) => textLength(element) >= 120)
    .sort((a, b) => scoreElement(b) - scoreElement(a));

  if (preferred[0]) return preferred[0];

  return (
    Array.from(document.body.querySelectorAll<HTMLElement>("article, section, div"))
      .filter((element) => textLength(element) >= 300)
      .sort((a, b) => scoreElement(b) - scoreElement(a))[0] ?? null
  );
}

function cleanClone(root: HTMLElement): HTMLElement {
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(cleanupSelectors.join(",")).forEach((node) => node.remove());
  clone.querySelectorAll("[hidden], [aria-hidden='true']").forEach((node) => node.remove());
  clone.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
    link.href = absolutizeUrl(link.getAttribute("href"));
  });
  clone.querySelectorAll<HTMLImageElement>("img[src]").forEach((image) => {
    image.src = absolutizeUrl(image.getAttribute("src"));
  });
  return clone;
}

function normalizeSpace(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function textLength(element: Element) {
  return normalizeSpace(element.textContent).length;
}

function selectorLabel(element: Element) {
  const id = element.id ? `#${element.id}` : "";
  const className =
    typeof element.className === "string" && element.className.trim()
      ? `.${element.className.trim().split(/\s+/).slice(0, 3).join(".")}`
      : "";
  return `${element.tagName.toLowerCase()}${id}${className}`;
}

function scoreElement(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const length = textLength(element);
  const linkText = Array.from(element.querySelectorAll("a")).reduce(
    (sum, link) => sum + textLength(link),
    0
  );
  const linkPenalty = length > 0 ? linkText / length : 0;
  const sizePenalty = rect.width < 280 || rect.height < 120 ? 300 : 0;
  return length - linkPenalty * 500 - sizePenalty;
}

function absolutizeUrl(value: string | null) {
  try {
    return new URL(value || "", location.href).href;
  } catch (_error) {
    return value || "";
  }
}

function tableMarkdown(table: HTMLTableElement) {
  const rows = Array.from(table.querySelectorAll("tr"))
    .map((row) =>
      Array.from(row.children).map((cell) =>
        normalizeSpace(cell.textContent).replace(/\|/g, "\\|")
      )
    )
    .filter((row) => row.length > 0);

  if (rows.length === 0) return "";

  const columnCount = Math.max(...rows.map((row) => row.length));
  const normalizeRow = (row: string[]) =>
    Array.from({ length: columnCount }, (_value, index) => row[index] || "");
  const header = normalizeRow(rows[0] ?? []);
  const separator = Array.from({ length: columnCount }, () => "---");
  const body = rows.slice(1).map(normalizeRow);

  return `\n\n| ${header.join(" | ")} |\n| ${separator.join(" | ")} |\n${body
    .map((row) => `| ${row.join(" | ")} |`)
    .join("\n")}\n\n`;
}

function normalizeMarkdown(value: string) {
  return value
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
