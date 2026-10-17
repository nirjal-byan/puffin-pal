"use client";

import { useEffect, useId, useRef, useState } from "react";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day) : undefined;
}

function toValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cellCount = Math.ceil((first.getDay() + daysInMonth) / 7) * 7;
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  return Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function DatePicker({
  value,
  onChange,
  name,
  min,
  disabled,
  ariaLabel,
  invalid,
  describedBy,
  tabSuggestion,
}: {
  value: string;
  onChange: (value: string) => void;
  name?: string;
  min?: string;
  disabled?: boolean;
  ariaLabel: string;
  invalid?: boolean;
  describedBy?: string;
  tabSuggestion?: string;
}) {
  const selected = parseDate(value);
  const minimum = min ? parseDate(min) : undefined;
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(
    () => selected ?? minimum ?? new Date(),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const calendarId = useId();

  useEffect(() => {
    function close(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  function toggle() {
    if (disabled) return;
    if (!open) setVisibleMonth(selected ?? minimum ?? new Date());
    setOpen((current) => !current);
  }

  return (
    <div className="date-picker" ref={rootRef} onKeyDown={(event) => {
      if (event.key === "Escape") setOpen(false);
    }}>
      <button
        type="button"
        className="date-picker-trigger"
        onClick={toggle}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={calendarId}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        data-tour-suggestion={tabSuggestion}
        onKeyDown={(event) => {
          if (event.key === "Tab" && !event.shiftKey && !value && tabSuggestion) {
            event.preventDefault();
            onChange(tabSuggestion);
          }
        }}
      >
        <span className={value ? "" : "date-picker-placeholder"}>
          {selected
            ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(selected)
            : "Select date"}
        </span>
        <svg className="date-picker-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none">
          <path d="M7 3v3m10-3v3M4.5 9h15M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>
      <input type="hidden" name={name} value={value} />
      {open && (
        <div className="date-picker-popover" id={calendarId} role="dialog" aria-label={`${ariaLabel} calendar`}>
          <div className="date-picker-header">
            <strong>{visibleMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong>
            <div>
              <button type="button" aria-label="Previous month" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}>‹</button>
              <button type="button" aria-label="Next month" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}>›</button>
            </div>
          </div>
          <div className="date-picker-weekdays" aria-hidden="true">
            {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="date-picker-days">
            {monthDays(visibleMonth).map((date) => {
              const dateValue = toValue(date);
              const outside = date.getMonth() !== visibleMonth.getMonth();
              const isSelected = dateValue === value;
              const unavailable = Boolean(minimum && date < minimum);
              if (outside) {
                return <span className="date-picker-empty" key={dateValue} aria-hidden="true" />;
              }
              return (
                <button
                  type="button"
                  key={dateValue}
                  className={isSelected ? "selected" : undefined}
                  disabled={unavailable}
                  aria-pressed={isSelected}
                  onClick={() => { onChange(dateValue); setOpen(false); }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          <div className="date-picker-footer">
            <button type="button" onClick={() => { onChange(""); setOpen(false); }}>Clear</button>
            <button type="button" onClick={() => {
              const today = new Date();
              const next = minimum && today < minimum ? minimum : today;
              onChange(toValue(next)); setOpen(false);
            }}>Today</button>
          </div>
        </div>
      )}
    </div>
  );
}
