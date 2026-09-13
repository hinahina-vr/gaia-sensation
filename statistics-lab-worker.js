const runMcmc = ({ alpha, beta, chains = 4, draws = 900 }) => {
  let seed = 0x6a09e667;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return (seed + 0.5) / 4294967296;
  };
  const logTarget = (value) => value <= 0 || value >= 1
    ? -Infinity
    : (alpha - 1) * Math.log(value) + (beta - 1) * Math.log(1 - value);
  const all = [];
  for (let chainIndex = 0; chainIndex < chains; chainIndex += 1) {
    let value = (alpha + chainIndex + 1) / (alpha + beta + chains + 1);
    let logDensity = logTarget(value);
    const chain = [];
    for (let index = 0; index < draws + 200; index += 1) {
      const proposal = Math.max(0.0001, Math.min(0.9999, value + (random() - 0.5) * 0.16));
      const candidateDensity = logTarget(proposal);
      if (Math.log(random()) < candidateDensity - logDensity) {
        value = proposal;
        logDensity = candidateDensity;
      }
      if (index >= 200) chain.push(value);
    }
    all.push(chain);
  }
  const means = all.map((chain) => chain.reduce((sum, value) => sum + value, 0) / chain.length);
  const variances = all.map((chain, chainIndex) => chain.reduce((sum, value) => sum + (value - means[chainIndex]) ** 2, 0) / (chain.length - 1));
  const meanOfMeans = means.reduce((sum, value) => sum + value, 0) / chains;
  const between = draws * means.reduce((sum, value) => sum + (value - meanOfMeans) ** 2, 0) / (chains - 1);
  const within = variances.reduce((sum, value) => sum + value, 0) / chains;
  const varianceHat = ((draws - 1) / draws) * within + between / draws;
  const rHat = Math.sqrt(varianceHat / within);
  let lagOne = 0;
  all.forEach((chain, chainIndex) => {
    for (let index = 1; index < chain.length; index += 1) lagOne += (chain[index] - means[chainIndex]) * (chain[index - 1] - means[chainIndex]);
  });
  lagOne /= Math.max(1e-12, chains * (draws - 1) * within);
  return { rHat, ess: Math.min(chains * draws, chains * draws * (1 - lagOne) / (1 + lagOne)), draws };
};

self.addEventListener("message", (event) => {
  if (event.data?.kind !== "mcmc") return;
  self.postMessage(runMcmc(event.data));
});
