import crypto from "crypto";

export function hashThirdPartyEngineerPassword(password) {
  return crypto.createHash("sha256").update(String(password)).digest("hex");
}

export function verifyThirdPartyEngineerPassword(inputPassword, storedHash) {
  if (!storedHash || !inputPassword) return false;
  return hashThirdPartyEngineerPassword(inputPassword) === storedHash;
}
