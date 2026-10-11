import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

config({ quiet: true });
const url = new URL(process.env.DATABASE_URL ?? "");
const database = decodeURIComponent(url.pathname.slice(1));
if (
  process.env.NODE_ENV === "production" ||
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  url.port !== "5433" ||
  database !== "puffinpal_dev"
) {
  throw new Error(
    "Reset is restricted to the local puffinpal_dev database on port 5433",
  );
}
if (process.env.PRISMA_RESET_CONFIRM !== "puffinpal_dev") {
  throw new Error(
    "This deletes local data. Run PRISMA_RESET_CONFIRM=puffinpal_dev make prisma.reset from the repo root to confirm.",
  );
}
const compose = fileURLToPath(
  new URL("../../../services/docker-compose.yml", import.meta.url),
);
const api = fileURLToPath(new URL("../", import.meta.url));
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run("docker", [
  "compose",
  "-p",
  "puffinpal",
  "-f",
  compose,
  "exec",
  "-T",
  "postgres",
  "psql",
  "-U",
  decodeURIComponent(url.username),
  "-d",
  database,
  "-v",
  "ON_ERROR_STOP=1",
  "-c",
  "BEGIN; DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS prisma_contract CASCADE; COMMIT;",
]);
run("pnpm", ["run", "prisma:migrate:deploy"], { cwd: api });
