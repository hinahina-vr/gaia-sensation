export function extractGbifRights(record) {
  const text = value => typeof value === "string" && value.trim() ? value.trim() : null;
  return {
    license: text(record.license),
    datasetKey: text(record.datasetKey),
    publishingOrgKey: text(record.publishingOrgKey),
    rightsHolder: text(record.rightsHolder),
    occurrenceUrl: Number.isSafeInteger(record.key) ? `https://www.gbif.org/occurrence/${record.key}` : null,
    datasetUrl: text(record.datasetKey) ? `https://www.gbif.org/dataset/${record.datasetKey}` : null,
  };
}

export function gbifRightsComplete(record) {
  return /^https?:\/\/creativecommons\.org\/(?:licenses\/(?:by|by-nc)\/4\.0|publicdomain\/zero\/1\.0)(?:\/|$)/.test(record.license || "")
    && /^[a-f0-9-]{36}$/.test(record.datasetKey || "")
    && /^[a-f0-9-]{36}$/.test(record.publishingOrgKey || "")
    && Boolean(record.occurrenceUrl && record.datasetUrl);
}
