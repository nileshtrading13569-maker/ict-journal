import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Loader2, Radio, Send, Users, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useP2PRoom } from "@/lib/multiplayer/frontend/use-p2p-room";
import { useDeskStore } from "@/lib/ict-store";
import { currentBalance, payoutProgress, planFor, protocolDayNumber, remainingRToDanger } from "@/lib/ict-stats";
import { cn, formatMoney, todayISO } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/** The compact read one trader shares with the other side of the room. */
type DeskRead = {
  handle: string;
  account: string;
  phase: number;
  day: number;
  market: string;
  bias: string;
  draw: string;
  delivery: string;
  equity: string;
  payoutPct: number;
  rToDanger: number;
  sentAt: string;
};

type RoomMessage = { type: "desk-read"; read: DeskRead };

function parseRead(data: unknown): DeskRead | null {
  if (typeof data !== "object" || data === null) return null;
  const message = data as { type?: unknown; read?: unknown };
  if (message.type !== "desk-read") return null;
  if (typeof message.read !== "object" || message.read === null) return null;
  const read = message.read as Partial<DeskRead>;
  if (typeof read.handle !== "string" || typeof read.market !== "string") return null;
  if (typeof read.sentAt !== "string") return null;
  return {
    handle: read.handle,
    account: typeof read.account === "string" ? read.account : "",
    phase: typeof read.phase === "number" ? read.phase : 1,
    day: typeof read.day === "number" ? read.day : 1,
    market: read.market,
    bias: typeof read.bias === "string" ? read.bias : "—",
    draw: typeof read.draw === "string" ? read.draw : "—",
    delivery: typeof read.delivery === "string" ? read.delivery : "—",
    equity: typeof read.equity === "string" ? read.equity : "—",
    payoutPct: typeof read.payoutPct === "number" ? read.payoutPct : 0,
    rToDanger: typeof read.rToDanger === "number" ? read.rToDanger : 0,
    sentAt: read.sentAt,
  };
}

const STATE_TONE: Record<string, string> = {
  connected: "bg-up",
  connecting: "bg-warn",
  new: "bg-warn",
  disconnected: "bg-down",
  failed: "bg-down",
  closed: "bg-subtle",
};

export function RoomSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [roomInput, setRoomInput] = useState("");
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const data = useDeskStore();
  const handle = (data.accountName || "Trader").slice(0, 40);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Live room</SheetTitle>
          <SheetDescription>
            Pair directly with one other trader over WebRTC. Signaling only relays offers between you —
            the desk read never touches the database, and the room closes when you close this panel.
          </SheetDescription>
        </SheetHeader>

        <div className="p-5">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              aria-label="Room code"
              placeholder="Room code, e.g. london-am"
              value={roomInput}
              onChange={(event) => setRoomInput(event.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
            />
            <Button type="button" onClick={() => setActiveRoom(roomInput.trim() || "desk-main")}>
              <Radio aria-hidden="true" /> {activeRoom ? "Rejoin" : "Join"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Both sides need to enter the same code. Leave the field empty to use <code className="font-mono">desk-main</code>.
          </p>

          {activeRoom ? (
            <RoomSession key={activeRoom} room={activeRoom} handle={handle} />
          ) : (
            <p className="mt-6 rounded-lg border border-dashed border-white/[0.12] px-4 py-8 text-center text-sm text-muted-foreground">
              Not in a room. Join to see who is online.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RoomSession({ room, handle }: { room: string; handle: string }) {
  const p2p = useP2PRoom({ room, name: handle });
  const data = useDeskStore();
  const [reads, setReads] = useState<DeskRead[]>([]);
  const [copied, setCopied] = useState(false);
  const seen = useRef(new Set<string>());

  // onMessage is a stable callback, so this subscribes once per room session.
  const { onMessage } = p2p;
  useEffect(() => {
    return onMessage((from, payload) => {
      const read = parseRead(payload);
      if (!read) return;
      const key = `${from}:${read.sentAt}`;
      if (seen.current.has(key)) return;
      seen.current.add(key);
      setReads((current) => [read, ...current].slice(0, 12));
      toast.info(`${read.handle} shared a read`);
    });
  }, [onMessage]);

  const connected = p2p.peers.filter((peer) => peer.connectionState === "connected");

  const share = () => {
    if (!connected.length) {
      toast.info("No connected peers yet — wait for the other side to appear.");
      return;
    }
    const today = todayISO();
    const plan = planFor(data, today);
    const pay = payoutProgress(data);
    const danger = remainingRToDanger(data, today);
    const read: DeskRead = {
      handle,
      account: data.accountName,
      phase: data.phaseId,
      day: protocolDayNumber(data),
      market: plan.market || "—",
      bias: plan.expectedDelivery || plan.htfStructure,
      draw: plan.expectedDraw || "—",
      delivery: plan.expectedDelivery || "—",
      equity: formatMoney(currentBalance(data)),
      payoutPct: Math.round(pay.pct),
      rToDanger: Math.round(danger.dailyR),
      sentAt: new Date().toISOString(),
    };
    p2p.send({ type: "desk-read", read } satisfies RoomMessage);
    toast.success(`Read shared with ${connected.length} peer${connected.length === 1 ? "" : "s"}`);
  };

  const copyRoom = async () => {
    try {
      await navigator.clipboard.writeText(room);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy the room code.");
    }
  };

  const summary = useMemo(
    () => (p2p.joined ? `${p2p.peers.length} peer${p2p.peers.length === 1 ? "" : "s"}` : "Connecting"),
    [p2p.joined, p2p.peers.length],
  );

  return (
    <div className="mt-6 space-y-4">
      <section className="rounded-lg border border-white/[0.09] bg-card/70">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "size-1.5 rounded-full",
                p2p.joined ? "bg-up" : "bg-warn animate-pulse",
              )}
              aria-hidden="true"
            />
            <span className="font-mono text-xs text-foreground">{room}</span>
            <span className="text-[11px] text-muted-foreground">{summary}</span>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={copyRoom}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? "Copied" : "Copy code"}
          </Button>
        </div>

        <div className="p-3.5">
          {p2p.peers.length === 0 ? (
            <div className="flex items-center gap-2.5 rounded-md border border-dashed border-white/[0.12] px-3 py-4 text-sm text-muted-foreground">
              {p2p.joined ? (
                <>
                  <WifiOff className="size-4 shrink-0" aria-hidden="true" />
                  Waiting for the other trader to join this code.
                </>
              ) : (
                <>
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
                  Registering with the signaling service…
                </>
              )}
            </div>
          ) : (
            <ul className="space-y-1.5">
              {p2p.peers.map((peer) => (
                <li
                  key={peer.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-white/[0.07] bg-white/[0.02] px-3 py-2"
                >
                  <span
                    className={cn("size-1.5 rounded-full", STATE_TONE[peer.connectionState] ?? "bg-subtle")}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{peer.name}</span>
                  <span className="font-mono text-[10px] text-subtle">#{peer.id.slice(-4)}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {peer.connectionState}
                    {peer.rttMs != null ? ` · ${peer.rttMs}ms` : ""}
                    {peer.candidateType ? ` · ${peer.candidateType}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <Button type="button" className="mt-3 w-full" onClick={share}>
            <Send aria-hidden="true" /> Share today&apos;s read
          </Button>
        </div>
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-2 text-[10px] font-semibold tracking-[0.16em] text-accent uppercase">
          <Users className="size-3.5" aria-hidden="true" /> Peer reads
        </h3>
        {reads.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/[0.1] px-3 py-6 text-center text-sm text-muted-foreground">
            Nothing received yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {reads.map((read) => (
              <li
                key={`${read.handle}-${read.sentAt}`}
                className="rounded-lg border border-white/[0.08] bg-card/60 p-3"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">{read.handle}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {new Date(read.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Phase {read.phase} · Day {read.day} · {read.market}
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
                  <ReadCell k="Bias" v={read.bias} />
                  <ReadCell k="Draw" v={read.draw} />
                  <ReadCell k="Equity" v={read.equity} />
                  <ReadCell k="Payout" v={`${read.payoutPct}%`} />
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ReadCell({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-sm border border-white/[0.06] bg-white/[0.02] px-2 py-1">
      <dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{k}</dt>
      <dd className="truncate font-medium capitalize text-foreground">{v}</dd>
    </div>
  );
}
