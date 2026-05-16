import { Marked } from "marked";
import DOMPurify from "isomorphic-dompurify";

const marked = new Marked({ gfm: true, breaks: true });

export function renderMarkdown(source: string | null | undefined): string {
  if (!source) return "";
  const html = marked.parse(source, { async: false }) as string;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "u", "s", "del", "ins", "mark", "code", "pre",
      "blockquote", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
      "a", "img", "hr", "table", "thead", "tbody", "tr", "th", "td",
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "title", "target", "rel"],
  });
}

export function stripMarkdown(source: string | null | undefined, max = 200): string {
  if (!source) return "";
  const plain = source
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~\-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > max ? plain.slice(0, max - 1) + "…" : plain;
}
