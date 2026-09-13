// Swap display names only; chapter numbers, scene IDs and narrative order stay fixed.
export const applyChapterNames = (scenes, { reverse = false } = {}) => scenes.map(scene => {
  const names = {
    circle_invitation: ['05 / AFTER SCHOOL', '惑星の放課後', '05 / WELCOME', 'つながる世界'],
    welcome_chat: ['06 / WELCOME', 'つながる世界', '06 / AFTER SCHOOL', '惑星の放課後'],
  }[scene.id];
  if (!names) return scene;
  const [chapter, title] = reverse ? names.slice(0, 2) : names.slice(2);
  return { ...scene, chapter, title };
});
