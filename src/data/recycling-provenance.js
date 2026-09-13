// SOURCE means a published value, not necessarily a directly measured value.
export const RECYCLING_COMPARABILITY = "国連は再資源化率、世界銀行は再資源化向け回収率です。資料側の推計を含み、報告年・対象ごみ・分母が異なります。世界平均や厳密な国別順位としては読めません。";
export const recyclingSourceId = row => row?.datasetId || "un-sdg";
export const recyclingSourceLabel = row => recyclingSourceId(row) === "worldbank-waw3-recycling" ? "世界銀行公表値" : "国連公表値";
export const recyclingDefinition = row => row?.sourceDefinition || "都市ごみの再資源化率（SDG 12.5.1）";
export const recyclingScope = row => row?.sourceScope || "国連側の推計を含む。報告年・制度・廃棄物定義は国で異なる。";
export const recyclingYearNote = row => row?.yearMeaning || "国連SDGデータの報告年。";
export const recyclingDetails = row => `${recyclingSourceLabel(row)} / ${recyclingDefinition(row)} / ${recyclingScope(row)} ${recyclingYearNote(row)}`;
