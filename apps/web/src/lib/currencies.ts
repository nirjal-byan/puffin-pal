export const CURRENCIES = [
  { code: "USD", flag: "🇺🇸", name: "US Dollar" },
  { code: "EUR", flag: "🇪🇺", name: "Euro" },
  { code: "GBP", flag: "🇬🇧", name: "British Pound" },
  { code: "NPR", flag: "🇳🇵", name: "Nepalese Rupee" },
  { code: "INR", flag: "🇮🇳", name: "Indian Rupee" },
  { code: "AUD", flag: "🇦🇺", name: "Australian Dollar" },
  { code: "CAD", flag: "🇨🇦", name: "Canadian Dollar" },
  { code: "JPY", flag: "🇯🇵", name: "Japanese Yen" },
  { code: "CNY", flag: "🇨🇳", name: "Chinese Yuan" },
  { code: "CHF", flag: "🇨🇭", name: "Swiss Franc" },
  { code: "SGD", flag: "🇸🇬", name: "Singapore Dollar" },
  { code: "AED", flag: "🇦🇪", name: "UAE Dirham" },
] as const;

export function currencyDetails(code: string) {
  return CURRENCIES.find((currency) => currency.code === code) ?? { code, flag: "🌐", name: code };
}
