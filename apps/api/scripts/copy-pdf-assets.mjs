import { cp, mkdir } from "node:fs/promises";

const destination = new URL("../dist/src/modules/invoices/pdf/assets/", import.meta.url);
await mkdir(destination, { recursive: true });
await cp(new URL("../assets/invoice-pdf/", import.meta.url), destination, {
  recursive: true,
});
