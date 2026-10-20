import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { REQUIRED_PERMISSIONS } from "../dist/src/auth/auth.decorators.js";
import { CashFlowController } from "../dist/src/cash-flow/cash-flow.controller.js";
import {
  CashFlowForecastQueryDto,
  UpdateCashFlowConfigurationDto,
} from "../dist/src/cash-flow/cash-flow.dto.js";
import {
  addDays,
  buildCashFlowForecast,
  centsToMoney,
  moneyToCents,
} from "../dist/src/cash-flow/cash-flow-forecast.engine.js";

const base = (overrides = {}) => ({
  from: "2026-10-20",
  horizonDays: 30,
  scenario: "EXPECTED",
  currency: "USD",
  openingBalanceCents: 100_00n,
  expectedCollectionDelayDays: 7,
  conservativeDelayAdjustmentDays: 14,
  optimisticDelayAdjustmentDays: 0,
  events: [],
  ...overrides,
});
const event = (overrides = {}) => ({
  id: "one",
  source: "INVOICE",
  direction: "INFLOW",
  date: "2026-10-20",
  amountCents: 10_00n,
  label: "INV-1",
  ...overrides,
});

for (const [input, cents] of [
  ["0", 0n],
  ["1", 100n],
  ["1.2", 120n],
  ["1.23", 123n],
  ["-4.50", -450n],
])
  test(`money parser preserves cents for ${input}`, () => assert.equal(moneyToCents(input), cents));
for (const [cents, output] of [
  [0n, "0.00"],
  [1n, "0.01"],
  [120n, "1.20"],
  [-450n, "-4.50"],
])
  test(`money formatter preserves cents for ${cents}`, () =>
    assert.equal(centsToMoney(cents), output));

test("invalid money is rejected", () => assert.throws(() => moneyToCents("1.234")));
test("date arithmetic crosses month boundaries", () =>
  assert.equal(addDays("2026-10-31", 1), "2026-11-01"));
test("forecast emits one point per day", () =>
  assert.equal(buildCashFlowForecast(base()).daily.length, 30));
test("inflows increase closing balance", () =>
  assert.equal(
    buildCashFlowForecast(base({ events: [event()] })).summary.projectedClosingBalance,
    "110.00",
  ));
test("outflows decrease closing balance", () =>
  assert.equal(
    buildCashFlowForecast(
      base({ events: [event({ source: "FINALIZED_PAYROLL", direction: "OUTFLOW" })] }),
    ).summary.projectedClosingBalance,
    "90.00",
  ));
test("net is inflows minus outflows", () =>
  assert.equal(
    buildCashFlowForecast(
      base({
        events: [
          event(),
          event({
            id: "two",
            source: "APPROVED_EXPENSE",
            direction: "OUTFLOW",
            amountCents: 3_00n,
          }),
        ],
      }),
    ).summary.projectedNet,
    "7.00",
  ));
test("closing balance remains unavailable without opening balance", () =>
  assert.equal(
    buildCashFlowForecast(base({ openingBalanceCents: null, events: [event()] })).summary
      .projectedClosingBalance,
    null,
  ));
test("events before range are excluded", () =>
  assert.equal(
    buildCashFlowForecast(base({ events: [event({ date: "2026-10-19" })] })).events.length,
    0,
  ));
test("events after range are excluded", () =>
  assert.equal(
    buildCashFlowForecast(base({ events: [event({ date: "2026-11-19" })] })).events.length,
    0,
  ));
test("last horizon day is included", () =>
  assert.equal(
    buildCashFlowForecast(base({ events: [event({ date: "2026-11-18" })] })).events.length,
    1,
  ));
test("expected scenario applies configured delay", () =>
  assert.equal(
    buildCashFlowForecast(base({ events: [event({ scenarioDelay: true })] })).events[0].date,
    "2026-10-27",
  ));
test("conservative scenario adds delay adjustment", () =>
  assert.equal(
    buildCashFlowForecast(
      base({ scenario: "CONSERVATIVE", events: [event({ scenarioDelay: true })] }),
    ).events[0].date,
    "2026-11-10",
  ));
test("optimistic scenario uses its explicit delay", () =>
  assert.equal(
    buildCashFlowForecast(
      base({
        scenario: "OPTIMISTIC",
        optimisticDelayAdjustmentDays: 2,
        events: [event({ scenarioDelay: true })],
      }),
    ).events[0].date,
    "2026-10-22",
  ));
test("non-collection events are not scenario shifted", () =>
  assert.equal(
    buildCashFlowForecast(
      base({
        scenario: "CONSERVATIVE",
        events: [event({ source: "FINALIZED_PAYROLL", direction: "OUTFLOW" })],
      }),
    ).events[0].date,
    "2026-10-20",
  ));
test("overdue balance includes marked receivables", () =>
  assert.equal(
    buildCashFlowForecast(base({ events: [event({ overdue: true })] })).summary.overdueReceivables,
    "10.00",
  ));
test("source totals aggregate exact cents", () =>
  assert.equal(
    buildCashFlowForecast(base({ events: [event(), event({ id: "two", amountCents: 1n })] }))
      .breakdown[0].amount,
    "10.01",
  ));
test("same-day ordering is stable by id", () =>
  assert.deepEqual(
    buildCashFlowForecast(base({ events: [event({ id: "z" }), event({ id: "a" })] })).events.map(
      (item) => item.id,
    ),
    ["a", "z"],
  ));
test("assumption labels survive serialization", () =>
  assert.equal(
    buildCashFlowForecast(base({ events: [event({ assumption: "Planning only" })] })).events[0]
      .assumption,
    "Planning only",
  ));
test("forecast endpoint requires cash-flow read permission", () =>
  assert.deepEqual(
    Reflect.getMetadata(REQUIRED_PERMISSIONS, CashFlowController.prototype.forecast),
    ["cash-flow:read"],
  ));
test("configuration update requires manage permission", () =>
  assert.deepEqual(
    Reflect.getMetadata(REQUIRED_PERMISSIONS, CashFlowController.prototype.updateConfiguration),
    ["cash-flow:manage"],
  ));
test("forecast query rejects excessive horizons", async () =>
  assert.ok(
    (await validate(plainToInstance(CashFlowForecastQueryDto, { horizonDays: 366 }))).length,
  ));
test("forecast query rejects unknown scenarios", async () =>
  assert.ok(
    (await validate(plainToInstance(CashFlowForecastQueryDto, { scenario: "MAGICAL" }))).length,
  ));
test("configuration accepts initial version zero", async () =>
  assert.equal(
    (await validate(plainToInstance(UpdateCashFlowConfigurationDto, { expectedVersion: 0 })))
      .length,
    0,
  ));
test("configuration rejects money with excess precision", async () =>
  assert.ok(
    (
      await validate(
        plainToInstance(UpdateCashFlowConfigurationDto, {
          expectedVersion: 1,
          openingBalance: "1.234",
        }),
      )
    ).length,
  ));
