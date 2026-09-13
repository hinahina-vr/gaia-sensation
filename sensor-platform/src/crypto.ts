const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
};

export const hmacHex = async (secret: string, value: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToHex(new Uint8Array(signature));
};

export const timingSafeHexEqual = async (left: string, right: string): Promise<boolean> => {
  const leftBytes = hexToBytes(left.padEnd(64, "0").slice(0, 64));
  const rightBytes = hexToBytes(right.padEnd(64, "0").slice(0, 64));
  const comparisonKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode("gaia-senseware-fixed-length-comparison-v1"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const signature = await crypto.subtle.sign("HMAC", comparisonKey, leftBytes);
  const equal = await crypto.subtle.verify("HMAC", comparisonKey, signature, rightBytes);
  return equal && left.length === 64 && right.length === 64;
};

export const randomToken = (prefix = ""): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `${prefix}${base64UrlEncode(bytes)}`;
};

const PAIRING_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export const randomPairingCode = (): string => {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const characters = Array.from(bytes, (byte) => PAIRING_ALPHABET[byte % PAIRING_ALPHABET.length]);
  return `${characters.slice(0, 4).join("")}-${characters.slice(4).join("")}`;
};

export const pkceChallenge = async (verifier: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
};

export const encryptFlowValue = async (value: string, secret: string): Promise<string> => {
  const key = await deriveAesKey(secret);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(value));
  return `${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(ciphertext))}`;
};

export const decryptFlowValue = async (packed: string, secret: string): Promise<string | null> => {
  const [ivPart, ciphertextPart] = packed.split(".");
  if (!ivPart || !ciphertextPart) return null;
  try {
    const key = await deriveAesKey(secret);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64UrlDecode(ivPart) },
      key,
      base64UrlDecode(ciphertextPart),
    );
    return decoder.decode(plaintext);
  } catch {
    return null;
  }
};

export const base64UrlEncode = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
};

export const base64UrlDecode = (value: string): Uint8Array<ArrayBuffer> => {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const deriveAesKey = async (secret: string): Promise<CryptoKey> => {
  const keyMaterial = await crypto.subtle.digest("SHA-256", encoder.encode(`gaia-oidc-flow:${secret}`));
  return crypto.subtle.importKey("raw", keyMaterial, "AES-GCM", false, ["encrypt", "decrypt"]);
};

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const hexToBytes = (hex: string): Uint8Array<ArrayBuffer> => {
  const pairs = hex.match(/.{2}/gu) ?? [];
  const bytes = new Uint8Array(pairs.length);
  pairs.forEach((pair, index) => { bytes[index] = Number.parseInt(pair, 16); });
  return bytes;
};
