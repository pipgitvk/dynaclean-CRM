/**
 * Stored format: "lat, lng | human-readable location"
 */
export function formatGeoLocation(lat, lng, label = "") {
  const latN = Number(lat);
  const lngN = Number(lng);
  if (!Number.isFinite(latN) || !Number.isFinite(lngN)) {
    return label.trim() || "";
  }
  const coords = `${latN.toFixed(6)}, ${lngN.toFixed(6)}`;
  const trimmed = String(label || "").trim();
  return trimmed ? `${coords} | ${trimmed}` : coords;
}

export function parseGeoLocation(value) {
  if (!value || typeof value !== "string") {
    return { lat: null, lng: null, label: "" };
  }
  const trimmed = value.trim();
  const pipeIdx = trimmed.indexOf("|");
  const coordPart = pipeIdx >= 0 ? trimmed.slice(0, pipeIdx).trim() : trimmed;
  const label = pipeIdx >= 0 ? trimmed.slice(pipeIdx + 1).trim() : "";
  const match = coordPart.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) {
    return { lat: null, lng: null, label: trimmed };
  }
  return {
    lat: parseFloat(match[1]),
    lng: parseFloat(match[2]),
    label,
  };
}

export async function reverseGeocodeLabel(lat, lng) {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    );
    if (!res.ok) return `${lat}, ${lng}`;
    const data = await res.json();
    const address = `${data.locality || ""} ${data.city || ""} ${data.principalSubdivision || ""} ${data.countryName || ""}`.trim();
    return address || `${lat}, ${lng}`;
  } catch {
    return `${lat}, ${lng}`;
  }
}
