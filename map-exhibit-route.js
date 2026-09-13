(() => {
  "use strict";

  const exhibitCount = () => globalThis.GaiaMapCategories?.exhibitCount ?? 71;
  const validNumber = number => Number.isInteger(number) && number >= 1 && number <= exhibitCount();
  const numberFromHash = hash => {
    const match = /^#world-(\d{1,3})$/iu.exec(hash);
    const number = match ? Number(match[1]) : NaN;
    return validNumber(number) ? number : null;
  };
  // Numeric but out-of-range links still open the map's normal fallback.
  const isMapHash = hash => ["#world", "#earth", "#japan", "#data"].includes(hash)
    || /^#world-\d+$/iu.test(hash);
  const hashForNumber = number => validNumber(Number(number))
    ? `#world-${String(Number(number)).padStart(2, "0")}` : null;

  globalThis.GaiaMapRoute = Object.freeze({ numberFromHash, isMapHash, hashForNumber });
})();
