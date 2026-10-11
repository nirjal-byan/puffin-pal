// Isolated Chrome smoke test runner. Run after building packages and API.
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { createServer } from "node:net";
const api = fileURLToPath(new URL("../", import.meta.url));
const web = fileURLToPath(new URL("../../web/", import.meta.url));
config({ path: `${api}/.env`, quiet: true });
const url = new URL(process.env.DATABASE_URL ?? "");
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  url.port !== "5433" ||
  process.env.NODE_ENV === "production"
)
  throw Error("Browser tests require local PostgreSQL");
// Refuse occupied test ports before creating fixtures or starting any browser.
for (const port of [3002, 3003, 9223]) {
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(port, () => probe.close(resolve));
  });
}
const database = `puffinpal_browser_test_${Date.now()}_${randomBytes(4).toString("hex")}`;
const create = spawnSync(
  "docker",
  [
    "exec",
    "puffinpal-postgres",
    "psql",
    "-U",
    decodeURIComponent(url.username),
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `CREATE DATABASE ${database}`,
  ],
  { encoding: "utf8" },
);
if (create.status !== 0) throw Error(create.stderr);
url.pathname = `/${database}`;
const environment = {
  ...process.env,
  DATABASE_URL: url.toString(),
  JWT_SECRET: randomBytes(32).toString("hex"),
  NODE_ENV: "test",
  PORT: "3002",
  WEB_ORIGIN: "http://localhost:3003",
  NEXT_PUBLIC_API_URL: "http://localhost:3002/api/v1",
  TEST_API_URL: "http://localhost:3002/api/v1",
  TEST_WEB_URL: "http://localhost:3003",
};
const servers = [];
async function ready(address) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (servers.some((server) => server.exitCode !== null))
      throw Error("Test server exited early");
    try {
      if ((await fetch(address)).ok) return;
    } catch {
      /* startup */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw Error(`Server not ready: ${address}`);
}
try {
  const migration = spawnSync(
    `${api}/node_modules/.bin/prisma`,
    ["db", "migrate"],
    { cwd: api, env: environment, encoding: "utf8" },
  );
  if (migration.status !== 0) throw Error(migration.stderr + migration.stdout);
  servers.push(
    spawn(process.execPath, ["dist/src/main.js"], {
      cwd: api,
      env: environment,
      stdio: ["ignore", "ignore", "inherit"],
    }),
  );
  servers.push(
    spawn(`${web}/node_modules/.bin/next`, ["dev", "--port", "3003"], {
      cwd: web,
      env: environment,
      stdio: ["ignore", "ignore", "inherit"],
    }),
  );
  await ready("http://localhost:3002/api/v1/health/ready");
  await ready("http://localhost:3003");
  const child = spawn(process.execPath, ["test/invoice.browser.mjs"], {
    cwd: web,
    env: environment,
    stdio: "inherit",
  });
  process.exitCode = await new Promise((resolve) =>
    child.on("exit", (code) => resolve(code ?? 1)),
  );
} finally {
  await Promise.all(
    servers.map(
      (server) =>
        new Promise((resolve) => {
          if (server.exitCode !== null) return resolve();
          server.once("exit", resolve);
          server.kill("SIGTERM");
        }),
    ),
  );
  console.log(`Browser test database retained: ${database}`);
}
