import { useEffect, useRef, useState } from "react";
import {
  Square,
  Minus,
  ArrowUpRight,
  Type,
  PenTool,
  Eraser,
  Undo,
  RotateCcw,
  Download,
  Save,
  Check,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type CanvasElement =
  | { id: string; type: "candle"; x: number; y?: number; open: number; close: number; high: number; low: number; isBullish: boolean }
  | { id: string; type: "box"; x: number; y: number; width: number; height: number; color: string; label: string }
  | { id: string; type: "line"; x1: number; y1: number; x2: number; y2: number; color: string; label: string; dashed?: boolean }
  | { id: string; type: "text"; x: number; y: number; text: string; color: string }
  | { id: string; type: "arrow"; x: number; y: number; direction: "up" | "down"; label: string; color: string }
  | { id: string; type: "path"; points: { x: number; y: number }[]; color: string };

interface PlaybookCanvasProps {
  initialSnapshot?: string;
  onSaveSnapshot?: (dataUrl: string) => void;
  presetModel?: "model-a" | "model-b" | "model-c" | "model-d" | "model-e";
  height?: number;
}

export function PlaybookCanvas({
  initialSnapshot,
  onSaveSnapshot,
  presetModel,
  height = 420,
}: PlaybookCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<"candle_bull" | "candle_bear" | "box_fvg" | "line_liq" | "arrow_entry" | "text" | "pen" | "eraser">("candle_bull");
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [history, setHistory] = useState<CanvasElement[][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Load preset elements if elements is empty
  useEffect(() => {
    if (elements.length > 0) return;
    loadPreset(presetModel || "model-a");
  }, [presetModel]);

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.parentElement?.clientWidth || 740;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Dark grid background
    ctx.fillStyle = "#070707";
    ctx.fillRect(0, 0, width, height);

    // Subtle grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw elements
    for (const el of elements) {
      if (el.type === "box") {
        ctx.fillStyle = el.color;
        ctx.fillRect(el.x, el.y, el.width, el.height);
        ctx.strokeStyle = el.color.replace("0.25", "0.75").replace("0.2", "0.8");
        ctx.lineWidth = 1;
        ctx.strokeRect(el.x, el.y, el.width, el.height);

        if (el.label) {
          ctx.fillStyle = "#ffffff";
          ctx.font = 'bold 10px "IBM Plex Mono", monospace';
          ctx.fillText(el.label, el.x + 6, el.y + 14);
        }
      } else if (el.type === "line") {
        ctx.strokeStyle = el.color;
        ctx.lineWidth = 1.5;
        if (el.dashed) ctx.setLineDash([4, 4]);
        else ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(el.x1, el.y1);
        ctx.lineTo(el.x2, el.y2);
        ctx.stroke();
        ctx.setLineDash([]);

        if (el.label) {
          ctx.fillStyle = el.color;
          ctx.font = 'bold 10px "IBM Plex Mono", monospace';
          ctx.fillText(el.label, el.x2 - 80, el.y1 - 5);
        }
      } else if (el.type === "candle") {
        const bodyTop = Math.min(el.open, el.close);
        const bodyHeight = Math.max(2, Math.abs(el.close - el.open));
        const color = el.isBullish ? "#3ddc84" : "#ff6b7d";

        // Wick
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(el.x, el.high);
        ctx.lineTo(el.x, el.low);
        ctx.stroke();

        // Body
        ctx.fillStyle = color;
        ctx.fillRect(el.x - 7, bodyTop, 14, bodyHeight);
      } else if (el.type === "arrow") {
        ctx.fillStyle = el.color;
        ctx.beginPath();
        if (el.direction === "up") {
          ctx.moveTo(el.x, el.y);
          ctx.lineTo(el.x - 6, el.y + 12);
          ctx.lineTo(el.x + 6, el.y + 12);
        } else {
          ctx.moveTo(el.x, el.y);
          ctx.lineTo(el.x - 6, el.y - 12);
          ctx.lineTo(el.x + 6, el.y - 12);
        }
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = el.color;
        ctx.font = 'bold 10px "IBM Plex Mono", monospace';
        ctx.textAlign = "center";
        ctx.fillText(el.label, el.x, el.direction === "up" ? el.y + 24 : el.y - 16);
        ctx.textAlign = "left";
      } else if (el.type === "text") {
        ctx.fillStyle = el.color;
        ctx.font = '11px "IBM Plex Sans", sans-serif';
        ctx.fillText(el.text, el.x, el.y);
      } else if (el.type === "path" && el.points.length > 1) {
        ctx.strokeStyle = el.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(el.points[0].x, el.points[0].y);
        for (let i = 1; i < el.points.length; i++) {
          ctx.lineTo(el.points[i].x, el.points[i].y);
        }
        ctx.stroke();
      }
    }

    // Draw active drawing path
    if (isDrawing && currentPath.length > 1) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(currentPath[0].x, currentPath[0].y);
      for (let i = 1; i < currentPath.length; i++) {
        ctx.lineTo(currentPath[i].x, currentPath[i].y);
      }
      ctx.stroke();
    }

    ctx.restore();
  }, [elements, isDrawing, currentPath, height]);

  // Load preset textbook model schematics
  const loadPreset = (preset: string) => {
    let next: CanvasElement[] = [];
    if (preset === "model-a" || preset === "model-b") {
      const isReversalShort = preset === "model-a";
      next = [
        // Liquidity Sweep Line
        {
          id: "line-sweep",
          type: "line",
          x1: 40,
          y1: isReversalShort ? 80 : 340,
          x2: 680,
          y2: isReversalShort ? 80 : 340,
          color: "rgba(245, 185, 66, 0.75)",
          label: isReversalShort ? "Buy-side Liquidity (BSL / PDH) Swept" : "Sell-side Liquidity (SSL / PDL) Swept",
          dashed: true,
        },
        // Candles creating sweep and MSS
        { id: "c1", type: "candle", x: 80, high: isReversalShort ? 140 : 260, low: isReversalShort ? 180 : 300, open: isReversalShort ? 170 : 270, close: isReversalShort ? 150 : 290, isBullish: !isReversalShort },
        { id: "c2", type: "candle", x: 120, high: isReversalShort ? 110 : 230, low: isReversalShort ? 160 : 280, open: isReversalShort ? 150 : 250, close: isReversalShort ? 120 : 270, isBullish: !isReversalShort },
        // Sweep Candle breaking key level
        { id: "c3", type: "candle", x: 160, high: isReversalShort ? 65 : 355, low: isReversalShort ? 130 : 240, open: isReversalShort ? 120 : 260, close: isReversalShort ? 100 : 280, isBullish: !isReversalShort },
        // Reversal Displacement Candle
        { id: "c4", type: "candle", x: 200, high: isReversalShort ? 100 : 320, low: isReversalShort ? 200 : 180, open: isReversalShort ? 105 : 310, close: isReversalShort ? 190 : 195, isBullish: isReversalShort },
        // FVG box
        {
          id: "box-fvg",
          type: "box",
          x: 230,
          y: isReversalShort ? 120 : 230,
          width: 140,
          height: isReversalShort ? 50 : 50,
          color: "rgba(34, 211, 238, 0.25)",
          label: isReversalShort ? "5m Bearish FVG" : "5m Bullish FVG",
        },
        // Retracement candle into FVG
        { id: "c5", type: "candle", x: 270, high: isReversalShort ? 135 : 265, low: isReversalShort ? 190 : 210, open: isReversalShort ? 185 : 215, close: isReversalShort ? 140 : 260, isBullish: !isReversalShort },
        // Entry Arrow
        {
          id: "arrow-entry",
          type: "arrow",
          x: 280,
          y: isReversalShort ? 140 : 260,
          direction: isReversalShort ? "down" : "up",
          label: isReversalShort ? "SHORT ENTRY (FVG / OTE)" : "LONG ENTRY (FVG / OTE)",
          color: isReversalShort ? "#ff6b7d" : "#3ddc84",
        },
        // Stop Loss Line
        {
          id: "line-sl",
          type: "line",
          x1: 140,
          y1: isReversalShort ? 60 : 360,
          x2: 360,
          y2: isReversalShort ? 60 : 360,
          color: "#ff6b7d",
          label: "Stop Loss Anchor",
          dashed: true,
        },
        // Take Profit Line
        {
          id: "line-tp",
          type: "line",
          x1: 270,
          y1: isReversalShort ? 320 : 100,
          x2: 680,
          y2: isReversalShort ? 320 : 100,
          color: "#3ddc84",
          label: "Target 1: Opposing Liquidity Pool",
          dashed: false,
        },
        // Text Annotations
        { id: "t1", type: "text", x: 190, y: isReversalShort ? 220 : 170, text: "MSS + Displacement Candle", color: "#f5b942" },
      ];
    } else {
      // Continuation Model
      next = [
        { id: "line-trend", type: "line", x1: 40, y1: 300, x2: 680, y2: 120, color: "rgba(61, 220, 132, 0.4)", label: "HTF Bullish Expansion Trend", dashed: true },
        { id: "box-ob", type: "box", x: 220, y: 190, width: 160, height: 45, color: "rgba(168, 85, 247, 0.25)", label: "1H Bullish Order Block / FVG" },
        { id: "c1", type: "candle", x: 140, high: 220, low: 280, open: 270, close: 230, isBullish: true },
        { id: "c2", type: "candle", x: 260, high: 200, low: 240, open: 210, close: 225, isBullish: false },
        { id: "arrow-1", type: "arrow", x: 270, y: 225, direction: "up", label: "Continuation Entry", color: "#3ddc84" },
        { id: "t1", type: "text", x: 230, y: 175, text: "Internal Liquidity Swept → Pullback into OB", color: "#f5b942" },
      ];
    }
    setHistory((h) => [...h, elements]);
    setElements(next);
  };

  // Canvas Click / Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === "pen") {
      setIsDrawing(true);
      setCurrentPath([{ x, y }]);
      return;
    }

    setHistory((h) => [...h, elements]);

    if (tool === "candle_bull") {
      setElements((prev) => [
        ...prev,
        {
          id: `c-${Date.now()}`,
          type: "candle",
          x,
          y,
          open: y + 25,
          close: y - 25,
          high: y - 40,
          low: y + 40,
          isBullish: true,
        },
      ]);
    } else if (tool === "candle_bear") {
      setElements((prev) => [
        ...prev,
        {
          id: `c-${Date.now()}`,
          type: "candle",
          x,
          y,
          open: y - 25,
          close: y + 25,
          high: y - 40,
          low: y + 40,
          isBullish: false,
        },
      ]);
    } else if (tool === "box_fvg") {
      setElements((prev) => [
        ...prev,
        {
          id: `box-${Date.now()}`,
          type: "box",
          x: x - 40,
          y: y - 20,
          width: 120,
          height: 40,
          color: "rgba(34, 211, 238, 0.25)",
          label: "Fair Value Gap (FVG)",
        },
      ]);
    } else if (tool === "line_liq") {
      setElements((prev) => [
        ...prev,
        {
          id: `line-${Date.now()}`,
          type: "line",
          x1: Math.max(20, x - 150),
          y1: y,
          x2: Math.min(canvas.clientWidth - 20, x + 150),
          y2: y,
          color: "rgba(245, 185, 66, 0.8)",
          label: "Liquidity Pool (BSL / SSL)",
          dashed: true,
        },
      ]);
    } else if (tool === "arrow_entry") {
      setElements((prev) => [
        ...prev,
        {
          id: `arr-${Date.now()}`,
          type: "arrow",
          x,
          y,
          direction: "up",
          label: "ENTRY CONFIRMATION",
          color: "#3ddc84",
        },
      ]);
    } else if (tool === "text") {
      const text = prompt("Enter text annotation:", "Market Structure Shift (MSS)");
      if (text) {
        setElements((prev) => [
          ...prev,
          {
            id: `txt-${Date.now()}`,
            type: "text",
            x,
            y,
            text,
            color: "#f5f5f4",
          },
        ]);
      }
    } else if (tool === "eraser") {
      // Remove nearest element within 30px
      setElements((prev) => prev.slice(0, -1));
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || tool !== "pen") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentPath((prev) => [...prev, { x, y }]);
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentPath.length > 1) {
      setHistory((h) => [...h, elements]);
      setElements((prev) => [
        ...prev,
        { id: `path-${Date.now()}`, type: "path", points: currentPath, color: "#ffffff" },
      ]);
    }
    setCurrentPath([]);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setElements(prev);
  };

  const handleClear = () => {
    if (confirm("Clear canvas schematic?")) {
      setHistory((h) => [...h, elements]);
      setElements([]);
    }
  };

  const handleSave = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    onSaveSnapshot?.(dataUrl);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
    toast.success("Blueprint schematic saved to playbook!");
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `playbook-blueprint-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="flex flex-col rounded-md border border-white/[0.08] bg-[#070707] overflow-hidden">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between border-b border-white/[0.06] bg-white/[0.02] p-2 gap-2 text-xs">
        {/* Drawing Tools */}
        <div className="flex flex-wrap items-center gap-1">
          <Button
            size="sm"
            variant={tool === "candle_bull" ? "default" : "outline"}
            className="h-7 text-xs border-white/10"
            onClick={() => setTool("candle_bull")}
            title="Place Bullish Green Candle"
          >
            <span className="inline-block size-2.5 rounded-sm bg-up mr-1" /> Bull Candle
          </Button>
          <Button
            size="sm"
            variant={tool === "candle_bear" ? "default" : "outline"}
            className="h-7 text-xs border-white/10"
            onClick={() => setTool("candle_bear")}
            title="Place Bearish Red Candle"
          >
            <span className="inline-block size-2.5 rounded-sm bg-down mr-1" /> Bear Candle
          </Button>
          <Button
            size="sm"
            variant={tool === "box_fvg" ? "default" : "outline"}
            className="h-7 text-xs border-white/10"
            onClick={() => setTool("box_fvg")}
            title="Place Fair Value Gap Box"
          >
            <Square className="mr-1 size-3 text-cyan-400" /> FVG Box
          </Button>
          <Button
            size="sm"
            variant={tool === "line_liq" ? "default" : "outline"}
            className="h-7 text-xs border-white/10"
            onClick={() => setTool("line_liq")}
            title="Place Liquidity Level Line"
          >
            <Minus className="mr-1 size-3 text-amber-400" /> Liquidity Line
          </Button>
          <Button
            size="sm"
            variant={tool === "arrow_entry" ? "default" : "outline"}
            className="h-7 text-xs border-white/10"
            onClick={() => setTool("arrow_entry")}
            title="Place Entry Arrow"
          >
            <ArrowUpRight className="mr-1 size-3 text-up" /> Entry Marker
          </Button>
          <Button
            size="sm"
            variant={tool === "text" ? "default" : "outline"}
            className="h-7 text-xs border-white/10"
            onClick={() => setTool("text")}
            title="Add Text Label"
          >
            <Type className="mr-1 size-3" /> Label
          </Button>
          <Button
            size="sm"
            variant={tool === "pen" ? "default" : "outline"}
            className="h-7 text-xs border-white/10"
            onClick={() => setTool("pen")}
            title="Freehand Pen"
          >
            <PenTool className="mr-1 size-3" /> Pen
          </Button>
          <Button
            size="sm"
            variant={tool === "eraser" ? "default" : "outline"}
            className="h-7 text-xs border-white/10"
            onClick={() => setTool("eraser")}
            title="Undo Last / Erase"
          >
            <Eraser className="mr-1 size-3" /> Erase
          </Button>
        </div>

        {/* Presets & Actions */}
        <div className="flex items-center gap-1.5">
          <div className="hidden sm:flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground mr-1">Presets:</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[10px] text-muted-foreground hover:text-foreground"
              onClick={() => loadPreset("model-a")}
            >
              Raid Reversal
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[10px] text-muted-foreground hover:text-foreground"
              onClick={() => loadPreset("model-c")}
            >
              Continuation
            </Button>
          </div>

          <Button
            size="icon-sm"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={handleUndo}
            title="Undo"
          >
            <Undo className="size-3.5" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={handleClear}
            title="Clear All"
          >
            <RotateCcw className="size-3.5" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={handleDownload}
            title="Download PNG"
          >
            <Download className="size-3.5" />
          </Button>
          <Button
            size="sm"
            className={`h-7 text-xs transition-colors ${
              savedSuccess ? "bg-up text-black font-semibold" : "bg-accent hover:bg-accent/90"
            }`}
            onClick={handleSave}
          >
            {savedSuccess ? (
              <>
                <Check className="mr-1 size-3" /> Saved!
              </>
            ) : (
              <>
                <Save className="mr-1 size-3" /> Save to Model
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Canvas Element */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="cursor-crosshair w-full block"
        />
        <div className="pointer-events-none absolute bottom-2 right-3 rounded bg-black/60 px-2 py-0.5 text-[9px] font-mono text-muted-foreground backdrop-blur-sm border border-white/5">
          TradeZella Canvas Blueprint Studio · Click on canvas to place elements
        </div>
      </div>
    </div>
  );
}
