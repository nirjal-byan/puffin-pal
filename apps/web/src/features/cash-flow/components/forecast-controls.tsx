import type { Permission } from "@puffinpal/permissions";
import { Dropdown } from "@/components/ui/dropdown";
import type { CashFlowScenario } from "../types";
import { cashFlowSourceLabel } from "../utils";

export function ForecastControls({
  scenario,
  horizon,
  customHorizon,
  permissions,
  onScenarioChange,
  onHorizonChange,
  onCustomChange,
  onConfigure,
}: {
  scenario: CashFlowScenario;
  horizon: number;
  customHorizon: boolean;
  permissions: readonly Permission[];
  onScenarioChange: (value: CashFlowScenario) => void;
  onHorizonChange: (value: number) => void;
  onCustomChange: (value: boolean) => void;
  onConfigure: () => void;
}) {
  return (
    <section className="cash-flow-toolbar panel">
      <div>
        <strong>Forecast controls</strong>
        <span>Compare timing assumptions without changing financial records.</span>
      </div>
      <div className="cash-flow-controls">
        <div className="dashboard-presets" aria-label="Forecast scenario">
          {(["CONSERVATIVE", "EXPECTED", "OPTIMISTIC"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={`button ${scenario === value ? "primary" : "secondary"}`}
              onClick={() => onScenarioChange(value)}
            >
              {cashFlowSourceLabel(value)}
            </button>
          ))}
        </div>
        <label>
          Horizon
          <Dropdown
            name="forecast-horizon"
            label="Forecast horizon"
            searchable={false}
            options={[
              { value: "30", label: "30 days" },
              { value: "60", label: "60 days" },
              { value: "90", label: "90 days" },
              { value: "custom", label: "Custom" },
            ]}
            value={customHorizon ? "custom" : String(horizon)}
            onChange={(value) => {
              if (value === "custom") onCustomChange(true);
              else {
                onCustomChange(false);
                onHorizonChange(Number(value));
              }
            }}
          />
        </label>
        {customHorizon && (
          <label>
            Days
            <input
              type="number"
              min="1"
              max="365"
              value={horizon}
              onChange={(event) =>
                onHorizonChange(Math.min(365, Math.max(1, Number(event.target.value))))
              }
            />
          </label>
        )}
        {permissions.includes("cash-flow:manage") && (
          <button type="button" className="button secondary" onClick={onConfigure}>
            Configure
          </button>
        )}
      </div>
    </section>
  );
}
