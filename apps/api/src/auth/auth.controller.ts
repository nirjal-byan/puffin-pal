import { OrganizationLogoDto } from "./organization-logo.dto.js";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Patch,
  UseGuards,
  Req,
  Res,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { AuthService } from "./auth.service.js";
import {
  ChangePasswordDto,
  UpdateProfileDto,
  LoginDto,
  SignupDto,
} from "./auth.dto.js";
import {
  CurrentTenant,
  Public,
  RequirePermissions,
} from "./auth.decorators.js";
import type { TenantContext } from "./auth.types.js";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public()
  @Post("signup")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async signup(
    @Body() input: SignupDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.checkOrigin(request);
    const session = await this.auth.signup(input);
    await this.setRefreshCookie(
      response,
      session.user.id,
      session.organization.id,
    );
    return session;
  }
  @Public()
  @Post("login")
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(
    @Body() input: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.checkOrigin(request);
    const session = await this.auth.login(input);
    await this.setRefreshCookie(
      response,
      session.user.id,
      session.organization.id,
    );
    return session;
  }
  @Get("me")
  @ApiBearerAuth()
  @RequirePermissions("profile:read")
  me(@CurrentTenant() tenant: TenantContext) {
    return this.auth.me(tenant);
  }
  @Patch("organization/logo")
  @ApiBearerAuth()
  @RequirePermissions("organization:update")
  updateOrganizationLogo(
    @CurrentTenant() tenant: TenantContext,
    @Body() input: OrganizationLogoDto,
  ) {
    return this.auth.updateOrganizationLogo(tenant, input.logoUrl);
  }
  @Patch("me")
  @ApiBearerAuth()
  @RequirePermissions("profile:read")
  updateProfile(
    @CurrentTenant() tenant: TenantContext,
    @Body() input: UpdateProfileDto,
  ) {
    return this.auth.updateProfile(tenant, input);
  }

  @Post("change-password")
  @HttpCode(200)
  @ApiBearerAuth()
  @RequirePermissions("profile:read")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async changePassword(
    @CurrentTenant() tenant: TenantContext,
    @Body() input: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.changePassword(tenant, input);
    await this.setRefreshCookie(response, tenant.userId, tenant.organizationId);
    return result;
  }
  @Public()
  @Post("refresh")
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.checkOrigin(request);
    response.setHeader("Cache-Control", "no-store");
    const cookie = request.headers.cookie
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("puffinpal_refresh="));
    if (!cookie) throw new UnauthorizedException("Sign in to continue");
    try {
      return await this.auth.refresh(cookie.slice("puffinpal_refresh=".length));
    } catch (error) {
      if (error instanceof UnauthorizedException)
        response.clearCookie("puffinpal_refresh", this.cookieOptions());
      throw error;
    }
  }

  @Public()
  @Post("logout")
  @HttpCode(200)
  logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.checkOrigin(request);
    response.clearCookie("puffinpal_refresh", this.cookieOptions());
    return { message: "Signed out successfully." };
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/api/v1/auth",
    };
  }
  private async setRefreshCookie(
    response: Response,
    userId: string,
    organizationId: string,
  ) {
    response.setHeader("Cache-Control", "no-store");
    response.cookie(
      "puffinpal_refresh",
      await this.auth.createRefreshToken(userId, organizationId),
      { ...this.cookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 },
    );
  }
  private checkOrigin(request: Request) {
    const origin = request.headers.origin;
    const expected = process.env.WEB_ORIGIN ?? "http://localhost:3000";
    if (
      (origin && origin !== expected) ||
      request.headers["sec-fetch-site"] === "cross-site"
    )
      throw new ForbiddenException("Request origin is not allowed");
  }
}
