#!/usr/bin/env bash
set -eu

# Requires jq. Pairing code and the one-time token stay in a mode-700
# temporary directory and are removed when this script exits.
API_BASE_URL="${API_BASE_URL:-https://gaia-senseware.pages.dev/api/v1}"
command -v jq >/dev/null 2>&1 || { printf '%s\n' 'jq is required.' >&2; exit 1; }
if [[ -z "${PAIRING_CODE:-}" ]]; then
  read -r -s -p "One-time pairing code: " PAIRING_CODE
  printf '\n' >&2
fi
[[ "${PAIRING_CODE}" =~ ^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$ ]] || {
  printf '%s\n' 'Pairing code format is invalid.' >&2
  exit 1
}

umask 077
SENSOR_TMP_DIR="$(mktemp -d)"
chmod 700 "${SENSOR_TMP_DIR}"
trap 'rm -rf -- "${SENSOR_TMP_DIR}"' EXIT HUP INT TERM

PAIR_BODY="${SENSOR_TMP_DIR}/pair-request.json"
PAIR_RESPONSE="${SENSOR_TMP_DIR}/pair-response.json"
TELEMETRY_BODY="${SENSOR_TMP_DIR}/telemetry.json"
CURL_CREDENTIALS="${SENSOR_TMP_DIR}/curl-credentials"

jq -n --arg code "${PAIRING_CODE}" '{pairingCode:$code}' >"${PAIR_BODY}"
unset PAIRING_CODE

curl --fail-with-body --silent --show-error \
  --request POST "${API_BASE_URL}/device/pair" \
  --header "Content-Type: application/json" \
  --data-binary "@${PAIR_BODY}" \
  --output "${PAIR_RESPONSE}"

DEVICE_ID="$(jq -er '.deviceId | select(type == "string" and length > 0)' "${PAIR_RESPONSE}")"
DEVICE_TOKEN="$(jq -er '.deviceToken | select(type == "string" and length > 0)' "${PAIR_RESPONSE}")"
jq -n '{seq:1,observedAt:null,data:{temperature:28.1,humidity:67.2,pm25:12.8}}' >"${TELEMETRY_BODY}"
printf 'header = "Authorization: Bearer %s"\n' "${DEVICE_TOKEN}" >"${CURL_CREDENTIALS}"
chmod 600 "${CURL_CREDENTIALS}"

curl --fail-with-body --silent --show-error \
  --config "${CURL_CREDENTIALS}" \
  --request POST "${API_BASE_URL}/devices/${DEVICE_ID}/telemetry" \
  --header "Content-Type: application/json" \
  --data-binary "@${TELEMETRY_BODY}"
