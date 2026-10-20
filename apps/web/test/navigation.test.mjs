import { test } from "node:test";
import assert from "node:assert/strict";
import { NAV, NAV_SECTIONS, resolveTab, sectionForTab, tabHref } from "../lib/navigation.ts";

test("navigation sections include the dedicated payroll area and all destinations", () => {
  assert.deepEqual(
    NAV_SECTIONS.map((section) => section.key),
    ["workspace", "payroll", "people", "settings"],
  );
  const tabs = new Set(NAV_SECTIONS.flatMap((section) => section.tabs));
  assert.deepEqual([...tabs].sort(), NAV.map((item) => item.key).sort());
});

test("main features belong to Workspace and access belongs to Settings", () => {
  for (const tab of ["overview", "invoices", "expenses", "retainers", "cash-flow"])
    assert.equal(sectionForTab(tab).key, "workspace");
  assert.equal(sectionForTab("payroll").key, "payroll");
  for (const tab of ["clients", "employees", "members"])
    assert.equal(sectionForTab(tab).key, "people");
  for (const tab of ["profile", "password", "access"])
    assert.equal(sectionForTab(tab).key, "settings");
});

test("client links retain their section without permitting unrelated sections", () => {
  const url = new URL(tabHref("clients", "workspace"), "http://localhost");
  const tab = resolveTab(url.pathname, url.searchParams.get("section"));
  assert.equal(tab, "clients");
  assert.equal(sectionForTab(tab, url.searchParams.get("area")).key, "workspace");
  assert.equal(sectionForTab("clients", "people").key, "people");
  assert.equal(sectionForTab("invoices", "people").key, "workspace");
  assert.equal(sectionForTab("access", "workspace").key, "settings");
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
