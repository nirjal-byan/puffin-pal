import { Global, Inject, Module, Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { createDatabase, type Database } from "./database/client.js";

export const DATABASE = Symbol("DATABASE");
@Injectable()
class DatabaseLifecycle implements OnApplicationShutdown {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  async onApplicationShutdown() {
    await this.db.close();
  }
}
@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      useFactory: () => createDatabase(process.env.DATABASE_URL!),
    },
    DatabaseLifecycle,
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}
