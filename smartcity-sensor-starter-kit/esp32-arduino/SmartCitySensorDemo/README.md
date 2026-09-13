# SmartCitySensorDemo

実機確認済みの対象は **ESP32-WROOM-32 / ESP32-D0WD-V3 revision 3.1 / 4MB flash / CH340** です。ESP32-S2 / S3 / C3 / C6、WROVER、4MB以外のflashは未検証です。

書き込み前にchip、revision、flash容量、Secure Boot、flash encryptionを確認し、現在のflash全体をバックアップしてください。4MB機ならバックアップが4,194,304 bytesであることとSHA-256を確認し、復元コマンドと一緒に保管します。保護機能や構成の不一致がある場合は消去・書き込みを止めてください。

1. `config.example.h` を `config.h` へコピーします。
2. `root_ca.example.h` を `root_ca.h` へコピーし、production API domainのchainに合うRoot CAか必ず照合します。
3. ArduinoJson 7.xを導入し、対応を確認したESP32へ書き込みます。
4. 通常は115200 baudのUSB Serialへ1行JSONでWi-FiとPairing Codeを渡します。`CITY-SENSOR-XXXX` と `http://192.168.4.1/` はUSB設定が使えない場合の代替です。

USB設定コマンド（秘密を含むため履歴・ログへ保存しないこと）:

```json
{"command":"GAIA_USB_PROVISION","ssid":"...","password":"...","pairingCode":"ABCD-EFGH"}
```

周辺Wi-Fi一覧をUSBへ返す診断コマンド:

```json
{"command":"GAIA_USB_SCAN"}
```

Wi-Fi、Device ID、Device Token、seqはPreferences/NVSへ保存されます。Pairing成功後、Pairing CodeはNVSから消去して再利用しません。Token・Wi-Fi password・Pairing CodeはSerialへ表示しません。`setInsecure()`は禁止です。

## 復旧と電源断耐性

- Wi-Fiへ3回接続できない場合、または初回Wi-Fi/Pairingに失敗した場合は、自動的に `CITY-SENSOR-XXXX` Setup APへ戻ります。新しいWi-FiとPairing Codeを同じ画面で上書きしてください。
- Pairing済みDeviceのWi-Fiだけを変更する場合、Setup画面のPairing Codeは空欄で構いません。
- いつでもBOOTボタン（標準はGPIO 0）を5秒間押し続けると、Wi-Fi・Device credential・pending telemetryをローカルNVSから消し、Setup APへ戻ります。利用boardに合わせて `REPROVISION_BUTTON_PIN` を変更してください。Web側Deviceは自動削除されないため、必要ならWeb画面でも削除します。
- telemetryは送信前に`seq`と完全なJSON本文をNVSのpending envelopeへ保存します。電源断後は同じbyte列を再送し、初回なら202、既に保存済みなら200 duplicateを受けてからseqを進めます。seq保存後・pending削除前の電源断も、再起動時に残骸を安全に消します。

## 実センサーへ差し替える

`USE_MOCK_SENSOR false` にし、`readSensors(SensorValues&)` だけを変更します。`addMeasurement(values, "標準キー", 値)` を1〜16回呼び出してください。標準キー、単位、受理範囲、接続方式、代表的モジュールは本番APIの `GET /api/public/v1/measurement-types` と `sensor-platform/src/measurements.ts` が正本です。

水質センサーの実装例（実際のライブラリ初期化・校正・温度補償は使用機器に合わせて追加）:

```cpp
bool readSensors(SensorValues& values) {
  const float waterCelsius = readWaterTemperature();
  const float waterPh = readCalibratedPh();
  const float turbidityNtu = readCalibratedTurbidity();
  return addMeasurement(values, "water_temperature", waterCelsius)
      && addMeasurement(values, "ph", waterPh)
      && addMeasurement(values, "turbidity", turbidityNtu);
}
```

大気、気象、水・水質、土壌・植物、動き、電気、放射線・電磁環境を標準化しています。I2C / SPI / UART / 1-Wire / GPIOパルスの3.3V機器は比較的接続しやすい一方、5V信号、ESP32 ADC、RS-485、pH・EC・ORP・DOプローブ、商用電源、高電圧回路にはレベル変換、信号調整、絶縁、校正、防水が必要です。掲載モジュールは候補例であり、個別の動作・精度・安全性を保証しません。
