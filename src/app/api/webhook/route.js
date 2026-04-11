import { getDbConnection } from "@/lib/db";
import { checkPhoneDuplicate, normalizePhone } from "@/lib/phone-check";
import {
  extractProductFromMetaFieldData,
  buildProductsInterestLabel,
} from "@/lib/metaLeadProduct";
import { TAMIL_META_FORM_ID, TAMIL_META_ASSIGNEE_USERNAME } from "@/lib/metaTamilLeadForm";

// Disable caching - fixes 405 Method Not Allowed on production (Vercel, nginx, etc.)
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// const dbConfig = {
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
// };

// // pincode find
// // get state from pincode
// // async function getStateFromPincode(pincode) {
// //   if (!pincode) return null;

// //   try {
// //     const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
// //     const data = await res.json();
// //     console.log("📍 Pincode data:", data);

// //     if (
// //       Array.isArray(data) &&
// //       data[0]?.Status === "Success" &&
// //       data[0]?.PostOffice?.length
// //     ) {
// //       console.log("📍 State from pincode:", data[0].PostOffice[0].State);
// //       return data[0].PostOffice[0].State;
// //     }
// //   } catch (err) {
// //     console.warn("⚠️ Pincode lookup failed:", pincode, err);
// //   }

// //   return null;
// // }

// // ✅ Verify webhook subscription (required for Meta to verify callback URL)
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.FB_VERIFY_TOKEN) {
    return new Response(challenge);
  }

  return new Response("Forbidden", { status: 403 });
}

// Allow OPTIONS for CORS preflight (some proxies/firewalls send this first)
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: "GET, POST, OPTIONS" } });
}





export async function POST(request) {
  const body = await request.json();
  console.log("🔔 Webhook received:", JSON.stringify(body, null, 2));

  const entry = body?.entry?.[0];
  const leadgen_id = entry?.changes?.[0]?.value?.leadgen_id;

  if (!leadgen_id) {
    return new Response("Missing leadgen_id", { status: 400 });
  }

  try {
    const conn = await getDbConnection();
    const token = process.env.FB_PAGE_TOKEN;

    // Step 1: Fetch lead details using leadgen_id
    // Explicitly request field_data + ad_id, otherwise Meta may not include them
    const leadRes = await fetch(
      `https://graph.facebook.com/v18.0/${leadgen_id}?fields=field_data,ad_id,created_time,form_id&access_token=${token}`,
    );
    const leadData = await leadRes.json();
    console.log("📥 Lead data:", JSON.stringify(leadData, null, 2));

    // If Meta returned an error or not OK status, don't continue silently
    if (!leadRes.ok || leadData?.error) {
      console.error("❌ Meta lead fetch failed:", leadData);
      return new Response("Failed to fetch lead from Meta", { status: 502 });
    }

    const fieldData = leadData?.field_data || [];
    const formIdFromLead =
      leadData?.form_id != null ? String(leadData.form_id) : null;
    // Prefer ad_id from Graph API — webhook payload often omits it
    const ad_id =
      leadData?.ad_id || entry?.changes?.[0]?.value?.ad_id || null;

    // Step 2: Fetch campaign name from ad_id → campaign_id → name
    let campaignName = "";
    if (ad_id) {
      const adRes = await fetch(
        `https://graph.facebook.com/v18.0/${ad_id}?fields=campaign_id&access_token=${token}`,
      );
      const adJson = await adRes.json();
      console.log("🧩 Ad Data:", adJson); // ← ADD THIS
      const campaign_id = adJson?.campaign_id;

      if (campaign_id) {
        const campRes = await fetch(
          `https://graph.facebook.com/v18.0/${campaign_id}?fields=name&access_token=${token}`,
        );
        const campJson = await campRes.json();
        console.log("🎯 Campaign Data:", campJson); // ← ADD THIS
        campaignName = campJson?.name || "";
      } else {
        console.log("⚠️ No campaign_id found in adJson");
      }
    }

    // Step 3: Parse lead fields
    const getValue = (name) =>
      fieldData.find((f) => f.name === name)?.values?.[0] || null;
    const first_name = getValue("full_name") || getValue("first_name");
    const email = getValue("email");
    const rawPhone = getValue("phone_number");
    const phone = normalizePhone(rawPhone) || (rawPhone ? String(rawPhone).replace(/\D/g, "").slice(-10) : null);
    const address = getValue("city");
    const language = getValue("preferred_language_to_communicate");
    const lead_campaign = "social_media";
    const productFromForm = extractProductFromMetaFieldData(fieldData);
    const products_interest =
      buildProductsInterestLabel({
        formProduct: productFromForm,
        campaignName,
      }) || "";
    const now = new Date();

    if (!phone && !email)
      return new Response("Missing contact info", { status: 400 });

    // --- Fetch all active reps ---
    const [repRows] = await conn.execute(`
      SELECT * FROM lead_distribution
      WHERE is_active = 1
      ORDER BY priority ASC, last_assigned_at ASC
    `);

    if (!repRows.length)
      return new Response("No reps available", { status: 503 });

    // --- Assign rep: fixed form (Tamil pipeline) → KAVYA; else language Tamil → KAVYA; else round-robin ---
    let assignedRep = null;

    if (formIdFromLead === TAMIL_META_FORM_ID) {
      assignedRep = repRows.find((r) => r.username === TAMIL_META_ASSIGNEE_USERNAME) || null;
      if (!assignedRep) {
        console.error(
          `❌ ${TAMIL_META_ASSIGNEE_USERNAME} not found in lead_distribution (Tamil form)`,
        );
        return new Response("KAVYA not configured", { status: 500 });
      }
    }

    const normalizedLanguage = language?.toUpperCase()?.trim();

    if (!assignedRep && normalizedLanguage === "TAMIL") {
      assignedRep = repRows.find((r) => r.username === TAMIL_META_ASSIGNEE_USERNAME) || null;

      if (!assignedRep) {
        console.error("❌ KAVYA not found in lead_distribution table");
        return new Response("KAVYA not configured", { status: 500 });
      }
    }

    // --- Round-robin fallback ---
    if (!assignedRep) {
      assignedRep =
        repRows.find((r) => r.assigned_count < r.max_leads) || repRows[0];
      // reset counts if all reached max
      if (assignedRep.assigned_count >= assignedRep.max_leads) {
        await conn.execute(
          `UPDATE lead_distribution SET assigned_count = 0 WHERE is_active = 1`,
        );
      }
    }

    const assignedTo = assignedRep.username;


    // --- Check if customer already exists (PHONE - last 10 digits only) ---
let customerId = null;

if (phone) {
  const dupCheck = await checkPhoneDuplicate(phone);
  if (dupCheck.duplicate) {
    customerId = dupCheck.customerId;

    // ✅ 1️⃣ Update customer status to 'Average'
    await conn.execute(
      `UPDATE customers SET status = ? WHERE customer_id = ?`,
      ["Average", customerId]
    );

    // ✅ 2️⃣ Insert urgent followup
    await conn.execute(
      `INSERT INTO customers_followup (
        customer_id, name, contact, next_followup_date,
        followed_by, followed_date, communication_mode,
        notes, email
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerId,
        first_name,
        phone,
        new Date(), // immediate followup
        assignedTo,
        now,
        "Facebook",
        "Re-Enquiry: urgent customer follow",
        email || ""
      ]
    );

    console.log("⚡ Existing customer → status updated + urgent followup added");

    return new Response("EXISTING_CUSTOMER_UPDATED_AND_FOLLOWUP_ADDED", { status: 200 });
  }
}


// Step 6: Insert into customers table
const [customerResult] = await conn.execute(
  `INSERT INTO customers (
    first_name, email, phone, address, lead_campaign,
    lead_source, sales_representative, assigned_to,
    status, date_created, products_interest
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

customerId =await customerResult.insertId; // ✅ FIXED


    // Step 7: Insert into followup table
    await conn.execute(
      `INSERT INTO customers_followup (
        customer_id, name, contact, next_followup_date,followed_by,
        followed_date, communication_mode, notes, email
      ) VALUES (?,?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerId,
        first_name,
        phone,
        null,
        assignedTo,
        now,
        "Facebook",
        "Lead from Facebook ad",
        email || "",
      ],
    );

    // Step 8: Update selected rep’s lead count and timestamp
    await conn.execute(
      `
      UPDATE lead_distribution
      SET assigned_count = assigned_count + 1,
          last_assigned_at = ?
      WHERE username = ?
    `,
      [now, assignedTo],
    );

    // await conn.end();

    console.log(
      `✅ Lead assigned to ${assignedTo} for campaign: ${campaignName}`,
    );
    return new Response("EVENT_RECEIVED", { status: 200 });
  } catch (err) {
    console.error("❌ Error handling lead:", err);
    return new Response("Server Error", { status: 500 });
  }
}


  // src/app/api/webhook/route.js

  // export async function POST(request) {
  //   try {
  //     const body = await request.json();
  //     console.log("📥 Received body:", body);

  //     // Simple response
  //     return new Response(
  //       JSON.stringify({
  //         message: "POST received successfully",
  //         received: body,
//       }),
//       {
//         status: 200,
//         headers: { "Content-Type": "application/json" },
//       }
//     );
//   } catch (err) {
//     console.error("❌ Error parsing request:", err);
//     return new Response(
//       JSON.stringify({ message: "Invalid JSON" }),
//       { status: 400, headers: { "Content-Type": "application/json" } }
//     );
//   }
// }

// Optional GET
