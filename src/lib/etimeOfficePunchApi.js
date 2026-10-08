/**
 * eTimeOffice DownloadPunchData API.
 * Postman Basic Auth: put CorpCode:Username:Password:true in the Username field,
 * leave Password empty → Authorization is Base64("CorpCode:Username:Password:true:")
 *
 * Set ETIME_OFFICE_USERNAME (or ETIME_OFFICE_AUTH) to that username string (no trailing colon).
 */

const DEFAULT_BASE = "https://api.etimeoffice.com/api";

function readEtimeOfficeAuthUsername() {
  let raw =
    process.env.ETIME_OFFICE_USERNAME?.trim() ||
    process.env.ETIME_OFFICE_AUTH?.trim();
  if (!raw) return "";
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    raw = raw.slice(1, -1);
  }
  return raw.trim();
}

function buildUsernameFromParts() {
  const corp = process.env.ETIME_OFFICE_CORP_CODE?.trim();
  const user = process.env.ETIME_OFFICE_API_USER?.trim();
  const pass = process.env.ETIME_OFFICE_API_PASSWORD;
  if (pass == null || pass === "") return "";
  if (!corp || !user) return "";
  const jsonFlag =
    process.env.ETIME_OFFICE_JSON_FLAG?.trim() !== ""
      ? process.env.ETIME_OFFICE_JSON_FLAG.trim()
      : "true";
  return `${corp}:${user}:${String(pass).trim()}:${jsonFlag}`;
}

export function getEtimeOfficeAuthHeader() {
  const precomputed = process.env.ETIME_OFFICE_BASIC_BASE64?.trim();
  if (precomputed) {
    const token = precomputed.replace(/^Basic\s+/i, "").trim();
    return `Basic ${token}`;
  }

  const username = buildUsernameFromParts() || readEtimeOfficeAuthUsername();
  if (!username) {
    throw new Error(
      "Configure ETIME_OFFICE_BASIC_BASE64 or ETIME_OFFICE_USERNAME (CorpCode:User:Password:true)"
    );
  }
  // Match Postman Basic Auth with empty password: base64(username + ":")
  const basicCredentials = username.endsWith(":") ? username : `${username}:`;
  return `Basic ${Buffer.from(basicCredentials, "utf8").toString("base64")}`;
}

/** YYYY-MM-DD → DD/MM/YYYY_HH:mm for API query params. */
export function formatEtimeOfficeApiDate(ymd, timeHHmm = "09:30") {
  const m = String(ymd || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const t = String(timeHHmm || "09:30").trim();
  if (!/^\d{1,2}:\d{2}$/.test(t)) return null;
  const [hh, mm] = t.split(":");
  return `${m[3]}/${m[2]}/${m[1]}_${String(parseInt(hh, 10)).padStart(2, "0")}:${mm}`;
}

/** "31/08/2026 19:05:00" → MySQL DATETIME string (IST wall clock). */
export function parseEtimeOfficePunchDate(punchDate) {
  const s = String(punchDate || "").trim();
  const m = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/
  );
  if (!m) return null;
  const d = String(parseInt(m[1], 10)).padStart(2, "0");
  const mo = String(parseInt(m[2], 10)).padStart(2, "0");
  const y = m[3];
  const h = String(parseInt(m[4], 10)).padStart(2, "0");
  const mi = String(parseInt(m[5], 10)).padStart(2, "0");
  const sec = String(parseInt(m[6], 10)).padStart(2, "0");
  return `${y}-${mo}-${d} ${h}:${mi}:${sec}`;
}

export function machinePunchSourceUid(empCode, rawPunchDate) {
  return `${String(empCode || "").trim()}|${String(rawPunchDate || "").trim()}`;
}

export async function fetchEtimeOfficePunchData({
  empCode = "ALL",
  fromApiDate,
  toApiDate,
}) {
  const base = (process.env.ETIME_OFFICE_API_BASE || DEFAULT_BASE).replace(
    /\/$/,
    ""
  );
  const params = new URLSearchParams({
    Empcode: empCode || "ALL",
    FromDate: fromApiDate,
    ToDate: toApiDate,
  });
  const url = `${base}/DownloadPunchData?${params.toString()}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: getEtimeOfficeAuthHeader(),
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `eTimeOffice returned non-JSON (HTTP ${res.status}). Check credentials and URL.`
    );
  }
  if (!res.ok) {
    throw new Error(data?.Msg || data?.message || `eTimeOffice HTTP ${res.status}`);
  }
  if (data.Error === true || data.Error === "true") {
    throw new Error(data.Msg || "eTimeOffice API error");
  }
  const punches = Array.isArray(data.PunchData) ? data.PunchData : [];
  return { punches, raw: data };
}

export function normalizeEtimeOfficePunchRow(row) {
  const empCode = String(row?.Empcode ?? row?.empcode ?? "").trim();
  const name = String(row?.Name ?? row?.name ?? "").trim();
  const rawPunch = String(row?.PunchDate ?? row?.punchDate ?? "").trim();
  const punchDatetime = parseEtimeOfficePunchDate(rawPunch);
  if (!empCode || !rawPunch || !punchDatetime) return null;
  const mFlag =
    row?.M_Flag != null && String(row.M_Flag).trim() !== ""
      ? String(row.M_Flag).trim()
      : null;
  return {
    emp_code: empCode,
    employee_name: name || empCode,
    punch_datetime: punchDatetime,
    m_flag: mFlag,
    raw_punch_date: rawPunch,
    source_uid: machinePunchSourceUid(empCode, rawPunch),
  };
}
