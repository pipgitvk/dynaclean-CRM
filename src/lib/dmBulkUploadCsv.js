function isMetaCSV(headers) {
  return headers.includes("full_name") || headers.includes("phone_number");
}

function mapMetaRow(row) {
  const fullName = row["full_name"]?.toString().trim() || "";
  const nameParts = fullName.split(" ");
  const first_name = nameParts[0] || "";
  const last_name = nameParts.slice(1).join(" ") || "";
  const language =
    row["preferred_language_to_communicate"]?.toString().trim() || "";
  return {
    first_name,
    last_name,
    email: row["email"]?.toString().trim() || "",
    phone: row["phone_number"]?.toString().trim() || "",
    company: "",
    address: row["city"]?.toString().trim() || "",
    lead_campaign: "social_media",
    products_interest: row["campaign_name"]?.toString().trim() || "",
    tags: "Other",
    notes: row["ad_name"]?.toString().trim() || "Lead from Meta",
    language,
    employee_username: "",
  };
}

/**
 * Parse bulk customer CSV (standard or Meta export). Matches admin bulk-upload behaviour.
 * @returns {{ rows: object[], isMeta: boolean }}
 */
export function parseDmBulkCustomerCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { rows: [], isMeta: false };

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const isMeta = isMetaCSV(headers);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = [];
    let current = "";
    let inQuotes = false;
    for (let c = 0; c < line.length; c++) {
      if (line[c] === '"') {
        inQuotes = !inQuotes;
      } else if (line[c] === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += line[c];
      }
    }
    values.push(current.trim());

    const raw = {};
    headers.forEach((h, idx) => {
      raw[h] = values[idx] || "";
    });

    const row = isMeta ? mapMetaRow(raw) : raw;
    rows.push(row);
  }
  return { rows, isMeta };
}
