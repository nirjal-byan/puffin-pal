import { Public } from "./auth/auth.decorators.js";
import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Database } from "./database/client.js";
import { DATABASE } from "./database.module.js";
import { RedisClientService } from "./redis/redis-client.service.js";
import { ObjectStorageService } from "./storage/object-storage.service.js";

@ApiTags("health")
@Controller("health")
@Public()
export class HealthController {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly redis: RedisClientService,
    private readonly storage: ObjectStorageService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Process liveness" })
  live() {
    return { status: "ok" };
  }

  @Get("ready")
  @ApiOperation({ summary: "Database readiness" })
  async ready() {
    try {
      await Promise.all([
        this.db.orm.public.Organization.select("id").limit(1).all(),
        this.redis.ping(),
        this.storage.readyCheck(),
      ]);
      return { status: "ok" };
    } catch {
      throw new ServiceUnavailableException("Service unavailable");
    }
  }
}
