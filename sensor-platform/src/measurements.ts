import { json } from "./http";

export type MeasurementCategory = {
  id: string;
  labelJa: string;
  labelEn: string;
  descriptionJa: string;
};

export type MeasurementDefinition = {
  key: string;
  category: string;
  labelJa: string;
  labelEn: string;
  unit: string;
  digits: number;
  minimum: number;
  maximum: number;
  interfaces: readonly string[];
  exampleSensors: readonly string[];
  noteJa?: string;
};

export const MEASUREMENT_CATEGORIES: readonly MeasurementCategory[] = Object.freeze([
  { id: "atmosphere", labelJa: "大気・空気質", labelEn: "AIR", descriptionJa: "気温、湿度、粒子、ガス、気圧を観測します。" },
  { id: "weather", labelJa: "気象・光・音", labelEn: "WEATHER / LIGHT / SOUND", descriptionJa: "雨、風、日射、紫外線、照度、騒音を観測します。" },
  { id: "water", labelJa: "水・水質", labelEn: "WATER", descriptionJa: "水温、pH、濁度、溶存酸素、水位、流量などを観測します。" },
  { id: "soil", labelJa: "土壌・植物", labelEn: "SOIL / PLANT", descriptionJa: "土の温湿度、EC、pH、葉面の濡れを観測します。" },
  { id: "motion", labelJa: "動き・距離・磁気", labelEn: "MOTION / POSITION", descriptionJa: "加速度、角速度、磁場、振動、距離、通過数を観測します。" },
  { id: "energy", labelJa: "電気・装置状態", labelEn: "ENERGY / DEVICE", descriptionJa: "電圧、電流、電力、電池残量、無線強度を観測します。" },
  { id: "radiation", labelJa: "放射線・電磁環境", labelEn: "RADIATION / EM", descriptionJa: "線量率、電界、電波ノイズなどを観測します。" },
]);

const measurement = (
  key: string,
  category: string,
  labelJa: string,
  labelEn: string,
  unit: string,
  digits: number,
  minimum: number,
  maximum: number,
  interfaces: readonly string[],
  exampleSensors: readonly string[],
  noteJa?: string,
): MeasurementDefinition => ({ key, category, labelJa, labelEn, unit, digits, minimum, maximum, interfaces, exampleSensors, ...(noteJa ? { noteJa } : {}) });

export const MEASUREMENT_CATALOG: readonly MeasurementDefinition[] = Object.freeze([
  measurement("temperature", "atmosphere", "気温", "Air temperature", "°C", 1, -80, 100, ["I2C", "1-Wire", "UART"], ["BME280", "SHT31/SHT4x", "DS18B20"]),
  measurement("humidity", "atmosphere", "相対湿度", "Relative humidity", "%RH", 1, 0, 100, ["I2C", "UART"], ["BME280", "SHT31/SHT4x", "AHT20"]),
  measurement("pressure", "atmosphere", "気圧", "Atmospheric pressure", "hPa", 1, 300, 1200, ["I2C", "SPI"], ["BMP280", "BME280", "BMP390"]),
  measurement("pm1", "atmosphere", "PM1.0", "PM1.0", "µg/m³", 1, 0, 5000, ["UART", "I2C"], ["PMS5003/PMSA003", "SPS30"]),
  measurement("pm25", "atmosphere", "PM2.5", "PM2.5", "µg/m³", 1, 0, 5000, ["UART", "I2C"], ["PMS5003/PMSA003", "SPS30"]),
  measurement("pm10", "atmosphere", "PM10", "PM10", "µg/m³", 1, 0, 5000, ["UART", "I2C"], ["PMS5003/PMSA003", "SPS30"]),
  measurement("co2", "atmosphere", "CO₂濃度", "Carbon dioxide", "ppm", 0, 0, 100000, ["I2C", "UART", "PWM"], ["SCD30/SCD4x", "MH-Z19B"]),
  measurement("tvoc", "atmosphere", "総VOC", "Total VOC", "ppb", 0, 0, 100000, ["I2C"], ["SGP30/SGP40", "BME680/BME688"]),
  measurement("voc", "atmosphere", "VOC", "Volatile organic compounds", "ppb", 0, 0, 100000, ["I2C", "ADC"], ["SGP40", "BME688", "ガスセンサー＋信号調整回路"]),
  measurement("nox", "atmosphere", "NOx指標", "NOx index", "index", 1, 0, 100000, ["I2C"], ["SGP41"]),
  measurement("no2", "atmosphere", "二酸化窒素", "Nitrogen dioxide", "ppb", 1, 0, 20000, ["ADC", "UART"], ["電気化学式NO₂センサー＋AFE"]),
  measurement("co", "atmosphere", "一酸化炭素", "Carbon monoxide", "ppm", 2, 0, 10000, ["ADC", "UART"], ["電気化学式COセンサー＋AFE"]),
  measurement("o3", "atmosphere", "オゾン", "Ozone", "ppb", 1, 0, 20000, ["ADC", "UART"], ["電気化学式O₃センサー＋AFE"]),
  measurement("so2", "atmosphere", "二酸化硫黄", "Sulfur dioxide", "ppb", 1, 0, 20000, ["ADC", "UART"], ["電気化学式SO₂センサー＋AFE"]),
  measurement("nh3", "atmosphere", "アンモニア", "Ammonia", "ppm", 2, 0, 10000, ["ADC", "UART"], ["電気化学式NH₃センサー＋AFE"]),
  measurement("h2s", "atmosphere", "硫化水素", "Hydrogen sulfide", "ppm", 2, 0, 10000, ["ADC", "UART"], ["電気化学式H₂Sセンサー＋AFE"]),
  measurement("formaldehyde", "atmosphere", "ホルムアルデヒド", "Formaldehyde", "mg/m³", 3, 0, 100, ["UART", "ADC"], ["HCHOセンサーモジュール"]),

  measurement("rainfall", "weather", "積算雨量", "Accumulated rainfall", "mm", 1, 0, 100000, ["Pulse", "GPIO"], ["転倒ます型雨量計"]),
  measurement("rainfall_rate", "weather", "降雨強度", "Rainfall rate", "mm/h", 1, 0, 2000, ["Pulse", "GPIO"], ["転倒ます型雨量計"]),
  measurement("wind_speed", "weather", "風速", "Wind speed", "m/s", 1, 0, 150, ["Pulse", "ADC", "RS-485"], ["カップ式風速計", "超音波風速計"]),
  measurement("wind_direction", "weather", "風向", "Wind direction", "°", 0, 0, 360, ["ADC", "I2C", "RS-485"], ["風向ベーン", "超音波風向風速計"]),
  measurement("illuminance", "weather", "照度", "Illuminance", "lx", 0, 0, 1000000, ["I2C", "ADC"], ["BH1750", "VEML7700", "TSL2591"]),
  measurement("uv_index", "weather", "UV指数", "UV index", "index", 1, 0, 30, ["I2C", "ADC"], ["VEML6075", "LTR390"]),
  measurement("solar_irradiance", "weather", "日射量", "Solar irradiance", "W/m²", 1, 0, 2500, ["ADC", "RS-485"], ["日射計＋信号変換器"]),
  measurement("noise_db", "weather", "騒音レベル", "Sound pressure level", "dB", 1, 0, 180, ["I2S", "ADC"], ["I2S MEMSマイク", "騒音計モジュール"], "校正しない値は法定騒音測定には使用できません。"),
  measurement("lightning_distance", "weather", "雷推定距離", "Lightning distance", "km", 0, 0, 1000, ["SPI", "I2C"], ["AS3935"]),

  measurement("water_temperature", "water", "水温", "Water temperature", "°C", 1, -20, 120, ["1-Wire", "I2C", "RS-485"], ["防水DS18B20", "PT100/PT1000＋変換器"]),
  measurement("ph", "water", "pH", "pH", "pH", 2, 0, 14, ["ADC", "I2C", "UART", "RS-485"], ["pH電極＋絶縁対応インターフェース"]),
  measurement("conductivity", "water", "電気伝導率", "Electrical conductivity", "µS/cm", 0, 0, 200000, ["I2C", "UART", "RS-485", "ADC"], ["ECプローブ＋インターフェース"]),
  measurement("tds", "water", "溶解性物質濃度", "Total dissolved solids", "ppm", 0, 0, 100000, ["ADC", "UART", "RS-485"], ["TDSプローブ＋インターフェース"]),
  measurement("turbidity", "water", "濁度", "Turbidity", "NTU", 1, 0, 10000, ["ADC", "UART", "RS-485"], ["光学式濁度センサー"]),
  measurement("dissolved_oxygen", "water", "溶存酸素", "Dissolved oxygen", "mg/L", 2, 0, 100, ["I2C", "UART", "RS-485", "ADC"], ["DOプローブ＋インターフェース"]),
  measurement("orp", "water", "酸化還元電位", "Oxidation-reduction potential", "mV", 0, -2000, 2000, ["ADC", "I2C", "UART"], ["ORP電極＋高インピーダンスAFE"]),
  measurement("salinity", "water", "塩分", "Salinity", "PSU", 2, 0, 100, ["UART", "RS-485", "I2C"], ["塩分・ECプローブ"]),
  measurement("water_level", "water", "水位", "Water level", "cm", 1, -10000, 100000, ["ADC", "I2C", "UART", "RS-485"], ["圧力式水位計", "超音波距離計", "フロート"]),
  measurement("groundwater_level", "water", "地下水位", "Groundwater level", "m", 2, -10000, 10000, ["ADC", "RS-485"], ["投込式水位計"]),
  measurement("flow_rate", "water", "流量", "Flow rate", "L/min", 2, 0, 100000, ["Pulse", "UART", "RS-485"], ["ホール式流量センサー", "電磁流量計"]),
  measurement("water_pressure", "water", "水圧", "Water pressure", "kPa", 1, -100, 100000, ["ADC", "I2C", "RS-485"], ["圧力トランスデューサー"]),
  measurement("nitrate", "water", "硝酸態窒素", "Nitrate", "mg/L", 2, 0, 10000, ["UART", "RS-485", "I2C"], ["イオン選択電極＋計測回路"]),
  measurement("ammonium", "water", "アンモニウム", "Ammonium", "mg/L", 2, 0, 10000, ["UART", "RS-485", "I2C"], ["イオン選択電極＋計測回路"]),

  measurement("soil_temperature", "soil", "地温", "Soil temperature", "°C", 1, -50, 100, ["1-Wire", "I2C", "RS-485"], ["防水DS18B20", "土壌温度プローブ"]),
  measurement("soil_moisture", "soil", "土壌含水率", "Soil moisture", "%", 1, 0, 100, ["ADC", "I2C", "RS-485"], ["静電容量式土壌水分センサー"]),
  measurement("soil_ec", "soil", "土壌EC", "Soil electrical conductivity", "µS/cm", 0, 0, 200000, ["RS-485", "UART", "ADC"], ["土壌ECプローブ"]),
  measurement("soil_ph", "soil", "土壌pH", "Soil pH", "pH", 2, 0, 14, ["RS-485", "UART", "ADC"], ["土壌pHプローブ"]),
  measurement("leaf_wetness", "soil", "葉面濡れ", "Leaf wetness", "%", 1, 0, 100, ["ADC", "I2C"], ["葉面濡れセンサー"]),

  measurement("acceleration_x", "motion", "X軸加速度", "X acceleration", "m/s²", 2, -1000, 1000, ["I2C", "SPI"], ["MPU6050", "LIS3DH", "ICM-20948"]),
  measurement("acceleration_y", "motion", "Y軸加速度", "Y acceleration", "m/s²", 2, -1000, 1000, ["I2C", "SPI"], ["MPU6050", "LIS3DH", "ICM-20948"]),
  measurement("acceleration_z", "motion", "Z軸加速度", "Z acceleration", "m/s²", 2, -1000, 1000, ["I2C", "SPI"], ["MPU6050", "LIS3DH", "ICM-20948"]),
  measurement("gyro_x", "motion", "X軸角速度", "X angular velocity", "°/s", 1, -20000, 20000, ["I2C", "SPI"], ["MPU6050", "ICM-20948"]),
  measurement("gyro_y", "motion", "Y軸角速度", "Y angular velocity", "°/s", 1, -20000, 20000, ["I2C", "SPI"], ["MPU6050", "ICM-20948"]),
  measurement("gyro_z", "motion", "Z軸角速度", "Z angular velocity", "°/s", 1, -20000, 20000, ["I2C", "SPI"], ["MPU6050", "ICM-20948"]),
  measurement("magnetic_x", "motion", "X軸磁束密度", "X magnetic flux density", "µT", 2, -50000, 50000, ["I2C", "SPI"], ["LIS3MDL", "MMC5603", "ICM-20948"]),
  measurement("magnetic_y", "motion", "Y軸磁束密度", "Y magnetic flux density", "µT", 2, -50000, 50000, ["I2C", "SPI"], ["LIS3MDL", "MMC5603", "ICM-20948"]),
  measurement("magnetic_z", "motion", "Z軸磁束密度", "Z magnetic flux density", "µT", 2, -50000, 50000, ["I2C", "SPI"], ["LIS3MDL", "MMC5603", "ICM-20948"]),
  measurement("geomagnetic", "motion", "地磁気変動", "Geomagnetic variation", "µT", 2, -50000, 50000, ["I2C", "SPI"], ["LIS3MDL", "MMC5603"]),
  measurement("distance", "motion", "距離", "Distance", "cm", 1, 0, 1000000, ["GPIO", "I2C", "UART"], ["HC-SR04（3.3Vレベル変換必須）", "VL53L0X/VL53L1X"]),
  measurement("vibration_rms", "motion", "振動RMS", "Vibration RMS", "m/s²", 3, 0, 1000, ["I2C", "SPI", "ADC"], ["加速度センサー"]),
  measurement("occupancy", "motion", "在室・検知状態", "Occupancy", "0/1", 0, 0, 1, ["GPIO", "UART"], ["PIR", "mmWaveレーダー"]),
  measurement("pulse_count", "motion", "パルス数", "Pulse count", "count", 0, 0, 1000000000, ["Pulse", "GPIO"], ["接点入力", "回転・通過カウンター"]),

  measurement("voltage", "energy", "電圧", "Voltage", "V", 3, -100000, 100000, ["I2C", "ADC", "UART", "RS-485"], ["INA219/INA226", "絶縁計測モジュール"]),
  measurement("current", "energy", "電流", "Current", "A", 3, -100000, 100000, ["I2C", "ADC", "UART", "RS-485"], ["INA219/INA226", "ホール電流センサー"]),
  measurement("power", "energy", "電力", "Power", "W", 2, -1000000, 1000000, ["I2C", "UART", "RS-485"], ["INA219/INA226", "電力計モジュール"]),
  measurement("energy", "energy", "積算電力量", "Energy", "Wh", 1, 0, 1000000000000, ["UART", "RS-485"], ["電力量計モジュール"], "商用電源の計測は感電・火災防止のため有資格者と絶縁済み製品を使用してください。"),
  measurement("battery_voltage", "energy", "電池電圧", "Battery voltage", "V", 3, 0, 1000, ["ADC", "I2C"], ["分圧回路", "燃料計IC"]),
  measurement("battery_percent", "energy", "電池残量", "Battery charge", "%", 0, 0, 100, ["I2C", "ADC"], ["MAX17048/MAX1704x", "燃料計IC"]),
  measurement("rssi", "energy", "Wi-Fi受信強度", "Wi-Fi RSSI", "dBm", 0, -127, 0, ["ESP32 internal"], ["WiFi.RSSI()"]),

  measurement("radiation_dose_rate", "radiation", "放射線量率", "Radiation dose rate", "µSv/h", 3, 0, 1000000, ["Pulse", "UART"], ["ガイガー計数管＋高電圧モジュール"], "高電圧回路と校正が必要です。安全監視・線量管理には使用できません。"),
  measurement("electric_field", "radiation", "電界強度", "Electric field strength", "kV/m", 3, -1000000, 1000000, ["ADC", "UART", "RS-485"], ["電界センサー＋絶縁インターフェース"]),
  measurement("radio_noise", "radiation", "電波ノイズ", "Radio noise", "dBm", 1, -200, 100, ["SPI", "UART", "I2C"], ["RF検波器", "受信モジュール"]),
]);

const measurementCatalogByKey: ReadonlyMap<string, MeasurementDefinition> = new Map(
  MEASUREMENT_CATALOG.map((definition) => [definition.key, definition]),
);

export const getMeasurementDefinition = (key: string): MeasurementDefinition | null => measurementCatalogByKey.get(key) ?? null;

export const listMeasurementTypes = (): Response => json({
  version: 1,
  maximumMeasurementsPerPacket: 16,
  categories: MEASUREMENT_CATEGORIES,
  measurements: MEASUREMENT_CATALOG,
  disclaimerJa: "掲載モジュールは接続例です。ESP32-WROOM-32との個別動作、精度、防水、電圧、絶縁、校正を保証するものではありません。ADC・5V・RS-485・商用電源・薬液プローブは適切な変換・絶縁回路が必要です。",
});
