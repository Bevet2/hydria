import crypto from "node:crypto";
import { env } from "../config/env.js";

const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const encryptionKey = crypto
  .createHash("sha256")
  .update(env.SECRET_ENCRYPTION_KEY || env.JWT_SECRET)
  .digest();

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function hashToken(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSecret(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Invalid encrypted secret");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

function base32Encode(value: Buffer) {
  let bits = "";
  for (const byte of value) bits += byte.toString(2).padStart(8, "0");
  let result = "";
  for (let index = 0; index < bits.length; index += 5) {
    result += base32Alphabet[Number.parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  }
  return result;
}

function base32Decode(value: string) {
  const bits = value
    .replace(/=+$/g, "")
    .toUpperCase()
    .split("")
    .map((character) => base32Alphabet.indexOf(character).toString(2).padStart(5, "0"))
    .join("");
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

export function createTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function totpAt(secret: string, timestamp: number) {
  const counter = Math.floor(timestamp / 30_000);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac("sha1", base32Decode(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const code = (
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff)
  ) % 1_000_000;
  return String(code).padStart(6, "0");
}

export function verifyTotp(secret: string, code: string, now = Date.now()) {
  const normalized = code.replace(/\s+/g, "");
  return [-1, 0, 1].some((window) => {
    const expected = totpAt(secret, now + window * 30_000);
    return normalized.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(normalized), Buffer.from(expected));
  });
}
