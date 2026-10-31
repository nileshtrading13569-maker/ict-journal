export interface NotebookEntry {
  id: string;
  folder: string;
  title: string;
  subDate?: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
  tags: string[];
  content: string;
  // Performance metrics (either auto-computed or manually overridden)
  manualMetrics?: {
    netPnl: number;
    grossPnl: number;
    commissions: number;
    totalTrades: number;
    winners: number;
    losers: number;
    winrate: number;
    volume: number;
    profitFactor: number;
  };
}

export const DEFAULT_FOLDERS: string[] = [
  "All notes",
  "Trade Notes",
  "Daily Journal",
  "Sessions Recap",
  "My notes",
];

export const SEED_NOTES: NotebookEntry[] = [
  {
    id: "day-2024-06-28",
    folder: "Daily Journal",
    title: "Fri Jun 28, 2024",
    subDate: "07/01/2025",
    date: "2024-06-28",
    createdAt: "Jul 01, 2025 05:18PM",
    updatedAt: "Jul 01, 2025 05:18PM",
    pinned: true,
    tags: ["NY AM", "XAUUSD", "Displacement"],
    manualMetrics: {
      netPnl: 185.47,
      grossPnl: 200.0,
      commissions: 14.53,
      totalTrades: 2,
      winners: 1,
      losers: 1,
      winrate: 50,
      volume: 11,
      profitFactor: 24.50697,
    },
    content: `## 🎯 NY AM Session Tape & Execution Narrative
Market opened with a clean Judas swing clearing previous session high at **2,338.50** before immediate aggressive displacement downward into 5m Fair Value Gap.

> **⚡ Rule Confluence Check**
> - HTF Daily bias was confirmed Bearish into sell-side liquidity.
> - 09:30 NY open purged Asian Session High liquidity pool.
> - 5m Market Structure Shift left clear displacement FVG.
> - Risk managed strictly at 1.0% with TP at internal range low.

### ⏱️ Session Tape Log
- **09:35** - Expansion high into 4H bearish breaker.
- **09:48** - MSS confirmation with heavy sell volume displacement.
- **10:02** - Trade #1 entered on OTE 62% retracement; partials taken at 2R.
- **10:45** - Final runner closed before high-impact 11:00 news. Net P&L locked at +$185.47.`,
  },
  {
    id: "day-2024-06-24",
    folder: "Daily Journal",
    title: "Mon, Jun 24, 2024",
    subDate: "07/01/2025",
    date: "2024-06-24",
    createdAt: "Jul 01, 2025 04:10PM",
    updatedAt: "Jul 01, 2025 04:10PM",
    pinned: false,
    tags: ["London Open", "EURUSD", "Judas"],
    manualMetrics: {
      netPnl: 342.1,
      grossPnl: 370.0,
      commissions: 27.9,
      totalTrades: 3,
      winners: 2,
      losers: 1,
      winrate: 66.7,
      volume: 18,
      profitFactor: 8.45,
    },
    content: `## 📊 London Open Reversal Breakdown
Classic Monday weekly profile expansion. Asian range remained tight (18 pips). London swept Asian low at 02:15 GMT and rapidly reclaimed structure.

- Swept Asian Low (1.0825) by 8 pips
- Formed Bullish Order Block + 15m FVG
- Long execution delivered full TP into Asian High liquidity pool.`,
  },
  {
    id: "note-prep-1",
    folder: "Trade Notes",
    title: "Pre-Market Dealing Range Matrix",
    subDate: "07/01/2025",
    date: "2026-10-31",
    createdAt: "Oct 31, 2026 08:00AM",
    updatedAt: "Oct 31, 2026 08:30AM",
    pinned: true,
    tags: ["Playbook", "Rules", "HTF"],
    content: `## 📋 Pre-Market Dealing Range Blueprint
1. **Midnight Open**: Mark the 00:00 EST true day open price.
2. **Previous Day Range**: High (PDH), Low (PDL), and Consequent Encroachment (50%).
3. **Session High/Low**: Asian session high and low must be marked as primary external liquidity pools.
4. **Key Draw on Liquidity**: Determine whether algorithm seeks BSL or SSL first.`,
  },
  {
    id: "note-psych-1",
    folder: "Sessions Recap",
    title: "Weekly Psychology & Discipline Audit",
    subDate: "06/29/2025",
    date: "2026-10-25",
    createdAt: "Oct 25, 2026 06:00PM",
    updatedAt: "Oct 25, 2026 06:00PM",
    pinned: false,
    tags: ["Psychology", "Discipline"],
    content: `## 🧠 Weekly Mental Tape & Emotional Discipline
- **Zero revenge trades** taken across the entire week.
- Managed FOMO during midday chop by stepping away from screens post 11:30 AM EST.
- Adhered strictly to max 2 trades per session protocol.`,
  },
  {
    id: "note-my-1",
    folder: "My notes",
    title: "Algorithmic Delivery Rules & Kill Zones",
    subDate: "06/25/2025",
    date: "2026-10-20",
    createdAt: "Oct 20, 2026 02:15PM",
    updatedAt: "Oct 20, 2026 02:15PM",
    pinned: false,
    tags: ["ICT", "KillZone"],
    content: `## ⚡ Core Algorithmic Tenets
- Time + Price = Setup. Never compromise on the Kill Zone window.
- London Kill Zone: 02:00 - 05:00 EST.
- NY AM Kill Zone: 09:30 - 11:00 EST.
- If no displacement occurs within the kill zone, capital preservation is the winning trade.`,
  },
];
