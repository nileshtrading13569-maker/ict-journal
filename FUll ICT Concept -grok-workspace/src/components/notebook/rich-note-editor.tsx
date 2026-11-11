import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  List,
  Mic,
  MicOff,
  RotateCcw,
  RotateCw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ensureRichHtml,
  markdownToRichHtml,
  richHtmlToMarkdown,
  sanitizeNotebookHtml,
} from "@/lib/notebook-rich-text";

export type TemplateSnippetType = "prep" | "tape" | "confluence" | "psych";

export interface RichNoteEditorHandle {
  insertMarkdownBlock: (markdown: string) => void;
  focus: () => void;
}

interface RichNoteEditorProps {
  noteId: string;
  value: string;
  fontSize: number;
  fontFamily: string;
  onFontSizeChange: (nextSize: number) => void;
  onFontFamilyChange: (nextFamily: string) => void;
  onChange: (nextValue: string) => void;
  onBlurFlush?: () => void;
}

const TEMPLATE_SNIPPETS: Record<TemplateSnippetType, string> = {
  prep: `### 📋 Pre-Market Dealing Range Blueprint\n- **Midnight Open (00:00 EST)**: \n- **HTF Bias**: Bullish / Bearish continuation\n- **Target Liquidity**: BSL / SSL\n- **Red Folder News**: Flat before 10:00 AM`,
  tape: `### ⏱️ Session Tape Reading\n- **09:30**: Opening drive & Asian high/low liquidity check\n- **09:45**: 5m MSS with Displacement candle\n- **10:00**: Consequent Encroachment retracement to FVG\n- **10:30**: Delivery to external liquidity pool`,
  confluence: `> **🛡️ ICT Confluence Checklist**\n- [x] HTF Dealing range alignment\n- [x] Liquidity raid confirmed before entry\n- [x] Displacement created clean FVG / Breaker\n- [x] Executed within session Kill Zone`,
  psych: `> **⚡ Trader Psychology & Discipline Audit**\n> - State of mind: Calm / Focused\n> - Did I wait for candle close? Yes / No\n> - Rule compliance: 100%`,
};

export const RichNoteEditor = forwardRef<RichNoteEditorHandle, RichNoteEditorProps>(
  function RichNoteEditor(
    {
      noteId,
      value,
      fontSize,
      fontFamily,
      onFontSizeChange,
      onFontFamilyChange,
      onChange,
      onBlurFlush,
    },
    ref,
  ) {
    const editorRef = useRef<HTMLDivElement | null>(null);
    const rawTextareaRef = useRef<HTMLTextAreaElement | null>(null);
    const lastLoadedNoteIdRef = useRef<string>("");
    const lastEmittedHtmlRef = useRef<string>("");
    const historyRef = useRef<string[]>([]);
    const historyIndexRef = useRef<number>(-1);
    const recognitionRef = useRef<any>(null);

    const [mode, setMode] = useState<"rich" | "markdown">("rich");
    const [slashMenuOpen, setSlashMenuOpen] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [activeFormats, setActiveFormats] = useState({
      bold: false,
      italic: false,
      underline: false,
      list: false,
      code: false,
      red: false,
      green: false,
    });
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    const pushHistory = useCallback((snapshotHtml: string) => {
      const stack = historyRef.current;
      const idx = historyIndexRef.current;
      if (idx >= 0 && stack[idx] === snapshotHtml) return;
      const trimmed = stack.slice(0, idx + 1);
      trimmed.push(snapshotHtml);
      if (trimmed.length > 60) trimmed.shift();
      historyRef.current = trimmed;
      historyIndexRef.current = trimmed.length - 1;
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(false);
    }, []);

    const syncDomContent = useCallback(
      (html: string, resetHistory = false) => {
        const clean = sanitizeNotebookHtml(html);
        if (editorRef.current) {
          editorRef.current.innerHTML = clean;
        }
        lastEmittedHtmlRef.current = clean;
        if (resetHistory) {
          historyRef.current = [clean];
          historyIndexRef.current = 0;
          setCanUndo(false);
          setCanRedo(false);
        }
      },
      [],
    );

    // Sync initial content & external updates without disrupting user cursor
    useEffect(() => {
      if (mode !== "rich") return;
      const normalizedHtml = ensureRichHtml(value);
      const isNewNote = lastLoadedNoteIdRef.current !== noteId;
      const isExternalChange =
        normalizedHtml !== lastEmittedHtmlRef.current &&
        value !== lastEmittedHtmlRef.current;

      if (isNewNote) {
        lastLoadedNoteIdRef.current = noteId;
        syncDomContent(normalizedHtml, true);
      } else if (isExternalChange) {
        syncDomContent(normalizedHtml, false);
        pushHistory(normalizedHtml);
      }
    }, [noteId, value, mode, syncDomContent, pushHistory]);

    // Clean up speech recognition on unmount
    useEffect(() => {
      return () => {
        try {
          recognitionRef.current?.stop?.();
        } catch {}
      };
    }, []);

    const emitFromDom = useCallback(() => {
      const el = editorRef.current;
      if (!el) return;
      const clean = sanitizeNotebookHtml(el.innerHTML);
      if (clean === lastEmittedHtmlRef.current) return;
      lastEmittedHtmlRef.current = clean;
      pushHistory(clean);
      onChange(clean);
    }, [onChange, pushHistory]);

    const updateActiveFormats = useCallback(() => {
      if (mode !== "rich" || typeof document === "undefined") return;
      const el = editorRef.current;
      const sel = window.getSelection();
      if (!el || !sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) {
        return;
      }

      let inCode = false;
      let inRed = false;
      let inGreen = false;
      let node: Node | null = sel.anchorNode;
      while (node && node !== el) {
        if (node instanceof HTMLElement) {
          const tag = node.tagName.toLowerCase();
          if (tag === "code") inCode = true;
          const color = node.style?.color || node.getAttribute("color") || "";
          if (color.includes("229, 9, 20") || color.toLowerCase() === "#e50914") {
            inRed = true;
          }
          if (color.includes("61, 220, 132") || color.toLowerCase() === "#3ddc84") {
            inGreen = true;
          }
        }
        node = node.parentNode;
      }

      try {
        setActiveFormats({
          bold: document.queryCommandState("bold"),
          italic: document.queryCommandState("italic"),
          underline: document.queryCommandState("underline"),
          list: document.queryCommandState("insertUnorderedList"),
          code: inCode,
          red: inRed,
          green: inGreen,
        });
      } catch {
        // Ignore queryCommandState exceptions in edge browsers
      }
    }, [mode]);

    const runRichCommand = (command: string, val?: string) => {
      const el = editorRef.current;
      if (!el || mode !== "rich") return;
      el.focus();
      try {
        document.execCommand("styleWithCSS", false, "true");
      } catch {}
      document.execCommand(command, false, val);
      emitFromDom();
      updateActiveFormats();
    };

    const toggleColorHighlight = (hexColor: "#e50914" | "#3ddc84") => {
      const el = editorRef.current;
      if (!el) return;
      if (mode === "markdown") {
        toast.info("Switch to Rich mode to apply color highlights cleanly");
        return;
      }
      el.focus();
      const isAlreadyActive =
        (hexColor === "#e50914" && activeFormats.red) ||
        (hexColor === "#3ddc84" && activeFormats.green);
      try {
        document.execCommand("styleWithCSS", false, "true");
      } catch {}
      document.execCommand("foreColor", false, isAlreadyActive ? "#e8e8e6" : hexColor);
      emitFromDom();
      updateActiveFormats();
    };

    const toggleInlineCode = () => {
      const el = editorRef.current;
      if (!el || mode !== "rich") return;
      el.focus();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);

      // Check if selection is already inside a <code> tag
      let ancestor: Node | null = range.commonAncestorContainer;
      let existingCode: HTMLElement | null = null;
      while (ancestor && ancestor !== el) {
        if (ancestor instanceof HTMLElement && ancestor.tagName.toLowerCase() === "code") {
          existingCode = ancestor;
          break;
        }
        ancestor = ancestor.parentNode;
      }

      if (existingCode) {
        const textNode = document.createTextNode(existingCode.textContent || "");
        existingCode.parentNode?.replaceChild(textNode, existingCode);
        const newRange = document.createRange();
        newRange.selectNodeContents(textNode);
        sel.removeAllRanges();
        sel.addRange(newRange);
      } else if (!range.collapsed) {
        const codeEl = document.createElement("code");
        codeEl.textContent = range.toString();
        range.deleteContents();
        range.insertNode(codeEl);
        const space = document.createTextNode("\u00A0");
        codeEl.after(space);
        const newRange = document.createRange();
        newRange.setStartAfter(space);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
      } else {
        const codeEl = document.createElement("code");
        codeEl.textContent = "level";
        range.insertNode(codeEl);
        const newRange = document.createRange();
        newRange.selectNodeContents(codeEl);
        sel.removeAllRanges();
        sel.addRange(newRange);
      }

      emitFromDom();
      updateActiveFormats();
    };

    const toggleHeadingBlock = (tag: "h2" | "p") => {
      const el = editorRef.current;
      if (!el || mode !== "rich") return;
      el.focus();
      document.execCommand("formatBlock", false, tag === "h2" ? "<H2>" : "<P>");
      emitFromDom();
      updateActiveFormats();
    };

    const insertHtmlAtCursor = useCallback(
      (htmlFragment: string, removeLeadingSlash = false) => {
        const el = editorRef.current;
        if (!el) return;
        el.focus();
        const sel = window.getSelection();

        if (removeLeadingSlash && sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          if (range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset > 0) {
            const txt = range.startContainer.textContent || "";
            if (txt[range.startOffset - 1] === "/") {
              const delRange = document.createRange();
              delRange.setStart(range.startContainer, range.startOffset - 1);
              delRange.setEnd(range.startContainer, range.startOffset);
              delRange.deleteContents();
            }
          }
        }

        const safeHtml = sanitizeNotebookHtml(htmlFragment);
        if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
          document.execCommand("insertHTML", false, safeHtml);
        } else {
          el.innerHTML = `${el.innerHTML}${safeHtml}`;
        }
        emitFromDom();
      },
      [emitFromDom],
    );

    const insertMarkdownBlock = useCallback(
      (markdown: string) => {
        if (mode === "markdown") {
          const curMd = richHtmlToMarkdown(value);
          const next = `${curMd.trimEnd()}\n\n${markdown}`;
          onChange(ensureRichHtml(next));
          return;
        }
        const html = markdownToRichHtml(markdown);
        insertHtmlAtCursor(html, slashMenuOpen);
      },
      [mode, value, onChange, insertHtmlAtCursor, slashMenuOpen],
    );

    useImperativeHandle(
      ref,
      () => ({
        insertMarkdownBlock,
        focus: () => {
          if (mode === "rich") editorRef.current?.focus();
          else rawTextareaRef.current?.focus();
        },
      }),
      [insertMarkdownBlock, mode],
    );

    const handleUndo = () => {
      if (mode !== "rich") return;
      if (historyIndexRef.current > 0) {
        historyIndexRef.current -= 1;
        const snapshot = historyRef.current[historyIndexRef.current];
        if (editorRef.current) {
          editorRef.current.innerHTML = snapshot;
        }
        lastEmittedHtmlRef.current = snapshot;
        onChange(snapshot);
        setCanUndo(historyIndexRef.current > 0);
        setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
      }
    };

    const handleRedo = () => {
      if (mode !== "rich") return;
      if (historyIndexRef.current < historyRef.current.length - 1) {
        historyIndexRef.current += 1;
        const snapshot = historyRef.current[historyIndexRef.current];
        if (editorRef.current) {
          editorRef.current.innerHTML = snapshot;
        }
        lastEmittedHtmlRef.current = snapshot;
        onChange(snapshot);
        setCanUndo(historyIndexRef.current > 0);
        setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
      }
    };

    const toggleVoiceDictation = () => {
      if (isListening) {
        try {
          recognitionRef.current?.stop?.();
        } catch {}
        setIsListening(false);
        return;
      }

      const SpeechRec =
        typeof window !== "undefined"
          ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
          : null;

      if (!SpeechRec) {
        toast.info("Voice dictation requires Chrome / Edge Web Speech support.");
        return;
      }

      try {
        const recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onresult = (event: any) => {
          let transcript = "";
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            if (event.results[i].isFinal) {
              transcript += event.results[i][0].transcript + " ";
            }
          }
          if (transcript.trim()) {
            if (mode === "rich") {
              insertHtmlAtCursor(`<p>${transcript.trim()}</p>`);
            } else {
              const md = `${richHtmlToMarkdown(value)}\n${transcript.trim()}`;
              onChange(ensureRichHtml(md));
            }
          }
        };

        recognition.onerror = () => {
          setIsListening(false);
          toast.error("Voice dictation interrupted — check microphone permission.");
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
        toast.success("Listening... speak your trade notes");
      } catch {
        setIsListening(false);
        toast.error("Could not start microphone dictation.");
      }
    };

    const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
      updateActiveFormats();
      const target = e.target as HTMLElement | null;
      const checkEl = target?.closest("[data-task-check]") as HTMLElement | null;
      if (checkEl) {
        e.preventDefault();
        const isChecked = checkEl.getAttribute("data-task-check") === "true";
        checkEl.setAttribute("data-task-check", isChecked ? "false" : "true");
        checkEl.textContent = isChecked ? "☐" : "☑";
        emitFromDom();
      }
    };

    const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
        return;
      }
      if (e.key === "/" && !slashMenuOpen) {
        setSlashMenuOpen(true);
      } else if (e.key === "Escape" && slashMenuOpen) {
        setSlashMenuOpen(false);
      }
    };

    const handleClearContent = () => {
      if (window.confirm("Clear all text from this note?")) {
        if (mode === "rich" && editorRef.current) {
          editorRef.current.innerHTML = "<p><br /></p>";
          emitFromDom();
        } else {
          onChange("");
        }
      }
    };

    const markdownPreviewValue = richHtmlToMarkdown(value);

    return (
      <div className="flex flex-col flex-1 min-h-0">
        {/* Rich Formatting Toolbar */}
        <div className="border-b border-white/[0.07] bg-[#0c0c0e] px-3 sm:px-4 py-2 flex flex-wrap items-center gap-1 sticky top-0 z-20 text-[#a2a2a0]">
          {/* Real Undo / Redo */}
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo || mode !== "rich"}
            className="p-1.5 rounded hover:bg-white/[0.06] hover:text-white disabled:opacity-30 disabled:pointer-events-none"
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <RotateCcw className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={!canRedo || mode !== "rich"}
            className="p-1.5 rounded hover:bg-white/[0.06] hover:text-white disabled:opacity-30 disabled:pointer-events-none"
            title="Redo (Ctrl+Y)"
            aria-label="Redo"
          >
            <RotateCw className="size-3.5" />
          </button>

          {/* Working Web Speech Voice Dictation */}
          <button
            type="button"
            onClick={toggleVoiceDictation}
            className={cn(
              "p-1.5 rounded transition-colors flex items-center gap-1",
              isListening
                ? "bg-[#e50914]/20 text-[#e50914] animate-pulse"
                : "hover:bg-white/[0.06] hover:text-[#e50914]",
            )}
            title={isListening ? "Stop dictation" : "Dictate trade note via microphone"}
            aria-label="Voice dictation"
          >
            {isListening ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
          </button>

          <span className="w-px h-4 bg-white/[0.1] mx-1" />

          {/* Font Family Selector */}
          <select
            value={fontFamily}
            onChange={(e) => onFontFamilyChange(e.target.value)}
            aria-label="Font family"
            className="bg-[#121215] border border-white/[0.08] text-white text-[11px] rounded px-2 py-1 focus:outline-none"
          >
            <option value="font-sans">IBM Plex Sans</option>
            <option value="font-display">Plus Jakarta Sans</option>
            <option value="font-mono">IBM Plex Mono</option>
          </select>

          {/* Font Size Selector */}
          <div className="flex items-center border border-white/[0.08] rounded bg-[#121215] text-[11px] px-1">
            <button
              type="button"
              onClick={() => onFontSizeChange(Math.max(12, fontSize - 1))}
              aria-label="Decrease font size"
              className="px-1.5 py-0.5 hover:text-white"
            >
              -
            </button>
            <span className="font-mono px-1.5 text-white">{fontSize}</span>
            <button
              type="button"
              onClick={() => onFontSizeChange(Math.min(24, fontSize + 1))}
              aria-label="Increase font size"
              className="px-1.5 py-0.5 hover:text-white"
            >
              +
            </button>
          </div>

          <span className="w-px h-4 bg-white/[0.1] mx-1" />

          {/* Real WYSIWYG Formatting Buttons */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runRichCommand("bold")}
            disabled={mode !== "rich"}
            className={cn(
              "px-2 py-1 rounded font-bold text-xs transition-colors disabled:opacity-35",
              activeFormats.bold
                ? "bg-white/15 text-white"
                : "hover:bg-white/[0.06] hover:text-white",
            )}
            title="Bold (Ctrl+B)"
            aria-label="Bold text"
          >
            B
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runRichCommand("italic")}
            disabled={mode !== "rich"}
            className={cn(
              "px-2 py-1 rounded italic text-xs transition-colors disabled:opacity-35",
              activeFormats.italic
                ? "bg-white/15 text-white"
                : "hover:bg-white/[0.06] hover:text-white",
            )}
            title="Italic (Ctrl+I)"
            aria-label="Italic text"
          >
            I
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runRichCommand("underline")}
            disabled={mode !== "rich"}
            className={cn(
              "px-2 py-1 rounded underline text-xs transition-colors disabled:opacity-35",
              activeFormats.underline
                ? "bg-white/15 text-white"
                : "hover:bg-white/[0.06] hover:text-white",
            )}
            title="Underline (Ctrl+U)"
            aria-label="Underline text"
          >
            U
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={toggleInlineCode}
            disabled={mode !== "rich"}
            className={cn(
              "px-1.5 py-1 rounded font-mono text-xs transition-colors disabled:opacity-35",
              activeFormats.code
                ? "bg-white/15 text-white"
                : "hover:bg-white/[0.06] hover:text-white",
            )}
            title="Inline Code / Price Level"
            aria-label="Code pill"
          >
            &lt;&gt;
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleHeadingBlock("h2")}
            disabled={mode !== "rich"}
            className="px-1.5 py-1 rounded text-[11px] font-bold hover:bg-white/[0.06] hover:text-white disabled:opacity-35"
            title="Section Heading"
            aria-label="Heading"
          >
            H2
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runRichCommand("insertUnorderedList")}
            disabled={mode !== "rich"}
            className={cn(
              "p-1.5 rounded transition-colors disabled:opacity-35",
              activeFormats.list
                ? "bg-white/15 text-white"
                : "hover:bg-white/[0.06] hover:text-white",
            )}
            title="Bullet List"
            aria-label="Bullet list"
          >
            <List className="size-3.5" />
          </button>

          <span className="w-px h-4 bg-white/[0.1] mx-1" />

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleColorHighlight("#e50914")}
            disabled={mode !== "rich"}
            className={cn(
              "px-2 py-1 rounded font-bold text-xs transition-colors disabled:opacity-35",
              activeFormats.red
                ? "bg-[#e50914]/25 text-[#e50914]"
                : "text-[#e50914]/85 hover:bg-white/[0.06] hover:text-[#e50914]",
            )}
            title="Crimson Text Color"
            aria-label="Crimson highlight"
          >
            A
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleColorHighlight("#3ddc84")}
            disabled={mode !== "rich"}
            className={cn(
              "px-2 py-1 rounded font-bold text-xs transition-colors disabled:opacity-35",
              activeFormats.green
                ? "bg-[#3ddc84]/25 text-[#3ddc84]"
                : "text-[#3ddc84]/85 hover:bg-white/[0.06] hover:text-[#3ddc84]",
            )}
            title="Profit Green Text Color"
            aria-label="Green highlight"
          >
            A
          </button>

          <span className="flex-1" />

          <div className="flex items-center rounded border border-white/[0.08] bg-[#121215] p-0.5 text-[10px] font-mono">
            <button
              type="button"
              onClick={() => setMode("rich")}
              className={cn(
                "rounded px-1.5 py-0.5 transition-colors",
                mode === "rich" ? "bg-white/15 text-white font-semibold" : "text-[#a1a1aa] hover:text-white",
              )}
            >
              Rich
            </button>
            <button
              type="button"
              onClick={() => setMode("markdown")}
              className={cn(
                "rounded px-1.5 py-0.5 transition-colors",
                mode === "markdown" ? "bg-white/15 text-white font-semibold" : "text-[#a1a1aa] hover:text-white",
              )}
            >
              MD
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSlashMenuOpen((v) => !v)}
            className="hidden md:inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[#a1a1aa] hover:bg-white/[0.06] hover:text-white font-mono ml-1"
            title="Open ICT block templates menu"
          >
            <span>press</span>
            <kbd className="px-1.5 py-0.5 rounded bg-[#17171b] border border-white/[0.1] text-white text-[10px]">
              /
            </kbd>
            <span>for blocks</span>
          </button>

          <button
            type="button"
            onClick={handleClearContent}
            className="p-1.5 rounded hover:bg-[#ff6b7d]/20 hover:text-[#ff6b7d] ml-0.5"
            title="Clear content"
            aria-label="Clear content"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>

        {/* Editor Surface */}
        <div className="relative flex-1 p-5 sm:p-8 min-h-[380px]">
          {slashMenuOpen && (
            <div className="absolute top-3 left-6 z-50 w-72 bg-[#121215] border border-white/[0.14] rounded-xl shadow-2xl overflow-hidden text-xs">
              <div className="p-2 border-b border-white/[0.08] bg-[#0c0c0e] text-[10px] uppercase font-semibold text-[#a1a1aa] tracking-wider flex items-center justify-between">
                <span>Insert ICT Block / Format</span>
                <button
                  type="button"
                  onClick={() => setSlashMenuOpen(false)}
                  aria-label="Close slash commands menu"
                  className="text-[#a1a1aa] hover:text-white"
                >
                  <X className="size-3" />
                </button>
              </div>
              <div className="p-1 max-h-60 overflow-y-auto space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    insertMarkdownBlock("## Main Section Heading");
                    setSlashMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#e50914]/15 hover:text-white flex items-center gap-2.5"
                >
                  <span className="w-6 h-6 rounded bg-white/[0.05] flex items-center justify-center font-bold text-xs text-white">
                    H2
                  </span>
                  <div>
                    <p className="font-medium text-white leading-tight">Section Heading</p>
                    <p className="text-[10px] text-[#a1a1aa]">Big structured headline</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    insertMarkdownBlock(TEMPLATE_SNIPPETS.confluence);
                    setSlashMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#e50914]/15 hover:text-white flex items-center gap-2.5"
                >
                  <span className="w-6 h-6 rounded bg-[#3ddc84]/10 text-[#3ddc84] flex items-center justify-center text-xs">
                    ✓
                  </span>
                  <div>
                    <p className="font-medium text-white leading-tight">ICT Rule Confluence Check</p>
                    <p className="text-[10px] text-[#a1a1aa]">Checklist for HTF bias &amp; kill zone</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    insertMarkdownBlock(TEMPLATE_SNIPPETS.psych);
                    setSlashMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#e50914]/15 hover:text-white flex items-center gap-2.5"
                >
                  <span className="w-6 h-6 rounded bg-[#e50914]/10 text-[#e50914] flex items-center justify-center text-xs">
                    ⚡
                  </span>
                  <div>
                    <p className="font-medium text-white leading-tight">Psychology / Warning Callout</p>
                    <p className="text-[10px] text-[#a1a1aa]">Highlighted execution callout</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    insertMarkdownBlock(TEMPLATE_SNIPPETS.tape);
                    setSlashMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#e50914]/15 hover:text-white flex items-center gap-2.5"
                >
                  <span className="w-6 h-6 rounded bg-white/[0.05] flex items-center justify-center text-xs">
                    ⏱️
                  </span>
                  <div>
                    <p className="font-medium text-white leading-tight">Session Tape Timeline</p>
                    <p className="text-[10px] text-[#a1a1aa]">Timestamped candle breakdown</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {mode === "rich" ? (
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              aria-label="Rich note editor"
              data-placeholder="Write your trading plan & reflections, or press '/' for structured blocks..."
              onInput={emitFromDom}
              onClick={handleEditorClick}
              onKeyUp={updateActiveFormats}
              onMouseUp={updateActiveFormats}
              onKeyDown={handleEditorKeyDown}
              onBlur={() => {
                emitFromDom();
                onBlurFlush?.();
              }}
              style={{ fontSize: `${fontSize}px` }}
              className={cn(
                "w-full min-h-[380px] outline-none leading-relaxed text-[#e8e8e6] empty:before:content-[attr(data-placeholder)] empty:before:text-[#6f6f6d] empty:before:pointer-events-none",
                "[&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-white [&_h1]:mt-2 [&_h1]:mb-2",
                "[&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:pb-1.5 [&_h2]:border-b [&_h2]:border-white/[0.07]",
                "[&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:text-[#f5f5f4] [&_h3]:mt-4 [&_h3]:mb-1.5",
                "[&_h4]:text-[13px] [&_h4]:font-semibold [&_h4]:text-white [&_h4]:mt-3 [&_h4]:mb-1",
                "[&_p]:my-1 [&_p]:leading-relaxed [&_p]:text-[#e0e0de]",
                "[&_strong]:font-semibold [&_strong]:text-white [&_b]:font-semibold [&_b]:text-white",
                "[&_code]:rounded [&_code]:border [&_code]:border-white/[0.1] [&_code]:bg-[#16161c] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.88em] [&_code]:text-[#3ddc84]",
                "[&_blockquote]:my-2.5 [&_blockquote]:border-l-2 [&_blockquote]:border-[#e50914] [&_blockquote]:bg-[#e50914]/[0.06] [&_blockquote]:px-3.5 [&_blockquote]:py-2 [&_blockquote]:rounded-r-lg [&_blockquote]:text-[#e8e8e6]",
                "[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ul]:text-[#d6d6d4]",
                "[&_ul[data-checklist='true']]:list-none [&_ul[data-checklist='true']]:pl-1",
                "[&_span[data-task-check]]:cursor-pointer [&_span[data-task-check]]:select-none [&_span[data-task-check]]:mr-1 [&_span[data-task-check]]:text-[#3ddc84]",
                fontFamily,
              )}
            />
          ) : (
            <textarea
              ref={rawTextareaRef}
              value={markdownPreviewValue}
              onChange={(e) => onChange(ensureRichHtml(e.target.value))}
              onBlur={() => onBlurFlush?.()}
              style={{ fontSize: `${fontSize}px` }}
              className="w-full min-h-[380px] resize-none bg-transparent font-mono outline-none leading-relaxed text-[#d6d6d4] placeholder-[#6f6f6d]"
              placeholder="Markdown source..."
            />
          )}
        </div>
      </div>
    );
  },
);
