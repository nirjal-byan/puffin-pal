import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { ThrottlerStorage } from "@nestjs/throttler";
import { RedisClientService } from "./redis-client.service.js";

const INCREMENT_SCRIPT = `
local nowParts = redis.call('TIME')
local now = (tonumber(nowParts[1]) * 1000) + math.floor(tonumber(nowParts[2]) / 1000)
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])

local blockedFor = redis.call('PTTL', KEYS[2])
if blockedFor > 0 then
  local hits = redis.call('ZCARD', KEYS[1])
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  local expiresIn = ttl
  if #oldest > 0 then expiresIn = math.max(0, tonumber(oldest[2]) + ttl - now) end
  return { hits, expiresIn, 1, blockedFor }
end

redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - ttl)
local sequence = redis.call('INCR', KEYS[3])
redis.call('PEXPIRE', KEYS[3], ttl)
redis.call('ZADD', KEYS[1], now, tostring(now) .. '-' .. tostring(sequence))
redis.call('PEXPIRE', KEYS[1], ttl)

local hits = redis.call('ZCARD', KEYS[1])
local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
local expiresIn = ttl
if #oldest > 0 then expiresIn = math.max(0, tonumber(oldest[2]) + ttl - now) end

if hits > limit then
  redis.call('SET', KEYS[2], '1', 'PX', blockDuration)
  return { hits, expiresIn, 1, blockDuration }
end
return { hits, expiresIn, 0, 0 }
`;

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly prefix: string;

  constructor(private readonly redis: RedisClientService) {
    this.prefix = process.env.REDIS_RATE_LIMIT_PREFIX ?? "puffinpal:auth-rate-limit";
    if (!/^[a-zA-Z0-9:_-]{1,80}$/.test(this.prefix))
      throw new Error("REDIS_RATE_LIMIT_PREFIX contains unsupported characters");
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ) {
    const hashTag = `{${throttlerName}:${key}}`;
    const base = `${this.prefix}:${hashTag}`;
    try {
      const result = (await this.redis.eval(
        INCREMENT_SCRIPT,
        [`${base}:hits`, `${base}:blocked`, `${base}:sequence`],
        [String(ttl), String(limit), String(blockDuration)],
      )) as number[];
      const [totalHits, expiresInMs, blocked, blockedForMs] = result.map(Number);
      return {
        totalHits,
        timeToExpire: Math.max(1, Math.ceil(expiresInMs / 1000)),
        isBlocked: blocked === 1,
        timeToBlockExpire: blocked === 1 ? Math.max(1, Math.ceil(blockedForMs / 1000)) : 0,
      };
    } catch {
      throw new ServiceUnavailableException(
        "Authentication rate limiting is temporarily unavailable",
      );
    }
  }
}
