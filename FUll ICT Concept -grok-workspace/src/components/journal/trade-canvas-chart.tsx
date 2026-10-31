import { useEffect, useRef, useState, useMemo } from "react";
import { Camera, Maximize2, Minus, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Trade } from "@/lib/ict-types";
import {
  generateTradeCandles,
  type CandleBar,
  formatCurrency,
  getTradePnL,
} from "@/lib/tradezella-helpers";

interface TradeCanvasChartProps {
  trade: Trade;
  height?: number;
  className?: string;
  showExcursions?: boolean;
}

export function TradeCanvasChart({
  trade,
  height = 360,
  className = "",
  showExcursions = true,
}: TradeCanvasChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [timeframe, setTimeframe] = useState<"1m" | "5m" | "15m" | "1H">("5m");
  const [hoverBar, setHoverBar] = useState<CandleBar | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number; price: number } | null>(null);

  // Generate or read the candles for this trade
  const candles = useMemo(() => generateTradeCandles(trade), [trade]);

  // Download chart as PNG snapshot
  const downloadSnapshot = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `${trade.market}-${trade.date}-${trade.time}-execution.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Retina display scaling
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.parentElement?.clientWidth || 700;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Dark sleek background
    ctx.fillStyle = "#070707";
    ctx.fillRect(0, 0, width, height);

    if (candles.length === 0) {
      ctx.restore();
      return;
    }

    // Chart margins
    const paddingLeft = 16;
    const paddingRight = 80;
    const paddingTop = 28;
    const paddingBottom = 32;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    // Find Price Range (Min & Max)
    let minPrice = Infinity;
    let maxPrice = -Infinity;

    for (const b of candles) {
      if (b.low < minPrice) minPrice = b.low;
      if (b.high > maxPrice) maxPrice = b.high;
    }

    // Ensure entry, SL, TP, and excursion lines fit inside range
    if (trade.entry) {
      minPrice = Math.min(minPrice, trade.entry);
      maxPrice = Math.max(maxPrice, trade.entry);
    }
    if (trade.sl) {
      minPrice = Math.min(minPrice, trade.sl);
      maxPrice = Math.max(maxPrice, trade.sl);
    }
    if (trade.tp1) {
      minPrice = Math.min(minPrice, trade.tp1);
      maxPrice = Math.max(maxPrice, trade.tp1);
    }
    if (trade.exitPrice) {
      minPrice = Math.min(minPrice, trade.exitPrice);
      maxPrice = Math.max(maxPrice, trade.exitPrice);
    }

    // Add 8% vertical padding
    const priceSpan = maxPrice - minPrice || 1;
    const yMin = minPrice - priceSpan * 0.08;
    const yMax = maxPrice + priceSpan * 0.08;
    const yRange = yMax - yMin;

    const priceToY = (price: number) => paddingTop + chartHeight - ((price - yMin) / yRange) * chartHeight;
    const yToPrice = (y: number) => yMin + ((paddingTop + chartHeight - y) / chartHeight) * yRange;

    // Bar spacing
    const barCount = candles.length;
    const barWidth = Math.max(4, Math.floor((chartWidth / barCount) * 0.65));
    const barSpacing = chartWidth / barCount;

    // Draw Price Grid Lines (horizontal)
    const gridLines = 6;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.fillStyle = "rgba(162, 162, 160, 0.6)";
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    for (let i = 0; i <= gridLines; i++) {
      const price = yMin + (yRange / gridLines) * i;
      const y = priceToY(price);

      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - paddingRight, y);
      ctx.stroke();

      // Price tag on the right axis
      ctx.fillText(price.toFixed(2), width - paddingRight + 8, y);
    }

    // Draw Volume bars at the bottom
    const maxVol = Math.max(...candles.map((c) => c.volume || 100), 400);
    const volAreaHeight = chartHeight * 0.18;
    for (let i = 0; i < barCount; i++) {
      const b = candles[i];
      const x = paddingLeft + i * barSpacing + barSpacing / 2;
      const vHeight = ((b.volume || 100) / maxVol) * volAreaHeight;
      const vY = paddingTop + chartHeight - vHeight;

      ctx.fillStyle = b.close >= b.open ? "rgba(61, 220, 132, 0.12)" : "rgba(255, 107, 125, 0.12)";
      ctx.fillRect(x - barWidth / 2, vY, barWidth, vHeight);
    }

    // Draw Candlesticks
    for (let i = 0; i < barCount; i++) {
      const b = candles[i];
      const x = paddingLeft + i * barSpacing + barSpacing / 2;
      const isUp = b.close >= b.open;

      const yOpen = priceToY(b.open);
      const yClose = priceToY(b.close);
      const yHigh = priceToY(b.high);
      const yLow = priceToY(b.low);

      const candleTop = Math.min(yOpen, yClose);
      const candleHeight = Math.max(1.5, Math.abs(yClose - yOpen));

      // Wick
      ctx.strokeStyle = isUp ? "#3ddc84" : "#ff6b7d";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, yHigh);
      ctx.lineTo(x, yLow);
      ctx.stroke();

      // Body
      ctx.fillStyle = isUp ? "#3ddc84" : "#ff6b7d";
      ctx.fillRect(x - barWidth / 2, candleTop, barWidth, candleHeight);

      // Time labels along bottom
      if (i % 4 === 0 || i === barCount - 1) {
        ctx.fillStyle = "rgba(162, 162, 160, 0.5)";
        ctx.textAlign = "center";
        ctx.fillText(b.time, x, height - 12);
      }
    }

    // ── Trade Overlays & Visual Markers ──

    // 1. Stop Loss (SL) Line
    if (trade.sl != null) {
      const slY = priceToY(trade.sl);
      ctx.save();
      ctx.strokeStyle = "rgba(255, 107, 125, 0.75)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(paddingLeft, slY);
      ctx.lineTo(width - paddingRight, slY);
      ctx.stroke();

      // SL Badge
      ctx.fillStyle = "#ff6b7d";
      ctx.fillRect(width - paddingRight + 4, slY - 8, 72, 16);
      ctx.fillStyle = "#000000";
      ctx.font = 'bold 9px "IBM Plex Mono", monospace';
      ctx.textAlign = "center";
      ctx.fillText(`SL ${trade.sl.toFixed(1)}`, width - paddingRight + 40, slY + 3);
      ctx.restore();
    }

    // 2. Take Profit (TP) Line
    const targetPrice = trade.tp1 ?? trade.targetPrice;
    if (targetPrice != null) {
      const tpY = priceToY(targetPrice);
      ctx.save();
      ctx.strokeStyle = "rgba(61, 220, 132, 0.75)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(paddingLeft, tpY);
      ctx.lineTo(width - paddingRight, tpY);
      ctx.stroke();

      // TP Badge
      ctx.fillStyle = "#3ddc84";
      ctx.fillRect(width - paddingRight + 4, tpY - 8, 72, 16);
      ctx.fillStyle = "#000000";
      ctx.font = 'bold 9px "IBM Plex Mono", monospace';
      ctx.textAlign = "center";
      ctx.fillText(`TP ${targetPrice.toFixed(1)}`, width - paddingRight + 40, tpY + 3);
      ctx.restore();
    }

    // 3. Entry Marker & Exit Marker
    let entryX = paddingLeft + 6 * barSpacing + barSpacing / 2;
    let exitX = paddingLeft + (barCount - 5) * barSpacing + barSpacing / 2;

    // Find actual entry/exit bar indexes if marked
    const foundEntryIdx = candles.findIndex((c) => c.isEntryBar);
    if (foundEntryIdx !== -1) entryX = paddingLeft + foundEntryIdx * barSpacing + barSpacing / 2;
    const foundExitIdx = candles.findIndex((c) => c.isExitBar);
    if (foundExitIdx !== -1) exitX = paddingLeft + foundExitIdx * barSpacing + barSpacing / 2;

    const entryY = trade.entry != null ? priceToY(trade.entry) : priceToY(candles[6]?.close || minPrice);
    const exitY = trade.exitPrice != null ? priceToY(trade.exitPrice) : priceToY(candles[candles.length - 5]?.close || maxPrice);

    // Trajectory dashed line from entry to exit
    ctx.save();
    ctx.strokeStyle = trade.result === "win" ? "rgba(61, 220, 132, 0.4)" : "rgba(255, 107, 125, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(entryX, entryY);
    ctx.lineTo(exitX, exitY);
    ctx.stroke();
    ctx.restore();

    // Draw Entry Marker (Green/Blue arrow)
    const isLong = trade.side === "long";
    ctx.save();
    ctx.fillStyle = isLong ? "#3ddc84" : "#ff6b7d";
    ctx.beginPath();
    if (isLong) {
      // Arrow pointing up from below entry
      ctx.moveTo(entryX, entryY + 8);
      ctx.lineTo(entryX - 6, entryY + 18);
      ctx.lineTo(entryX + 6, entryY + 18);
    } else {
      // Arrow pointing down from above entry
      ctx.moveTo(entryX, entryY - 8);
      ctx.lineTo(entryX - 6, entryY - 18);
      ctx.lineTo(entryX + 6, entryY - 18);
    }
    ctx.closePath();
    ctx.fill();

    // Entry Label Box
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.strokeStyle = isLong ? "#3ddc84" : "#ff6b7d";
    ctx.lineWidth = 1;
    const entryLabel = `BUY @ ${trade.entry?.toFixed(2) ?? "MKT"}`;
    ctx.fillRect(entryX - 35, isLong ? entryY + 20 : entryY - 34, 70, 16);
    ctx.strokeRect(entryX - 35, isLong ? entryY + 20 : entryY - 34, 70, 16);
    ctx.fillStyle = isLong ? "#3ddc84" : "#ff6b7d";
    ctx.font = 'bold 9px "IBM Plex Mono", monospace';
    ctx.textAlign = "center";
    ctx.fillText(entryLabel, entryX, isLong ? entryY + 31 : entryY - 23);
    ctx.restore();

    // Draw Exit Marker
    ctx.save();
    const isWin = trade.result === "win";
    ctx.fillStyle = isWin ? "#3ddc84" : "#ff6b7d";
    ctx.beginPath();
    if (isLong) {
      // Arrow pointing down into exit
      ctx.moveTo(exitX, exitY - 8);
      ctx.lineTo(exitX - 6, exitY - 18);
      ctx.lineTo(exitX + 6, exitY - 18);
    } else {
      // Arrow pointing up into exit
      ctx.moveTo(exitX, exitY + 8);
      ctx.lineTo(exitX - 6, exitY + 18);
      ctx.lineTo(exitX + 6, exitY + 18);
    }
    ctx.closePath();
    ctx.fill();

    // Exit Label Box
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.strokeStyle = isWin ? "#3ddc84" : "#ff6b7d";
    ctx.lineWidth = 1;
    const rLabel = trade.rMultiple != null ? `${trade.rMultiple > 0 ? "+" : ""}${trade.rMultiple.toFixed(2)}R` : "EXIT";
    const exitLabel = `EXIT (${rLabel})`;
    ctx.fillRect(exitX - 36, isLong ? exitY - 34 : exitY + 20, 72, 16);
    ctx.strokeRect(exitX - 36, isLong ? exitY - 34 : exitY + 20, 72, 16);
    ctx.fillStyle = isWin ? "#3ddc84" : "#ff6b7d";
    ctx.font = 'bold 9px "IBM Plex Mono", monospace';
    ctx.textAlign = "center";
    ctx.fillText(exitLabel, exitX, isLong ? exitY - 23 : exitY + 31);
    ctx.restore();

    // 4. MFE and MAE Lines (TradeZella Excursion feature)
    if (showExcursions && trade.entry && trade.sl) {
      const riskDist = Math.abs(trade.entry - trade.sl);
      if (trade.mfeR) {
        const mfePrice = isLong ? trade.entry + trade.mfeR * riskDist : trade.entry - trade.mfeR * riskDist;
        const mfeY = priceToY(mfePrice);
        ctx.save();
        ctx.strokeStyle = "rgba(34, 211, 238, 0.6)";
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(entryX, mfeY);
        ctx.lineTo(width - paddingRight, mfeY);
        ctx.stroke();

        ctx.fillStyle = "rgba(34, 211, 238, 0.85)";
        ctx.font = '9px "IBM Plex Mono", monospace';
        ctx.textAlign = "left";
        ctx.fillText(`MFE +${trade.mfeR.toFixed(1)}R`, width - paddingRight + 6, mfeY - 2);
        ctx.restore();
      }

      if (trade.maeR) {
        const maePrice = isLong ? trade.entry + trade.maeR * riskDist : trade.entry - trade.maeR * riskDist;
        const maeY = priceToY(maePrice);
        ctx.save();
        ctx.strokeStyle = "rgba(245, 185, 66, 0.6)";
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(entryX, maeY);
        ctx.lineTo(width - paddingRight, maeY);
        ctx.stroke();

        ctx.fillStyle = "rgba(245, 185, 66, 0.85)";
        ctx.font = '9px "IBM Plex Mono", monospace';
        ctx.textAlign = "left";
        ctx.fillText(`MAE ${trade.maeR.toFixed(1)}R`, width - paddingRight + 6, maeY + 9);
        ctx.restore();
      }
    }

    // ── Interactive Hover Crosshair ──
    if (hoverPos) {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(hoverPos.x, paddingTop);
      ctx.lineTo(hoverPos.x, height - paddingBottom);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(paddingLeft, hoverPos.y);
      ctx.lineTo(width - paddingRight, hoverPos.y);
      ctx.stroke();

      // Hover Price badge on right axis
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(width - paddingRight, hoverPos.y - 8, 76, 16);
      ctx.fillStyle = "#000000";
      ctx.font = 'bold 9px "IBM Plex Mono", monospace';
      ctx.textAlign = "center";
      ctx.fillText(hoverPos.price.toFixed(2), width - paddingRight + 38, hoverPos.y + 3);
      ctx.restore();
    }

    ctx.restore();
  }, [candles, trade, height, showExcursions, hoverPos]);

  // Handle Mouse Move for Crosshair
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const paddingLeft = 16;
    const paddingRight = 80;
    const paddingTop = 28;
    const paddingBottom = 32;
    const chartWidth = canvas.clientWidth - paddingLeft - paddingRight;
    const chartHeight = canvas.clientHeight - paddingTop - paddingBottom;

    if (x < paddingLeft || x > canvas.clientWidth - paddingRight || y < paddingTop || y > canvas.clientHeight - paddingBottom) {
      setHoverPos(null);
      setHoverBar(null);
      return;
    }

    // Calculate nearest candle bar
    const barSpacing = chartWidth / candles.length;
    const barIndex = Math.min(candles.length - 1, Math.max(0, Math.floor((x - paddingLeft) / barSpacing)));
    const bar = candles[barIndex];

    // Calculate price at mouse Y
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    for (const b of candles) {
      if (b.low < minPrice) minPrice = b.low;
      if (b.high > maxPrice) maxPrice = b.high;
    }
    const priceSpan = maxPrice - minPrice || 1;
    const yMin = minPrice - priceSpan * 0.08;
    const yMax = maxPrice + priceSpan * 0.08;
    const price = yMin + ((paddingTop + chartHeight - y) / chartHeight) * (yMax - yMin);

    setHoverPos({ x, y, price });
    setHoverBar(bar);
  };

  const handleMouseLeave = () => {
    setHoverPos(null);
    setHoverBar(null);
  };

  const pnl = getTradePnL(trade);

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col rounded-md border border-white/[0.08] bg-[#070707] shadow-inner ${className}`}
    >
      {/* Top Header Controls Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-white/[0.06] px-3 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold tracking-wide text-foreground">
            {trade.market}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              trade.side === "long" ? "bg-up/20 text-up" : "bg-down/20 text-down"
            }`}
          >
            {trade.side}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {trade.date} · {trade.session || "NY"}
          </span>
          {trade.result && (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                trade.result === "win"
                  ? "bg-up/15 text-up border border-up/30"
                  : trade.result === "loss"
                  ? "bg-down/15 text-down border border-down/30"
                  : "bg-white/10 text-muted-foreground"
              }`}
            >
              {trade.result} {pnl !== 0 && `(${formatCurrency(pnl)})`}
            </span>
          )}
        </div>

        {/* Timeframe Selector & Actions */}
        <div className="flex items-center gap-1">
          {(["1m", "5m", "15m", "1H"] as const).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              className={`rounded px-2 py-0.5 font-mono text-[10px] transition-colors ${
                timeframe === tf
                  ? "bg-white/20 text-foreground font-bold"
                  : "text-muted-foreground hover:bg-white/10 hover:text-foreground"
              }`}
            >
              {tf}
            </button>
          ))}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={downloadSnapshot}
            title="Download Chart Snapshot"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
          >
            <Camera className="size-3" />
          </Button>
        </div>
      </div>

      {/* Floating HUD Tooltip */}
      <div className="pointer-events-none absolute left-4 top-10 z-10 flex flex-wrap gap-2 text-[10px] font-mono">
        {hoverBar ? (
          <div className="flex items-center gap-2 rounded bg-black/80 px-2 py-1 border border-white/10 backdrop-blur-sm">
            <span className="text-muted-foreground">{hoverBar.time}</span>
            <span>O: <span className="text-foreground">{hoverBar.open.toFixed(2)}</span></span>
            <span>H: <span className="text-foreground">{hoverBar.high.toFixed(2)}</span></span>
            <span>L: <span className="text-foreground">{hoverBar.low.toFixed(2)}</span></span>
            <span>C: <span className={hoverBar.close >= hoverBar.open ? "text-up" : "text-down"}>{hoverBar.close.toFixed(2)}</span></span>
            <span className="text-muted-foreground">Vol: {hoverBar.volume}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Entry: <span className="text-foreground">{trade.entry?.toFixed(2) ?? "—"}</span></span>
            <span>Exit: <span className="text-foreground">{trade.exitPrice?.toFixed(2) ?? "—"}</span></span>
            {trade.sl && <span>SL: <span className="text-down">{trade.sl.toFixed(2)}</span></span>}
            {trade.tp1 && <span>TP: <span className="text-up">{trade.tp1.toFixed(2)}</span></span>}
          </div>
        )}
      </div>

      {/* Candlestick Canvas Element */}
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="cursor-crosshair w-full block"
      />
    </div>
  );
}
