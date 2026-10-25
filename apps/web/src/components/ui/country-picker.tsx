"use client";
import type { CountryCode } from "libphonenumber-js/max";
import { PHONE_COUNTRIES } from "@/lib/phone";
import { Dropdown } from "@/components/ui/dropdown";
const options = PHONE_COUNTRIES.map((item) => ({
  value: item.country,
  label: item.name,
  leading: item.flag,
  detail: `+${item.callingCode}`,
}));
export function CountryPicker({
  country,
  onChange,
}: {
  country: CountryCode;
  onChange: (country: CountryCode) => void;
}) {
  return (
    <Dropdown
      options={options}
      value={country}
      onChange={(next) => onChange(next as CountryCode)}
      name="phoneCountry"
      label="Phone country"
      searchPlaceholder="Search country or code"
      compact
    />
  );
}
