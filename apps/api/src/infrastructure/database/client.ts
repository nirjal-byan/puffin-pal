import { postgres } from "database";
import type { Contract } from "../../../prisma/schema/schema.d.ts";
import contractJson from "../../../prisma/schema/schema.json" with { type: "json" };

export function createDatabase(url: string) {
  return postgres<Contract>({ contractJson, url });
}
export type Database = ReturnType<typeof createDatabase>;
