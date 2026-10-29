import type { Dispatch, SetStateAction } from "react";
import type { DashboardPreset } from "../types";
import { dashboardPresetRange } from "../utils";

type Range = { from: string; to: string };
export function DashboardPeriodFilter({
  preset,
  draftRange,
  setPreset,
  setDraftRange,
  setRange,
}: {
  preset: DashboardPreset;
  draftRange: Range;
  setPreset: Dispatch<SetStateAction<DashboardPreset>>;
  setDraftRange: Dispatch<SetStateAction<Range>>;
  setRange: Dispatch<SetStateAction<Range>>;
}) {
  function choosePreset(next: Exclude<DashboardPreset, "custom">) {
    const nextRange = dashboardPresetRange(next);
    setPreset(next);
    setDraftRange(nextRange);
    setRange(nextRange);
  }
  return (
    <div className="dashboard-filters" aria-label="Reporting period">
      <div className="dashboard-presets">
        {(
          [
            ["month", "Month"],
            ["30", "30 days"],
            ["90", "90 days"],
            ["year", "Year"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`button compact ${preset === value ? "primary" : "secondary"}`}
            onClick={() => choosePreset(value)}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className={`button compact ${preset === "custom" ? "primary" : "secondary"}`}
          onClick={() => setPreset("custom")}
        >
          Custom
        </button>
      </div>
      {preset === "custom" && (
        <div className="dashboard-custom-range">
          <label>
            From
            <input
              type="date"
              value={draftRange.from}
              max={draftRange.to}
              onChange={(event) =>
                setDraftRange((current) => ({ ...current, from: event.target.value }))
              }
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={draftRange.to}
              min={draftRange.from}
              onChange={(event) =>
                setDraftRange((current) => ({ ...current, to: event.target.value }))
              }
            />
          </label>
          <button
            type="button"
            className="button primary compact"
            disabled={!draftRange.from || !draftRange.to || draftRange.from > draftRange.to}
            onClick={() => setRange(draftRange)}
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
