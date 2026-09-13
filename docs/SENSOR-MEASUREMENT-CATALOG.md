# GAIA SENSEWARE 計測項目マスター

正本は `sensor-platform/src/measurements.ts`、公開APIは `GET /api/public/v1/measurement-types` です。画面の日本語名・単位・小数桁、Workerの受理範囲、ESP32スターターのキーはこのマスターへ揃えます。

## 設計ルール

- telemetryの `data` は1〜16項目。値は有限のJSON numberです。
- キーはマスターに登録済みのものだけを受理します。
- 既存互換キー `temperature` / `humidity` / `pm25` は維持します。
- 機器登録時に選んだ `measurementKeys` は能力の申告です。実際に受理した標準キーもDeviceへ自動追加します。
- 単位変換は送信側で行い、APIへはマスター記載単位で送ります。
- GPS、住所、SSID、Device Tokenは計測値へ含めません。

## 対象分野

1. 大気・空気質：気温、湿度、気圧、PM、CO₂、VOC、NOx、各種ガス
2. 気象・光・音：雨量、風速・風向、照度、UV、日射、騒音、雷距離
3. 水・水質：水温、pH、EC、TDS、濁度、DO、ORP、塩分、水位、流量、水圧、硝酸・アンモニウム
4. 土壌・植物：地温、土壌水分、土壌EC、土壌pH、葉面濡れ
5. 動き・距離・磁気：加速度、角速度、磁束密度、距離、振動、在室、パルス数
6. 電気・装置状態：電圧、電流、電力、積算電力量、電池、Wi-Fi RSSI
7. 放射線・電磁環境：線量率、電界、電波ノイズ

## 水質送信例

```json
{
  "seq": 42,
  "observedAt": "2026-09-01T03:00:00Z",
  "data": {
    "water_temperature": 18.4,
    "ph": 7.18,
    "conductivity": 312,
    "turbidity": 2.7,
    "dissolved_oxygen": 8.31,
    "water_level": 64.2
  }
}
```

## 接続と安全

I2C / SPI / UART / 1-Wire / 3.3V GPIOのモジュールはESP32へ比較的接続しやすい構成です。5V出力、アナログ電極、RS-485、長い屋外配線、商用電源、高電圧回路にはレベル変換・信号調整・絶縁・サージ対策が必要です。pH・EC・ORP・DO・濁度などは校正、温度補償、洗浄、防水も必要です。掲載製品名は候補例であり、動作・精度・安全性の保証ではありません。

GAIA SENSEWAREは展示・教育・試作用途です。生命、安全、医療、防災、法定監視、設備の自動制御には使用しません。
