import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NAV,
  NAV_SECTIONS,
  resolveTab,
  sectionForTab,
  tabHref,
  visibleNavigationSections,
} from "../src/lib/navigation.ts";

test("navigation sections follow the primary product workflow and include every destination", () => {
  assert.deepEqual(
    NAV_SECTIONS.map((section) => section.key),
    ["workspace", "cash-flow", "payroll", "people", "settings"],
  );
  const destinations = NAV_SECTIONS.flatMap((section) => section.tabs);
  const tabs = new Set(destinations);
  assert.equal(destinations.length, NAV.length);
  assert.deepEqual([...tabs].sort(), NAV.map((item) => item.key).sort());
});

test("features belong to a single, predictable top-level section", () => {
  for (const tab of ["overview", "clients", "invoices", "retainers", "expenses"])
    assert.equal(sectionForTab(tab).key, "workspace");
  for (const tab of ["cash-flow", "banking", "vendors", "accounts-payable", "reports"])
    assert.equal(sectionForTab(tab).key, "cash-flow");
  assert.equal(sectionForTab("payroll").key, "payroll");
  assert.equal(sectionForTab("payroll-automation").key, "payroll");
  for (const tab of ["employees", "attendance", "leave", "overtime", "members"])
    assert.equal(sectionForTab(tab).key, "people");
  for (const tab of ["profile", "password", "access"])
    assert.equal(sectionForTab(tab).key, "settings");
});

test("finance navigation is visible when any finance destination is permitted", () => {
  assert.equal(
    visibleNavigationSections(["profile:read"]).some((item) => item.key === "cash-flow"),
    false,
  );
  assert.equal(
    visibleNavigationSections(["banking:read"]).some((item) => item.key === "cash-flow"),
    true,
  );
});

test("legacy areas cannot move a destination into an unrelated section", () => {
  const url = new URL(tabHref("clients"), "http://localhost");
  const tab = resolveTab(url.pathname, url.searchParams.get("section"));
  assert.equal(tab, "clients");
  assert.equal(sectionForTab(tab, url.searchParams.get("area")).key, "workspace");
  assert.equal(sectionForTab("clients", "people").key, "workspace");
  assert.equal(sectionForTab("invoices", "people").key, "workspace");
  assert.equal(sectionForTab("access", "workspace").key, "settings");
});

test("top-level navigation hides sections with no permitted destination", () => {
  assert.deepEqual(
    visibleNavigationSections(["profile:read", "cash-flow:read"]).map((section) => section.key),
    ["workspace", "cash-flow", "settings"],
  );
});

test("every destination round-trips through its URL", () => {
  for (const { key } of NAV) {
    const url = new URL(tabHref(key), "http://localhost");
    assert.equal(resolveTab(url.pathname, url.searchParams.get("section")), key);
  }
});

test("invoice routes override queries; legacy links and invalid queries are handled", () => {
  assert.equal(resolveTab("/invoices/new", "clients"), "invoices");
  assert.equal(resolveTab("/invoices", "access"), "invoices");
  assert.equal(resolveTab("/", "invoices"), "invoices");
  assert.equal(resolveTab("/", "access"), "access");
  assert.equal(resolveTab("/", "not-a-page"), "overview");
});
