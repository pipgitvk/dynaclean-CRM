import { getDbConnection } from "@/lib/db";

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

// ✅ Verify webhook subscription
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

export async function POST(request) {
  const body = await request.json();
  console.log("🔔 Webhook received:", JSON.stringify(body, null, 2));

  const entry = body?.entry?.[0];
  const leadgen_id = entry?.changes?.[0]?.value?.leadgen_id;

  if (!leadgen_id) {
    return new Response("Missing leadgen_id", { status: 400 });
  }

  try {
    const token = process.env.FB_PAGE_TOKEN;

    // Step 1: Fetch lead details using leadgen_id
    const leadRes = await fetch(
      `https://graph.facebook.com/v18.0/${leadgen_id}?access_token=${token}`,
    );
    const leadData = await leadRes.json();
    console.log("📥 Lead data:", JSON.stringify(leadData, null, 2));

    const fieldData = leadData?.field_data || [];
    const ad_id = body?.entry?.[0]?.changes?.[0]?.value?.ad_id;

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
    let phone = getValue("phone_number");
    const address = getValue("city");
    const lead_campaign = "social_media";
    const products_interest = campaignName;
    const now = new Date();

    if (!phone && !email) {
      return new Response("Missing contact info", { status: 400 });
    }
    // Step 3.1: Check if the phone number starts with +91 and remove it
    if (phone && typeof phone === "string" && phone.startsWith("+91")) {
      phone = phone.slice(3); // Removes the "+91" part
    } else if (phone && typeof phone !== "string") {
      phone = String(phone); // Convert phone to a string if it's not already one
    }

    // Step 4: Connect to DB and fetch reps ordered by priority
    const conn = await getDbConnection();
    const [repRows] = await conn.execute(`
      SELECT * FROM lead_distribution
      WHERE is_active = 1
      ORDER BY priority ASC, last_assigned_at ASC
    `);

    if (repRows.length === 0) {
      // await conn.end();
      return new Response("No reps available", { status: 503 });
    }

    // Step 5: Round-robin logic to pick next available rep
    let selectedRep = null;
    for (const rep of repRows) {
      if (rep.assigned_count < rep.max_leads) {
        selectedRep = rep;
        break;
      }
    }

    // If no rep is available (all hit max), reset counts and pick first
    if (!selectedRep) {
      await conn.execute(`
        UPDATE lead_distribution
        SET assigned_count = 0
        WHERE is_active = 1
      `);
      selectedRep = repRows[0];
    }

    const assignedTo = selectedRep.username;

    // Step 6: Insert into customers table
    const [customerResult] = await conn.execute(
      `INSERT INTO customers (
        first_name, email, phone, address, lead_campaign,
        lead_source,sales_representative, assigned_to, status, date_created, products_interest
      ) VALUES (?, ?, ?, ?, ?, ?,?, ?, ?, ?, ?)`,
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
