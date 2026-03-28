/**
 * Formats a numeric value as a Canadian dollar (CAD) currency string.
 * Pass an explicit currency code to format in a different currency using
 * the same en-CA locale (e.g. for accounts whose currency differs from CAD).
 */
export const formatCurrency = (value: number, currency = 'CAD'): string =>
    new Intl.NumberFormat('en-CA', {style: 'currency', currency}).format(value);
