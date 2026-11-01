import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { Node, mergeAttributes } from "@tiptap/core";
import { marked } from "marked";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Lightbulb,
  Quote,
  Minus,
  RotateCcw,
  RotateCw,
  Sparkles,
  Trash2,
  X,
  ChevronDown,
  Check,
  Shield,
  Clock,
  Zap,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Custom Callout Block Node for Tiptap
 */
export const CalloutNode = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return {
      icon: { default: "💡" },
      calloutType: { default: "default" },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-type="callout"]',
        getAttrs: (dom) => {
          const el = dom as HTMLElement;
          return {
            icon: el.getAttribute("data-icon") || "💡",
            calloutType: el.getAttribute("data-callout-type") || "default",
          };
        },
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "callout",
        "data-icon": node.attrs.icon,
        "data-callout-type": node.attrs.calloutType,
        class: `notion-callout notion-callout-${node.attrs.calloutType}`,
      }),
      ["div", { class: "notion-callout-icon", contenteditable: "false" }, node.attrs.icon],
      ["div", { class: "notion-callout-content" }, 0],
    ];
  },
});

/**
 * Normalizes any note content (Markdown, raw HTML spans, legacy text) into clean HTML for Tiptap
 */
export function normalizeNoteContentToHtml(raw: string): string {
  if (!raw || typeof raw !== "string") return "<p></p>";
  const trimmed = raw.trim();
  if (!trimmed) return "<p></p>";

  const hasBlockTags = /<(?:p|h[1-6]|ul|ol|li|div|blockquote|table|pre|hr)\b/i.test(trimmed);

  let html = trimmed;
  if (!hasBlockTags) {
    try {
      html = marked.parse(trimmed, { async: false, breaks: true, gfm: true }) as string;
    } catch {
      html = `<p>${trimmed}</p>`;
    }
  }

  // Convert markdown-style checkbox items into Tiptap task list format
  html = html.replace(/<ul>(\s*<li[^>]*><input[^>]*type=["']checkbox["'][^>]*>[\s\S]*?<\/li>\s*)+<\/ul>/gi, (match) => {
    let converted = match.replace(/<ul>/i, '<ul data-type="taskList">');
    converted = converted.replace(
      /<li[^>]*>\s*<input[^>]*checked[^>]*>\s*([\s\S]*?)<\/li>/gi,
      '<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>$1</p></div></li>'
    );
    converted = converted.replace(
      /<li[^>]*>\s*<input[^>]*>\s*([\s\S]*?)<\/li>/gi,
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>$1</p></div></li>'
    );
    return converted;
  });

  return html;
}

// ICT Template HTML Boilerplates
export const TEMPLATES = {
  premarket: `
<div data-type="callout" data-icon="📋" data-callout-type="blue" class="notion-callout notion-callout-blue">
  <div class="notion-callout-icon" contenteditable="false">📋</div>
  <div class="notion-callout-content">
    <p><strong>Pre-Market Dealing Range Blueprint</strong> — Key HTF bias &amp; level filter</p>
  </div>
</div>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p><strong>Midnight Open (00:00 EST)</strong>: Identify premium vs discount boundaries</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p><strong>HTF Bias</strong>: Bullish / Bearish institutional order flow</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p><strong>Target Liquidity</strong>: Buy-Side (BSL) / Sell-Side (SSL) pool</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p><strong>Economic Calendar</strong>: Flat 10 mins before &amp; after High Impact Red Folder news</p></div></li>
</ul>
<p></p>
`,
  sessionTape: `
<div data-type="callout" data-icon="⏱️" data-callout-type="default" class="notion-callout notion-callout-default">
  <div class="notion-callout-icon" contenteditable="false">⏱️</div>
  <div class="notion-callout-content">
    <p><strong>Session Tape Reading Timeline</strong></p>
  </div>
</div>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p><strong>09:30 AM</strong>: Opening drive &amp; Asian high/low liquidity purge</p></div></li>
  <li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p><strong>09:45 AM</strong>: 5m Market Structure Shift (MSS) with energetic displacement</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p><strong>10:00 AM</strong>: Consequent Encroachment (50% CE) retracement to 5m FVG</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p><strong>10:30 AM</strong>: Target delivery into opposing external range liquidity pool</p></div></li>
</ul>
<p></p>
`,
  confluence: `
<div data-type="callout" data-icon="🛡️" data-callout-type="green" class="notion-callout notion-callout-green">
  <div class="notion-callout-icon" contenteditable="false">🛡️</div>
  <div class="notion-callout-content">
    <p><strong>ICT Rule Confluence Checklist</strong> — Confirm all criteria before execution</p>
  </div>
</div>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>HTF Daily / 4H Dealing Range aligned with setup direction</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Liquidity raid confirmed (Asian or Previous Session High/Low cleared)</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Displacement candle created clean Fair Value Gap (FVG)</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Executing strictly inside Kill Zone (09:30 - 11:00 AM NY AM)</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Strict Risk:Reward minimum 2:1 with defined invalidation level</p></div></li>
</ul>
<p></p>
`,
  psychology: `
<div data-type="callout" data-icon="⚡" data-callout-type="crimson" class="notion-callout notion-callout-crimson">
  <div class="notion-callout-icon" contenteditable="false">⚡</div>
  <div class="notion-callout-content">
    <p><strong>Trader Psychology &amp; Execution Discipline Audit</strong></p>
  </div>
</div>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Mental State: Calm, patient, and detached from dollar outcome</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Did I wait for candle close before confirming entry?</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Risk managed at &le; 1% of account equity</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Zero FOMO / No revenge trading following previous trade</p></div></li>
</ul>
<p></p>
`,
};

interface SlashCommandItem {
  id: string;
  category: "Basic Blocks" | "Lists & Tasks" | "Callouts & Quotes" | "ICT Templates";
  title: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  keywords: string[];
  action: (editor: any) => void;
}

interface NotionEditorProps {
  noteId: string;
  initialContent: string;
  onUpdate: (html: string) => void;
  fontSize?: number;
  onFontSizeChange?: (size: number) => void;
  fontFamily?: string;
  onFontFamilyChange?: (family: string) => void;
  onClearNote?: () => void;
}

export function NotionEditor({
  noteId,
  initialContent,
  onUpdate,
  fontSize = 15,
  onFontSizeChange,
  fontFamily = "font-sans",
  onFontFamilyChange,
  onClearNote,
}: NotionEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 40, left: 32 });
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);

  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const currentNoteIdRef = useRef(noteId);
  const updateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Define slash menu commands
  const slashCommands: SlashCommandItem[] = useMemo(
    () => [
      {
        id: "heading-1",
        category: "Basic Blocks",
        title: "Heading 1",
        description: "Large section headline",
        badge: "#",
        icon: <Heading1 className="size-4 text-white" />,
        keywords: ["h1", "heading1", "title", "header", "big"],
        action: (ed) => ed.chain().focus().setHeading({ level: 1 }).run(),
      },
      {
        id: "heading-2",
        category: "Basic Blocks",
        title: "Heading 2",
        description: "Medium section headline",
        badge: "##",
        icon: <Heading2 className="size-4 text-white" />,
        keywords: ["h2", "heading2", "subtitle", "section"],
        action: (ed) => ed.chain().focus().setHeading({ level: 2 }).run(),
      },
      {
        id: "heading-3",
        category: "Basic Blocks",
        title: "Heading 3",
        description: "Small section headline",
        badge: "###",
        icon: <Heading3 className="size-4 text-white" />,
        keywords: ["h3", "heading3", "subheading"],
        action: (ed) => ed.chain().focus().setHeading({ level: 3 }).run(),
      },
      {
        id: "text",
        category: "Basic Blocks",
        title: "Text",
        description: "Plain text paragraph",
        badge: "p",
        icon: <span className="font-bold text-xs text-white">¶</span>,
        keywords: ["text", "paragraph", "p", "normal"],
        action: (ed) => ed.chain().focus().setParagraph().run(),
      },
      {
        id: "checklist",
        category: "Lists & Tasks",
        title: "To-do Checklist",
        description: "Track tasks with interactive checkboxes",
        badge: "[]",
        icon: <CheckSquare className="size-4 text-[#e50914]" />,
        keywords: ["todo", "checklist", "task", "check", "box"],
        action: (ed) => ed.chain().focus().toggleTaskList().run(),
      },
      {
        id: "bullet-list",
        category: "Lists & Tasks",
        title: "Bulleted List",
        description: "Create a simple bulleted list",
        badge: "-",
        icon: <List className="size-4 text-white" />,
        keywords: ["bullet", "list", "ul", "unordered"],
        action: (ed) => ed.chain().focus().toggleBulletList().run(),
      },
      {
        id: "numbered-list",
        category: "Lists & Tasks",
        title: "Numbered List",
        description: "Create a numbered sequence list",
        badge: "1.",
        icon: <ListOrdered className="size-4 text-white" />,
        keywords: ["number", "ordered", "ol", "list"],
        action: (ed) => ed.chain().focus().toggleOrderedList().run(),
      },
      {
        id: "callout",
        category: "Callouts & Quotes",
        title: "Callout Box",
        description: "Highlighted note container with icon",
        badge: "callout",
        icon: <Lightbulb className="size-4 text-[#f59e0b]" />,
        keywords: ["callout", "box", "highlight", "note", "alert"],
        action: (ed) =>
          ed
            .chain()
            .focus()
            .insertContent(
              '<div data-type="callout" data-icon="💡" data-callout-type="default" class="notion-callout notion-callout-default"><div class="notion-callout-icon" contenteditable="false">💡</div><div class="notion-callout-content"><p>Important trading observation or note...</p></div></div>'
            )
            .run(),
      },
      {
        id: "callout-crimson",
        category: "Callouts & Quotes",
        title: "Crimson Warning Callout",
        description: "High priority risk or psychology warning",
        badge: "warning",
        icon: <Zap className="size-4 text-[#e50914]" />,
        keywords: ["warning", "crimson", "danger", "risk", "red"],
        action: (ed) =>
          ed
            .chain()
            .focus()
            .insertContent(
              '<div data-type="callout" data-icon="⚡" data-callout-type="crimson" class="notion-callout notion-callout-crimson"><div class="notion-callout-icon" contenteditable="false">⚡</div><div class="notion-callout-content"><p><strong>High Risk Warning</strong>: Strict stop loss compliance mandatory.</p></div></div>'
            )
            .run(),
      },
      {
        id: "quote",
        category: "Callouts & Quotes",
        title: "Quote",
        description: "Capture trading rule or quote",
        badge: '"',
        icon: <Quote className="size-4 text-[#a2a2a0]" />,
        keywords: ["quote", "blockquote", "cite"],
        action: (ed) => ed.chain().focus().toggleBlockquote().run(),
      },
      {
        id: "divider",
        category: "Basic Blocks",
        title: "Divider",
        description: "Visual horizontal dividing rule",
        badge: "---",
        icon: <Minus className="size-4 text-white" />,
        keywords: ["divider", "hr", "line", "separator"],
        action: (ed) => ed.chain().focus().setHorizontalRule().run(),
      },
      {
        id: "code-block",
        category: "Basic Blocks",
        title: "Code Block",
        description: "Monospace code or PineScript snippet",
        badge: "</>",
        icon: <Code className="size-4 text-[#3ddc84]" />,
        keywords: ["code", "pinescript", "script", "snippet"],
        action: (ed) => ed.chain().focus().toggleCodeBlock().run(),
      },
      {
        id: "ict-premarket",
        category: "ICT Templates",
        title: "ICT Pre-Market Blueprint",
        description: "Midnight Open, HTF bias, liquidity targets",
        badge: "template",
        icon: <BookOpen className="size-4 text-[#38bdf8]" />,
        keywords: ["premarket", "prep", "ict", "blueprint", "midnight", "bias"],
        action: (ed) => ed.chain().focus().insertContent(TEMPLATES.premarket).run(),
      },
      {
        id: "ict-tape",
        category: "ICT Templates",
        title: "ICT Session Tape Timeline",
        description: "Timestamped session execution & FVG delivery",
        badge: "template",
        icon: <Clock className="size-4 text-[#f59e0b]" />,
        keywords: ["tape", "timeline", "session", "fvg", "mss", "execution"],
        action: (ed) => ed.chain().focus().insertContent(TEMPLATES.sessionTape).run(),
      },
      {
        id: "ict-confluence",
        category: "ICT Templates",
        title: "ICT Rule Confluence Checklist",
        description: "Pre-execution checklist for Killzone & FVG",
        badge: "template",
        icon: <Shield className="size-4 text-[#3ddc84]" />,
        keywords: ["confluence", "rules", "checklist", "killzone", "fvg"],
        action: (ed) => ed.chain().focus().insertContent(TEMPLATES.confluence).run(),
      },
      {
        id: "ict-psychology",
        category: "ICT Templates",
        title: "Trader Psychology & Discipline",
        description: "Audit emotional state, FOMO and compliance",
        badge: "template",
        icon: <Zap className="size-4 text-[#e50914]" />,
        keywords: ["psychology", "discipline", "mindset", "fomo", "audit"],
        action: (ed) => ed.chain().focus().insertContent(TEMPLATES.psychology).run(),
      },
    ],
    []
  );

  // Filter commands by query
  const filteredCommands = useMemo(() => {
    const q = slashQuery.trim().toLowerCase();
    if (!q) return slashCommands;
    return slashCommands.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }, [slashCommands, slashQuery]);

  // Keep selected index in bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [slashQuery]);

  // Execute selected command
  const executeCommand = useCallback(
    (cmd: SlashCommandItem, ed: any) => {
      if (!ed) return;
      // Delete the slash trigger text
      const { from } = ed.state.selection;
      const $from = ed.state.selection.$from;
      const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
      const slashIndex = textBefore.lastIndexOf("/");

      if (slashIndex !== -1) {
        const startPos = $from.start() + slashIndex;
        ed.chain().focus().deleteRange({ from: startPos, to: from }).run();
      }

      // Execute command
      cmd.action(ed);
      setSlashMenuOpen(false);
      setSlashQuery("");
    },
    []
  );

  // Tiptap editor instance
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Type '/' for Notion blocks or ICT templates...",
        emptyEditorClass: "is-editor-empty",
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Underline,
      TextStyle,
      Color,
      CalloutNode,
    ],
    content: normalizeNoteContentToHtml(initialContent),
    immediatelyRender: false,
    editorProps: {
      handleKeyDown: (view, event) => {
        // Intercept navigation inside open slash menu
        if (slashMenuOpen) {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setSelectedIndex((idx) => (filteredCommands.length > 0 ? (idx + 1) % filteredCommands.length : 0));
            return true;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setSelectedIndex((idx) =>
              filteredCommands.length > 0 ? (idx - 1 + filteredCommands.length) % filteredCommands.length : 0
            );
            return true;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            if (filteredCommands.length > 0) {
              executeCommand(filteredCommands[selectedIndex] || filteredCommands[0], editor);
            }
            return true;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setSlashMenuOpen(false);
            setSlashQuery("");
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();

      // Debounce saving note content to avoid re-rendering entire parent on every keystroke
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
      updateTimerRef.current = setTimeout(() => {
        onUpdate(html);
      }, 250);

      // Check if cursor is on a slash command
      const { from } = ed.state.selection;
      const $from = ed.state.selection.$from;
      const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
      const slashIndex = textBefore.lastIndexOf("/");

      if (slashIndex !== -1 && !textBefore.slice(slashIndex).includes(" ")) {
        const query = textBefore.slice(slashIndex + 1);
        setSlashQuery(query);
        setSlashMenuOpen(true);

        // Update menu position near cursor
        try {
          const coords = ed.view.coordsAtPos(from);
          const containerRect = editorContainerRef.current?.getBoundingClientRect();
          if (coords && containerRect) {
            const top = Math.max(coords.bottom - containerRect.top + 8, 24);
            const left = Math.min(Math.max(coords.left - containerRect.left, 16), containerRect.width - 320);
            setMenuPos({ top, left });
          }
        } catch {
          // Fallback to current pos
        }
      } else {
        if (slashMenuOpen) {
          setSlashMenuOpen(false);
          setSlashQuery("");
        }
      }
    },
  });

  // Client-side hydration flag
  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync content when active noteId changes
  useEffect(() => {
    if (!editor) return;
    if (noteId !== currentNoteIdRef.current) {
      currentNoteIdRef.current = noteId;
      const cleanHtml = normalizeNoteContentToHtml(initialContent);
      editor.commands.setContent(cleanHtml, { emitUpdate: false });
      setSlashMenuOpen(false);
    }
  }, [noteId, initialContent, editor]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
    };
  }, []);

  if (!mounted || !editor) {
    return (
      <div className="flex-1 p-6 sm:p-8 min-h-[460px] flex items-center justify-center text-xs text-[#6f6f6d] font-mono">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#e50914] animate-ping" />
          Loading Notion-style editor...
        </span>
      </div>
    );
  }

  return (
    <div className="notion-editor-root flex flex-col flex-1 h-full min-h-0 bg-transparent text-[#f5f5f4]">
      {/* Notion-style Top Action Toolbar */}
      <div className="border-b border-white/[0.08] bg-[#0c0c0e] px-3 sm:px-4 py-1.5 flex items-center gap-1 sm:gap-1.5 text-xs text-[#a2a2a0] shrink-0 overflow-x-auto z-20">
        {/* History: Undo / Redo */}
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-1.5 rounded hover:bg-white/[0.06] hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Undo (Ctrl+Z)"
        >
          <RotateCcw className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-1.5 rounded hover:bg-white/[0.06] hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Redo (Ctrl+Y)"
        >
          <RotateCw className="size-3.5" />
        </button>

        {/* Font Family Selector */}
        {onFontFamilyChange && (
          <select
            value={fontFamily}
            onChange={(e) => onFontFamilyChange(e.target.value)}
            className="bg-[#141417] border border-white/[0.08] text-white text-[11px] rounded px-2 py-1 focus:outline-none"
          >
            <option value="font-sans">IBM Plex Sans</option>
            <option value="font-display">Plus Jakarta Sans</option>
            <option value="font-mono">IBM Plex Mono</option>
          </select>
        )}

        {/* Font Size Selector */}
        {onFontSizeChange && (
          <div className="flex items-center border border-white/[0.08] rounded bg-[#141417] text-[11px] px-1">
            <button
              type="button"
              onClick={() => onFontSizeChange(Math.max(12, fontSize - 1))}
              className="px-1.5 py-0.5 hover:text-white"
              title="Decrease font size"
            >
              -
            </button>
            <span className="font-mono px-1.5 text-white">{fontSize}</span>
            <button
              type="button"
              onClick={() => onFontSizeChange(Math.min(24, fontSize + 1))}
              className="px-1.5 py-0.5 hover:text-white"
              title="Increase font size"
            >
              +
            </button>
          </div>
        )}

        <span className="w-px h-4 bg-white/[0.1] mx-0.5" />

        {/* Headings */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={cn(
            "p-1.5 rounded text-xs font-bold transition-colors",
            editor.isActive("heading", { level: 1 })
              ? "bg-[#e50914]/20 text-[#ff4d5a] border border-[#e50914]/40"
              : "hover:bg-white/[0.06] hover:text-white text-[#a2a2a0]"
          )}
          title="Heading 1"
        >
          H1
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn(
            "p-1.5 rounded text-xs font-bold transition-colors",
            editor.isActive("heading", { level: 2 })
              ? "bg-[#e50914]/20 text-[#ff4d5a] border border-[#e50914]/40"
              : "hover:bg-white/[0.06] hover:text-white text-[#a2a2a0]"
          )}
          title="Heading 2"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={cn(
            "p-1.5 rounded text-xs font-bold transition-colors",
            editor.isActive("heading", { level: 3 })
              ? "bg-[#e50914]/20 text-[#ff4d5a] border border-[#e50914]/40"
              : "hover:bg-white/[0.06] hover:text-white text-[#a2a2a0]"
          )}
          title="Heading 3"
        >
          H3
        </button>

        <span className="w-px h-4 bg-white/[0.1] mx-0.5" />

        {/* Bold, Italic, Underline, Strikethrough, Code */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn(
            "p-1.5 rounded text-xs font-bold transition-colors",
            editor.isActive("bold")
              ? "bg-[#e50914]/20 text-[#ff4d5a] border border-[#e50914]/40"
              : "hover:bg-white/[0.06] hover:text-white text-[#a2a2a0]"
          )}
          title="Bold (Ctrl+B)"
        >
          <Bold className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn(
            "p-1.5 rounded text-xs transition-colors",
            editor.isActive("italic")
              ? "bg-[#e50914]/20 text-[#ff4d5a] border border-[#e50914]/40"
              : "hover:bg-white/[0.06] hover:text-white text-[#a2a2a0]"
          )}
          title="Italic (Ctrl+I)"
        >
          <Italic className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={cn(
            "p-1.5 rounded text-xs transition-colors",
            editor.isActive("underline")
              ? "bg-[#e50914]/20 text-[#ff4d5a] border border-[#e50914]/40"
              : "hover:bg-white/[0.06] hover:text-white text-[#a2a2a0]"
          )}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={cn(
            "p-1.5 rounded text-xs transition-colors",
            editor.isActive("strike")
              ? "bg-[#e50914]/20 text-[#ff4d5a] border border-[#e50914]/40"
              : "hover:bg-white/[0.06] hover:text-white text-[#a2a2a0]"
          )}
          title="Strikethrough"
        >
          <Strikethrough className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={cn(
            "p-1.5 rounded font-mono text-xs transition-colors",
            editor.isActive("code")
              ? "bg-[#e50914]/20 text-[#ff4d5a] border border-[#e50914]/40"
              : "hover:bg-white/[0.06] hover:text-white text-[#a2a2a0]"
          )}
          title="Inline Code"
        >
          <Code className="size-3.5" />
        </button>

        <span className="w-px h-4 bg-white/[0.1] mx-0.5" />

        {/* Task List, Bullet List, Numbered List */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={cn(
            "p-1.5 rounded text-xs transition-colors",
            editor.isActive("taskList")
              ? "bg-[#e50914]/20 text-[#ff4d5a] border border-[#e50914]/40"
              : "hover:bg-white/[0.06] hover:text-white text-[#a2a2a0]"
          )}
          title="Checklist / To-do"
        >
          <CheckSquare className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(
            "p-1.5 rounded text-xs transition-colors",
            editor.isActive("bulletList")
              ? "bg-[#e50914]/20 text-[#ff4d5a] border border-[#e50914]/40"
              : "hover:bg-white/[0.06] hover:text-white text-[#a2a2a0]"
          )}
          title="Bullet List"
        >
          <List className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn(
            "p-1.5 rounded text-xs transition-colors",
            editor.isActive("orderedList")
              ? "bg-[#e50914]/20 text-[#ff4d5a] border border-[#e50914]/40"
              : "hover:bg-white/[0.06] hover:text-white text-[#a2a2a0]"
          )}
          title="Numbered List"
        >
          <ListOrdered className="size-3.5" />
        </button>

        <span className="w-px h-4 bg-white/[0.1] mx-0.5" />

        {/* Callout Box button */}
        <button
          type="button"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent(
                '<div data-type="callout" data-icon="💡" data-callout-type="default" class="notion-callout notion-callout-default"><div class="notion-callout-icon" contenteditable="false">💡</div><div class="notion-callout-content"><p>Important trading observation or note...</p></div></div>'
              )
              .run()
          }
          className="p-1.5 rounded hover:bg-white/[0.06] hover:text-[#f59e0b] text-[#a2a2a0] transition-colors"
          title="Insert Callout Box"
        >
          <Lightbulb className="size-3.5" />
        </button>

        {/* Quote & Divider */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={cn(
            "p-1.5 rounded text-xs transition-colors",
            editor.isActive("blockquote")
              ? "bg-[#e50914]/20 text-[#ff4d5a] border border-[#e50914]/40"
              : "hover:bg-white/[0.06] hover:text-white text-[#a2a2a0]"
          )}
          title="Blockquote"
        >
          <Quote className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="p-1.5 rounded hover:bg-white/[0.06] hover:text-white text-[#a2a2a0] transition-colors"
          title="Divider Line"
        >
          <Minus className="size-3.5" />
        </button>

        <span className="w-px h-4 bg-white/[0.1] mx-0.5" />

        {/* Color Highlight Picker */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setColorPickerOpen((v) => !v)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-white border border-white/[0.08]"
            title="Text Color Highlight"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#e50914]" />
            <span className="text-[11px]">Color</span>
            <ChevronDown className="size-3 text-[#a2a2a0]" />
          </button>

          {colorPickerOpen && (
            <div className="absolute left-0 mt-1.5 w-44 bg-[#141417] border border-white/[0.12] rounded-lg shadow-2xl p-1.5 z-50 text-xs">
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().unsetColor().run();
                  setColorPickerOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.08] text-left text-white"
              >
                <span className="w-3 h-3 rounded-full border border-white/40 bg-transparent" />
                <span>Default Text</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().setColor("#e50914").run();
                  setColorPickerOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.08] text-left text-[#ff4d5a]"
              >
                <span className="w-3 h-3 rounded-full bg-[#e50914]" />
                <span>Crimson (ICT Bearish)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().setColor("#3ddc84").run();
                  setColorPickerOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.08] text-left text-[#3ddc84]"
              >
                <span className="w-3 h-3 rounded-full bg-[#3ddc84]" />
                <span>Profit Green (Bullish)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().setColor("#f59e0b").run();
                  setColorPickerOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.08] text-left text-[#f59e0b]"
              >
                <span className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                <span>Gold Amber (Liquidity)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().setColor("#38bdf8").run();
                  setColorPickerOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.08] text-left text-[#38bdf8]"
              >
                <span className="w-3 h-3 rounded-full bg-[#38bdf8]" />
                <span>Ice Blue (FVG / Breaker)</span>
              </button>
            </div>
          )}
        </div>

        {/* Quick Insert ICT Template Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setTemplateMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#e50914]/15 hover:bg-[#e50914]/25 text-white border border-[#e50914]/30 text-xs font-semibold"
          >
            <Sparkles className="size-3 text-[#e50914]" />
            <span className="text-[11px]">ICT Templates</span>
            <ChevronDown className="size-3 text-white/70" />
          </button>

          {templateMenuOpen && (
            <div className="absolute left-0 mt-1.5 w-64 bg-[#141417] border border-white/[0.12] rounded-lg shadow-2xl p-1 z-50 text-xs">
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().insertContent(TEMPLATES.premarket).run();
                  setTemplateMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded hover:bg-white/[0.08] text-left text-white"
              >
                <BookOpen className="size-3.5 text-[#38bdf8] shrink-0" />
                <div>
                  <p className="font-medium text-white leading-tight">Pre-Market Blueprint</p>
                  <p className="text-[10px] text-[#a2a2a0]">Midnight Open, HTF bias, news filter</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().insertContent(TEMPLATES.sessionTape).run();
                  setTemplateMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded hover:bg-white/[0.08] text-left text-white"
              >
                <Clock className="size-3.5 text-[#f59e0b] shrink-0" />
                <div>
                  <p className="font-medium text-white leading-tight">Session Tape Reading</p>
                  <p className="text-[10px] text-[#a2a2a0]">Opening drive, 5m MSS, FVG CE</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().insertContent(TEMPLATES.confluence).run();
                  setTemplateMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded hover:bg-white/[0.08] text-left text-white"
              >
                <Shield className="size-3.5 text-[#3ddc84] shrink-0" />
                <div>
                  <p className="font-medium text-white leading-tight">Rule Confluence Checklist</p>
                  <p className="text-[10px] text-[#a2a2a0]">Killzone &amp; risk criteria check</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().insertContent(TEMPLATES.psychology).run();
                  setTemplateMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded hover:bg-white/[0.08] text-left text-white"
              >
                <Zap className="size-3.5 text-[#e50914] shrink-0" />
                <div>
                  <p className="font-medium text-white leading-tight">Psychology Audit</p>
                  <p className="text-[10px] text-[#a2a2a0]">Emotional discipline &amp; compliance</p>
                </div>
              </button>
            </div>
          )}
        </div>

        <span className="flex-1" />

        {/* Keyboard hint */}
        <div className="text-[11px] text-[#6f6f6d] hidden xl:flex items-center gap-1 font-mono">
          <span>type</span>
          <kbd className="px-1.5 py-0.5 rounded bg-[#17171b] border border-white/[0.1] text-white text-[10px]">
            /
          </kbd>
          <span>for slash menu</span>
        </div>

        {/* Clear note */}
        {onClearNote && (
          <button
            type="button"
            onClick={onClearNote}
            className="p-1.5 rounded hover:bg-[#ff6b7d]/20 hover:text-[#ff6b7d] ml-1 text-[#a2a2a0]"
            title="Clear Note Body"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      {/* Editor Body with Floating Slash Command Popover */}
      <div ref={editorContainerRef} className="relative flex-1 p-6 sm:p-8 min-h-[460px] overflow-y-auto">
        {/* Floating Slash Commands Menu */}
        {slashMenuOpen && (
          <div
            style={{
              top: `${menuPos.top}px`,
              left: `${menuPos.left}px`,
            }}
            className="absolute z-50 w-76 sm:w-80 bg-[#121215] border border-white/[0.14] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] overflow-hidden text-xs animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="p-2 border-b border-white/[0.08] bg-[#0c0c0e] text-[10px] uppercase font-semibold text-[#a2a2a0] tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="text-[#e50914]">/</span> Insert Notion Block or ICT Template
              </span>
              <button
                type="button"
                onClick={() => setSlashMenuOpen(false)}
                className="text-[#6f6f6d] hover:text-white"
              >
                <X className="size-3" />
              </button>
            </div>

            <div className="p-1 max-h-72 overflow-y-auto space-y-0.5">
              {filteredCommands.length === 0 ? (
                <div className="p-4 text-center text-[#6f6f6d] text-xs">
                  <p>No matching commands for "{slashQuery}"</p>
                </div>
              ) : (
                filteredCommands.map((cmd, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={cmd.id}
                      type="button"
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => executeCommand(cmd, editor)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer",
                        isSelected
                          ? "bg-[#e50914]/15 border border-[#e50914]/30 text-white"
                          : "hover:bg-white/[0.05] text-[#e8e8e6] border border-transparent"
                      )}
                    >
                      <div className="w-6 h-6 rounded bg-white/[0.06] flex items-center justify-center shrink-0">
                        {cmd.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-medium text-white leading-tight truncate">{cmd.title}</p>
                          {cmd.badge && (
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-white/[0.06] text-[#a2a2a0]">
                              {cmd.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#a2a2a0] truncate">{cmd.description}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            <div className="p-1.5 bg-[#0a0a0c] border-t border-white/[0.06] text-[10px] text-[#6f6f6d] flex items-center justify-between px-3">
              <span>↑ ↓ to navigate</span>
              <span>↵ to select</span>
              <span>esc to cancel</span>
            </div>
          </div>
        )}

        {/* The Tiptap Content Editable Canvas */}
        <div style={{ fontSize: `${fontSize}px` }} className={cn("w-full h-full min-h-[440px]", fontFamily)}>
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
