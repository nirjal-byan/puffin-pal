import { ApiProperty } from "@nestjs/swagger";
import { ValidateBy } from "class-validator";


export const MAX_LOGO_BYTES = 64 * 1024;
export function validOrganizationLogo(value: unknown): boolean {
  if (value === null) return true;
  if (typeof value !== "string" || value.length > 87500) return false;
  const match =
    /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return false;
  const bytes = Buffer.from(match[2]!, "base64");
  if (bytes.length > MAX_LOGO_BYTES || bytes.toString("base64") !== match[2])
    return false;
  switch (match[1]) {
    case "png":
      return (
        bytes.length >= 24 &&
        bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
        bytes.toString("ascii", 12, 16) === "IHDR"
      );
    case "jpeg":
      return (
        bytes.length >= 4 &&
        bytes[0] === 255 &&
        bytes[1] === 216 &&
        bytes[bytes.length - 2] === 255 &&
        bytes[bytes.length - 1] === 217
      );
    case "webp":
      return (
        bytes.length >= 20 &&
        bytes.toString("ascii", 0, 4) === "RIFF" &&
        bytes.readUInt32LE(4) === bytes.length - 8 &&
        bytes.toString("ascii", 8, 12) === "WEBP" &&
        ["VP8 ", "VP8L", "VP8X"].includes(bytes.toString("ascii", 12, 16))
      );
    default:
      return false;
  }
}
export function IsOrganizationLogo() {
  return ValidateBy({
    name: "isOrganizationLogo",
    validator: {
      validate: validOrganizationLogo,
      defaultMessage: () =>
        "Provide a PNG, JPEG or WebP logo up to 64 KB, or null to remove it",
    },
  });
}
export class OrganizationLogoDto {
  @ApiProperty({
    nullable: true,
    description: "Image data URL, or null to remove the logo",
  })
  @IsOrganizationLogo()
  logoUrl!: string | null;
}
