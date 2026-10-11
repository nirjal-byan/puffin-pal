import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuthService } from "./auth.service.js";
import { AuthController } from "./auth.controller.js";
import { AuthGuard } from "./auth.guard.js";
import { PermissionsGuard } from "./permissions.guard.js";

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret || Buffer.byteLength(secret) < 32)
          throw new Error("JWT_SECRET must contain at least 32 bytes");
        return {
          secret,
          signOptions: {
            algorithm: "HS256" as const,
            expiresIn: 900,
            issuer: "puffinpal",
            audience: "puffinpal-api",
          },
          verifyOptions: {
            algorithms: ["HS256"],
            issuer: "puffinpal",
            audience: "puffinpal-api",
          },
        };
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
