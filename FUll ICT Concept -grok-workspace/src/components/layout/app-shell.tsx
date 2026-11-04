import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarRange,
  ChartLine,
  Cloud,
  CloudOff,
  CloudUpload,
  Compass,
  Layers,
  LayoutDashboard,
  ListChecks,
  MoreHorizontal,
  NotebookPen,
  Plus,
  RotateCcw,
  Settings2,
  Shield,
  ShieldCheck,
  Sun,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDeskStore } from "@/lib/ict-store";
import { UserButton } from "@/lib/auth/gates";
import { signOut } from "@/lib/auth/client";
import { toast } from "sonner";
import { useDeskSyncStatus } from "@/components/desk/desk-sync-context";
import { lockInfo, protocolDayNumber } from "@/lib/ict-stats";
import { cn, todayISO } from "@/lib/utils";
import { TradeWizard } from "@/components/desk/trade-wizard";
import { SettingsSheet } from "@/components/desk/settings-sheet";
import { RoomSheet } from "@/components/desk/room-sheet";
import { ConfluenceGraderModal } from "@/components/playbook/confluence-grader-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { to: "/", label: "Today", icon: LayoutDashboard },
  { to: "/weekly", label: "Weekly", icon: CalendarRange },
  { to: "/daily", label: "Daily", icon: Sun },
  { to: "/playbook", label: "Playbook", icon: Compass },
  { to: "/notebook", label: "Notebook", icon: NotebookPen },
  { to: "/journal", label: "Journal", icon: BookOpen },
  { to: "/replay", label: "Replay", icon: RotateCcw },
  { to: "/analytics", label: "Analytics", icon: ChartLine },
  { to: "/protocol", label: "Protocol", icon: ListChecks },
] as const;

const MOBILE = [
  { to: "/", label: "Today", icon: LayoutDashboard },
  { to: "/weekly", label: "Weekly", icon: CalendarRange },
  { to: "/journal", label: "Journal", icon: BookOpen },
  { to: "/analytics", label: "Edge", icon: ChartLine },
] as const;

const MOBILE_MORE = [
  { to: "/weekly-profile", label: "Weekly Profile" },
  { to: "/daily", label: "Daily map" },
  { to: "/playbook", label: "Playbook" },
  { to: "/notebook", label: "Notebook" },
  { to: "/replay", label: "Replay" },
  { to: "/protocol", label: "Protocol" },
] as const;

export function AppShell({
  children,
  fullWidth = false,
  contentClassName,
}: {
  children: React.ReactNode;
  fullWidth?: boolean;
  contentClassName?: string;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isWeekly = pathname === "/weekly" || pathname === "/weekly-profile";
  const isWeeklyProfile = pathname === "/weekly-profile";
  const navigate = useNavigate();
  const phaseId = useDeskStore((s) => s.phaseId);
  const phases = useDeskStore((s) => s.phases);
  const accountName = useDeskStore((s) => s.accountName);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [roomOpen, setRoomOpen] = useState(false);
  const [confluenceOpen, setConfluenceOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const syncStatus = useDeskSyncStatus();
  // Primitive selectors keep the shell from re-rendering on every desk edit.
  const locked = useDeskStore((s) => lockInfo(s, todayISO()).locked);
  const day = useDeskStore((s) => protocolDayNumber(s));
  const phase = phases.find((p) => p.id === phaseId);

  const syncLabel = {
    local: "Local only",
    loading: "Connecting",
    saved: "Cloud saved",
    saving: "Syncing",
    error: "Sync issue",
  }[syncStatus];
  const SyncIcon =
    syncStatus === "error" ? CloudOff : syncStatus === "saving" || syncStatus === "loading" ? CloudUpload : Cloud;

  const handleMobileSignOut = () => {
    void signOut().catch((error: unknown) => {
      console.error("[auth] sign-out failed:", error);
      toast.error(error instanceof Error ? error.message : "Could not sign out. Please try again.");
    });
  };

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <aside
        id="primary-sidebar"
        aria-label="Primary navigation"
        className={cn(
          "sticky top-3 my-3 ml-3.5 mr-1 hidden h-[calc(100dvh-1.5rem)] shrink-0 flex-col overflow-hidden rounded-[34px] px-[13px] py-3.5 border border-white/[0.08] bg-[#0c0c0e]/90 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(255,255,255,0.08)] transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[width] lg:flex z-20",
          sidebarExpanded ? "w-60" : "w-[68px]",
        )}
      >
        <div className="flex h-10 w-full items-center pb-2 mb-1">
          <button
            type="button"
            className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05] border border-white/[0.1] text-white shadow-[0_2px_10px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.12)] transition-all duration-200 hover:bg-white/[0.1] hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent cursor-pointer"
            aria-label={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
            aria-controls="primary-sidebar"
            aria-expanded={sidebarExpanded}
            title={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
            onClick={() => setSidebarExpanded((prev) => !prev)}
          >
            <Shield className="size-4.5 text-white" />
          </button>
          <div
            className={cn(
              "min-w-0 flex-1 overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform,margin] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[transform,opacity]",
              sidebarExpanded
                ? "max-w-[170px] opacity-100 translate-x-0 ml-2.5"
                : "max-w-0 opacity-0 -translate-x-3 pointer-events-none ml-0",
            )}
          >
            <p className="truncate font-display text-[15px] font-bold tracking-tight text-white leading-tight">
              First Payout
            </p>
            <p className="whitespace-nowrap text-[10px] font-semibold tracking-[0.16em] text-[#ff6b7d] uppercase leading-tight mt-0.5">
              ICT desk terminal
            </p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-1 -mx-2 px-2">
          {NAV.map((item) => {
            const active = pathname === item.to || (item.to === "/weekly" && pathname === "/weekly-profile");
            return (
              <div key={item.to} className="relative flex w-full flex-col">
                <div className="relative flex w-full items-center">
                  <Link
                    to={item.to}
                    title={!sidebarExpanded ? item.label : undefined}
                    aria-label={item.label}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex h-10 w-full items-center rounded-full border transition-[border-color,background-color,color,box-shadow] duration-200",
                      active
                        ? "border-accent/40 bg-accent/15 text-white font-semibold shadow-[0_0_24px_color-mix(in_srgb,var(--color-accent,#d946ef)_25%,transparent),inset_0_1px_1px_rgba(255,255,255,0.2)]"
                        : "border-transparent text-zinc-400 hover:border-white/[0.06] hover:bg-white/[0.04] hover:text-white",
                    )}
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center">
                      <item.icon
                        className={cn(
                          "size-[18px] shrink-0 transition-colors duration-200",
                          active ? "text-white" : "text-zinc-400 group-hover:text-white",
                        )}
                        aria-hidden="true"
                      />
                    </div>
                    <span
                      className={cn(
                        "min-w-0 overflow-hidden whitespace-nowrap text-[13px] leading-none transition-[max-width,opacity,transform,padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[transform,opacity]",
                        sidebarExpanded
                          ? "max-w-[160px] opacity-100 translate-x-0 pr-2"
                          : "max-w-0 opacity-0 -translate-x-3 pointer-events-none pr-0",
                        active ? "font-semibold text-white" : "font-medium text-zinc-400 group-hover:text-white",
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                </div>
                {item.to === "/weekly" && sidebarExpanded ? (
                  <div className="mt-1 flex flex-col pl-7 pr-1">
                    <div className="flex flex-col border-l border-white/[0.1] pl-2.5 gap-1">
                      <Link
                        to="/weekly"
                        className={cn(
                          "group relative flex h-7 items-center justify-between rounded-md px-2 text-[11px] transition-colors",
                          pathname === "/weekly"
                            ? "bg-accent/15 text-white font-medium border border-accent/30"
                            : "text-zinc-400 hover:text-white hover:bg-white/[0.04]",
                        )}
                      >
                        <span>Dealing Range Map</span>
                        {pathname === "/weekly" ? (
                          <span className="size-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent,#d946ef)]" />
                        ) : null}
                      </Link>
                      <Link
                        to="/weekly-profile"
                        className={cn(
                          "group relative flex h-7 items-center justify-between rounded-md px-2 text-[11px] transition-colors",
                          pathname === "/weekly-profile"
                            ? "bg-[#e50914]/15 text-white font-medium border border-[#e50914]/30"
                            : "text-zinc-400 hover:text-white hover:bg-white/[0.04]",
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              pathname === "/weekly-profile" ? "bg-[#e50914] shadow-[0_0_8px_#e50914]" : "bg-zinc-600",
                            )}
                          />
                          <span>Weekly Profile</span>
                        </div>
                        {pathname === "/weekly-profile" ? (
                          <span className="font-mono text-[9px] uppercase tracking-wider text-[#ff6b7d] font-bold">Active</span>
                        ) : null}
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="mt-auto w-full flex flex-col gap-1 pt-2">
          <div className="relative flex w-full items-center">
            <button
              type="button"
              onClick={() => setRoomOpen(true)}
              className="group relative flex h-10 w-full items-center rounded-full border border-transparent text-zinc-400 transition-[border-color,background-color,color] duration-200 hover:border-white/[0.06] hover:bg-white/[0.04] hover:text-white cursor-pointer"
              aria-label="Open live room"
              title={!sidebarExpanded ? "Live room" : undefined}
            >
              <div className="flex size-10 shrink-0 items-center justify-center">
                <Users
                  className="size-[18px] shrink-0 text-zinc-400 transition-colors duration-200 group-hover:text-white"
                  aria-hidden="true"
                />
              </div>
              <span
                className={cn(
                  "min-w-0 overflow-hidden whitespace-nowrap text-[12.5px] font-medium leading-none transition-[max-width,opacity,transform,padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[transform,opacity]",
                  sidebarExpanded
                    ? "max-w-[160px] opacity-100 translate-x-0 pr-2"
                    : "max-w-0 opacity-0 -translate-x-3 pointer-events-none pr-0",
                )}
              >
                Live room
              </span>
            </button>
          </div>

          <div className="relative flex w-full items-center">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="group relative flex h-10 w-full items-center rounded-full border border-transparent text-zinc-400 transition-[border-color,background-color,color] duration-200 hover:border-white/[0.06] hover:bg-white/[0.04] hover:text-white cursor-pointer"
              aria-label="Open settings"
              title={!sidebarExpanded ? "Settings" : undefined}
            >
              <div className="flex size-10 shrink-0 items-center justify-center">
                <Settings2
                  className="size-[18px] shrink-0 text-zinc-400 transition-colors duration-200 group-hover:text-white"
                  aria-hidden="true"
                />
              </div>
              <span
                className={cn(
                  "min-w-0 overflow-hidden whitespace-nowrap text-[12.5px] font-medium leading-none transition-[max-width,opacity,transform,padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[transform,opacity]",
                  sidebarExpanded
                    ? "max-w-[160px] opacity-100 translate-x-0 pr-2"
                    : "max-w-0 opacity-0 -translate-x-3 pointer-events-none pr-0",
                )}
              >
                Settings
              </span>
            </button>
          </div>

          <div
            className="relative my-1.5 grid grid-cols-1 grid-rows-1 h-8 w-full items-center overflow-hidden rounded-full border border-white/[0.07] bg-white/[0.03] shadow-[inset_0_1px_1px_rgba(0,0,0,0.3)]"
            title={`Day ${day} · Live NY`}
            aria-label={`Day ${day} · Live NY`}
          >
            {/* Expanded view */}
            <div
              className={cn(
                "col-start-1 row-start-1 flex w-full items-center justify-between px-3.5 font-mono text-[10.5px] text-zinc-400 whitespace-nowrap transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[transform,opacity]",
                sidebarExpanded
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 -translate-x-3 pointer-events-none",
              )}
            >
              <span className="font-medium text-zinc-300">Day {day}</span>
              <span className="inline-flex items-center gap-1.5 text-up font-sans font-medium text-[10.5px]">
                <span
                  className="size-1.5 rounded-full bg-up animate-pulse shadow-[0_0_6px_rgba(61,220,132,0.8)]"
                  aria-hidden="true"
                />
                <span>Live NY</span>
              </span>
            </div>

            {/* Collapsed view */}
            <div
              className={cn(
                "col-start-1 row-start-1 flex size-full items-center justify-center transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[transform,opacity]",
                sidebarExpanded
                  ? "opacity-0 pointer-events-none scale-75"
                  : "opacity-100 scale-100",
              )}
            >
              <span className="relative flex size-2.5 items-center justify-center cursor-default">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-up opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-up shadow-[0_0_8px_rgba(61,220,132,0.8)]" />
              </span>
            </div>
          </div>

          <div className="mt-2 w-full border-t border-white/[0.06] pt-2.5 flex items-center overflow-hidden">
            <UserButton collapsed={!sidebarExpanded} />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2.5 border-b border-white/[0.08] bg-background/85 px-4 py-2.5 backdrop-blur-xl md:px-8">
          <div className="min-w-0 flex-1">
            <p className="hidden truncate text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase sm:block">
              {accountName}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={locked ? "down" : "up"} className="gap-1.5 whitespace-nowrap">
                <span
                  className={cn("size-1 rounded-full", locked ? "bg-down" : "bg-up animate-pulse")}
                  aria-hidden="true"
                />
                {locked ? "Platform closed" : "Session open"}
              </Badge>
              <Badge variant="default" className="whitespace-nowrap">
                Phase {phaseId} · {phase?.name}
              </Badge>
            </div>
          </div>
          {isWeeklyProfile ? (
            <>
              <div className="hidden md:flex items-center gap-2 rounded-md border border-[#f5b942]/30 bg-[#f5b942]/10 px-2.5 py-1">
                <span className="font-mono text-[11px] font-semibold text-[#f5b942]">Au · XAUUSD</span>
                <span className="text-[10px] text-zinc-400">Spot Gold · Dealing Range</span>
              </div>
              <div className="hidden lg:flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-[#11161d] px-2.5 py-1.5 text-[12px] text-zinc-300">
                <Layers className="size-3.5 text-[#2979ff]" />
                <span className="font-mono text-[11px]">ICT Confluences:</span>
                <span className="font-mono font-semibold text-[#00c853]">4/4 Match</span>
              </div>
            </>
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Open live room"
            title="Live room"
            onClick={() => setRoomOpen(true)}
            className="rounded-sm border border-white/[0.08] hover:border-accent/40 hover:text-accent"
          >
            <Users className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Settings"
            title="Settings"
            onClick={() => setSettingsOpen(true)}
            className="rounded-sm border border-white/[0.08] hover:border-white/[0.2]"
          >
            <Settings2 className="size-4" aria-hidden="true" />
          </Button>
          <span
            role="status"
            title={syncLabel}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium",
              syncStatus === "error" ? "text-down" : "text-muted-foreground",
            )}
          >
            <SyncIcon
              className={cn("size-3.5", (syncStatus === "saving" || syncStatus === "loading") && "animate-pulse")}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">
              {isWeeklyProfile && syncStatus === "saved" ? "Cloud sync active" : syncLabel}
            </span>
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfluenceOpen(true)}
            className="hidden sm:inline-flex items-center gap-1.5 border-white/[0.1] bg-white/[0.03] text-xs text-white hover:border-accent/50 hover:bg-white/[0.06]"
            aria-label="Pre-flight Confluence Grader"
            title="Pre-flight Confluence Grader"
          >
            <ShieldCheck className="size-3.5 text-accent" />
            <span>Confluence</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setTradeOpen(true)}
            className="gap-1.5 transition-transform active:scale-95"
            aria-label="Quick trade"
          >
            <Plus className="size-4 shrink-0" aria-hidden="true" />
            <span className="text-xs font-semibold">Quick trade</span>
          </Button>
        </header>

        <main
          className={cn(
            "mx-auto w-full flex-1",
            fullWidth
              ? "max-w-[1920px] px-2 sm:px-4 md:px-5 py-2 sm:py-3 pb-18 lg:pb-3 flex flex-col min-h-0"
              : "max-w-6xl px-4 py-6 pb-24 md:px-8 md:pb-12",
            contentClassName,
          )}
        >
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-white/[0.08] bg-black/90 backdrop-blur-xl lg:hidden">
        {MOBILE.map((item) => {
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium tracking-wide uppercase transition-colors",
                active ? "text-accent" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active ? (
                <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-accent" aria-hidden="true" />
              ) : null}
              <item.icon className="size-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium tracking-wide uppercase",
              MOBILE_MORE.some((item) => item.to === pathname)
                ? "text-accent"
                : "text-muted-foreground",
            )}
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
            More
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="mb-2 border-white/[0.12] bg-popover">
            {MOBILE_MORE.map((item) => (
              <DropdownMenuItem key={item.to} onSelect={() => void navigate({ to: item.to })}>
                {item.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onSelect={() => setRoomOpen(true)}>Live room</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>Settings</DropdownMenuItem>
            <DropdownMenuItem onSelect={handleMobileSignOut}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      <TradeWizard open={tradeOpen} onOpenChange={setTradeOpen} trade={null} />
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
      <RoomSheet open={roomOpen} onOpenChange={setRoomOpen} />
      <ConfluenceGraderModal
        open={confluenceOpen}
        onOpenChange={setConfluenceOpen}
        onTakeTrade={() => {
          setConfluenceOpen(false);
          setTradeOpen(true);
        }}
      />
    </div>
  );
}
