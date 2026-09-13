import { formatJapaneseNumber } from "./number-format.js";

// Preserve at least three significant digits for trace concentrations. This is
// display precision only; the original observations are never rounded in storage.
export function formatObservationNumber(value, digits = 3) {
  if (typeof value === "string") return value;
  if (!Number.isFinite(value)) return "—";
  const absolute = Math.abs(value);
  if (absolute > 0 && (absolute < 1e-7 || absolute >= 1e6)) return value.toExponential(2);
  const precision = absolute > 0 && absolute < 1 ? Math.max(digits, 2 - Math.floor(Math.log10(absolute))) : digits;
  return formatJapaneseNumber(value, Math.min(9, precision));
}

// Nonnegative source concentrations need data-relative margins, not an absolute
// +0.5 padding that hides differences between e.g. 0.001 and 0.002 ppm.
export function concentrationDomain(values) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return [0, 1];
  const low = Math.min(...finite), high = Math.max(...finite);
  const margin = high === low ? (Math.abs(high) || 1) * .2 : (high - low) * .12;
  return [Math.max(0, low - margin), high + margin];
}
