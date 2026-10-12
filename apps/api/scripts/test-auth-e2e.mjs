import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

// Own a disposable database. Never migrate, seed or truncate the development DB during tests.
const requestedTests = process.argv.slice(2);
if (
  requestedTests.some((file) => !/^test\/[a-z-]+\.e2e\.test\.mjs$/.test(file))
) {
  throw new Error("Expected test/<name>.e2e.test.mjs arguments");
}
const tests = requestedTests.length
  ? requestedTests
  : [
      "test/auth.e2e.test.mjs",
      "test/invoices.e2e.test.mjs",
      "test/invoice-drafts.e2e.test.mjs",
      "test/invoice-issuance.e2e.test.mjs",
    ];
const api = fileURLToPath(new URL("../", import.meta.url));
config({ path: `${api}/.env`, quiet: true });
const url = new URL(process.env.DATABASE_URL ?? "");
if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.port !== "5433") {
  throw new Error(
    "Integration tests require the local PostgreSQL service on port 5433",
  );
}
const database = `puffinpal_auth_test_${Date.now()}_${randomBytes(4).toString("hex")}`;
url.pathname = `/${database}`;
function execute(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.status !== 0)
    throw new Error(`${command} failed: ${result.stderr}\n${result.stdout}`);
  return result.stdout;
}
const psql = (statement) =>
  execute("docker", [
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
    statement,
  ]);
psql(`CREATE DATABASE ${database}`);
try {
  const environment = {
    ...process.env,
    DATABASE_URL: url.toString(),
    JWT_SECRET: randomBytes(32).toString("hex"),
    NODE_ENV: "test",
  };
  execute(`${api}/node_modules/.bin/prisma`, ["db", "migrate"], {
    cwd: api,
    env: environment,
  });
  const result = spawnSync(process.execPath, ["--test", ...tests], {
    cwd: api,
    env: environment,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exitCode = result.status ?? 1;
} finally {
  if (process.env.KEEP_TEST_DATABASE === "1")
    console.log(`Test database retained: ${database}`);
  else psql(`DROP DATABASE ${database} WITH (FORCE)`);
}
