"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  max,
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
  max?: string;
  disabled?: boolean;
  ariaLabel: string;
  invalid?: boolean;
  describedBy?: string;
  tabSuggestion?: string;
}) {
  const selected = parseDate(value);
  const minimum = min ? parseDate(min) : undefined;
  const maximum = max ? parseDate(max) : undefined;
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    dialog: HTMLDialogElement | null;
  } | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => selected ?? minimum ?? new Date());
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const calendarId = useId();

  useEffect(() => {
    function close(event: PointerEvent) {
      if (
        !rootRef.current?.contains(event.target as Node) &&
        !panelRef.current?.contains(event.target as Node)
      )
        setPosition(null);
    }
    function dismiss() {
      setPosition(null);
    }
    document.addEventListener("pointerdown", close);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, []);

  function toggle() {
    if (disabled) return;
    if (position) {
      setPosition(null);
      return;
    }
    setVisibleMonth(selected ?? minimum ?? new Date());
    const trigger = rootRef.current!.querySelector("button")!;
    const rect = trigger.getBoundingClientRect();
    const dialog = trigger.closest("dialog");
    const dialogRect = dialog?.getBoundingClientRect();
    const top = 8;
    const bottom = window.innerHeight - 8;
    const left = 8;
    const right = window.innerWidth - 8;
    const width = 252;
    const estimatedHeight = 286;
    const openBelow = bottom - rect.bottom >= estimatedHeight || rect.top - top < estimatedHeight;
    const screenLeft = Math.max(left + 12, Math.min(rect.left, right - width - 12));
    const preferredTop = openBelow ? rect.bottom + 8 : rect.top - estimatedHeight - 8;
    const screenTop = Math.max(top, Math.min(preferredTop, bottom - estimatedHeight));
    setPosition({
      left: dialogRect ? screenLeft - dialogRect.left : screenLeft,
      top: dialogRect ? screenTop - dialogRect.top : screenTop,
      dialog,
    });
  }

  return (
    <div
      className="date-picker"
      ref={rootRef}
      onKeyDown={(event) => {
        if (event.key === "Escape") setPosition(null);
      }}
    >
      <button
        type="button"
        className="date-picker-trigger"
        onClick={toggle}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={Boolean(position)}
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
          <path
            d="M7 3v3m10-3v3M4.5 9h15M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <input type="hidden" name={name} value={value} />
      {position &&
        createPortal(
          <div
            ref={panelRef}
            className={`date-picker-popover date-picker-popover-floating${position.dialog ? " date-picker-popover-dialog" : ""}`}
            id={calendarId}
            role="dialog"
            aria-label={`${ariaLabel} calendar`}
            style={{ top: position.top, left: position.left }}
          >
            <div className="date-picker-header">
              <strong>
                {visibleMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </strong>
              <div>
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() =>
                    setVisibleMonth(
                      new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1),
                    )
                  }
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() =>
                    setVisibleMonth(
                      new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1),
                    )
                  }
                >
                  ›
                </button>
              </div>
            </div>
            <div className="date-picker-weekdays" aria-hidden="true">
              {WEEKDAYS.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="date-picker-days">
              {monthDays(visibleMonth).map((date) => {
                const dateValue = toValue(date);
                const outside = date.getMonth() !== visibleMonth.getMonth();
                const isSelected = dateValue === value;
                const unavailable = Boolean(
                  (minimum && date < minimum) || (maximum && date > maximum),
                );
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
                    onClick={() => {
                      onChange(dateValue);
                      setPosition(null);
                    }}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="date-picker-footer">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setPosition(null);
                }}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  const today = new Date();
                  const afterMinimum = minimum && today < minimum ? minimum : today;
                  const next = maximum && afterMinimum > maximum ? maximum : afterMinimum;
                  onChange(toValue(next));
                  setPosition(null);
                }}
              >
                Today
              </button>
            </div>
          </div>,
          position.dialog ?? document.body,
        )}
    </div>
  );
}
