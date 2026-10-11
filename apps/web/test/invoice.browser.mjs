/* eslint-disable turbo/no-undeclared-env-vars -- Standalone browser runner; never executed or cached by Turbo. */
import process from "node:process";
import { Buffer } from "node:buffer";
// Dependency-free real Chrome/CDP workflows. Use the isolated API script runner.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const api = process.env.TEST_API_URL,
  web = process.env.TEST_WEB_URL;
assert.equal(api, "http://localhost:3002/api/v1");
assert.equal(web, "http://localhost:3003");
assert.match(
  new URL(process.env.DATABASE_URL).pathname,
  /^\/puffinpal_browser_test_/,
);
const profile = await mkdtemp(join(tmpdir(), "puffinpal-chrome-"));
const chrome = spawn(
  process.env.CHROME_BIN ?? "google-chrome",
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--remote-debugging-port=9223",
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket,
  nextId = 0;
const waiting = new Map(),
  errors = [];
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    waiting.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails)
    throw Error(result.exceptionDetails.text + " " + result.result.description);
  return result.result.value;
}
async function until(expression) {
  for (let attempt = 0; attempt < 150; attempt++) {
    if (await evaluate(expression)) return;
    await pause(100);
  }
  throw Error(
    `Timed out: ${expression}\n${await evaluate("document.body.innerText")}`,
  );
}
const text = (value) =>
  `(document.body?.innerText ?? "").includes(${JSON.stringify(value)})`;
async function click(label) {
  await evaluate(
    `(() => { const e = [...document.querySelectorAll('button,a')].find(e => e.textContent.trim() === ${JSON.stringify(label)}); if (!e) throw Error('Missing action '+${JSON.stringify(label)}); e.click(); })()`,
  );
}
async function fill(selector, value) {
  await evaluate(
    `(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) throw Error('Missing input'); const p = e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : e.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(p, 'value').set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); })()`,
  );
}
async function request(path, token, body, method = "POST") {
  const response = await fetch(api + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  assert.ok(response.ok, JSON.stringify(data));
  return data;
}
async function login(email) {
  await command("Page.navigate", { url: web });
  await until("!!document.querySelector('[name=organizationSlug]')");
  await fill('[name="organizationSlug"]', "browser-invoices");
  await fill('[name="email"]', email);
  await fill('[name="password"]', "Browser-test-password-123");
  await evaluate(
    "document.querySelector('.auth-form-card form').requestSubmit()",
  );
  await until("!!document.querySelector('.workspace-main')");
}
async function navigate(path, expected) {
  await command("Page.navigate", { url: web + path });
  await until(text(expected));
}
try {
  let target;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      target = (await (await fetch("http://127.0.0.1:9223/json")).json()).find(
        (t) => t.type === "page",
      );
      if (target) break;
    } catch {
      /* startup */
    }
    await pause(100);
  }
  assert.ok(target, "Chrome did not start");
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  socket.onmessage = (event) => {
    const m = JSON.parse(event.data);
    if (m.id) {
      const p = waiting.get(m.id);
      waiting.delete(m.id);
      if (m.error) p?.reject(Error(m.error.message));
      else p?.resolve(m.result);
    }
    if (m.method === "Runtime.exceptionThrown")
      errors.push(m.params.exceptionDetails.text);
  };
  await command("Page.enable");
  await command("Runtime.enable");
  const password = "Browser-test-password-123";
  const owner = await request("/auth/signup", null, {
    organizationName: "Browser invoices",
    organizationSlug: "browser-invoices",
    fullName: "Browser owner",
    email: "owner@browser.test",
    password,
  });
  const client = await request("/clients", owner.accessToken, {
    name: "Browser client",
    email: "client@browser.test",
  });
  const input = {
    clientId: client.id,
    issueDate: "2026-10-10",
    dueDate: "2026-11-10",
    notes: "Original note",
    items: [
      { description: "First service", quantity: 3, unitPrice: "0.10" },
      { description: "Second service", quantity: 2, unitPrice: "12.25" },
    ],
  };
  const invoice = await request("/invoices", owner.accessToken, input);
  await login("owner@browser.test");
  await navigate(`/invoices/${invoice.id}`, "Browser client");
  assert.ok(await evaluate(text("USD 24.80")));
  assert.ok(await evaluate(text("Edit Draft")));
  assert.ok(await evaluate(text("Delete Draft")));
  const artifacts = join(tmpdir(), "puffinpal-invoice-browser");
  await mkdir(artifacts, { recursive: true });
  const screenshot = async (name) =>
    writeFile(
      join(artifacts, name),
      Buffer.from(
        (await command("Page.captureScreenshot", { format: "png" })).data,
        "base64",
      ),
    );
  await command("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await screenshot("detail-desktop.png");
  await click("Edit Draft");
  await until("!!document.querySelector('[aria-label=\"Description 1\"]')");
  assert.equal(
    await evaluate(
      "document.querySelector('[aria-label=\"Description 1\"]').value",
    ),
    "First service",
  );
  assert.equal(
    await evaluate(
      "document.querySelector('[aria-label=\"Description 2\"]').value",
    ),
    "Second service",
  );
  await until(
    `!!document.querySelector('select option[value="${client.id}"]')`,
  );
  assert.equal(
    await evaluate("document.querySelector('select').value"),
    client.id,
  );
  await fill('[aria-label="Quantity 1"]', "7");
  await click("+ Add line item");
  await fill('[aria-label="Description 3"]', "Extra service");
  await fill('[aria-label="Unit price 3"]', "0.10");
  await evaluate(
    "document.querySelector('[aria-label=\"Remove item 2\"]').click()",
  );
  assert.equal(
    await evaluate(
      "document.querySelector('[aria-label=\"Invoice total\"]').textContent",
    ),
    "0.80",
  );
  await fill("textarea", "");
  await evaluate(
    `window.originalFetch = window.fetch; window.failPatch = true; window.fetch = (url, options) => options?.method === 'PATCH' && window.failPatch ? Promise.reject(new TypeError('Test offline')) : window.originalFetch(url, options);`,
  );
  await click("Save Changes");
  await until(text("Cannot reach the API"));
  assert.equal(
    await evaluate(
      "document.querySelector('[aria-label=\"Quantity 1\"]').value",
    ),
    "7",
  );
  await evaluate("window.failPatch = false");
  await click("Save Changes");
  await until(text("USD 0.80"));
  assert.ok(await evaluate(text("No notes.")));
  await click("Edit Draft");
  await until("!!document.querySelector('textarea')");
  await fill("textarea", "My unsaved note");
  const latest = await request(
    `/invoices/${invoice.id}`,
    owner.accessToken,
    undefined,
    "GET",
  );
  await request(
    `/invoices/${invoice.id}`,
    owner.accessToken,
    { ...input, notes: "Other user's note", expectedVersion: latest.version },
    "PATCH",
  );
  // Force normal session renewal while the dirty form holds a stale version.
  // It must neither lose the input nor silently adopt the newer server version.
  await evaluate(`window.force401 = true; window.fetch = (url, options) => {
    if (options?.method === 'PATCH' && window.force401) {
      window.force401 = false;
      return Promise.resolve(new Response(JSON.stringify({message:'Expired for test'}), {status:401, headers:{'content-type':'application/json'}}));
    }
    return window.originalFetch(url, options);
  };`);
  await click("Save Changes");
  await until(text("Your changes have not been saved"));
  assert.equal(
    await evaluate("document.querySelector('textarea').value"),
    "My unsaved note",
  );
  assert.equal(
    await evaluate(
      "[...document.querySelectorAll('button')].find(e => e.textContent === 'Save Changes').disabled",
    ),
    true,
  );
  await click("Discard my changes and reload");
  await until(
    "document.querySelector('textarea')?.value === \"Other user's note\"",
  );
  await command("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await screenshot("edit-mobile.png");
  assert.ok(
    await evaluate("document.documentElement.scrollWidth <= innerWidth"),
    "Mobile edit page overflows",
  );
  await click("Cancel");
  await until(text("Delete Draft"));
  await screenshot("detail-mobile.png");
  assert.ok(
    await evaluate("document.documentElement.scrollWidth <= innerWidth"),
    "Mobile detail page overflows",
  );
  await click("Delete Draft");
  await until("!!document.querySelector('dialog[open]')");
  const now = await request(
    `/invoices/${invoice.id}`,
    owner.accessToken,
    undefined,
    "GET",
  );
  await request(
    `/invoices/${invoice.id}`,
    owner.accessToken,
    { ...input, expectedVersion: now.version },
    "PATCH",
  );
  await click("Delete permanently");
  await until(text("Reload latest invoice"));
  await click("Reload latest invoice");
  await until(text("Delete Draft"));
  await click("Delete Draft");
  await until("!!document.querySelector('dialog[open]')");
  assert.ok(
    await evaluate(
      "document.querySelector('dialog').innerText.includes('permanently')",
    ),
  );
  await click("Cancel");
  await until("!document.querySelector('dialog[open]')");
  await click("← Back to Invoices");
  await until(text("Show items"));
  await until(text(invoice.invoiceNumber));
  await click("Show items");
  await until(text("Invoice items"));
  await click("Delete Draft");
  await until("!!document.querySelector('dialog[open]')");
  await screenshot("delete-mobile.png");
  await click("Delete permanently");
  await until(text("No invoices yet"));
  assert.ok(!(await evaluate(text(invoice.invoiceNumber))));
  const next = await request("/invoices", owner.accessToken, input);
  for (const [role, email] of [
    ["PROJECT_MANAGER", "pm@browser.test"],
    ["FINANCE_VIEWER", "viewer@browser.test"],
  ]) {
    await request("/members", owner.accessToken, {
      fullName: role,
      email,
      password,
      role,
    });
    await evaluate(
      `fetch(${JSON.stringify(api + "/auth/logout")}, { method: 'POST', credentials: 'include' })`,
    );
    await login(email);
    await navigate(`/invoices/${next.id}`, "Browser client");
    assert.equal(
      await evaluate(text("Edit Draft")),
      role === "PROJECT_MANAGER",
    );
    assert.equal(await evaluate(text("Delete Draft")), false);
    if (role === "FINANCE_VIEWER") {
      await navigate(`/invoices/${next.id}/edit`, "Draft editing unavailable");
      assert.equal(
        await evaluate("!!document.querySelector('textarea')"),
        false,
      );
    }
  }
  await navigate(
    "/invoices/00000000-0000-4000-8000-000000000001",
    "Invoice not found",
  );
  assert.deepEqual(errors, []);
  console.log(`Browser invoice workflows passed. Screenshots: ${artifacts}`);
} finally {
  socket?.close();
  chrome.kill("SIGTERM");
}
