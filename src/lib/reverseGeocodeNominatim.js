/** Reverse geocode via OpenStreetMap Nominatim (server-side). */
export async function reverseGeocodeNominatim(lat, lon) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
      {
        headers: {
          "User-Agent":
            "DynacleanIndustriesApp/1.0 (contact@dynacleanindustries.com)",
        },
      }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.display_name || null;
  } catch {
    return null;
  }
}
