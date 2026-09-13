(() => {
  "use strict";

  // Sample once per burst, never in a frame loop. Each layer has its own
  // irregular stepped timeline; fresh offsets and durations prevent a loop.
  const randomize = (surface) => {
    if (!surface || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const between = (min, max) => min + Math.random() * (max - min);
    const layers = [
      ["stage", 32, "px", 155, 180],
      ["bands", 12, "%", 170, 210],
      ["dropout", 19, "%", 140, 200],
      ["noise", 56, "px", 155, 210],
    ];
    for (const [name, amplitude, unit, minDuration, maxDuration] of layers) {
      surface.style.setProperty(`--glitch-${name}-duration`, `${Math.round(between(minDuration, maxDuration))}ms`);
      for (let index = 1; index <= 8; index += 1) {
        // Do not alternate direction automatically: same-side kicks and tiny
        // offsets between larger tears keep the interference from swaying.
        surface.style.setProperty(`--glitch-${name}-x${index}`, `${between(-amplitude, amplitude).toFixed(2)}${unit}`);
      }
    }
    surface.style.setProperty("--glitch-bands-strength", between(.58, .88).toFixed(2));
    surface.style.setProperty("--glitch-noise-strength", between(.32, .56).toFixed(2));
    const tears = Array.from({ length: 5 }, (_, index) => {
      const top = 7 + index * 17 + between(0, 8);
      const bottom = top + between(.4, 3.8);
      return `transparent ${top.toFixed(2)}%, #000 ${top.toFixed(2)}% ${bottom.toFixed(2)}%, transparent ${bottom.toFixed(2)}%`;
    });
    surface.style.setProperty("--glitch-bands-mask", `linear-gradient(180deg, transparent 0%, ${tears.join(", ")}, transparent 100%)`);
    // Change which scan rows break between bursts, without animating them up
    // or down. The disturbance itself always travels on the horizontal axis.
    const row = between(16, 80);
    surface.style.setProperty("--glitch-dropout-row", `${row.toFixed(2)}%`);
    surface.style.setProperty("--glitch-dropout-end", `${(row + between(.15, .55)).toFixed(2)}%`);
  };

  window.GaiaEndingGlitch = Object.freeze({ randomize });
})();
