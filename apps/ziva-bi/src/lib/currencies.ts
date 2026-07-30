/**
 * ZivaBI — ISO 4217 currency catalogue.
 *
 * Shared between the Currencies & FX setup page and any other page that
 * needs to display or select from the tenant's enabled currencies.
 * Keep this list in sync with the backend's COUNTRY_CURRENCY_MAP.
 */

export interface IsoCurrency {
  code: string;
  name: string;
  symbol: string;
}

export const ISO_CURRENCIES: IsoCurrency[] = [
  { code: "USD",   name: "US Dollar",               symbol: "$"   },
  { code: "EUR",   name: "Euro",                    symbol: "€"   },
  { code: "GBP",   name: "British Pound",           symbol: "£"   },
  { code: "NGN",   name: "Nigerian Naira",          symbol: "₦"   },
  { code: "GHS",   name: "Ghanaian Cedi",           symbol: "₵"   },
  { code: "KES",   name: "Kenyan Shilling",         symbol: "KSh" },
  { code: "ZAR",   name: "South African Rand",      symbol: "R"   },
  { code: "AED",   name: "UAE Dirham",              symbol: "د.إ" },
  { code: "CAD",   name: "Canadian Dollar",         symbol: "CA$" },
  { code: "AUD",   name: "Australian Dollar",       symbol: "A$"  },
  { code: "CHF",   name: "Swiss Franc",             symbol: "Fr"  },
  { code: "JPY",   name: "Japanese Yen",            symbol: "¥"   },
  { code: "CNY",   name: "Chinese Yuan",            symbol: "¥"   },
  { code: "INR",   name: "Indian Rupee",            symbol: "₹"   },
  { code: "XOF",   name: "CFA Franc BCEAO",        symbol: "Fr"  },
  { code: "XAF",   name: "CFA Franc BEAC",         symbol: "Fr"  },
  { code: "EGP",   name: "Egyptian Pound",          symbol: "E£"  },
  { code: "TZS",   name: "Tanzanian Shilling",      symbol: "TSh" },
  { code: "UGX",   name: "Ugandan Shilling",        symbol: "USh" },
  { code: "RWF",   name: "Rwandan Franc",           symbol: "Fr"  },
  { code: "ETB",   name: "Ethiopian Birr",          symbol: "Br"  },
  { code: "MAD",   name: "Moroccan Dirham",         symbol: "MAD" },
];

/**
 * Look up the display name for an ISO 4217 code.
 * Returns the code itself as a fallback for unknown currencies.
 */
export function getCurrencyLabel(code: string): string {
  const match = ISO_CURRENCIES.find(c => c.code === code);
  return match ? `${code} — ${match.name}` : code;
}
