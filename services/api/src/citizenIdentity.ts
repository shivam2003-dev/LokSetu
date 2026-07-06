import { createHmac } from "node:crypto";
import { AadhaarIdentity } from "./types.js";

export function canonicalAadhaarNumber(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

export function validateAadhaarNumber(value: unknown): string | null {
  const canonical = canonicalAadhaarNumber(value);
  return /^\d{12}$/.test(canonical) ? canonical : null;
}

export function buildAadhaarIdentity(value: unknown): AadhaarIdentity | null {
  const aadhaarNumber = validateAadhaarNumber(value);
  if (!aadhaarNumber) return null;
  const aadhaarLast4 = aadhaarNumber.slice(-4);
  return {
    aadhaarHash: hashAadhaarNumber(aadhaarNumber),
    aadhaarMasked: `xxxx-xxxx-${aadhaarLast4}`,
    aadhaarLast4,
    aadhaarVerified: false,
    identityMode: "aadhaar_format_only"
  };
}

export function hashAadhaarNumber(aadhaarNumber: string): string {
  const secret =
    process.env.AADHAAR_HASH_SECRET ??
    process.env.APP_AUTH_SECRET ??
    process.env.APP_ACCESS_PASSWORD ??
    "loksetu-local-aadhaar-hash-secret";
  return createHmac("sha256", secret).update(`aadhaar:v1:${aadhaarNumber}`).digest("hex");
}
