import { BadRequestException } from "@nestjs/common";

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
export interface ReceiptFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
const allowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
export function validateReceipt(file?: ReceiptFile) {
  if (!file) throw new BadRequestException("Choose a receipt file");
  if (!allowed.has(file.mimetype) || file.size < 4 || file.size > MAX_RECEIPT_BYTES)
    throw new BadRequestException("Receipt must be a JPEG, PNG, WebP or PDF up to 5 MB");
  const b = file.buffer;
  const valid =
    file.mimetype === "image/png"
      ? b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : file.mimetype === "image/jpeg"
        ? b[0] === 0xff && b[1] === 0xd8 && b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9
        : file.mimetype === "image/webp"
          ? b.length >= 20 &&
            b.toString("ascii", 0, 4) === "RIFF" &&
            b.toString("ascii", 8, 12) === "WEBP"
          : b.toString("ascii", 0, 5) === "%PDF-";
  if (!valid) throw new BadRequestException("Receipt contents do not match the declared file type");
  return file;
}
