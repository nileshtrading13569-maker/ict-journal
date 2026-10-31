import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Panel } from "@/components/desk/fields";
import { buildActivityCalendar, type ActivityDay } from "@/lib/activity-calendar";
import type { DeskData } from "@/lib/ict-types";
import { formatR } from "@/lib/utils";

type ProgressTrackerProps = {
  data: Pick<DeskData, "checklistItems" | "checks" | "trades">;
  today: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onOpenChecklist: () => void;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LEVEL_STYLES = [
  "bg-white/[0.04]",
  "bg-accent/25",
  "bg-accent/45",
  "bg-accent/70",
  "bg-accent",
];

function formatCalendarDate(date: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00.000Z`),
  );
}

function dayDescription(day: ActivityDay) {
  const tradeLabel = `${day.trades} trade${day.trades === 1 ? "" : "s"}`;
  const result = day.trades ? `, ${formatR(day.netR)} realized` : "";
  return `${formatCalendarDate(day.date, { month: "short", day: "numeric", year: "numeric" })}: ${day.checked}/${day.total} core checks, ${tradeLabel}${result}`;
}

export function ProgressTracker({
  data,
  today,
  selectedDate,
  onSelectDate,
  onOpenChecklist,
}: ProgressTrackerProps) {
  const [showFullYear, setShowFullYear] = useState(false);
  const coreChecklistIds = data.checklistItems
    .filter((item) => item.group === "core")
    .map((item) => item.id);
  const weeks = buildActivityCalendar({
    endDate: today,
    weeks: showFullYear ? 52 : 26,
    coreChecklistIds,
    checks: data.checks,
    trades: data.trades,
  });
  const checkedIds = new Set(data.checks[selectedDate] ?? []);
  const checked = coreChecklistIds.filter((id) => checkedIds.has(id)).length;
  const total = coreChecklistIds.length;
  const scoreLabel =
    selectedDate === today
      ? "Today's score"
      : `${formatCalendarDate(selectedDate, { month: "short", day: "numeric" })} score`;
  const monthLabels = weeks.flatMap((week, weekIndex) => {
    const month = week[0].date.slice(0, 7);
    const previousMonth = weeks[weekIndex - 1]?.[0].date.slice(0, 7);
    if (weekIndex === 0 || month !== previousMonth) {
      return [{ weekIndex, date: week[0].date }];
    }
    return [];
  });

  return (
    <Panel
      className="mb-5"
      kicker={`Consistency · last ${showFullYear ? "12" : "6"} months`}
      title="Progress tracker"
      titleAction={
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onOpenChecklist}
          aria-controls="daily-checklist"
        >
          Daily checklist
        </Button>
      }
      action={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowFullYear((expanded) => !expanded)}
          aria-expanded={showFullYear}
        >
          {showFullYear ? "Show less" : "View more"}
        </Button>
      }
    >
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max gap-2">
          <div className="flex shrink-0 flex-col gap-1 pt-4" aria-hidden="true">
            {WEEKDAYS.map((weekday) => (
              <span
                key={weekday}
                className="flex h-3 w-7 items-center text-[9px] leading-none text-muted-foreground"
              >
                {weekday}
              </span>
            ))}
          </div>
          <div>
            <div className="relative mb-1 h-3" style={{ width: `${weeks.length * 20 - 8}px` }} aria-hidden="true">
              {monthLabels.map(({ weekIndex, date }) => (
                <span
                  key={date}
                  className="absolute whitespace-nowrap text-[9px] leading-none tracking-wider text-muted-foreground uppercase"
                  style={{ left: `${weekIndex * 20}px` }}
                >
                  {formatCalendarDate(date, { month: "short" })}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              {weeks.map((week) => (
                <div key={week[0].date} className="flex w-3 flex-col gap-1">
                  {week.map((day) =>
                    day.isFuture ? (
                      <span key={day.date} className="size-3 rounded-xs bg-white/[0.02]" aria-hidden="true" />
                    ) : (
                      <button
                        key={day.date}
                        type="button"
                        title={dayDescription(day)}
                        aria-label={dayDescription(day)}
                        aria-pressed={selectedDate === day.date}
                        onClick={() => onSelectDate(day.date)}
                        className={`size-3 rounded-xs ${LEVEL_STYLES[day.level]} transition-colors hover:ring-1 hover:ring-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                          selectedDate === day.date ? "ring-1 ring-accent" : ""
                        }`}
                      />
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-4">
        <div className="w-28 shrink-0">
          <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            {scoreLabel}
          </p>
          <p className="font-mono text-base font-semibold leading-tight text-foreground">
            {checked}/{total}
          </p>
        </div>
        <Progress value={total ? (checked / total) * 100 : 0} className="min-w-40 flex-1" />
      </div>

      <div className="mt-3 flex items-center justify-end gap-1.5 text-[9px] tracking-wider text-muted-foreground uppercase">
        <span>Less</span>
        {LEVEL_STYLES.map((style) => (
          <span key={style} className={`size-2 rounded-xs ${style}`} aria-hidden="true" />
        ))}
        <span>More</span>
      </div>
    </Panel>
  );
}
