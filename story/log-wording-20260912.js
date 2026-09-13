// Owner's OBSERVATION LOG correction, exported 2026-09-12T03:40:44.107Z.
// Keep the submitted manuscripts and historical LOG contracts unchanged.
export const logWordingCorrection = Object.freeze({
  id: 'circle_invitation_030',
  before: '「私たちのサークルは、このGAIA SENSEWAREを作りながら、それぞれの技術やフェチを持ち寄る場所です」',
  after: '「私たちのサークルは、このGAIA SENSEWAREを作りながら、それぞれの技術とこだわりをぶつけ合う場所です」',
});
export const applyLogWording = (scenes, {reverse = false} = {}) => scenes.map(scene => {
  const key = scene.steps ? 'steps' : 'entries';
  return {...scene, [key]: scene[key].map(step => {
    if (step.id !== logWordingCorrection.id) return step;
    const from = reverse ? logWordingCorrection.after : logWordingCorrection.before;
    const to = reverse ? logWordingCorrection.before : logWordingCorrection.after;
    if (step.text !== from) throw new Error(`${step.id}: unexpected input for wording correction`);
    return {...step, text: to};
  })};
});
