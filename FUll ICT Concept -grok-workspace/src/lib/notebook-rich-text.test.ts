import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ensureRichHtml,
  markdownToRichHtml,
  notebookContentToPlainText,
  richHtmlToMarkdown,
  sanitizeNotebookHtml,
} from "./notebook-rich-text.ts";

describe("Notebook Rich Text Conversion & Sanitization", () => {
  it("converts Journal-synced Markdown cleanly into formatted headings, bold, code pills, and lists without raw asterisks", () => {
    const sample = [
      "## Wed, Nov 11, 2026 — Journal Synced Tape",
      "**Net P&L:** +$115.25 · **Trades:** 1 (1W / 0L)",
      "",
      "### Linked Journal Executions",
      "#### 06:00 AM ET · **XAUUSD SHORT** (WIN · +$115.25)",
      "- **Execution**: Entry `4049` → Exit `4010` · Lots `0.03`",
      "- **Next Session Focus**: ******text******",
    ].join("\n");

    const html = markdownToRichHtml(sample);
    assert.ok(html.includes("<h2>Wed, Nov 11, 2026 — Journal Synced Tape</h2>"));
    assert.ok(html.includes("<strong>Net P&amp;L:</strong>"));
    assert.ok(html.includes("<h3>Linked Journal Executions</h3>"));
    assert.ok(html.includes("<h4>06:00 AM ET · <strong>XAUUSD SHORT</strong>"));
    assert.ok(html.includes("<code>4049</code>"));
    assert.ok(html.includes("<strong>text</strong>"), "Collapsed broken ******text****** markers");
    assert.ok(!html.includes("**"), "No literal ** markers remain");
    assert.ok(!html.includes("##"), "No literal ## heading syntax remains");
  });

  it("preserves safe inline color spans and underlines while sanitizing dangerous scripts", () => {
    const mixed =
      'Bias: <span style="color:#e50914">Bearish</span> & <u>confirmed</u> <script>alert(1)</script><img src=x onerror="evil()">';
    const html = markdownToRichHtml(mixed);
    assert.ok(html.includes('<span style="color:#e50914">Bearish</span>'));
    assert.ok(html.includes("<u>confirmed</u>"));
    assert.ok(!html.includes("<script"));
    assert.ok(!html.includes("onerror"));
  });

  it("round-trips plain text and markdown export cleanly", () => {
    const html = ensureRichHtml("## Daily Plan\n- [x] Liquidity swept\n- **Trigger**: `5m MSS`");
    const plain = notebookContentToPlainText(html);
    assert.ok(plain.includes("Daily Plan"));
    assert.ok(plain.includes("Liquidity swept"));
    assert.ok(!plain.includes("<h2>"));

    const md = richHtmlToMarkdown(html);
    assert.ok(md.includes("## Daily Plan"));
    assert.ok(md.includes("- [x] Liquidity swept"));
    assert.ok(md.includes("**Trigger**"));
    assert.ok(md.includes("`5m MSS`"));
  });

  it("sanitizes javascript URLs and unsafe attributes", () => {
    const cleaned = sanitizeNotebookHtml('<p onclick="x()">Safe</p><a href="javascript:alert(1)">bad</a>');
    assert.ok(!cleaned.includes("onclick"));
    assert.ok(!cleaned.includes("javascript:"));
  });
});
