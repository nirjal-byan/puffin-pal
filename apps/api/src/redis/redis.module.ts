import { Global, Module } from "@nestjs/common";
import { RedisClientService } from "./redis-client.service.js";
import { RedisThrottlerStorage } from "./redis-throttler.storage.js";

@Global()
@Module({
  providers: [RedisClientService, RedisThrottlerStorage],
  exports: [RedisClientService, RedisThrottlerStorage],
})
export class RedisModule {}
