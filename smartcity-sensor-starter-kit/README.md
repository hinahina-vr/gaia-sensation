# GAIA SENSEWARE ESP32 Sensor Starter Kit

自分のESP32 / ESP32-S3を、Cloudflare WorkerへHTTPSで直接接続する最小キットです。MQTT、mTLS、Device Certificate、GPS、スマートフォンgatewayは使いません。

## はじめる

1. GAIA SENSEWAREの「センサーで参加」を開き、Googleでログインします。
2. 「センサーを追加」で名前と国を登録します。都道府県・州、市区町村は任意です。
3. 10分間・一回限りのPairing Codeを取得します。
4. `esp32-arduino/SmartCitySensorDemo/config.example.h` を `config.h` へコピーし、HTTPS API URLを設定します。
5. production API domainのTLS chainを確認し、対応するRoot CAを `root_ca.example.h` から `root_ca.h` へコピー・照合します。
6. Arduino IDEへ `ArduinoJson` を追加し、ESP32へ書き込みます。
7. 初回起動時の `CITY-SENSOR-XXXX` Setup Wi-FiへPC/スマートフォンから接続し、`http://192.168.4.1/` でWi-FiとPairing Codeを入力します。
8. 初回だけpairingし、Wi-Fi、Device ID・Device Token・seqをPreferences/NVSへ保存します。Pairing Codeは成功時に消去します。
9. Web詳細画面でONLINE、現在値、履歴を確認します。

`readSensors()` はmock実装です。`USE_MOCK_SENSOR false` にし、関数本体を実センサーの読み取りへ置き換えられます。

## 位置情報と秘密情報

- GPS、緯度経度、住所は不要です。
- ESP32は国・地域・Google Userを毎回送信しません。Device IDからサーバー側で解決します。
- Device Token、Pairing Code、Wi-Fi passwordをGitHubやSerial Logへ出さないでください。
- HTTPは禁止です。`setInsecure()` も使用しません。
- Root CAはAPI domainの証明書chainが変わる可能性があるため、deploymentごとに運用者が確認・更新してください。
- Wi-Fi/Pairing失敗時はSetup APへ自動復帰します。通常運転中もBOOTボタン5秒長押しでローカルcredentialを消去し、再provisionできます。
- 送信中の電源断に備え、seqとcanonical JSON本文は送信前にNVSへ保存されます。再起動後は同一本文を再送して202/200 duplicateのどちらからも復帰します。

## API contract

- 公開APIは `POST /api/v1/device/pair` と `POST /api/v1/devices/{deviceId}/telemetry` だけです。
- 詳細は [openapi.yaml](./openapi.yaml)、ESP32なしの確認は [curl-examples.sh](./curl-examples.sh) を参照してください。
- telemetry `seq` は単調増加。同一seq・同一内容は冪等再送、同一seq・異内容と後退seqは拒否されます。
- 新規telemetryの保存はDeviceごとに60秒に1件までです。超過時は最大60秒の `Retry-After` を付けた429を返します。

## Arduino dependencies

- Arduino-ESP32 core
- ArduinoJson 7.x
- core同梱: WiFi, WiFiClientSecure, HTTPClient, Preferences, WebServer, DNSServer

Root CA exampleはGoogle Trust Servicesの公式repositoryで公開されるGTS Root R4です。これは配布例であり、未作成の本番Worker domainに合うと架空に断定しません。外部resource作成後に `openssl s_client -showcerts -connect <domain>:443 -servername <domain>` 等でchainを確認してください。
