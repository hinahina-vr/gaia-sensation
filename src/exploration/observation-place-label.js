// UI labels only: leave source station names, coordinates and catalogue IDs intact.
// Tokyo is a source point name, not a municipality; do not invent 東京市 or a ward.
export const formatPrefecturePlace = (prefecture, municipality = "") => {
  if (!municipality) return prefecture;
  const name = municipality === "東京" || /[市区町村]$/u.test(municipality)
    ? municipality : `${municipality}市`;
  return `${prefecture}（${name}）`;
};
