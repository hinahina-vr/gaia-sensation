const EPSILON = 1e-12;

const finiteValues = (values) => (Array.isArray(values) ? values : [])
  .map(Number)
  .filter(Number.isFinite);

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const sum = (values) => values.reduce((total, value) => total + value, 0);
const mean = (values) => values.length ? sum(values) / values.length : Number.NaN;
const round = (value, digits = 4) => Number.isFinite(value)
  ? Number(value.toFixed(digits))
  : Number.NaN;

const quantile = (values, probability) => {
  const sorted = finiteValues(values).sort((left, right) => left - right);
  if (!sorted.length) return Number.NaN;
  const position = clamp(probability, 0, 1) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
};

const median = (values) => quantile(values, 0.5);

const descriptive = (rawValues) => {
  const values = finiteValues(rawValues);
  if (!values.length) return null;
  const average = mean(values);
  const centered = values.map((value) => value - average);
  const populationVariance = mean(centered.map((value) => value ** 2));
  const sampleVariance = values.length > 1
    ? sum(centered.map((value) => value ** 2)) / (values.length - 1)
    : Number.NaN;
  const populationSd = Math.sqrt(populationVariance);
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  const maximumCount = Math.max(...counts.values());
  const modes = maximumCount > 1
    ? [...counts.entries()].filter(([, count]) => count === maximumCount).map(([value]) => value)
    : [];
  const skewness = populationSd > EPSILON
    ? mean(centered.map((value) => (value / populationSd) ** 3))
    : 0;
  const excessKurtosis = populationSd > EPSILON
    ? mean(centered.map((value) => (value / populationSd) ** 4)) - 3
    : 0;
  return {
    n: values.length,
    values,
    mean: average,
    median: median(values),
    modes,
    minimum: Math.min(...values),
    maximum: Math.max(...values),
    range: Math.max(...values) - Math.min(...values),
    q1,
    q3,
    iqr,
    lowerFence,
    upperFence,
    outliers: values.filter((value) => value < lowerFence || value > upperFence),
    populationVariance,
    sampleVariance,
    populationSd,
    sampleSd: Math.sqrt(sampleVariance),
    skewness,
    excessKurtosis,
  };
};

const histogram = (rawValues, requestedBins) => {
  const values = finiteValues(rawValues);
  const stats = descriptive(values);
  if (!stats) return [];
  const count = clamp(
    Math.round(Number(requestedBins) || (1 + Math.log2(values.length))),
    3,
    30,
  );
  if (stats.range < EPSILON) {
    return [{ x0: stats.minimum - 0.5, x1: stats.maximum + 0.5, count: values.length }];
  }
  const width = stats.range / count;
  const bins = Array.from({ length: count }, (_, index) => ({
    x0: stats.minimum + width * index,
    x1: index === count - 1 ? stats.maximum : stats.minimum + width * (index + 1),
    count: 0,
  }));
  values.forEach((value) => {
    const index = Math.min(count - 1, Math.floor((value - stats.minimum) / width));
    bins[index].count += 1;
  });
  return bins;
};

const covariance = (rawX, rawY, sample = false) => {
  const pairs = (Array.isArray(rawX) ? rawX : [])
    .map((value, index) => [Number(value), Number(rawY?.[index])])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (pairs.length < (sample ? 2 : 1)) return Number.NaN;
  const averageX = mean(pairs.map(([x]) => x));
  const averageY = mean(pairs.map(([, y]) => y));
  return sum(pairs.map(([x, y]) => (x - averageX) * (y - averageY)))
    / (pairs.length - (sample ? 1 : 0));
};

const pearson = (rawX, rawY) => {
  const pairs = (Array.isArray(rawX) ? rawX : [])
    .map((value, index) => [Number(value), Number(rawY?.[index])])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (pairs.length < 2) return Number.NaN;
  const x = pairs.map(([value]) => value);
  const y = pairs.map(([, value]) => value);
  const denominator = Math.sqrt(covariance(x, x) * covariance(y, y));
  return denominator > EPSILON ? covariance(x, y) / denominator : Number.NaN;
};

const erf = (value) => {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const t = 1 / (1 + 0.3275911 * x);
  const polynomial = (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t
    - 0.284496736) * t + 0.254829592) * t;
  return sign * (1 - polynomial * Math.exp(-x * x));
};

const normalPdf = (x, location = 0, scale = 1) => {
  if (!(scale > 0)) return Number.NaN;
  const z = (x - location) / scale;
  return Math.exp(-0.5 * z * z) / (scale * Math.sqrt(2 * Math.PI));
};

const normalCdf = (x, location = 0, scale = 1) => {
  if (!(scale > 0)) return Number.NaN;
  return 0.5 * (1 + erf((x - location) / (scale * Math.SQRT2)));
};

const inverseNormal = (probability) => {
  const p = clamp(Number(probability), 1e-15, 1 - 1e-15);
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969,
    138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887,
    66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184,
    -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143,
    3.75440866190742];
  const low = 0.02425;
  const high = 1 - low;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
      / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= high) {
    const q = p - 0.5;
    const r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q
      / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
    / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
};

const logGamma = (value) => {
  const coefficients = [
    676.5203681218851, -1259.1392167224028, 771.3234287776531,
    -176.6150291621406, 12.507343278686905, -0.13857109526572012,
    9.984369578019571e-6, 1.5056327351493116e-7,
  ];
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  let x = 0.9999999999998099;
  const z = value - 1;
  coefficients.forEach((coefficient, index) => { x += coefficient / (z + index + 1); });
  const t = z + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
};

const betaContinuedFraction = (a, b, x) => {
  const maxIterations = 200;
  const fpMinimum = 1e-30;
  let qab = a + b;
  let qap = a + 1;
  let qam = a - 1;
  let c = 1;
  let d = 1 - qab * x / qap;
  if (Math.abs(d) < fpMinimum) d = fpMinimum;
  d = 1 / d;
  let h = d;
  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const m2 = 2 * iteration;
    let aa = iteration * (b - iteration) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpMinimum) d = fpMinimum;
    c = 1 + aa / c;
    if (Math.abs(c) < fpMinimum) c = fpMinimum;
    d = 1 / d;
    h *= d * c;
    aa = -(a + iteration) * (qab + iteration) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpMinimum) d = fpMinimum;
    c = 1 + aa / c;
    if (Math.abs(c) < fpMinimum) c = fpMinimum;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 3e-10) break;
  }
  return h;
};

const regularizedBeta = (x, a, b) => {
  if (!(a > 0) || !(b > 0) || x < 0 || x > 1) return Number.NaN;
  if (x === 0 || x === 1) return x;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b)
    + a * Math.log(x) + b * Math.log1p(-x));
  return x < (a + 1) / (a + b + 2)
    ? front * betaContinuedFraction(a, b, x) / a
    : 1 - front * betaContinuedFraction(b, a, 1 - x) / b;
};

const regularizedGammaP = (shape, x) => {
  if (!(shape > 0) || x < 0) return Number.NaN;
  if (x === 0) return 0;
  if (x < shape + 1) {
    let term = 1 / shape;
    let total = term;
    for (let iteration = 1; iteration < 300; iteration += 1) {
      term *= x / (shape + iteration);
      total += term;
      if (Math.abs(term) < Math.abs(total) * 1e-14) break;
    }
    return total * Math.exp(-x + shape * Math.log(x) - logGamma(shape));
  }
  let b = x + 1 - shape;
  let c = 1 / 1e-30;
  let d = 1 / b;
  let h = d;
  for (let iteration = 1; iteration < 300; iteration += 1) {
    const an = -iteration * (iteration - shape);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-14) break;
  }
  return 1 - Math.exp(-x + shape * Math.log(x) - logGamma(shape)) * h;
};

const studentTCdf = (value, degreesOfFreedom) => {
  if (!(degreesOfFreedom > 0)) return Number.NaN;
  const x = degreesOfFreedom / (degreesOfFreedom + value * value);
  const tail = 0.5 * regularizedBeta(x, degreesOfFreedom / 2, 0.5);
  return value >= 0 ? 1 - tail : tail;
};

const chiSquareCdf = (value, degreesOfFreedom) => regularizedGammaP(degreesOfFreedom / 2, value / 2);
const fCdf = (value, numeratorDf, denominatorDf) => regularizedBeta(
  (numeratorDf * value) / (numeratorDf * value + denominatorDf),
  numeratorDf / 2,
  denominatorDf / 2,
);

const inverseCdf = (cdf, probability, lower = 0, upper = 1) => {
  const target = clamp(probability, 1e-12, 1 - 1e-12);
  let high = upper;
  while (cdf(high) < target && high < 1e12) high *= 2;
  let low = lower;
  for (let iteration = 0; iteration < 160; iteration += 1) {
    const middle = (low + high) / 2;
    if (cdf(middle) < target) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
};

const studentTQuantile = (probability, degreesOfFreedom) => {
  if (probability < 0.5) return -studentTQuantile(1 - probability, degreesOfFreedom);
  return inverseCdf((value) => studentTCdf(value, degreesOfFreedom), probability, 0, 2);
};
const chiSquareQuantile = (probability, degreesOfFreedom) => inverseCdf(
  (value) => chiSquareCdf(value, degreesOfFreedom), probability, 0, Math.max(2, degreesOfFreedom),
);
const fQuantile = (probability, numeratorDf, denominatorDf) => inverseCdf(
  (value) => fCdf(value, numeratorDf, denominatorDf), probability, 0, 2,
);

const logChoose = (n, k) => logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
const binomialPmf = (k, n, p) => (k < 0 || k > n || p < 0 || p > 1)
  ? 0
  : Math.exp(logChoose(n, k) + k * Math.log(Math.max(p, EPSILON))
    + (n - k) * Math.log(Math.max(1 - p, EPSILON)));
const poissonPmf = (k, lambda) => (k < 0 || !(lambda >= 0))
  ? 0
  : Math.exp(k * Math.log(Math.max(lambda, EPSILON)) - lambda - logGamma(k + 1));
const geometricPmf = (k, probability) => k < 1 ? 0 : ((1 - probability) ** (k - 1)) * probability;
const exponentialPdf = (x, rate) => x < 0 || !(rate > 0) ? 0 : rate * Math.exp(-rate * x);
const uniformPdf = (x, minimum, maximum) => x < minimum || x > maximum || !(maximum > minimum)
  ? 0
  : 1 / (maximum - minimum);

const meanConfidenceInterval = (rawValues, confidence = 0.95) => {
  const stats = descriptive(rawValues);
  if (!stats || stats.n < 2) return null;
  const alpha = 1 - confidence;
  const critical = studentTQuantile(1 - alpha / 2, stats.n - 1);
  const margin = critical * stats.sampleSd / Math.sqrt(stats.n);
  return { estimate: stats.mean, lower: stats.mean - margin, upper: stats.mean + margin, confidence, df: stats.n - 1 };
};

const varianceConfidenceInterval = (rawValues, confidence = 0.95) => {
  const stats = descriptive(rawValues);
  if (!stats || stats.n < 2) return null;
  const alpha = 1 - confidence;
  const df = stats.n - 1;
  return {
    estimate: stats.sampleVariance,
    lower: df * stats.sampleVariance / chiSquareQuantile(1 - alpha / 2, df),
    upper: df * stats.sampleVariance / chiSquareQuantile(alpha / 2, df),
    confidence,
    df,
  };
};

const proportionConfidenceInterval = (successes, trials, confidence = 0.95) => {
  if (!(trials > 0) || successes < 0 || successes > trials) return null;
  const estimate = successes / trials;
  const z = inverseNormal(0.5 + confidence / 2);
  const margin = z * Math.sqrt(estimate * (1 - estimate) / trials);
  return { estimate, lower: clamp(estimate - margin, 0, 1), upper: clamp(estimate + margin, 0, 1), confidence };
};

const oneSampleTTest = (rawValues, nullMean = 0, alternative = "two-sided") => {
  const stats = descriptive(rawValues);
  if (!stats || stats.n < 2 || !(stats.sampleSd > EPSILON)) return null;
  const statistic = (stats.mean - nullMean) / (stats.sampleSd / Math.sqrt(stats.n));
  const cdf = studentTCdf(statistic, stats.n - 1);
  const pValue = alternative === "greater" ? 1 - cdf
    : alternative === "less" ? cdf
      : 2 * Math.min(cdf, 1 - cdf);
  return { statistic, pValue: clamp(pValue, 0, 1), df: stats.n - 1, effect: stats.mean - nullMean, stats };
};

const welchTTest = (rawLeft, rawRight, alternative = "two-sided") => {
  const left = descriptive(rawLeft);
  const right = descriptive(rawRight);
  if (!left || !right || left.n < 2 || right.n < 2) return null;
  const leftTerm = left.sampleVariance / left.n;
  const rightTerm = right.sampleVariance / right.n;
  const standardError = Math.sqrt(leftTerm + rightTerm);
  if (!(standardError > EPSILON)) return null;
  const statistic = (left.mean - right.mean) / standardError;
  const df = ((leftTerm + rightTerm) ** 2)
    / ((leftTerm ** 2) / (left.n - 1) + (rightTerm ** 2) / (right.n - 1));
  const cdf = studentTCdf(statistic, df);
  const pValue = alternative === "greater" ? 1 - cdf
    : alternative === "less" ? cdf
      : 2 * Math.min(cdf, 1 - cdf);
  const critical = studentTQuantile(0.975, df);
  return {
    statistic,
    pValue: clamp(pValue, 0, 1),
    df,
    effect: left.mean - right.mean,
    interval: [left.mean - right.mean - critical * standardError, left.mean - right.mean + critical * standardError],
    left,
    right,
  };
};

const pairedTTest = (rawLeft, rawRight) => {
  const differences = (Array.isArray(rawLeft) ? rawLeft : [])
    .map((value, index) => Number(value) - Number(rawRight?.[index]))
    .filter(Number.isFinite);
  const test = oneSampleTTest(differences, 0);
  return test ? { ...test, differences } : null;
};

const exactBinomialTest = (successes, trials, probability = 0.5) => {
  if (!(trials > 0) || successes < 0 || successes > trials) return null;
  const observed = binomialPmf(successes, trials, probability);
  let pValue = 0;
  for (let count = 0; count <= trials; count += 1) {
    const candidate = binomialPmf(count, trials, probability);
    if (candidate <= observed + 1e-15) pValue += candidate;
  }
  return { successes, trials, probability, estimate: successes / trials, pValue: clamp(pValue, 0, 1) };
};

const chiSquareGoodnessOfFit = (observed, expected) => {
  if (!Array.isArray(observed) || !Array.isArray(expected) || observed.length !== expected.length || observed.length < 2) return null;
  if (expected.some((value) => !(value > 0))) return null;
  const statistic = sum(observed.map((value, index) => ((value - expected[index]) ** 2) / expected[index]));
  const df = observed.length - 1;
  return { statistic, df, pValue: 1 - chiSquareCdf(statistic, df), expectedTooSmall: expected.some((value) => value < 5) };
};

const chiSquareIndependence = (table) => {
  if (!Array.isArray(table) || table.length < 2 || table.some((row) => !Array.isArray(row) || row.length < 2)) return null;
  const columns = table[0].length;
  if (table.some((row) => row.length !== columns)) return null;
  const rowTotals = table.map(sum);
  const columnTotals = Array.from({ length: columns }, (_, column) => sum(table.map((row) => row[column])));
  const total = sum(rowTotals);
  if (!(total > 0)) return null;
  const expected = table.map((row, rowIndex) => row.map((_, columnIndex) => rowTotals[rowIndex] * columnTotals[columnIndex] / total));
  const statistic = sum(table.flatMap((row, rowIndex) => row.map((value, columnIndex) =>
    ((value - expected[rowIndex][columnIndex]) ** 2) / expected[rowIndex][columnIndex])));
  const df = (table.length - 1) * (columns - 1);
  return { statistic, df, pValue: 1 - chiSquareCdf(statistic, df), expected, expectedTooSmall: expected.flat().some((value) => value < 5) };
};

const fisherExact = (table) => {
  if (!Array.isArray(table) || table.length !== 2 || table.some((row) => row.length !== 2)) return null;
  const [[a, b], [c, d]] = table;
  const row1 = a + b;
  const row2 = c + d;
  const column1 = a + c;
  const total = row1 + row2;
  const probability = (cell) => Math.exp(
    logChoose(row1, cell) + logChoose(row2, column1 - cell) - logChoose(total, column1),
  );
  const observedProbability = probability(a);
  const minimum = Math.max(0, column1 - row2);
  const maximum = Math.min(row1, column1);
  let pValue = 0;
  for (let cell = minimum; cell <= maximum; cell += 1) {
    const candidate = probability(cell);
    if (candidate <= observedProbability + 1e-15) pValue += candidate;
  }
  return { pValue: clamp(pValue, 0, 1), oddsRatio: b * c === 0 ? Number.POSITIVE_INFINITY : a * d / (b * c) };
};

const benjaminiHochberg = (pValues) => {
  const sorted = pValues.map((value, index) => ({ value: clamp(Number(value), 0, 1), index }))
    .sort((left, right) => left.value - right.value);
  let previous = 1;
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const adjusted = Math.min(previous, sorted[index].value * sorted.length / (index + 1));
    sorted[index].adjusted = adjusted;
    previous = adjusted;
  }
  return sorted.sort((left, right) => left.index - right.index).map(({ adjusted }) => adjusted);
};

const oneWayAnova = (groups) => {
  const cleanGroups = (Array.isArray(groups) ? groups : []).map(finiteValues).filter((group) => group.length);
  if (cleanGroups.length < 2) return null;
  const all = cleanGroups.flat();
  const grandMean = mean(all);
  const betweenSs = sum(cleanGroups.map((group) => group.length * ((mean(group) - grandMean) ** 2)));
  const withinSs = sum(cleanGroups.map((group) => sum(group.map((value) => (value - mean(group)) ** 2))));
  const betweenDf = cleanGroups.length - 1;
  const withinDf = all.length - cleanGroups.length;
  if (withinDf <= 0 || withinSs < EPSILON) return null;
  const statistic = (betweenSs / betweenDf) / (withinSs / withinDf);
  return {
    statistic,
    pValue: 1 - fCdf(statistic, betweenDf, withinDf),
    betweenSs,
    withinSs,
    totalSs: betweenSs + withinSs,
    betweenDf,
    withinDf,
    groupMeans: cleanGroups.map(mean),
    groupSizes: cleanGroups.map((group) => group.length),
  };
};

const invertMatrix = (matrix) => {
  const size = matrix.length;
  const augmented = matrix.map((row, rowIndex) => [
    ...row.map(Number),
    ...Array.from({ length: size }, (_, columnIndex) => rowIndex === columnIndex ? 1 : 0),
  ]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    if (Math.abs(augmented[pivot][column]) < 1e-10) return null;
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    augmented[column] = augmented[column].map((value) => value / divisor);
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      augmented[row] = augmented[row].map((value, index) => value - factor * augmented[column][index]);
    }
  }
  return augmented.map((row) => row.slice(size));
};

const multiplyMatrixVector = (matrix, vector) => matrix.map((row) => sum(row.map((value, index) => value * vector[index])));

const ordinaryLeastSquares = (rows, response) => {
  if (!Array.isArray(rows) || !Array.isArray(response) || rows.length !== response.length || !rows.length) return null;
  const design = rows.map((row) => [1, ...row.map(Number)]);
  if (design.some((row) => row.some((value) => !Number.isFinite(value))) || response.some((value) => !Number.isFinite(Number(value)))) return null;
  const columns = design[0].length;
  if (design.length <= columns) return null;
  const xtx = Array.from({ length: columns }, (_, i) => Array.from({ length: columns }, (_, j) =>
    sum(design.map((row) => row[i] * row[j]))));
  const inverse = invertMatrix(xtx);
  if (!inverse) return null;
  const xty = Array.from({ length: columns }, (_, index) => sum(design.map((row, rowIndex) => row[index] * Number(response[rowIndex]))));
  const coefficients = multiplyMatrixVector(inverse, xty);
  const fitted = design.map((row) => sum(row.map((value, index) => value * coefficients[index])));
  const residuals = response.map((value, index) => Number(value) - fitted[index]);
  const responseMean = mean(response.map(Number));
  const rss = sum(residuals.map((value) => value ** 2));
  const tss = sum(response.map((value) => (Number(value) - responseMean) ** 2));
  const rSquared = tss > EPSILON ? 1 - rss / tss : Number.NaN;
  const df = design.length - columns;
  const residualVariance = rss / df;
  const standardErrors = inverse.map((row, index) => Math.sqrt(Math.max(0, residualVariance * row[index])));
  const tStatistics = coefficients.map((value, index) => value / standardErrors[index]);
  const pValues = tStatistics.map((value) => 2 * (1 - studentTCdf(Math.abs(value), df)));
  const adjustedRSquared = 1 - (1 - rSquared) * (design.length - 1) / df;
  const modelDf = columns - 1;
  const fStatistic = modelDf > 0 && rss > EPSILON ? ((tss - rss) / modelDf) / (rss / df) : Number.NaN;
  return {
    coefficients,
    fitted,
    residuals,
    rss,
    tss,
    rSquared,
    adjustedRSquared,
    df,
    standardErrors,
    tStatistics,
    pValues,
    fStatistic,
    fPValue: Number.isFinite(fStatistic) ? 1 - fCdf(fStatistic, modelDf, df) : Number.NaN,
  };
};

const simpleRegression = (rawX, rawY) => {
  const pairs = (Array.isArray(rawX) ? rawX : [])
    .map((value, index) => [Number(value), Number(rawY?.[index])])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  const model = ordinaryLeastSquares(pairs.map(([x]) => [x]), pairs.map(([, y]) => y));
  return model ? { ...model, pairs, correlation: pearson(pairs.map(([x]) => x), pairs.map(([, y]) => y)) } : null;
};

const logisticRegression = (rawX, rawY, options = {}) => {
  const pairs = (Array.isArray(rawX) ? rawX : [])
    .map((value, index) => [Number(value), Number(rawY?.[index])])
    .filter(([x, y]) => Number.isFinite(x) && (y === 0 || y === 1));
  if (pairs.length < 8 || new Set(pairs.map(([, y]) => y)).size < 2) return null;
  const xs = pairs.map(([x]) => x);
  const average = mean(xs);
  const scale = Math.sqrt(mean(xs.map((value) => (value - average) ** 2))) || 1;
  const design = pairs.map(([x]) => [1, (x - average) / scale]);
  const response = pairs.map(([, y]) => y);
  let coefficients = [0, 0];
  const maxIterations = options.maxIterations || 80;
  let converged = false;
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const probabilities = design.map((row) => 1 / (1 + Math.exp(-clamp(sum(row.map((value, index) => value * coefficients[index])), -30, 30))));
    const weights = probabilities.map((probability) => Math.max(1e-7, probability * (1 - probability)));
    const information = Array.from({ length: 2 }, (_, i) => Array.from({ length: 2 }, (_, j) =>
      sum(design.map((row, rowIndex) => row[i] * weights[rowIndex] * row[j]))));
    const inverse = invertMatrix(information);
    if (!inverse) return null;
    const score = Array.from({ length: 2 }, (_, i) => sum(design.map((row, rowIndex) => row[i] * (response[rowIndex] - probabilities[rowIndex]))));
    const step = multiplyMatrixVector(inverse, score);
    coefficients = coefficients.map((value, index) => value + step[index]);
    if (Math.max(...step.map(Math.abs)) < 1e-8) {
      converged = true;
      break;
    }
  }
  const intercept = coefficients[0] - coefficients[1] * average / scale;
  const slope = coefficients[1] / scale;
  const fitted = xs.map((x) => 1 / (1 + Math.exp(-clamp(intercept + slope * x, -30, 30))));
  const logLikelihood = sum(response.map((value, index) => value * Math.log(Math.max(fitted[index], EPSILON))
    + (1 - value) * Math.log(Math.max(1 - fitted[index], EPSILON))));
  return { intercept, slope, oddsRatio: Math.exp(slope), fitted, logLikelihood, converged, n: pairs.length, pairs };
};

const betaPdf = (x, alpha, beta) => x <= 0 || x >= 1
  ? 0
  : Math.exp((alpha - 1) * Math.log(x) + (beta - 1) * Math.log1p(-x)
    - (logGamma(alpha) + logGamma(beta) - logGamma(alpha + beta)));

const betaQuantile = (probability, alpha, beta) => inverseCdf(
  (value) => regularizedBeta(value, alpha, beta), probability, 0, 1,
);

const betaBinomialUpdate = (successes, trials, priorAlpha = 2, priorBeta = 2) => {
  if (!(trials > 0) || successes < 0 || successes > trials) return null;
  const alpha = priorAlpha + successes;
  const beta = priorBeta + trials - successes;
  const lower = betaQuantile(0.025, alpha, beta);
  const upper = betaQuantile(0.975, alpha, beta);
  const grid = Array.from({ length: 401 }, (_, index) => index / 400);
  const density = grid.map((value) => betaPdf(clamp(value, 1e-8, 1 - 1e-8), alpha, beta));
  const sortedIndices = density.map((value, index) => ({ value, index })).sort((left, right) => right.value - left.value);
  const step = 1 / 400;
  let accumulated = 0;
  const included = [];
  for (const item of sortedIndices) {
    accumulated += item.value * step;
    included.push(grid[item.index]);
    if (accumulated >= 0.95) break;
  }
  return {
    successes,
    trials,
    priorAlpha,
    priorBeta,
    posteriorAlpha: alpha,
    posteriorBeta: beta,
    priorMean: priorAlpha / (priorAlpha + priorBeta),
    observedRate: successes / trials,
    posteriorMean: alpha / (alpha + beta),
    equalTailInterval: [lower, upper],
    hdi: [Math.min(...included), Math.max(...included)],
    curve: grid.map((x, index) => ({ x, y: density[index] })),
  };
};

const seededRandom = (seed = 1) => {
  let state = Math.trunc(seed) >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const sampleMeans = (rawValues, sampleSize = 5, repetitions = 400, seed = 20260828) => {
  const values = finiteValues(rawValues);
  if (!values.length) return [];
  const random = seededRandom(seed);
  return Array.from({ length: repetitions }, () => mean(Array.from({ length: sampleSize }, () =>
    values[Math.floor(random() * values.length)])));
};

const formatNumber = (value, digits = 2) => Number.isFinite(value)
  ? new Intl.NumberFormat("ja-JP", { maximumFractionDigits: digits }).format(value)
  : "—";

const correlationStrength = (value) => {
  const absolute = Math.abs(value);
  if (absolute < 0.2) return "ごく弱い";
  if (absolute < 0.4) return "弱い";
  if (absolute < 0.6) return "中程度の";
  if (absolute < 0.8) return "強い";
  return "非常に強い";
};

const insight = ({ headline, meaning, evidence = [], interpretation, limitations = [], nextActions = [], provenance = ["SOURCE"] }) => ({
  headline,
  meaning,
  evidence,
  interpretation,
  limitations,
  nextActions,
  provenance,
});

const notApplicable = (reason, nextActions = []) => ({
  kind: "not-applicable",
  metrics: [],
  chart: { type: "empty" },
  insight: insight({
    headline: "このデータには、この分析をそのまま適用できません。",
    meaning: "統計手法には、標本数、変数の種類、比較群、独立性などの前提があります。",
    interpretation: reason,
    limitations: ["条件を満たさないまま数値を出すと、もっともらしい誤解を生みます。"],
    nextActions,
  }),
});

const analyzeSummary = ({ values, label, unit = "", provenance = ["SOURCE"] }) => {
  const stats = descriptive(values);
  if (!stats) return notApplicable("有限の数値がありません。", ["別のデータセットを選ぶ"]);
  const direction = stats.skewness > 0.5 ? "大きい値側へ裾が伸びています"
    : stats.skewness < -0.5 ? "小さい値側へ裾が伸びています"
      : "左右の偏りは大きくありません";
  return {
    kind: "summary",
    stats,
    metrics: [
      ["標本数", stats.n, "件"], ["平均", stats.mean, unit], ["中央値", stats.median, unit],
      ["標準偏差", stats.populationSd, unit], ["最小", stats.minimum, unit], ["最大", stats.maximum, unit],
      ["歪度", stats.skewness, ""], ["過剰尖度", stats.excessKurtosis, ""],
    ],
    chart: { type: "histogram", bins: histogram(values), stats, label, unit },
    insight: insight({
      headline: `${label}は平均${formatNumber(stats.mean)}${unit}、中央値${formatNumber(stats.median)}${unit}です。`,
      meaning: "平均は全体の重心、中央値は小さい順に並べた中央、標準偏差は値の散らばりを示します。",
      evidence: [
        ["n", stats.n, "件"], ["平均", stats.mean, unit], ["中央値", stats.median, unit],
        ["標準偏差", stats.populationSd, unit], ["範囲", stats.range, unit], ["外れ値候補", stats.outliers.length, "件"],
      ],
      interpretation: `${direction}。最小${formatNumber(stats.minimum)}${unit}から最大${formatNumber(stats.maximum)}${unit}まで広がり、平均だけでは地点や時点の違いを表し切れません。`,
      limitations: ["この要約だけでは、時間変化、地域差、原因は判断できません。", "外れ値候補は誤りとは限らず、重要な観測かもしれません。"],
      nextActions: ["05 標本とCLT", "06 区間推定", "11 回帰分析"],
      provenance,
    }),
  };
};

const analyzeCorrelation = ({ x, y, xLabel, yLabel, xUnit = "", yUnit = "", provenance = ["SOURCE"], extraLimitations = [] }) => {
  const model = simpleRegression(x, y);
  if (!model) return notApplicable("対応する2変数が2組以上必要です。定数列も相関を計算できません。", ["01 要約統計"]);
  const correlation = model.correlation;
  const shared = correlation ** 2;
  const direction = correlation >= 0 ? "正" : "負";
  return {
    kind: "correlation",
    model,
    metrics: [
      ["標本数", model.pairs.length, "組"], ["相関係数 r", correlation, ""], ["r²", shared, ""],
      ["回帰傾き", model.coefficients[1], `${yUnit}/${xUnit || "1単位"}`], ["決定係数 R²", model.rSquared, ""],
    ],
    chart: { type: "scatter", pairs: model.pairs, line: model.coefficients, xLabel, yLabel, xUnit, yUnit },
    insight: insight({
      headline: `${xLabel}と${yLabel}には${correlationStrength(correlation)}${direction}の関係が見られます。`,
      meaning: "相関係数rは2変数が直線的に同じ方向、または逆方向へ動く程度を-1から1で示します。",
      evidence: [["n", model.pairs.length, "組"], ["r", correlation, ""], ["r²", shared, ""], ["傾き", model.coefficients[1], `${yUnit}/${xUnit || "1単位"}`]],
      interpretation: `この保存標本ではr=${formatNumber(correlation, 3)}です。単回帰が説明する変動は約${formatNumber(shared * 100, 1)}%で、残りはこの変数だけでは説明できません。`,
      limitations: ["未収録要因、空間依存、時系列依存が結果へ影響する可能性があります。", ...extraLimitations],
      nextActions: ["12 回帰診断", "06 区間推定"],
      provenance,
    }),
  };
};

const analyzeDistribution = ({ values, label, unit = "", family = "normal", provenance = ["SOURCE"], periodLabel = "" }) => {
  const stats = descriptive(values);
  if (!stats || stats.n < 3) return notApplicable("分布の形を確認するには3件以上の数値が必要です。", ["01 要約統計"]);
  const bins = histogram(values);
  let modelLabel = "正規分布";
  let curve;
  let interpretation;
  const minimum = stats.minimum;
  const maximum = stats.maximum;
  if (family === "poisson") {
    modelLabel = "ポアソン分布";
    const dispersion = stats.populationVariance / Math.max(stats.mean, EPSILON);
    curve = Array.from({ length: Math.max(2, Math.ceil(maximum) + 1) }, (_, x) => ({ x, y: poissonPmf(x, stats.mean) * stats.n }));
    interpretation = `${periodLabel || "単位期間"}の平均は${formatNumber(stats.mean)}件、分散は${formatNumber(stats.populationVariance)}です。分散／平均は${formatNumber(dispersion, 2)}で、${dispersion > 1.2 ? "ポアソン分布より変動が大きい" : dispersion < 0.8 ? "ポアソン分布より変動が小さい" : "平均と分散が近い"}傾向です。`;
  } else if (family === "exponential") {
    modelLabel = "指数分布";
    const rate = 1 / stats.mean;
    curve = Array.from({ length: 121 }, (_, index) => {
      const x = maximum * index / 120;
      return { x, y: exponentialPdf(x, rate) * stats.n * (stats.range / Math.max(1, bins.length)) };
    });
    interpretation = `平均間隔は${formatNumber(stats.mean)}${unit}、中央値は${formatNumber(stats.median)}${unit}です。指数分布は発生率が一定で、各間隔が独立という仮定を置きます。`;
  } else {
    curve = Array.from({ length: 121 }, (_, index) => {
      const x = minimum + stats.range * index / 120;
      return { x, y: normalPdf(x, stats.mean, stats.populationSd) * stats.n * (stats.range / Math.max(1, bins.length)) };
    });
    interpretation = `平均${formatNumber(stats.mean)}${unit}、標準偏差${formatNumber(stats.populationSd)}${unit}です。歪度は${formatNumber(stats.skewness, 2)}で、正規分布は比較のための仮定として重ねています。`;
  }
  return {
    kind: "distribution",
    stats,
    family,
    metrics: [["標本数", stats.n, "件"], ["平均", stats.mean, unit], ["分散", stats.populationVariance, `${unit}²`], ["歪度", stats.skewness, ""], ["尖度", stats.excessKurtosis, ""]],
    chart: { type: "distribution", bins, curve, label, unit, modelLabel },
    insight: insight({
      headline: `${label}を${modelLabel}と比較します。`,
      meaning: "理論分布は、観測値がどのような確率的な仕組みから生まれたかを単純化して表すモデルです。",
      evidence: [["n", stats.n, "件"], ["平均", stats.mean, unit], ["分散", stats.populationVariance, `${unit}²`], ["歪度", stats.skewness, ""]],
      interpretation,
      limitations: ["曲線が重なって見えても、適合を証明したことにはなりません。", "観測範囲、抽出条件、時間・空間依存を考慮する必要があります。"],
      nextActions: ["05 標本とCLT", "09 適合度検定"],
      provenance,
    }),
  };
};

const analyzeSampling = ({ values, label, unit = "", provenance = ["SOURCE"], sampleSize = 5 }) => {
  const stats = descriptive(values);
  if (!stats || stats.n < 3) return notApplicable("標本シミュレーションには3件以上の有限値が必要です。", ["01 要約統計"]);
  const size = clamp(Math.round(sampleSize), 2, Math.max(2, stats.n));
  const samples = sampleMeans(stats.values, size, 500);
  const sampleStats = descriptive(samples);
  const chebyshev95 = Math.sqrt(1 / 0.05);
  return {
    kind: "sampling",
    metrics: [["元データ", stats.n, "件"], ["標本サイズ", size, "件"], ["反復", samples.length, "回"], ["標本平均の平均", sampleStats.mean, unit], ["標本平均の標準偏差", sampleStats.populationSd, unit]],
    chart: { type: "sampling", bins: histogram(samples), populationMean: stats.mean, label, unit },
    insight: insight({
      headline: `${size}件ずつ取り直した標本平均は、全体平均${formatNumber(stats.mean)}${unit}の周囲へ集まります。`,
      meaning: "大数の法則は標本数が増えるほど平均が安定すること、中心極限定理は標本平均の分布が正規分布へ近づくことを示します。",
      evidence: [["元データ", stats.n, "件"], ["標本サイズ", size, "件"], ["反復", samples.length, "回"], ["標本平均SD", sampleStats.populationSd, unit]],
      interpretation: `固定シードの500回シミュレーションでは、標本平均の平均は${formatNumber(sampleStats.mean)}${unit}でした。チェビチェフの不等式では少なくとも95%が平均±${formatNumber(chebyshev95, 2)}標準偏差以内に入ります。`,
      limitations: ["保存データ自体が無作為標本とは限りません。再標本化は元データの偏りを取り除きません。"],
      nextActions: ["06 区間推定", "07 仮説検定"],
      provenance,
    }),
  };
};

const analyzeInterval = ({ values, label, unit = "", provenance = ["SOURCE"] }) => {
  const interval = meanConfidenceInterval(values);
  const varianceInterval = varianceConfidenceInterval(values);
  if (!interval || !varianceInterval) return notApplicable("平均の区間推定には2件以上の有限値が必要です。", ["01 要約統計"]);
  return {
    kind: "interval",
    interval,
    metrics: [["標本平均", interval.estimate, unit], ["95%下限", interval.lower, unit], ["95%上限", interval.upper, unit], ["不偏分散", varianceInterval.estimate, `${unit}²`]],
    chart: { type: "interval", estimate: interval.estimate, lower: interval.lower, upper: interval.upper, label, unit },
    insight: insight({
      headline: `${label}の平均の95%信頼区間は${formatNumber(interval.lower)}〜${formatNumber(interval.upper)}${unit}です。`,
      meaning: "同じ方法で標本抽出と区間計算を繰り返すと、その約95%が母平均を含むように作られた範囲です。",
      evidence: [["平均", interval.estimate, unit], ["下限", interval.lower, unit], ["上限", interval.upper, unit], ["自由度", interval.df, ""]],
      interpretation: `点推定${formatNumber(interval.estimate)}${unit}だけでなく、約${formatNumber(interval.upper - interval.lower)}${unit}の不確実性幅があります。`,
      limitations: ["今回の特定区間に母平均が95%の確率で入る、という意味ではありません。", "独立な無作為標本と近似的な正規性を仮定します。"],
      nextActions: ["07 仮説検定", "11 回帰分析"],
      provenance,
    }),
  };
};

const analyzeWelch = ({ left, right, leftLabel, rightLabel, unit = "", provenance = ["SOURCE"], diagnosticOnly = false }) => {
  const test = welchTTest(left, right);
  if (!test) return notApplicable("比較する2群に、それぞれ2件以上の有限値とばらつきが必要です。", ["01 要約統計"]);
  const decision = test.pValue < 0.05 ? "5%水準で平均差0を棄却します" : "5%水準では平均差0を棄却できません";
  return {
    kind: "test",
    test,
    metrics: [[`${leftLabel}平均`, test.left.mean, unit], [`${rightLabel}平均`, test.right.mean, unit], ["平均差", test.effect, unit], ["t", test.statistic, ""], ["p", test.pValue, ""], ["自由度", test.df, ""]],
    chart: { type: "test", left: test.left.values, right: test.right.values, leftLabel, rightLabel, unit, interval: test.interval },
    insight: insight({
      headline: diagnosticOnly ? "2群の違いを診断表示します。推測統計としては解釈しません。" : decision,
      meaning: "Welch検定は、分散が等しいと仮定せずに2群の平均差を評価します。p値は帰無仮説の下で今回以上に極端な結果が出る確率です。",
      evidence: [["平均差", test.effect, unit], ["95%下限", test.interval[0], unit], ["95%上限", test.interval[1], unit], ["p", test.pValue, ""]],
      interpretation: `${leftLabel}と${rightLabel}の平均差は${formatNumber(test.effect)}${unit}です。${diagnosticOnly ? "群の作り方が無作為標本ではないため、違いの原因や母集団差は判断しません。" : decision + "。"}`,
      limitations: ["p値が大きいことは、差が存在しない証明ではありません。", "効果量、信頼区間、標本設計を合わせて読む必要があります。"],
      nextActions: ["06 区間推定", "10 ANOVA"],
      provenance,
    }),
  };
};

const analyzeCategorical = ({ categories, groups, categoryLabel = "カテゴリ", groupLabel = "群", provenance = ["SOURCE"] }) => {
  const pairs = (Array.isArray(categories) ? categories : [])
    .map((category, index) => [String(category ?? ""), String(groups?.[index] ?? "")])
    .filter(([category, group]) => category && group);
  const categoryLevels = [...new Set(pairs.map(([category]) => category))];
  const groupLevels = [...new Set(pairs.map(([, group]) => group))];
  if (categoryLevels.length < 2 || groupLevels.length < 2) {
    return notApplicable(`比較に必要な変動がありません。${categoryLabel}は${categoryLevels.length}種類、${groupLabel}は${groupLevels.length}種類です。`, ["01 要約統計", "データの抽出条件を確認する"]);
  }
  const table = groupLevels.map((group) => categoryLevels.map((category) =>
    pairs.filter(([candidateCategory, candidateGroup]) => candidateCategory === category && candidateGroup === group).length));
  const test = chiSquareIndependence(table);
  if (!test) return notApplicable("クロス集計表を構成できませんでした。", ["01 要約統計"]);
  const sparse = test.expectedTooSmall;
  return {
    kind: "categorical",
    table,
    categoryLevels,
    groupLevels,
    metrics: [["標本数", pairs.length, "件"], [`${categoryLabel}数`, categoryLevels.length, "種類"], [`${groupLabel}数`, groupLevels.length, "種類"], ["χ²", test.statistic, ""], ["p", test.pValue, ""]],
    chart: { type: "categorical", table, categoryLevels, groupLevels },
    insight: insight({
      headline: sparse ? "期待度数が不足しているため、χ²検定の結論は出しません。" : test.pValue < 0.05 ? `${categoryLabel}と${groupLabel}に関連が見られます。` : `${categoryLabel}と${groupLabel}の関連を示す十分な証拠はありません。`,
      meaning: "χ²独立性検定は、クロス集計の偏りが偶然だけで説明できるかを評価します。",
      evidence: [["n", pairs.length, "件"], ["χ²", test.statistic, ""], ["自由度", test.df, ""], ["p", test.pValue, ""], ["期待度数5未満", test.expected.flat().filter((value) => value < 5).length, "セル"]],
      interpretation: sparse ? `${pairs.length}件が${groupLevels.length}群×${categoryLevels.length}カテゴリへ細かく分かれています。群やカテゴリを統合しない限り、近似の前提を満たしません。` : `観測された組み合わせの偏りをχ²=${formatNumber(test.statistic)}として評価しました。`,
      limitations: ["関連が見られても因果関係は分かりません。", "選定された事例のクロス集計であり、世界全体の無作為標本ではありません。"],
      nextActions: sparse ? ["カテゴリまたは地域を統合する", "2×2ならFisher検定を使う"] : ["効果の大きいセルを確認する", "多重比較を補正する"],
      provenance,
    }),
  };
};

const analyzeAnova = ({ groups, labels, unit = "", provenance = ["SOURCE"], diagnosticOnly = false }) => {
  const model = oneWayAnova(groups);
  if (!model) return notApplicable("ANOVAには2群以上、各群のばらつき、残差自由度が必要です。", ["08 Welch検定"]);
  return {
    kind: "anova",
    model,
    metrics: [["F", model.statistic, ""], ["p", model.pValue, ""], ["群間平方和", model.betweenSs, `${unit}²`], ["群内平方和", model.withinSs, `${unit}²`]],
    chart: { type: "anova", groups: groups.map(finiteValues), labels, means: model.groupMeans, unit },
    insight: insight({
      headline: diagnosticOnly ? "群平均を探索的に比較します。独立性を満たさないため推測結論は出しません。" : model.pValue < 0.05 ? "少なくとも1つの群平均が異なる可能性があります。" : "群平均の違いを示す十分な証拠はありません。",
      meaning: "ANOVAは全体のばらつきを群間と群内へ分け、群間の違いが相対的に大きいかをF値で評価します。",
      evidence: [["F", model.statistic, ""], ["p", model.pValue, ""], ["群間df", model.betweenDf, ""], ["群内df", model.withinDf, ""]],
      interpretation: `群平均は${model.groupMeans.map((value, index) => `${labels?.[index] || index + 1}:${formatNumber(value)}${unit}`).join(" / ")}です。ANOVAだけではどの群同士が違うかは確定しません。`,
      limitations: ["独立性、各群の正規性、分散の等質性が前提です。", "時系列や空間データでは観測同士が独立でない可能性があります。"],
      nextActions: ["08 Welch検定", "10 BH補正", "12 残差診断"],
      provenance,
    }),
  };
};

const analyzeLogistic = ({ x, y, xLabel, outcomeLabel, provenance = ["SOURCE"], extraLimitations = [] }) => {
  const model = logisticRegression(x, y);
  if (!model) return notApplicable("ロジスティック回帰には、0と1の両方を含む二値目的変数と8件以上の標本が必要です。", ["09 質的変数の検定"]);
  return {
    kind: "logistic",
    model,
    metrics: [["標本数", model.n, "件"], ["係数", model.slope, ""], ["オッズ比", model.oddsRatio, "倍"], ["対数尤度", model.logLikelihood, ""], ["収束", model.converged ? 1 : 0, ""]],
    chart: { type: "logistic", pairs: model.pairs, line: { intercept: model.intercept, slope: model.slope }, xLabel, outcomeLabel },
    insight: insight({
      headline: model.converged ? `${xLabel}が1増えると、${outcomeLabel}のオッズは約${formatNumber(model.oddsRatio, 2)}倍です。` : "最尤推定が安定して収束しませんでした。",
      meaning: "ロジスティック回帰は、説明変数と二値結果が1になる確率の関係をS字曲線で表します。",
      evidence: [["n", model.n, "件"], ["係数", model.slope, ""], ["オッズ比", model.oddsRatio, "倍"], ["対数尤度", model.logLikelihood, ""]],
      interpretation: model.converged ? `係数の符号は${model.slope >= 0 ? "確率が増える" : "確率が減る"}方向を示します。ただし分類境界はデータの選び方に依存します。` : "完全分離、標本不足、強い外れ値がないか確認してください。",
      limitations: ["オッズ比は確率の倍率ではありません。", "観察データから因果効果は判断できません。", ...extraLimitations],
      nextActions: ["09 クロス集計", "14 ベイズ更新"],
      provenance,
    }),
  };
};

const analyzeBayes = ({ successes, trials, successLabel, provenance = ["SOURCE"], priorAlpha = 2, priorBeta = 2, extraLimitations = [] }) => {
  const model = betaBinomialUpdate(successes, trials, priorAlpha, priorBeta);
  if (!model) return notApplicable("ベイズ更新には成功数と試行数が必要です。", ["09 質的変数の検定"]);
  return {
    kind: "bayes",
    model,
    metrics: [["成功", successes, "件"], ["試行", trials, "件"], ["観測比率", model.observedRate, ""], ["事前平均", model.priorMean, ""], ["事後平均", model.posteriorMean, ""], ["95% HDI下限", model.hdi[0], ""], ["95% HDI上限", model.hdi[1], ""]],
    chart: { type: "bayes", curve: model.curve, hdi: model.hdi, observedRate: model.observedRate, priorMean: model.priorMean },
    insight: insight({
      headline: `${successLabel}の事後平均は${formatNumber(model.posteriorMean * 100, 1)}%、95% HDIは${formatNumber(model.hdi[0] * 100, 1)}〜${formatNumber(model.hdi[1] * 100, 1)}%です。`,
      meaning: "ベイズ更新は、観測前の分布にデータの尤度を掛け、観測後の不確実性を事後分布として表します。",
      evidence: [["事前", `Beta(${priorAlpha}, ${priorBeta})`, ""], ["観測", `${successes}/${trials}`, ""], ["事後", `Beta(${model.posteriorAlpha}, ${model.posteriorBeta})`, ""], ["事後平均", model.posteriorMean, ""]],
      interpretation: `観測比率${formatNumber(model.observedRate * 100, 1)}%を受け、事前平均${formatNumber(model.priorMean * 100, 1)}%から事後平均${formatNumber(model.posteriorMean * 100, 1)}%へ更新されました。`,
      limitations: ["事後分布は事前分布と確率モデルの選択に依存します。", "選定事例の比率を母集団全体へ一般化できるとは限りません。", ...extraLimitations],
      nextActions: ["09 Fisher検定", "15 分析の進め方"],
      provenance,
    }),
  };
};

export {
  analyzeAnova,
  analyzeBayes,
  analyzeCategorical,
  analyzeCorrelation,
  analyzeDistribution,
  analyzeInterval,
  analyzeLogistic,
  analyzeSampling,
  analyzeSummary,
  analyzeWelch,
  benjaminiHochberg,
  betaBinomialUpdate,
  binomialPmf,
  chiSquareCdf,
  chiSquareGoodnessOfFit,
  chiSquareIndependence,
  descriptive,
  exactBinomialTest,
  exponentialPdf,
  fCdf,
  fQuantile,
  fisherExact,
  geometricPmf,
  histogram,
  inverseNormal,
  meanConfidenceInterval,
  normalCdf,
  normalPdf,
  notApplicable,
  oneSampleTTest,
  oneWayAnova,
  ordinaryLeastSquares,
  pairedTTest,
  pearson,
  poissonPmf,
  proportionConfidenceInterval,
  quantile,
  round,
  sampleMeans,
  simpleRegression,
  studentTCdf,
  studentTQuantile,
  uniformPdf,
  varianceConfidenceInterval,
  welchTTest,
};
