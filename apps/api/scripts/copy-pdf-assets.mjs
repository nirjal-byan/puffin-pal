import { cp, mkdir } from "node:fs/promises";

const destination = new URL("../dist/src/invoices/pdf/assets/", import.meta.url);
await mkdir(destination, { recursive: true });
await cp(new URL("../src/invoices/pdf/assets/", import.meta.url), destination, {
  recursive: true,
});
