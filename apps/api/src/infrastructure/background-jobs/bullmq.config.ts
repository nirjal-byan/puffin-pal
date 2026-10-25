import type { ConnectionOptions } from "bullmq";

export const INVOICE_EXPORT_QUEUE = "invoice-exports";

function integer(name: string, fallback: number, minimum: number, maximum: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < minimum || value > maximum)
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  return value;
}

export function bullConnection(): ConnectionOptions {
  const value = process.env.BULLMQ_REDIS_URL ?? process.env.REDIS_URL;
  if (!value) throw new Error("BULLMQ_REDIS_URL or REDIS_URL is required");
  const url = new URL(value);
  if (!["redis:", "rediss:"].includes(url.protocol))
    throw new Error("BullMQ Redis URL must use redis:// or rediss://");
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    connectTimeout: integer("BULLMQ_CONNECT_TIMEOUT_MS", 5000, 250, 30000),
    maxRetriesPerRequest: null,
    retryStrategy: (attempts) =>
      attempts > integer("BULLMQ_RECONNECT_MAX_RETRIES", 5, 0, 20)
        ? null
        : Math.min(250 * 2 ** (attempts - 1), 5000),
  };
}

export function bullPrefix() {
  const prefix = process.env.BULLMQ_PREFIX ?? "puffinpal:jobs";
  if (!/^[a-zA-Z0-9:_-]{1,80}$/.test(prefix))
    throw new Error("BULLMQ_PREFIX contains unsupported characters");
  return prefix;
}

export const exportWorkerConcurrency = () => integer("INVOICE_EXPORT_WORKER_CONCURRENCY", 2, 1, 10);

export const recurringInvoiceWorkerConcurrency = () =>
  integer("RECURRING_INVOICE_WORKER_CONCURRENCY", 2, 1, 10);

export const payrollWorkerConcurrency = () => integer("PAYROLL_WORKER_CONCURRENCY", 2, 1, 10);
