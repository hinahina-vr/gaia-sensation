// Modes 15–30 share the same Japan overview. Observation selection changes
// the data/markers, never the user's pan or zoom within an exhibit.
export const japanPrefectureView = (viewportWidth) => {
  const mobile = viewportWidth <= 720;
  return {
    lon: 137.4,
    lat: 36.2,
    zoom: mobile ? 4.25 : 6,
    targetX: 0.51,
    targetY: mobile ? 0.42 : 0.44,
    label: "japan-47-prefectures",
  };
};
