export const THIRD_PARTY_ENGINEER_ROLE = "THIRD PARTY ENGINEER";

export function normalizeThirdPartyEngineerRole(role) {
  return String(role || "").trim().toUpperCase();
}

export function isThirdPartyEngineerSession(payload) {
  return normalizeThirdPartyEngineerRole(payload?.role) === THIRD_PARTY_ENGINEER_ROLE;
}

export function getEngineerIdFromPayload(payload) {
  if (!isThirdPartyEngineerSession(payload)) return null;
  const id = payload.engineerId ?? payload.engineer_id ?? payload.id;
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : null;
}
