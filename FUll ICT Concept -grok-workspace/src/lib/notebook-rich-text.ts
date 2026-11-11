/**
 * Utilities for converting between Markdown/inline note text and clean Rich HTML
 * for the Notebook WYSIWYG editor, without losing compatibility with stored DB notes.
 */

const BLOCK_HTML_RE = /<(?:h[1-6]|p|ul|ol|li|blockquote|pre|div|hr)\b/i;

export function isRichHtmlContent(content: string): boolean {
  if (!content) return false;
  return BLOCK_HTML_RE.test(content);
}

/**
 * Strips potentially unsafe HTML tags/attributes while preserving formatting tags
 * (`h1..h4`, `p`, `div`, `br`, `strong`, `b`, `em`, `i`, `u`, `s`, `code`, `pre`,
 * `blockquote`, `ul`, `ol`, `li`, `span`, `hr`, `font`, `label`, `input`).
 */
export function sanitizeNotebookHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<(?:iframe|object|embed|meta|link|base)[^>]*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '$1="#"');
}

function escapeHtmlPreservingSafeTags(line: string): string {
  // Temporarily stash allowed inline tags so literal `<` / `>` in trading notes don't break HTML,
  // while existing `<u>`, `</span>`, `<span style="color:...">` render as intended.
  const tokens: string[] = [];
  const stash = (tag: string) => {
    const idx = tokens.length;
    tokens.push(tag);
    return `\u0000TAG${idx}\u0000`;
  };

  let s = line
    .replace(/<\/?(?:u|b|strong|i|em|code|s)>/gi, (m) => stash(m.toLowerCase()))
    .replace(/<span\s+style=(["'])\s*color\s*:\s*#[0-9a-fA-F]{3,8}\s*;?\s*\1\s*>/gi, (m) =>
      stash(m),
    )
    .replace(/<\/span>/gi, (m) => stash(m.toLowerCase()));

  s = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Collapse repeated bold markers (e.g. ******text****** -> <strong>text</strong>)
  s = s.replace(/\*{4,}([^*\n]+?)\*{4,}/g, "<strong>$1</strong>");
  // Inline code: `code`
  s = s.replace(/`([^`\n]+?)`/g, "<code>$1</code>");
  // Bold: **text**
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");
  // Italic: *text* (avoid matching standalone asterisks in math like 4 * 5)
  s = s.replace(/(^|[\s(])\*([^*\s][^*\n]*?)\*(?=[\s.,;:!?)]|$)/g, "$1<em>$2</em>");

  s = s.replace(/\u0000TAG(\d+)\u0000/g, (_, idx) => tokens[Number(idx)] ?? "");
  return s;
}

/**
 * Converts stored Markdown (including mixed inline `<u>`/`<span style="color:...">`
 * formatting from legacy notes) into clean, semantic Rich HTML.
 */
export function markdownToRichHtml(raw: string): string {
  if (!raw || !raw.trim()) return "";
  if (isRichHtmlContent(raw)) return sanitizeNotebookHtml(raw);

  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inList = false;
  let quoteLines: string[] = [];

  const flushList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  const flushQuote = () => {
    if (quoteLines.length > 0) {
      out.push(`<blockquote>${quoteLines.join("<br />")}</blockquote>`);
      quoteLines = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      flushQuote();
      out.push("<p><br /></p>");
      continue;
    }

    // Blockquote lines
    if (trimmed.startsWith(">")) {
      flushList();
      const inner = trimmed.replace(/^>\s?/, "");
      quoteLines.push(escapeHtmlPreservingSafeTags(inner));
      continue;
    } else {
      flushQuote();
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const body = escapeHtmlPreservingSafeTags(headingMatch[2]);
      out.push(`<h${level}>${body}</h${level}>`);
      continue;
    }

    // Task checklist items (- [x] ... or - [ ] ...)
    const taskMatch = trimmed.match(/^[-*]\s+\[(x|X|\s)\]\s+(.*)$/);
    if (taskMatch) {
      if (!inList) {
        out.push('<ul data-checklist="true">');
        inList = true;
      }
      const checked = taskMatch[1].toLowerCase() === "x";
      const body = escapeHtmlPreservingSafeTags(taskMatch[2]);
      out.push(
        `<li class="nb-task"><span data-task-check="${checked ? "true" : "false"}">${checked ? "☑" : "☐"}</span> ${body}</li>`,
      );
      continue;
    }

    // Unordered list items
    const listMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (listMatch) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${escapeHtmlPreservingSafeTags(listMatch[1])}</li>`);
      continue;
    }

    flushList();
    out.push(`<p>${escapeHtmlPreservingSafeTags(line)}</p>`);
  }

  flushList();
  flushQuote();

  return sanitizeNotebookHtml(out.join(""));
}

/**
 * Ensures any note content (Markdown or HTML) is converted to Rich HTML.
 */
export function ensureRichHtml(content: string): string {
  if (!content) return "";
  return isRichHtmlContent(content) ? sanitizeNotebookHtml(content) : markdownToRichHtml(content);
}

/**
 * Strips HTML tags and markdown tokens cleanly for search indexing and list previews.
 */
export function notebookContentToPlainText(content: string): string {
  if (!content) return "";
  return content
    .replace(/<(?:br|\/p|\/h[1-4]|\/li|\/div|\/blockquote)\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[#*`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Converts Rich HTML back into clean readable Markdown (for `.md` exports or source inspection).
 */
export function richHtmlToMarkdown(content: string): string {
  if (!content) return "";
  if (!isRichHtmlContent(content)) return content;

  let md = content
    .replace(/\r\n/g, "\n")
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n")
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n")
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner) => {
      const cleaned = inner.replace(/<br\s*\/?>/gi, "\n").trim();
      return (
        "\n" +
        cleaned
          .split("\n")
          .map((l: string) => `> ${l.trim()}`)
          .join("\n") +
        "\n"
      );
    })
    .replace(/<li[^>]*>\s*<span[^>]*data-task-check="true"[^>]*>[\s\S]*?<\/span>\s*([\s\S]*?)<\/li>/gi, "- [x] $1\n")
    .replace(/<li[^>]*>\s*<span[^>]*data-task-check="false"[^>]*>[\s\S]*?<\/span>\s*([\s\S]*?)<\/li>/gi, "- [ ] $1\n")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n")
    .replace(/<\/?(?:ul|ol)[^>]*>/gi, "\n")
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, "**$1**")
    .replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, "*$1*")
    .replace(/<p[^>]*>\s*<br\s*\/?>\s*<\/p>/gi, "\n")
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "$1\n")
    .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, "$1\n")
    .replace(/<br\s*\/?>/gi, "\n");

  // Unwrap generic inline spans without color, preserve plain text if no color
  md = md.replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, "$1");
  md = md
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return md;
}
