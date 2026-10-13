import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { AuthService } from "../dist/src/auth/auth.service.js";
import { AuthController } from "../dist/src/auth/auth.controller.js";
import { ProfilePictureDto } from "../dist/src/auth/profile-picture.dto.js";
import { REQUIRED_PERMISSIONS } from "../dist/src/auth/auth.decorators.js";
import { hasPermission } from "@puffinpal/permissions";

const picture = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
test("profile pictures accept supported images and removal; reject unsafe or oversized inputs", async () => {
  for (const avatarUrl of [picture, null])
    assert.equal((await validate(plainToInstance(ProfilePictureDto, { avatarUrl }))).length, 0);
  for (const avatarUrl of [undefined, "", "https://example.com/photo.png", "data:image/svg+xml;base64,PHN2Zz4=", "data:image/png;base64,aGVsbG8=", `data:image/png;base64,${"A".repeat(90000)}`])
    assert.ok((await validate(plainToInstance(ProfilePictureDto, { avatarUrl }))).length);
  assert.ok((await validate(plainToInstance(ProfilePictureDto, { avatarUrl: picture, userId: "other" }), { whitelist: true, forbidNonWhitelisted: true })).length);
});
test("every authenticated role can update its own picture through the profile permission", () => {
  assert.deepEqual(Reflect.getMetadata(REQUIRED_PERMISSIONS, AuthController.prototype.updateProfilePicture), ["profile:read"]);
  for (const role of ["OWNER", "ADMIN", "PROJECT_MANAGER", "FINANCE_VIEWER"])
    assert.equal(hasPermission(role, "profile:read"), true);
});
test("picture updates and removals target only the authenticated user and organization", async () => {
  const tenant = { userId: "user-1", organizationId: "org-1", role: "FINANCE_VIEWER" };
  const user = { id: tenant.userId, avatarUrl: null, fullName: "User" };
  const filters = [];
  const service = new AuthService({ orm: { public: {
    User: { where(filter) {
      filters.push(filter);
      return {
        select() { return this; },
        async update(data) { Object.assign(user, data); return { id: user.id }; },
        async first() { return { ...user }; },
      };
    } },
    Organization: { where: () => ({ select: () => ({ first: async () => ({ id: tenant.organizationId }) }) }) },
  } } }, {});
  assert.equal((await service.updateProfilePicture(tenant, picture)).user.avatarUrl, picture);
  assert.equal((await service.me(tenant)).user.avatarUrl, picture);
  assert.equal((await service.updateProfilePicture(tenant, null)).user.avatarUrl, null);
  for (const filter of filters) assert.deepEqual(filter, { id: tenant.userId, organizationId: tenant.organizationId });
  const reads = filters.length;
  await assert.rejects(service.updateProfilePicture(tenant, "javascript:alert(1)"), /Invalid profile picture/);
  assert.equal(filters.length, reads);
});
