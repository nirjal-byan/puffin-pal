"use client";

import { CURRENCIES } from "../lib/currencies";
import { Dropdown } from "./dropdown";

export function CurrencyDropdown({
  value,
  onChange,
  name = "currency",
  label = "Currency",
  placeholder = "Select currency",
  disabled = false,
}: {
  value: string;
  onChange: (currency: string) => void;
  name?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <Dropdown
      name={name}
      label={label}
      placeholder={placeholder}
      searchPlaceholder="Search currencies"
      value={value}
      onChange={onChange}
      disabled={disabled}
      options={CURRENCIES.map((currency) => ({
        value: currency.code,
        label: `${currency.code} — ${currency.name}`,
        leading: currency.flag,
        detail: currency.code,
      }))}
    />
  );
}
