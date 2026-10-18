import { ApiProperty } from "@nestjs/swagger";
import { ValidateBy } from "class-validator";
import { validOrganizationLogo } from "./organization-logo.dto.js";

export class ProfilePictureDto {
  @ApiProperty({
    nullable: true,
    description: "PNG, JPEG or WebP data URL, or null to remove the profile picture",
  })
  @ValidateBy({
    name: "isProfilePicture",
    validator: {
      validate: validOrganizationLogo,
      defaultMessage: () =>
        "Provide a PNG, JPEG or WebP profile picture up to 64 KB, or null to remove it",
    },
  })
  avatarUrl!: string | null;
}
