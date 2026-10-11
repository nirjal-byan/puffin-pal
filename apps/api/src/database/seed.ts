import { hashPassword } from "../auth/password.js";
import { config } from "dotenv";
import { createDatabase } from "./client.js";

config({ quiet: true });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const password = process.env.SEED_OWNER_PASSWORD;
if (!password || password.length < 12) {
  throw new Error(
    "Set SEED_OWNER_PASSWORD to at least 12 characters before seeding",
  );
}
const passwordHash = await hashPassword(password);
const db = createDatabase(process.env.DATABASE_URL);
try {
  await db.transaction(async (tx) => {
    const organization =
      (await tx.orm.public.Organization.where({
        slug: "puffinpal-demo",
      }).first()) ??
      (await tx.orm.public.Organization.create({
        name: "PuffinPal Demo",
        slug: "puffinpal-demo",
      }));
    const user =
      (await tx.orm.public.User.where({
        organizationId: organization.id,
        email: "owner@puffinpal.test",
      }).first()) ??
      (await tx.orm.public.User.create({
        organizationId: organization.id,
        email: "owner@puffinpal.test",
        fullName: "Demo Owner",
        passwordHash,
      }));
    const membership = await tx.orm.public.Membership.where({
      organizationId: organization.id,
      userId: user.id,
    }).first();
    if (!membership)
      await tx.orm.public.Membership.create({
        organizationId: organization.id,
        userId: user.id,
        role: "OWNER",
      });
  });
  console.log(
    "Demo organization and owner seeded; existing records were preserved.",
  );
} finally {
  await db.close();
}
