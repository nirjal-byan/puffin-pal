import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/max";

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
export const PHONE_COUNTRIES = getCountries()
  .map((country) => ({
    country,
    name: regionNames.of(country) ?? country,
    callingCode: getCountryCallingCode(country),
    flag: String.fromCodePoint(...[...country].map((letter) => 127397 + letter.charCodeAt(0))),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function readPhoneInput(value: string, selectedCountry: CountryCode) {
  const input = value.trim().replace(/^00/, "+");
  const international = input.startsWith("+");
  const formatter = new AsYouType(international ? undefined : selectedCountry);
  formatter.input(input);
  const detected = international ? formatter.getCountry() : undefined;
  const callingCode = international ? formatter.getCallingCode() : undefined;
  const fallback =
    callingCode && getCountryCallingCode(selectedCountry) !== callingCode
      ? PHONE_COUNTRIES.find((item) => item.callingCode === callingCode)?.country
      : selectedCountry;
  const country = detected ?? fallback ?? selectedCountry;
  const phone = parsePhoneNumberFromString(input, {
    defaultCountry: country,
    extract: false,
  });
  return {
    country,
    phone,
    valid: Boolean(phone?.isValid()),
    normalized: phone?.isValid() ? phone.number : "",
  };
}
