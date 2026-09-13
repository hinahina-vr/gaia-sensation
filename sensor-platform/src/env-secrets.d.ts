interface Env {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  DEVICE_TOKEN_PEPPER: string;
  PAIRING_CODE_PEPPER: string;
  LIVE_SENSEWARE_ENABLED?: string;
  LIVE_SENSEWARE_JAXA_ENABLED?: string;
  LIVE_SENSEWARE_ESA_ENABLED?: string;
  CDSE_CLIENT_ID?: string;
  CDSE_CLIENT_SECRET?: string;
}

declare namespace Cloudflare {
  interface Env {
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    SESSION_SECRET: string;
    DEVICE_TOKEN_PEPPER: string;
    PAIRING_CODE_PEPPER: string;
    LIVE_SENSEWARE_ENABLED?: string;
    LIVE_SENSEWARE_JAXA_ENABLED?: string;
    LIVE_SENSEWARE_ESA_ENABLED?: string;
    CDSE_CLIENT_ID?: string;
    CDSE_CLIENT_SECRET?: string;
  }
}
