"use client";
import { useLayoutEffect, useRef, useState } from "react";
import type { CountryCode } from "libphonenumber-js/max";
import { CountryPicker } from "./country-picker";
import { readPhoneInput } from "../lib/phone";

export function PhoneInput({
  value,
  country,
  onChange,
}: {
  value: string;
  country: CountryCode;
  onChange: (value: string, country: CountryCode) => void;
}) {
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const result = readPhoneInput(value, country);
  const error = touched && value.trim() && !result.valid;
  useLayoutEffect(() => {
    const current = readPhoneInput(value, country);
    inputRef.current?.setCustomValidity(
      value.trim() && !current.valid ? "Enter a valid phone number, including the area code." : "",
    );
  }, [value, country]);
  function update(nextValue: string, nextCountry: CountryCode) {
    const next = readPhoneInput(nextValue, nextCountry);
    onChange(nextValue, next.country);
  }
  return (
    <div className="registration-phone">
      <label htmlFor="signup-phone">
        Phone number <span className="required-mark">*</span>
      </label>
      <div className={`phone-input-group ${error ? "phone-input-invalid" : ""}`}>
        <div className="phone-country-control">
          <CountryPicker
            country={country}
            onChange={(nextCountry) => {
              const parsed = readPhoneInput(value, country).phone;
              const national =
                /^[+]|^00/.test(value.trim()) && parsed ? parsed.nationalNumber : value;
              update(national, nextCountry);
              inputRef.current?.focus();
            }}
          />
        </div>
        <input
          ref={inputRef}
          id="signup-phone"
          name="phoneNumberDisplay"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          maxLength={32}
          value={value}
          placeholder={country === "US" || country === "CA" ? "202 555 0123" : "Phone number"}
          aria-invalid={Boolean(error)}
          aria-describedby="signup-phone-hint"
          onChange={(event) => update(event.target.value, country)}
          onBlur={() => {
            setTouched(true);
            if (result.valid && result.phone) update(result.phone.formatNational(), result.country);
          }}
        />
        <input type="hidden" name="phoneNumber" value={result.normalized} />
      </div>
      <span
        id="signup-phone-hint"
        className={`field-hint ${error ? "phone-error" : ""}`}
        aria-live="polite"
      >
        {error
          ? "Enter a valid number for the selected country."
          : "Country detected automatically with + or 00."}
      </span>
    </div>
  );
}
