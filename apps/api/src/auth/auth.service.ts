import { createHmac, timingSafeEqual } from "node:crypto";
import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  canAssignRole,
  isRole,
  permissionsFor,
  type Role,
} from "@puffinpal/permissions";
import { DATABASE } from "../database.module.js";
import type { Database } from "../database/client.js";
import type {
  ChangePasswordDto,
  UpdateProfileDto,
  CreateMemberDto,
  LoginDto,
  SignupDto,
} from "./auth.dto.js";
import type { TenantContext } from "./auth.types.js";
import { validOrganizationLogo } from "./organization-logo.dto.js";
import { hashPassword, verifyPassword } from "./password.js";
import type { UpdateOnboardingDto } from "./onboarding.dto.js";

const DUMMY_HASH = `scrypt:32768:8:1:${"0".repeat(32)}:${"0".repeat(128)}`;
@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly jwt: JwtService,
  ) {}

  async signup(input: SignupDto) {
    if (
      input.confirmPassword !== undefined &&
      input.confirmPassword !== input.password
    )
      throw new BadRequestException("Passwords do not match");
    if (Boolean(input.firstName) !== Boolean(input.lastName))
      throw new BadRequestException("First and last name are both required");
    const fullName =
      input.firstName && input.lastName
        ? [input.firstName, input.middleName, input.lastName]
            .map((part) => part?.trim())
            .filter(Boolean)
            .join(" ")
        : input.fullName.trim();
    if (fullName.length > 120)
      throw new BadRequestException("Full name must be at most 120 characters");
    if (input.logoUrl !== undefined && !validOrganizationLogo(input.logoUrl))
      throw new BadRequestException("Invalid organization logo");
    const passwordHash = await hashPassword(input.password);
    let tenant: TenantContext;
    try {
      tenant = await this.db.transaction(async (tx) => {
        const organization = await tx.orm.public.Organization.create({
          name: input.organizationName.trim(),
          slug: input.organizationSlug,
          ...(input.logoUrl ? { logoUrl: input.logoUrl } : {}),
          ...(input.companyWebsite ? { website: input.companyWebsite } : {}),
          ...(input.employeeCount
            ? { employeeCount: input.employeeCount }
            : {}),
        });
        const user = await tx.orm.public.User.create({
          organizationId: organization.id,
          email: input.email,
          fullName,
          ...(input.firstName ? { firstName: input.firstName.trim() } : {}),
          ...(input.middleName?.trim()
            ? { middleName: input.middleName.trim() }
            : {}),
          ...(input.lastName ? { lastName: input.lastName.trim() } : {}),
          ...(input.phoneNumber ? { phoneNumber: input.phoneNumber } : {}),
          passwordHash,
          onboardingStatus: "PENDING",
        });
        await tx.orm.public.Membership.create({
          organizationId: organization.id,
          userId: user.id,
          role: "OWNER",
        });
        return {
          organizationId: organization.id,
          userId: user.id,
          role: "OWNER" as const,
        };
      });
    } catch (error) {
      if (
        await this.db.orm.public.Organization.where({
          slug: input.organizationSlug,
        })
          .select("id")
          .first()
      ) {
        throw new ConflictException("Organization slug is already taken");
      }
      throw error;
    }
    return this.session(tenant);
  }

  async login(input: LoginDto) {
    const organization = await this.db.orm.public.Organization.where({
      slug: input.organizationSlug,
    })
      .select("id")
      .first();
    const user = organization
      ? await this.db.orm.public.User.where({
          organizationId: organization.id,
          email: input.email,
        }).first()
      : null;
    const valid = await verifyPassword(
      input.password,
      user?.passwordHash ?? DUMMY_HASH,
    );
    if (!valid || !organization || !user)
      throw new UnauthorizedException("Invalid credentials");
    const membership = await this.db.orm.public.Membership.where({
      organizationId: organization.id,
      userId: user.id,
    }).first();
    if (!membership || !isRole(membership.role))
      throw new UnauthorizedException("Invalid credentials");
    return this.session({
      organizationId: organization.id,
      userId: user.id,
      role: membership.role,
    });
  }

  async me(tenant: TenantContext) {
    const user = await this.db.orm.public.User.where({
      id: tenant.userId,
      organizationId: tenant.organizationId,
    })
      .select("id", "email", "fullName", "avatarUrl", "onboardingStatus", "onboardingStep")
      .first();
    const organization = await this.db.orm.public.Organization.where({
      id: tenant.organizationId,
    })
      .select("id", "name", "slug", "currency", "logoUrl")
      .first();
    if (!user || !organization) throw new UnauthorizedException();
    return {
      user,
      organization,
      role: tenant.role,
      permissions: permissionsFor(tenant.role),
    };
  }

  async updateOrganizationLogo(tenant: TenantContext, logoUrl: string | null) {
    if (tenant.role !== "OWNER" && tenant.role !== "ADMIN")
      throw new ForbiddenException(
        "Only owners and admins can change the company logo",
      );
    if (!validOrganizationLogo(logoUrl))
      throw new BadRequestException("Invalid organization logo");
    const [organization] = await this.db.orm.public.Organization.where({
      id: tenant.organizationId,
    }).updateAll({ logoUrl });
    if (!organization) throw new NotFoundException("Organization not found");
    return this.me(tenant);
  }

  async updateOnboarding(tenant: TenantContext, input: UpdateOnboardingDto) {
    // Terminal states and legacy accounts never return to automatic onboarding.
    // Manual replays are local UI state and do not change this record.
    await this.db.orm.public.User.where({
      id: tenant.userId,
      organizationId: tenant.organizationId,
    }).where((user) => user.onboardingStatus.in(["PENDING", "IN_PROGRESS"]))
      .updateAll({ onboardingStatus: input.status, onboardingStep: input.step });
    const user = await this.db.orm.public.User.where({
      id: tenant.userId, organizationId: tenant.organizationId,
    }).select("onboardingStatus", "onboardingStep").first();
    if (!user) throw new UnauthorizedException();
    return user;
  }

  async updateProfile(tenant: TenantContext, input: UpdateProfileDto) {
    const user = await this.db.orm.public.User.where({
      id: tenant.userId,
      organizationId: tenant.organizationId,
    })
      .select("id", "email", "fullName", "avatarUrl")
      .update({ fullName: input.fullName.trim() });
    if (!user) throw new UnauthorizedException();
    return this.me(tenant);
  }

  async updateProfilePicture(tenant: TenantContext, avatarUrl: string | null) {
    if (!validOrganizationLogo(avatarUrl))
      throw new BadRequestException("Invalid profile picture");
    const user = await this.db.orm.public.User.where({
      id: tenant.userId,
      organizationId: tenant.organizationId,
    }).select("id").update({ avatarUrl });
    if (!user) throw new UnauthorizedException();
    return this.me(tenant);
  }

  async changePassword(tenant: TenantContext, input: ChangePasswordDto) {
    const user = await this.db.orm.public.User.where({
      id: tenant.userId,
      organizationId: tenant.organizationId,
    })
      .select("id", "passwordHash")
      .first();
    if (
      !user ||
      !(await verifyPassword(input.currentPassword, user.passwordHash))
    ) {
      throw new UnauthorizedException("Current password is incorrect");
    }
    const passwordHash = await hashPassword(input.newPassword);
    const updated = await this.db.orm.public.User.where({
      id: tenant.userId,
      organizationId: tenant.organizationId,
      passwordHash: user.passwordHash,
    })
      .select("id")
      .update({ passwordHash });
    if (!updated)
      throw new ConflictException(
        "Password changed during this request. Try again.",
      );
    return { message: "Password updated successfully." };
  }

  async createMember(tenant: TenantContext, input: CreateMemberDto) {
    if (!canAssignRole(tenant.role, input.role))
      throw new ForbiddenException("You cannot assign this role");
    const passwordHash = await hashPassword(input.password);
    try {
      return await this.db.transaction(async (tx) => {
        const user = await tx.orm.public.User.select(
          "id",
          "email",
          "fullName",
        ).create({
          organizationId: tenant.organizationId,
          email: input.email,
          fullName: input.fullName.trim(),
          passwordHash,
          onboardingStatus: "PENDING",
        });
        await tx.orm.public.Membership.create({
          organizationId: tenant.organizationId,
          userId: user.id,
          role: input.role,
        });
        return { user, role: input.role };
      });
    } catch (error) {
      if (
        await this.db.orm.public.User.where({
          organizationId: tenant.organizationId,
          email: input.email,
        })
          .select("id")
          .first()
      ) {
        throw new ConflictException(
          "Email is already registered in this organization",
        );
      }
      throw error;
    }
  }

  async updateMemberRole(tenant: TenantContext, userId: string, role: Role) {
    if (!canAssignRole(tenant.role, role))
      throw new ForbiddenException("You cannot assign this role");
    // Include the allowed prior roles in the mutation predicate as well, avoiding an unchecked read/write gap.
    const allowed =
      tenant.role === "OWNER"
        ? (["ADMIN", "PROJECT_MANAGER", "FINANCE_VIEWER"] as const)
        : (["PROJECT_MANAGER", "FINANCE_VIEWER"] as const);
    const membership = await this.db.orm.public.Membership.where({
      organizationId: tenant.organizationId,
      userId,
    })
      .select("id", "role")
      .first();
    if (!membership) throw new NotFoundException("Member not found");
    if (!(allowed as readonly string[]).includes(membership.role))
      throw new ForbiddenException("You cannot change this member's role");
    const updated = await this.db.orm.public.Membership.where({
      organizationId: tenant.organizationId,
      userId,
    })
      .where((member) => member.role.in([...allowed]))
      .select("id", "userId", "role")
      .update({ role });
    if (!updated)
      throw new ForbiddenException("Member role changed; try again");
    return updated;
  }

  async createRefreshToken(userId: string, organizationId: string) {
    const user = await this.db.orm.public.User.where({
      id: userId,
      organizationId,
    })
      .select("passwordHash")
      .first();
    if (!user) throw new UnauthorizedException();
    return this.jwt.signAsync(
      {
        sub: userId,
        organizationId,
        kind: "refresh",
        passwordVersion: this.passwordVersion(user.passwordHash),
      },
      { audience: "puffinpal-refresh", expiresIn: 7 * 24 * 60 * 60 },
    );
  }

  async refresh(token: string) {
    let payload: Record<string, unknown>;
    try {
      payload = await this.jwt.verifyAsync<Record<string, unknown>>(token, {
        audience: "puffinpal-refresh",
      });
    } catch {
      throw new UnauthorizedException("Your session expired. Sign in again.");
    }
    if (
      payload.kind !== "refresh" ||
      typeof payload.sub !== "string" ||
      typeof payload.organizationId !== "string" ||
      typeof payload.passwordVersion !== "string" ||
      !/^[a-f0-9]{64}$/.test(payload.passwordVersion) ||
      typeof payload.exp !== "number"
    )
      throw new UnauthorizedException("Invalid session");
    const user = await this.db.orm.public.User.where({
      id: payload.sub,
      organizationId: payload.organizationId,
    })
      .select("id", "passwordHash")
      .first();
    const expected = user ? this.passwordVersion(user.passwordHash) : "";
    const actual = payload.passwordVersion;
    if (
      !user ||
      actual.length !== expected.length ||
      !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
    )
      throw new UnauthorizedException("Session no longer valid");
    const membership = await this.db.orm.public.Membership.where({
      userId: user.id,
      organizationId: payload.organizationId,
    })
      .select("role")
      .first();
    if (!membership || !isRole(membership.role))
      throw new UnauthorizedException("Membership is no longer valid");
    return this.session({
      userId: user.id,
      organizationId: payload.organizationId,
      role: membership.role,
    });
  }

  private passwordVersion(hash: string) {
    return createHmac("sha256", process.env.JWT_SECRET!)
      .update(hash)
      .digest("hex");
  }

  private async session(tenant: TenantContext) {
    const accessToken = await this.jwt.signAsync({
      sub: tenant.userId,
      organizationId: tenant.organizationId,
    });
    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn: 900,
      ...(await this.me(tenant)),
    };
  }
}
