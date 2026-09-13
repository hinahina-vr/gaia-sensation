const isFiniteNumber = (value) => Number.isFinite(value);

const round = (value, digits = 3) => {
  if (!isFiniteNumber(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
};

const median = (values) => {
  const sorted = values.filter(isFiniteNumber).sort((first, second) => first - second);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

const decimalYear = (row) => Number(row.year) + (Number(row.month || 1) - 1) / 12;

const spatialPrediction = (
  values,
  width,
  height,
  targetIndex,
  { neighborCount = 8, power = 2, excludeIndex = -1 } = {},
) => {
  const row = Math.floor(targetIndex / width);
  const column = targetIndex % width;
  const latitude = 90 - (row + 0.5) * (180 / height);
  const longitudeScale = Math.max(0.12, Math.cos((latitude * Math.PI) / 180));
  const candidates = [];
  const maximumRadius = Math.max(width / 2, height);

  for (let radius = 1; radius <= maximumRadius && candidates.length < neighborCount; radius += 1) {
    for (let deltaRow = -radius; deltaRow <= radius; deltaRow += 1) {
      const candidateRow = row + deltaRow;
      if (candidateRow < 0 || candidateRow >= height) continue;
      for (let deltaColumn = -radius; deltaColumn <= radius; deltaColumn += 1) {
        if (Math.max(Math.abs(deltaRow), Math.abs(deltaColumn)) !== radius) continue;
        const candidateColumn = (column + deltaColumn + width) % width;
        const candidateIndex = candidateRow * width + candidateColumn;
        if (candidateIndex === excludeIndex || !isFiniteNumber(values[candidateIndex])) continue;
        const wrappedColumnDistance = Math.min(
          Math.abs(candidateColumn - column),
          width - Math.abs(candidateColumn - column),
        );
        const distanceCells = Math.hypot(deltaRow, wrappedColumnDistance * longitudeScale);
        candidates.push({
          value: values[candidateIndex],
          distanceCells: Math.max(distanceCells, 0.001),
        });
      }
    }
  }

  const donors = candidates
    .sort((first, second) => first.distanceCells - second.distanceCells)
    .slice(0, neighborCount);
  if (!donors.length) return null;
  let weightedTotal = 0;
  let weightTotal = 0;
  for (const donor of donors) {
    const weight = 1 / donor.distanceCells ** power;
    weightedTotal += donor.value * weight;
    weightTotal += weight;
  }
  return {
    value: weightedTotal / weightTotal,
    donorCount: donors.length,
    nearestDistanceCells: donors[0].distanceCells,
    meanDistanceCells:
      donors.reduce((sum, donor) => sum + donor.distanceCells, 0) / donors.length,
  };
};

const crossValidateSpatialModel = (values, width, height, options) => {
  const observedIndices = values
    .map((value, index) => (isFiniteNumber(value) ? index : -1))
    .filter((index) => index >= 0);
  const validationCount = Math.min(128, observedIndices.length);
  if (!validationCount) return { sampleSize: 0, rmsePpm: null, maePpm: null };
  const squaredErrors = [];
  const absoluteErrors = [];
  for (let sample = 0; sample < validationCount; sample += 1) {
    const sourceIndex = observedIndices[
      Math.floor((sample / validationCount) * observedIndices.length)
    ];
    const prediction = spatialPrediction(values, width, height, sourceIndex, {
      ...options,
      excludeIndex: sourceIndex,
    });
    if (!prediction) continue;
    const error = prediction.value - values[sourceIndex];
    squaredErrors.push(error ** 2);
    absoluteErrors.push(Math.abs(error));
  }
  return {
    sampleSize: squaredErrors.length,
    rmsePpm: squaredErrors.length
      ? round(Math.sqrt(squaredErrors.reduce((sum, value) => sum + value, 0) / squaredErrors.length))
      : null,
    maePpm: absoluteErrors.length
      ? round(absoluteErrors.reduce((sum, value) => sum + value, 0) / absoluteErrors.length)
      : null,
  };
};

const imputeSpatialFrame = (frame, width, height) => {
  const previousImputed = new Set(frame.imputedIndices || []);
  const sourceValues = (frame.values || []).map((value, index) =>
    previousImputed.has(index) ? null : value,
  );
  const options = { neighborCount: 8, power: 2 };
  const validation = crossValidateSpatialModel(sourceValues, width, height, options);
  const values = [...sourceValues];
  const imputedIndices = [];
  const donorDistances = [];

  for (let index = 0; index < values.length; index += 1) {
    if (isFiniteNumber(values[index])) continue;
    const prediction = spatialPrediction(sourceValues, width, height, index, options);
    if (!prediction) continue;
    values[index] = round(prediction.value, 1);
    imputedIndices.push(index);
    donorDistances.push(prediction.meanDistanceCells * (180 / height));
  }

  const finiteValues = values.filter(isFiniteNumber);
  const observedCells = sourceValues.filter(isFiniteNumber).length;
  return {
    ...frame,
    sourceAvailableCells: frame.sourceAvailableCells ?? observedCells,
    observedCells,
    imputedCells: imputedIndices.length,
    availableCells: finiteValues.length,
    sourceMinimumPpm: frame.sourceMinimumPpm ?? frame.minimumPpm,
    sourceMaximumPpm: frame.sourceMaximumPpm ?? frame.maximumPpm,
    minimumPpm: finiteValues.length ? Math.min(...finiteValues) : null,
    maximumPpm: finiteValues.length ? Math.max(...finiteValues) : null,
    values,
    imputedIndices,
    imputation: {
      method: "K_NEAREST_IDW",
      formula: "x_hat(s) = sum(d_i^-2 * x_i) / sum(d_i^-2)",
      neighborCount: options.neighborCount,
      distancePower: options.power,
      longitudeWrap: true,
      meanDonorDistanceDegrees: round(
        donorDistances.reduce((sum, value) => sum + value, 0) / Math.max(1, donorDistances.length),
        2,
      ),
      validation: {
        method: "deterministic spatial holdout",
        ...validation,
      },
      uncertaintyNote:
        "RMSE/MAE are holdout errors for the display-grid interpolation, not measurement uncertainty or a formal confidence interval.",
    },
  };
};

const fitLinearTrend = (rows, trainingCount = 120) => {
  const training = rows
    .filter((row) => isFiniteNumber(row.deseasonalizedPpm))
    .sort((first, second) => decimalYear(first) - decimalYear(second))
    .slice(-trainingCount);
  if (training.length < 3) return null;
  const xs = training.map(decimalYear);
  const ys = training.map((row) => row.deseasonalizedPpm);
  const n = training.length;
  const meanX = xs.reduce((sum, value) => sum + value, 0) / n;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / n;
  const sxx = xs.reduce((sum, value) => sum + (value - meanX) ** 2, 0);
  const sxy = xs.reduce((sum, value, index) => sum + (value - meanX) * (ys[index] - meanY), 0);
  const slope = sxy / sxx;
  const residuals = ys.map((value, index) => value - (meanY + slope * (xs[index] - meanX)));
  const sse = residuals.reduce((sum, value) => sum + value ** 2, 0);
  const sst = ys.reduce((sum, value) => sum + (value - meanY) ** 2, 0);
  const residualStandardError = Math.sqrt(sse / Math.max(1, n - 2));
  const rSquared = sst > 0 ? 1 - sse / sst : 1;
  const tCritical95 = 1.98;
  const predict = (year) => {
    const estimate = meanY + slope * (year - meanX);
    const standardError = residualStandardError * Math.sqrt(
      1 + 1 / n + ((year - meanX) ** 2) / sxx,
    );
    const halfWidth = tCritical95 * standardError;
    return {
      year,
      predictedPpm: round(estimate),
      lower95Ppm: round(estimate - halfWidth),
      upper95Ppm: round(estimate + halfWidth),
      predictionHalfWidth95Ppm: round(halfWidth),
      type: "SCENARIO_OLS_PROJECTION",
    };
  };
  return {
    method: "ordinary least squares linear trend",
    equation: "y_hat(t) = y_bar + beta_1 * (t - t_bar)",
    response: "NOAA Mauna Loa monthly deseasonalized CO2",
    trainingMonths: n,
    trainingPeriod: `${training[0].year}-${String(training[0].month).padStart(2, "0")}–${training.at(-1).year}-${String(training.at(-1).month).padStart(2, "0")}`,
    referenceYear: round(meanX, 6),
    levelAtReferencePpm: round(meanY, 6),
    slopePpmYear: round(slope, 6),
    sxx: round(sxx, 6),
    residualStandardErrorPpm: round(residualStandardError, 6),
    rSquared: round(rSquared, 6),
    tCritical95,
    intervalType: "95% prediction interval for a future monthly observation under the unchanged linear model",
    predict,
  };
};

const haversineKm = (first, second) => {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const deltaLat = radians(second.lat - first.lat);
  const deltaLon = radians(second.lon - first.lon);
  const a = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radians(first.lat)) * Math.cos(radians(second.lat)) * Math.sin(deltaLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const imputeWasteCountries = (observedRows, referenceSites, neighborCount = 5) => {
  const observed = observedRows
    .filter((row) => row.valueStatus !== "IMPUTED" && isFiniteNumber(row.recyclePercent))
    .map((row) => ({ ...row, valueStatus: "SOURCE" }));
  const observedIso3 = new Set(observed.map((row) => row.iso3));
  const imputed = referenceSites
    .filter((site) => !observedIso3.has(site.iso3))
    .map((site) => {
      const donors = observed
        .map((row) => ({ row, distanceKm: haversineKm(site, row) }))
        .sort((first, second) => first.distanceKm - second.distanceKm)
        .slice(0, neighborCount);
      const estimate = median(donors.map((donor) => donor.row.recyclePercent));
      const absoluteDeviations = donors.map((donor) => Math.abs(donor.row.recyclePercent - estimate));
      return {
        ...site,
        country: site.name,
        year: null,
        recyclePercent: round(estimate, 2),
        valueStatus: "IMPUTED",
        imputationMethod: "GEOGRAPHIC_KNN_MEDIAN",
        neighborCount: donors.length,
        donorIso3: donors.map((donor) => donor.row.iso3),
        maximumDonorDistanceKm: round(Math.max(...donors.map((donor) => donor.distanceKm)), 1),
        donorMedianAbsoluteDeviationPp: round(median(absoluteDeviations), 2),
        caveat: "Official value unavailable in the snapshot; not suitable for country ranking or policy evaluation.",
      };
    })
    .filter((row) => isFiniteNumber(row.recyclePercent));
  return { observed, imputed, combined: referenceSites.map((site) =>
    observed.find((row) => row.iso3 === site.iso3) || imputed.find((row) => row.iso3 === site.iso3),
  ).filter(Boolean) };
};

const upsertDataset = (mode, dataset) => {
  const index = mode.datasets.findIndex((candidate) => candidate.id === dataset.id);
  if (index >= 0) mode.datasets[index] = dataset;
  else mode.datasets.push(dataset);
};

export const enrichSnapshotWithStatistics = (snapshot) => {
  const breathing = snapshot.modes.find((mode) => mode.id === "breathing-earth");
  if (breathing?.signals?.gosat?.frames?.length) {
    const grid = breathing.signals.gosat;
    grid.frames = grid.frames.map((frame) => imputeSpatialFrame(frame, grid.width, grid.height));
    const regression = fitLinearTrend(breathing.signals.co2 || [], 120);
    if (regression) {
      const forecastYears = [2026, 2030, 2035, 2040, 2045, 2050];
      const forecastRows = forecastYears.map(regression.predict);
      const { predict, ...serializableModel } = regression;
      breathing.signals.co2ForecastModel = serializableModel;
      breathing.datasets = breathing.datasets.filter(
        (dataset) => dataset.id !== "co2-future-trend-scenario",
      );
      upsertDataset(breathing, {
        id: "co2-ols-trend-projection",
        kind: "SCENARIO",
        organisation: "GAIA SENSEWARE / statistics layer",
        title: "NOAA直近120か月によるCO₂最小二乗トレンド投影",
        url: "./scripts/statistics.mjs",
        retrievedAt: snapshot.generatedAt,
        period: "2026–2050",
        unit: "ppm / 95% prediction interval",
        resolution: "年次表示・回帰学習は月次120標本",
        transformation: `直近120か月を一本の傾向線にまとめました。年あたりの増加は${serializableModel.slopePpmYear} ppm、当てはまりの指標R²は${serializableModel.rSquared}です。予想には幅も添えます。`,
        caveat: "時間の流れだけを使った単純な計算です。政策や排出量の変化は含まないため、気候モデルによる未来予測ではありません。",
        preview: forecastRows.slice(0, 10),
      });
    }
    const auditRows = grid.frames.map((frame) => ({
      date: frame.date,
      observedCells: frame.observedCells,
      imputedCells: frame.imputedCells,
      totalCells: frame.values.length,
      method: frame.imputation.method,
      k: frame.imputation.neighborCount,
      power: frame.imputation.distancePower,
      holdoutRmsePpm: frame.imputation.validation.rmsePpm,
      holdoutMaePpm: frame.imputation.validation.maePpm,
    }));
    upsertDataset(breathing, {
      id: "gosat-spatial-imputation",
      kind: "DERIVED",
      organisation: "GAIA SENSEWARE / statistics layer",
      title: "GOSAT欠測セルの空間k近傍IDW補完",
      url: "./scripts/statistics.mjs",
      retrievedAt: snapshot.generatedAt,
      period: `${grid.frames[0].date}–${grid.frames.at(-1).date}`,
      unit: "approx. ppm XCO₂",
      resolution: `${grid.resolutionDegrees}°格子 / k=8 / 距離指数p=2`,
      transformation: "測れなかったマスは、地球上で近い8地点から補いました。近い地点ほど強く、遠い地点ほど弱く参考にします。",
      caveat: "周囲がなめらかに変化すると仮定した展示用の推定です。衛星の観測値ではないため、斜線とDERIVED表示で区別します。",
      preview: auditRows.slice(0, 10),
    });
    const decodedDataset = breathing.datasets.find(
      (dataset) => dataset.id === "gosat-gallery-decoded",
    );
    if (decodedDataset) {
      decodedDataset.transformation =
        "地図の各マスの色をCO₂濃度へ変換しました。色を読めないマスは、近くの8地点から補い、斜線で区別します。";
      decodedDataset.caveat =
        "元の数値ファイルではなく、公式の閲覧画像から読み取った近似値です。観測から読めたマスと、計算で補ったマスの数を分けて保存しています。";
    }
    const noaaDataset = breathing.datasets.find((dataset) => dataset.id === "noaa-co2");
    if (noaaDataset) {
      noaaDataset.transformation =
        "季節ごとの上下を球体の呼吸に、長期の増加を光の強さに使います。直近120か月は、未来の仮定をつくる計算にも使います。";
    }
    breathing.statisticalMethods = [
      {
        id: "SPATIAL_IDW",
        plainTitle: "値がないマスを、近くの8地点から計算する",
        plainExplanation: "人工衛星の値がないマスは、近くにある8地点を使って計算しました。距離が近い地点の値ほど、強く反映しています。",
        plainLimit: "斜線の場所は、実際に測った値ではありません。周囲から計算した値です。",
        target: "GOSAT 2.5° XCO₂欠測セル",
        formula: "x_hat(s) = Σ[d_i^-2 x_i] / Σ[d_i^-2]",
        rule: "近い8地点を使います。日付変更線の左右も隣り合う場所として扱い、観測値は書き換えません。",
        validation: "測れているマスを一部隠して計算し、元の値との差をRMSEとMAEという誤差で確かめました。",
        display: "補ったマスは薄い色と斜線にし、タップするとIMPUTEDと誤差を表示します。",
      },
      {
        id: "TEMPORAL_LINEAR",
        plainTitle: "記録がある二つの月を、直線でつなぐ",
        plainExplanation: "記録がある月と次の月のあいだは、二つの数字を直線で結び、途中の値を計算しました。",
        plainLimit: "途中の変化を実際に観測したわけではありません。急な変化は表せない方法です。",
        target: "収録したGOSAT時点の間",
        formula: "x_hat(t) = (1-a)x_t0 + a x_t1",
        rule: "観測された前後二つの時点がある区間だけを、直線でつなぎます。観測期間の外へは延ばしません。",
        validation: "途中を実際に測った値ではないため、画面ではDERIVEDと表示します。",
        display: "大きな年月表示とデータ変換欄で、計算中の区間を示します。",
      },
      {
        id: "OLS_TREND_PROJECTION",
        plainTitle: "最近10年と同じ増え方が続いた場合を計算する",
        plainExplanation: "直近10年分のCO₂を一本の傾向線にまとめ、その線を2050年まで伸ばしました。未来の数字には、ぶれの幅も添えています。",
        plainLimit: "これは未来を言い当てる予言ではありません。今までと同じ増え方が続いた場合の『もしも』です。",
        target: "2026–2050 CO₂トレンド投影",
        formula: "y_hat(t) = y_bar + beta_1(t - t_bar)",
        rule: "NOAAの季節変化を除いた月平均から、直近120か月の増え方を一本の直線にします。",
        validation: "線の当てはまりと誤差を計算し、中心の値だけでなく95%の予想幅も表示します。",
        display: "SCENARIOとして表示し、政策などを含む気候モデルの予測とは呼びません。",
      },
    ];
  }

  const wasteMode = snapshot.modes.find((mode) => mode.id === "nothing-is-waste");
  const energyMode = snapshot.modes.find((mode) => mode.id === "earth-organ");
  if (wasteMode?.signals?.countryWaste && energyMode?.signals?.potential && !wasteMode.signals.countryCoverage?.sourceOnly) {
    const waste = imputeWasteCountries(wasteMode.signals.countryWaste, energyMode.signals.potential, 5);
    wasteMode.signals.countryWaste = waste.combined;
    upsertDataset(wasteMode, {
      id: "waste-geographic-knn-median",
      kind: "DERIVED",
      organisation: "GAIA SENSEWARE / statistics layer",
      title: "UN SDG欠測国の地理的5近傍中央値補完",
      url: "./scripts/statistics.mjs",
      retrievedAt: snapshot.generatedAt,
      period: "同梱スナップショット時点",
      unit: "% municipal waste recycled",
      resolution: `${waste.imputed.length} imputed / ${waste.observed.length} observed countries`,
      transformation: "公式値がない国は、地理的に近く公式値がある5か国を探し、その中央の値を置きました。極端に大きい値や小さい値へ引っぱられにくい方法です。",
      caveat: "近い国でも制度や暮らしは違います。公式値ではないため破線で示し、国の順位や政策評価には使いません。",
      preview: waste.imputed.slice(0, 10),
    });
    wasteMode.statisticalMethods = [
      {
        id: "GEOGRAPHIC_KNN_MEDIAN",
        plainTitle: "公式値がない地域を、近い5か国から計算する",
        plainExplanation: "公式データがない地域は、地理的に近い5か国の数字を並べ、中央の値を仮に置きました。",
        plainLimit: "近い国でも制度や暮らしは違います。破線の円は公式値ではなく、比較のための仮の値です。",
        target: "UN SDG 12.5.1の未収録14地域",
        formula: "x_hat(c) = median(x of 5 geographically nearest observed countries)",
        rule: "公式値を持つ国だけをドナーにし、観測値は上書きしない。",
        validation: "地理的近さだけでは制度差を説明できないため、推定値を政策比較に使わない。",
        display: "SOURCEは実線、IMPUTEDは破線。POIにドナー国とMADを表示。",
      },
    ];
  }

  for (const mode of snapshot.modes) {
    mode.statisticalMethods ||= [];
  }
  snapshot.statisticalPolicy = {
    principle: "Observed values are never overwritten. Every filled or projected value carries a DERIVED or SCENARIO label.",
    numericMissingness: "Interpolate only when the variable is numeric and a defensible neighborhood or time model exists.",
    structuralMissingness: "Do not fill periods before station opening, after station closure, absent categorical metadata, or unobserved biological relationships.",
    uncertainty: "Show holdout error or prediction interval where the model permits; neither is measurement uncertainty.",
  };
  snapshot.statisticsAppliedAt = new Date().toISOString();
  return snapshot;
};
