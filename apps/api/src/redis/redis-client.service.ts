import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { createClient, type RedisClientType } from "redis";

function positiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 0)
    throw new Error(`${name} must be a non-negative integer`);
  return value;
}

@Injectable()
export class RedisClientService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(RedisClientService.name);
  private readonly client: RedisClientType;

  constructor() {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL is required");
    const connectTimeout = positiveInteger("REDIS_CONNECT_TIMEOUT_MS", 2000);
    const maxRetries = positiveInteger("REDIS_RECONNECT_MAX_RETRIES", 3);

    this.client = createClient({
      url,
      disableOfflineQueue: true,
      commandsQueueMaxLength: 1000,
      socket: {
        connectTimeout,
        reconnectStrategy: (retries) =>
          retries >= maxRetries
            ? new Error("Redis reconnect retry limit reached")
            : Math.min(100 * 2 ** retries, 1000),
      },
    });
    this.client.on("error", (error) =>
      this.logger.error(`Redis connection error: ${error.message}`),
    );
  }

  async onApplicationBootstrap() {
    await this.client.connect();
    await this.client.ping();
  }

  eval(script: string, keys: string[], args: string[]) {
    return this.client.eval(script, { keys, arguments: args });
  }

  async onApplicationShutdown() {
    if (this.client.isReady) await this.client.quit();
    else if (this.client.isOpen) this.client.destroy();
  }
}
