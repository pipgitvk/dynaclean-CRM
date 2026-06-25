import { getDbConnection } from "@/lib/db";

export async function GET(req) {
  try {
    const conn = await getDbConnection();

    // Fetch all settings from app_settings table
    const [rows] = await conn.execute(
      "SELECT setting_key, setting_value FROM app_settings"
    );

    // Convert to key-value object
    const settings = {};
    rows.forEach((row) => {
      settings[row.setting_key] = row.setting_value;
    });

    return Response.json(settings, { status: 200 });
  } catch (err) {
    console.error("[company-settings] Error:", err?.message);
    return Response.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PUT(req) {
  try {
    const body = await req.json();
    const { setting_key, setting_value } = body;

    if (!setting_key) {
      return Response.json(
        { error: "setting_key is required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    await conn.execute(
      "INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?",
      [setting_key, setting_value, setting_value]
    );

    return Response.json(
      { success: true, setting_key, setting_value },
      { status: 200 }
    );
  } catch (err) {
    console.error("[company-settings] Error:", err?.message);
    return Response.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
