import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

// GET: Fetch current user's email credentials
export async function GET(request) {
    try {
        const session = await getSessionPayload();
        if (!session?.username) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const conn = await getDbConnection();
        const [rows] = await conn.execute(
            `SELECT smtp_host, smtp_port, smtp_user , smtp_pass
       FROM email_credentials 
       WHERE username = ?`,
            [session.username]
        );

        if (rows.length === 0) {
            return NextResponse.json({ success: true, configured: false });
        }

        const creds = rows[0];
        return NextResponse.json({
            success: true,
            configured: true,
            credentials: {
                smtp_host: creds.smtp_host,
                smtp_port: creds.smtp_port,
                smtp_user: creds.smtp_user,
                smtp_pass: creds.smtp_pass,
                // Never return the password
            }
        });

    } catch (error) {
        console.error("Error fetching settings:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST: Save credentials
export async function POST(request) {
    try {
        const session = await getSessionPayload();
        if (!session?.username) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { smtp_host, smtp_port, smtp_user, smtp_pass } = body;

        if (!smtp_user || !smtp_pass) {
            return NextResponse.json(
                { success: false, error: "SMTP Username and Password are required" },
                { status: 400 }
            );
        }

        const host = smtp_host || 'mail.dynacleanindustries.com';
        const port = smtp_port || 587;

        const conn = await getDbConnection();

        // Upsert credentials
        await conn.execute(
            `INSERT INTO email_credentials (username, smtp_host, smtp_port, smtp_user, smtp_pass)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       smtp_host = VALUES(smtp_host),
       smtp_port = VALUES(smtp_port),
       smtp_user = VALUES(smtp_user),
       smtp_pass = VALUES(smtp_pass)
      `,
            [session.username, host, port, smtp_user, smtp_pass]
        );

        return NextResponse.json({
            success: true,
            message: "Email settings saved successfully"
        });

    } catch (error) {
        console.error("Error saving settings:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
