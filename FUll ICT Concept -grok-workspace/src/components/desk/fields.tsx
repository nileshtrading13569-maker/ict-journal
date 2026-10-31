import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { parseNum } from "@/lib/utils";

export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">{label}</span>
      {children}
      {hint ? <span className="text-xs text-subtle">{hint}</span> : null}
    </div>
  );
}

export function NumField({
  label,
  value,
  onChange,
  step = "any",
  placeholder,
  className,
}: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
  step?: string;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value == null ? "" : String(value));
  }, [editing, value]);

  return (
    <Field label={label} className={className}>
      <Input
        type="text"
        inputMode="decimal"
        step={step}
        placeholder={placeholder}
        value={draft}
        onFocus={() => setEditing(true)}
        onBlur={() => setEditing(false)}
        onChange={(e) => {
          const next = e.target.value;
          setDraft(next);
          onChange(parseNum(next));
        }}
      />
    </Field>
  );
}

/*
 * The one card in the system. Layered black, hairline border, and a thin red
 * rule across the top edge that marks it as a featured surface.
 */
export function Panel({
  kicker,
  title,
  meta,
  action,
  titleAction,
  children,
  className,
  bodyClassName,
}: {
  kicker?: string;
  title?: string;
  meta?: string;
  action?: ReactNode;
  /* Sits directly under the title for a primary action that belongs to the heading. */
  titleAction?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/[0.09] bg-card/85 transition-colors duration-200 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-accent/60 before:to-transparent hover:border-white/[0.16]",
        className,
      )}
    >
      {kicker || title || action || titleAction || meta ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            {kicker ? (
              <p className="text-[10px] font-semibold tracking-[0.16em] text-accent uppercase">{kicker}</p>
            ) : null}
            {title ? (
              <h2 className="mt-1 font-display text-2xl font-normal leading-tight tracking-wide text-foreground">
                {title}
              </h2>
            ) : null}
            {titleAction ? (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">{titleAction}</div>
            ) : null}
            {meta ? <p className="mt-1 text-xs text-muted-foreground">{meta}</p> : null}
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </header>
      ) : null}
      <div className={cn("p-5 sm:p-6", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
  multiple = false,
}: {
  options: readonly T[] | readonly { value: T; label: string }[];
  value: T | T[] | "";
  onChange: (next: T | T[]) => void;
  multiple?: boolean;
}) {
  const items = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const selected = new Set(Array.isArray(value) ? value : value ? [value] : []);

  function toggle(v: T) {
    if (multiple) {
      const next = new Set(selected);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      onChange([...next] as T[]);
    } else {
      onChange(v);
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((o) => {
        const on = selected.has(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(o.value)}
            className={cn(
              "h-8 rounded-md border px-3 text-xs font-medium transition-all duration-150 active:scale-[0.97]",
              on
                ? "border-accent bg-accent text-primary-foreground font-semibold shadow-[0_8px_18px_-12px_rgba(229,9,20,0.9)]"
                : "border-white/[0.1] bg-white/[0.03] text-foreground/75 hover:border-white/[0.24] hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function BoolRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={value}
      onClick={() => onChange(!value)}
      className={cn(
        "flex h-11 items-center justify-between gap-3 rounded-lg border px-3.5 text-left text-sm transition-all duration-150 active:scale-[0.99]",
        value
          ? "border-up/35 bg-up/[0.07] text-foreground"
          : "border-white/[0.09] bg-white/[0.02] text-foreground/75 hover:border-white/[0.2] hover:text-foreground",
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]",
          value ? "border-up/30 bg-up/10 text-up" : "border-white/[0.1] bg-white/[0.04] text-subtle",
        )}
      >
        {value ? "Yes" : "No"}
      </span>
    </button>
  );
}

export function TriRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex gap-1.5">
        {(
          [
            [true, "Correct"],
            [false, "Wrong"],
            [null, "—"],
          ] as const
        ).map(([v, lab]) => (
          <button
            key={lab}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={cn(
              "h-8 rounded-md border px-2.5 text-xs font-medium transition-all active:scale-[0.97]",
              value === v
                ? v === true
                  ? "border-up/40 bg-up/15 text-up font-semibold"
                  : v === false
                    ? "border-down/40 bg-down/15 text-down font-semibold"
                    : "border-accent bg-accent text-primary-foreground font-semibold"
                : "border-white/[0.1] bg-white/[0.03] text-foreground/70 hover:border-white/[0.22] hover:text-foreground",
            )}
          >
            {lab}
          </button>
        ))}
      </div>
    </div>
  );
}
