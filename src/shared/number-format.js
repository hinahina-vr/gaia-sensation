// Cache formatters, not formatted values: observations remain live, while the
// locale/options setup is reused across map labels and statistical readouts.
const numberFormatters = new Map();

export function formatJapaneseNumber(value, maximumFractionDigits = 0, minimumFractionDigits = 0) {
  const key = `${minimumFractionDigits}:${maximumFractionDigits}`;
  let formatter = numberFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat("ja-JP", { minimumFractionDigits, maximumFractionDigits });
    numberFormatters.set(key, formatter);
  }
  return formatter.format(value);
}
