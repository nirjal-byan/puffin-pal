import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { ServiceUnavailableException } from "@nestjs/common";
import { createClient } from "redis";
import { AuthController } from "../dist/src/auth/auth.controller.js";
import { RedisThrottlerStorage } from "../dist/src/redis/redis-throttler.storage.js";

const redisUrl =
  process.env.REDIS_TEST_URL ??
  process.env.REDIS_URL ??
  "redis://:puffinpal_redis_password@127.0.0.1:6379";

function storageFor(client) {
  return new RedisThrottlerStorage({
    eval: (script, keys, args) =>
      client.eval(script, { keys, arguments: args }),
  });
}

test("Redis shares counters between instances and expires them by TTL", async () => {
  process.env.REDIS_RATE_LIMIT_PREFIX = `puffinpal:test:${randomUUID()}`;
  const socket = { connectTimeout: 1_000, reconnectStrategy: false };
  const firstClient = createClient({ url: redisUrl, socket });
  const secondClient = createClient({ url: redisUrl, socket });
  firstClient.on("error", () => {});
  secondClient.on("error", () => {});
  await Promise.all([firstClient.connect(), secondClient.connect()]);
  try {
    const first = storageFor(firstClient);
    const second = storageFor(secondClient);
    assert.equal(
      (await first.increment("shared-key", 100, 2, 100, "default"))
        .totalHits,
      1,
    );
    assert.equal(
      (await second.increment("shared-key", 100, 2, 100, "default"))
        .totalHits,
      2,
    );
    assert.equal(
      (await first.increment("shared-key", 100, 2, 100, "default"))
        .isBlocked,
      true,
    );
    await delay(140);
    const afterExpiry = await second.increment(
      "shared-key",
      100,
      2,
      100,
      "default",
    );
    assert.equal(afterExpiry.totalHits, 1);
    assert.equal(afterExpiry.isBlocked, false);
  } finally {
    await Promise.all([firstClient.quit(), secondClient.quit()]);
  }
});

test("authentication endpoint-specific limits remain unchanged", () => {
  const expected = {
    signup: 5,
    login: 10,
    changePassword: 5,
    refresh: 30,
  };
  for (const [method, limit] of Object.entries(expected)) {
    const handler = AuthController.prototype[method];
    assert.equal(Reflect.getMetadata("THROTTLER:LIMITdefault", handler), limit);
    assert.equal(Reflect.getMetadata("THROTTLER:TTLdefault", handler), 60_000);
  }
});

test("Redis failures fail closed with HTTP 503", async () => {
  const storage = new RedisThrottlerStorage({
    eval: async () => {
      throw new Error("Redis unavailable");
    },
  });
  await assert.rejects(
    storage.increment("key", 60_000, 5, 60_000, "default"),
    (error) =>
      error instanceof ServiceUnavailableException && error.getStatus() === 503,
  );
});
