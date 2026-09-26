// Shared starting point for historical maps, never a fabricated observation.
export const INITIAL_OBSERVATION_YEAR = 2016;

export function initialObservationIndex(periods, yearOf = value => Number(value)) {
  let selected = -1, distance = Infinity, selectedYear = Infinity;
  periods.forEach((period, index) => {
    const year = Number(yearOf(period));
    if (!Number.isFinite(year)) return;
    const delta = Math.abs(year - INITIAL_OBSERVATION_YEAR);
    if (delta < distance || (delta === distance && year < selectedYear)) {
      selected = index; distance = delta; selectedYear = year;
    }
  });
  return selected;
}
