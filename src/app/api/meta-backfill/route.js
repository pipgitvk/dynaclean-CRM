import { getDbConnection } from "@/lib/db";

// Helper: normalize phone
// - convert to string
// - keep only digits
// - drop leading 91 if present
// - keep last 10 digits (typical Indian mobile)
function normalizePhone(phone) {
  if (!phone) return null;
  let p = typeof phone === "string" ? phone : String(phone);

  // keep only digits
  p = p.replace(/\D/g, "");

  // if starts with 91 and length > 10, drop country code
  if (p.startsWith("91") && p.length > 10) {
    p = p.slice(-10);
  }

  // if still longer than 10, keep last 10 digits
  if (p.length > 10) {
    p = p.slice(-10);
  }

  return p || null;
}

// get state from pincode
// async function getStateFromPincode(pincode) {
//   if (!pincode) return null;

//   try {
//     const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
//     const data = await res.json();
//     console.log("📍 Pincode data:", data);

//     if (
//       Array.isArray(data) &&
//       data[0]?.Status === "Success" &&
//       data[0]?.PostOffice?.length
//     ) {
//       console.log("📍 State from pincode:", data[0].PostOffice[0].State);
//       return data[0].PostOffice[0].State;
//     }
//   } catch (err) {
//     console.warn("⚠️ Pincode lookup failed:", pincode, err);
//   }

//   return null;
// }

// Helper: parse lead field_data from Meta into our shape
// function parseLeadFromFieldData(fieldData, extra = {}) {
//   const getValue = (name) =>
//     fieldData.find((f) => f.name === name)?.values?.[0] || null;

//   const first_name = getValue("full_name") || getValue("first_name");
//   const email = getValue("email");
//   const rawPhone = getValue("phone_number");
//   const address = getValue("city");

//   return {
//     first_name: first_name || "",
//     email: email || "",
//     phone: normalizePhone(rawPhone),
//     address: address || "",
//     ...extra,
//   };
// }

function parseLeadFromFieldData(fieldData, extra = {}) {
  const getValue = (name) =>
    fieldData.find((f) => f.name === name)?.values?.[0] || null;

  const first_name = getValue("full_name") || getValue("first_name");
  const email = getValue("email");
  const rawPhone = getValue("phone_number");
  const address = getValue("city");
  const language = getValue("preferred_language_to_communicate");
  // const pincode = getValue("postcode") || getValue("zipcode");

  return {
    first_name: first_name || "",
    email: email || "",
    phone: normalizePhone(rawPhone),
    address: address || "",
    language:language || "",
    ...extra,
  };
}

// GET /api/meta-backfill?since=YYYY-MM-DD&until=YYYY-MM-DD
// 1) Fetch leads from Meta for the date range
// 2) Filter out leads whose phone already exists in `customers`
// 3) Return only NEW leads (not in DB) so UI can display & choose which to import
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since"); // e.g. 2025-01-01
  const until = searchParams.get("until"); // e.g. 2025-01-03
  const mode = searchParams.get("mode") || "range"; // "range" or "all"

  // For normal mode we require a date range; for mode=all we don't
  if (mode !== "all" && (!since || !until)) {
    return new Response("Missing since/until query params", { status: 400 });
  }

  const token = process.env.FB_PAGE_TOKEN;
  const formId = process.env.FB_LEAD_FORM_ID; // set this in .env

  if (!token || !formId) {
    return new Response("FB_PAGE_TOKEN or FB_LEAD_FORM_ID not configured", {
      status: 500,
    });
  }

  try {
    // Build Meta leads API URL
    let url = new URL(`https://graph.facebook.com/v18.0/${formId}/leads`);
    url.searchParams.set("access_token", token);
    url.searchParams.set("limit", "100"); // page size
    url.searchParams.set("fields", "field_data,ad_id,created_time");

    // Only send time_range if we're not fetching ALL history
    if (mode !== "all") {
      url.searchParams.set("time_range[since]", since);
      url.searchParams.set("time_range[until]", until);
    }

    // Fetch all pages using Graph API paging
    let rawLeads = [];
    while (url) {
      const res = await fetch(url.toString());
      const data = await res.json();
      console.log("data from meta ", data);

      if (!res.ok) {
        console.error("❌ Meta backfill error:", data);
        return new Response("Failed to fetch leads from Meta", { status: 502 });
      }

      rawLeads = rawLeads.concat(data?.data || []);

      const next = data?.paging?.next;
      url = next ? new URL(next) : null;
    }

    // Map raw leads into our shape
    const allLeads = rawLeads.map((lead) => {
      const fieldData = lead.field_data || [];
      const created_time = lead.created_time || null;
      const ad_id = lead.ad_id || null;
      const leadgen_id = lead.id; // Meta lead id

      return {
        leadgen_id,
        created_time,
        ad_id,
        ...parseLeadFromFieldData(fieldData, {
          lead_campaign: "social_media",
          products_interest: "", // we will resolve via campaign only on insert
        }),
      };
    });

    // Extra safety: filter by created_time in our own code as well,
    // because Meta may ignore time_range and return older leads.
    let leadsInRange = allLeads;

    if (mode !== "all") {
      const sinceDate = new Date(`${since}T00:00:00Z`);
      const untilDate = new Date(`${until}T23:59:59Z`);

      leadsInRange = allLeads.filter((l) => {
        if (!l.created_time) return false;
        const created = new Date(l.created_time);
        return created >= sinceDate && created <= untilDate;
      });
    }

    // first latest lead data
    console.log("Latest lead first:", allLeads[0]);

    // Collect phones and check which already exist in DB
    const phones = leadsInRange.map((l) => l.phone).filter((p) => !!p);

    let existingPhones = new Set();

    if (phones.length) {
      const conn = await getDbConnection();
      const placeholders = phones.map(() => "?").join(",");
      const [rows] = await conn.execute(
        `SELECT phone FROM customers WHERE phone IN (${placeholders})`,
        phones,
      );
      existingPhones = new Set(rows.map((r) => normalizePhone(r.phone)));
    }

    // Now only keep leads that are BOTH in the date range AND not in customers
    const newLeads = leadsInRange.filter(
      (l) => l.phone && !existingPhones.has(l.phone),
    );

    // Resolve products_interest (campaign name) for display in UI
    for (const lead of newLeads) {
      if (!lead.ad_id) continue;
      try {
        const adRes = await fetch(
          `https://graph.facebook.com/v18.0/${lead.ad_id}?fields=campaign_id&access_token=${token}`,
        );
        const adJson = await adRes.json();
        const campaign_id = adJson?.campaign_id;

        if (campaign_id) {
          const campRes = await fetch(
            `https://graph.facebook.com/v18.0/${campaign_id}?fields=name&access_token=${token}`,
          );
          const campJson = await campRes.json();
          lead.products_interest = campJson?.name || "";
        }
      } catch (err) {
        console.warn("⚠️ Failed to resolve campaign for ad", lead.ad_id, err);
      }
    }

    return Response.json({
      total_from_meta: allLeads.length,
      total_in_range: leadsInRange.length,
      existing_in_db: existingPhones.size,
      new_count: newLeads.length,
      leads: newLeads,
    });
  } catch (err) {
    console.error("❌ Error in meta-backfill GET:", err);
    return new Response("Server error", { status: 500 });
  }
}

// Helper: insert ONE lead into DB (reusing your webhook logic)
async function insertLeadIntoDb(lead) {
  const conn = await getDbConnection();


  // STEP 1: check state from pincode (runtime)

 let repRows = [];
const normalizedLanguage = lead.language?.toUpperCase();

// 🟢 STEP 1: Tamil → Kavya
if (normalizedLanguage === "TAMIL") {
  const [rows] = await conn.execute(
    `SELECT *
     FROM lead_distribution
     WHERE is_active = 1
       AND username = 'KAVYA'
       AND assigned_count < max_leads
     LIMIT 1`,
  );

  if (rows.length) {
    repRows = rows;
  }
}

// 🟡 STEP 2: fallback round-robin
if (!repRows.length) {
  const [rows] = await conn.execute(
    `SELECT *
     FROM lead_distribution
     WHERE is_active = 1
     ORDER BY priority ASC, last_assigned_at ASC`,
  );
  repRows = rows;
}

if (repRows.length === 0) {
  throw new Error("No reps available");
}


  // Round-robin
  // let selectedRep = null;
  // for (const rep of repRows) {
  //   if (rep.assigned_count < rep.max_leads) {
  //     selectedRep = rep;
  //     break;
  //   }
  // }

  // if (!selectedRep) {
  //   await conn.execute(
  //     `UPDATE lead_distribution
  //      SET assigned_count = 0
  //      WHERE is_active = 1`,
  //   );
  //   selectedRep = repRows[0];
  // }

let selectedRep = null;

for (const rep of repRows) {
  if (rep.assigned_count < rep.max_leads) {
    selectedRep = rep;
    break;
  }
}

if (!selectedRep) {
  await conn.execute(
    `UPDATE lead_distribution
     SET assigned_count = 0
     WHERE is_active = 1`,
  );
  selectedRep = repRows[0];
}


  const assignedTo = selectedRep.username;
  const now = new Date();

  // Final safety: skip if phone already exists
  if (lead.phone) {
    const [rows] = await conn.execute(
      `SELECT customer_id FROM customers WHERE phone = ? LIMIT 1`,
      [lead.phone],
    );
    if (rows.length) {
      console.log("ℹ️ Skipping lead, phone already exists:", lead.phone);
      return { skipped: true, reason: "phone_exists" };
    }
  }

  const {
    first_name,
    email,
    phone,
    address,
    lead_campaign = "social_media",
    products_interest = "",
  } = lead;

  const [customerResult] = await conn.execute(
    `INSERT INTO customers (
        first_name, email, phone, address, lead_campaign,
        lead_source, sales_representative, assigned_to, status, date_created, products_interest
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      first_name,
      email,
      phone,
      address || "",
      lead_campaign,
      assignedTo,
      assignedTo,
      "Automatic",
      "New",
      now,
      products_interest,
    ],
  );

  const customerId = await customerResult.insertId;

  await conn.execute(
    `INSERT INTO customers_followup (
        customer_id, name, contact, next_followup_date, followed_by,
        followed_date, communication_mode, notes, email
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      customerId,
      first_name,
      phone,
      null,
      assignedTo,
      now,
      "Facebook",
      "Lead from Facebook ad (backfill)",
      email || "",
    ],
  );

  await conn.execute(
    `UPDATE lead_distribution
       SET assigned_count = assigned_count + 1,
           last_assigned_at = ?
     WHERE username = ?`,
    [now, assignedTo],
  );

  return { skipped: false, customerId };
}

// POST /api/meta-backfill
// Body: { leadIds: ["LEAD_ID_1", "LEAD_ID_2", ...] }
// For each lead id:
//  - fetch full lead data from Meta
//  - normalize/parse
//  - insert into DB using same logic as webhook
export async function POST(request) {
  const body = await request.json();
  const leadIds = body?.leadIds;

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return new Response("leadIds array is required", { status: 400 });
  }

  const token = process.env.FB_PAGE_TOKEN;
  if (!token) {
    return new Response("FB_PAGE_TOKEN not configured", { status: 500 });
  }

  const results = [];

  try {
    for (const leadgen_id of leadIds) {
      try {
        const leadRes = await fetch(
          `https://graph.facebook.com/v18.0/${leadgen_id}?fields=field_data,ad_id,created_time&access_token=${token}`,
        );
        const leadData = await leadRes.json();
        console.log(
          "🟦 RAW META field_data:",
          JSON.stringify(leadData.field_data, null, 2),
        );

        if (!leadRes.ok) {
          console.error("❌ Failed to fetch lead", leadgen_id, leadData);
          results.push({ leadgen_id, error: "fetch_failed" });
          continue;
        }

        const fieldData = leadData?.field_data || [];
        const ad_id = leadData?.ad_id;

        // Optional: resolve campaign name (like webhook) if ad_id exists
        let campaignName = "";
        if (ad_id) {
          try {
            const adRes = await fetch(
              `https://graph.facebook.com/v18.0/${ad_id}?fields=campaign_id&access_token=${token}`,
            );
            const adJson = await adRes.json();
            const campaign_id = adJson?.campaign_id;

            if (campaign_id) {
              const campRes = await fetch(
                `https://graph.facebook.com/v18.0/${campaign_id}?fields=name&access_token=${token}`,
              );
              const campJson = await campRes.json();
              campaignName = campJson?.name || "";
            }
          } catch (err) {
            console.warn("⚠️ Failed to resolve campaign for", ad_id, err);
          }
        }

        const parsed = parseLeadFromFieldData(fieldData, {
          lead_campaign: "social_media",
          products_interest: campaignName,
        });

        if (!parsed.phone && !parsed.email) {
          results.push({ leadgen_id, skipped: true, reason: "no_contact" });
          continue;
        }

        const insertResult = await insertLeadIntoDb(parsed);
        results.push({ leadgen_id, ...insertResult });
      } catch (err) {
        console.error("❌ Error handling lead", leadgen_id, err);
        results.push({ leadgen_id, error: "exception" });
      }
    }

    return Response.json({ count: results.length, results });
  } catch (err) {
    console.error("❌ Error in meta-backfill POST:", err);
    return new Response("Server error", { status: 500 });
  }
}
