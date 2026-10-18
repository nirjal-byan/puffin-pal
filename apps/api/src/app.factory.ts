import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import { AppModule } from "./app.module.js";

export async function createApplication(quiet = false) {
  const app = await NestFactory.create(
    AppModule,
    quiet ? { logger: false, abortOnError: false } : { abortOnError: false },
  );
  const trustProxyHops = Number(
    process.env.TRUST_PROXY_HOPS ?? (process.env.NODE_ENV === "production" ? 1 : 0),
  );
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0)
    throw new Error("TRUST_PROXY_HOPS must be a non-negative integer");
  if (trustProxyHops > 0) app.getHttpAdapter().getInstance().set("trust proxy", trustProxyHops);
  app.use(helmet());
  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
  return app;
}
