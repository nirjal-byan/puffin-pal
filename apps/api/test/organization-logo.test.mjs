import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  OrganizationLogoDto,
  validOrganizationLogo,
} from "../dist/src/modules/auth/organization-logo.dto.js";
import { SignupDto } from "../dist/src/modules/auth/auth.dto.js";
import { AuthService } from "../dist/src/modules/auth/auth.service.js";

const logo =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
test("logo validation accepts bounded raster uploads and rejects other payloads", async () => {
  assert.equal(validOrganizationLogo(logo), true);
  assert.equal(validOrganizationLogo(null), true);
  for (const value of [
    undefined,
    "",
    "https://example.com/logo.png",
    "data:image/svg+xml;base64,PHN2Zz4=",
    "data:image/png;base64,aGVsbG8=",
    logo.replace("image/png", "image/webp"),
    logo + "A",
    "data:image/png;base64," + "A".repeat(90000),
  ]) {
    assert.equal(validOrganizationLogo(value), false);
    assert.ok(
      (await validate(plainToInstance(OrganizationLogoDto, { logoUrl: value })))
        .length,
    );
  }
  assert.equal(
    (await validate(plainToInstance(OrganizationLogoDto, { logoUrl: null })))
      .length,
    0,
  );
  const signup = {
    organizationName: "Company",
    organizationSlug: "logo-company",
    fullName: "Owner",
    email: "owner@logo.test",
    password: "logo-test-password-123",
    logoUrl: logo,
  };
  assert.equal((await validate(plainToInstance(SignupDto, signup))).length, 0);
});

test("logo updates are restricted to owner/admin and scoped to the authenticated tenant", async () => {
  let filter, update;
  const db = {
    orm: {
      public: {
        Organization: {
          where(value) {
            filter = value;
            return {
              async updateAll(data) {
                update = data;
                return [{ id: value.id }];
              },
            };
          },
        },
      },
    },
  };
  const service = new AuthService(db, {});
  service.me = async (tenant) => ({
    organization: { id: tenant.organizationId, ...update },
  });
  for (const role of ["PROJECT_MANAGER", "FINANCE_VIEWER"]) {
    await assert.rejects(
      service.updateOrganizationLogo({ role, organizationId: "org-a" }, logo),
      /Only owners and admins/,
    );
    assert.equal(filter, undefined);
  }
  for (const role of ["OWNER", "ADMIN"]) {
    const result = await service.updateOrganizationLogo(
      { role, organizationId: "org-a" },
      logo,
    );
    assert.deepEqual(filter, { id: "org-a" });
    assert.deepEqual(update, { logoUrl: logo });
    assert.equal(result.organization.logoUrl, logo);
  }
  await service.updateOrganizationLogo(
    { role: "OWNER", organizationId: "org-a" },
    null,
  );
  assert.deepEqual(update, { logoUrl: null });
  await assert.rejects(
    service.updateOrganizationLogo(
      { role: "OWNER", organizationId: "org-a" },
      "bad",
    ),
    /Invalid organization logo/,
  );
});
