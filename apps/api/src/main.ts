import "reflect-metadata";
import { config } from "dotenv";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { createApplication } from "./app.factory.js";

async function bootstrap() {
  config({ quiet: true });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const port = Number(process.env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  const app = await createApplication();
  if (process.env.NODE_ENV !== "production") {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle("PuffinPal API").setVersion("0.1.0").addBearerAuth().build(),
    );
    SwaggerModule.setup("api/docs", app, document);
  }
  await app.listen(port, process.env.HOST ?? "127.0.0.1");
}
bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
