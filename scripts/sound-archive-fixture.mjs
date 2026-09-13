// Visual-regression tests explicitly represent a listener who knows the tracks.
// History-only fixture; fresh availability is checked by check-sound-slim-unlocked-browser.
export const seedHeardSoundArchive = target => target.addInitScript(() => {
  localStorage.setItem("gaia-senseware-heard-tracks:v1", JSON.stringify({
    version: 1,
    tracks: ["opening", "story", "windowlight", "firstlight", "foldedwind", "snowfire", "snowafter", "moonbook", "senseware", "moonreopen", "ending", "trueend"],
  }));
});
