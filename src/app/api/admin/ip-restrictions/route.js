import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const username = searchParams.get("username");

        const conn = await getDbConnection();

        if (username) {
            // Try emplist
            let [rows] = await conn.execute(
                "SELECT username, allowed_ips, ip_restriction_enabled FROM emplist WHERE LOWER(username) = LOWER(?)",
                [username.trim()]
            );

            if (rows.length === 0) {
                // Try rep_list
                [rows] = await conn.execute(
                    "SELECT username, allowed_ips, ip_restriction_enabled FROM rep_list WHERE LOWER(username) = LOWER(?)",
                    [username.trim()]
                );
            }

            if (rows.length === 0) {
                return NextResponse.json({ error: "User not found" }, { status: 404 });
            }

            return NextResponse.json(rows[0]);
        }

        // Global summary (count of restricted users)
        const [empCount] = await conn.execute("SELECT COUNT(*) as count FROM emplist WHERE ip_restriction_enabled = 1");
        const [repCount] = await conn.execute("SELECT COUNT(*) as count FROM rep_list WHERE ip_restriction_enabled = 1");

        return NextResponse.json({
            restrictedUserCount: empCount[0].count + repCount[0].count
        });
    } catch (error) {
        console.error("Error in IP Restrictions GET:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const { username, allowed_ips, ip_restriction_enabled, bulk } = await request.json();
        const conn = await getDbConnection();

        if (bulk) {
            // Apply to everyone
            await conn.execute("UPDATE emplist SET allowed_ips = ?, ip_restriction_enabled = ?", [allowed_ips, ip_restriction_enabled]);
            await conn.execute("UPDATE rep_list SET allowed_ips = ?, ip_restriction_enabled = ?", [allowed_ips, ip_restriction_enabled]);

            return NextResponse.json({ message: "Updated all users successfully" });
        }

        if (!username) {
            return NextResponse.json({ error: "Username is required" }, { status: 400 });
        }

        // Update specific user
        // Try emplist first
        const [empResult] = await conn.execute(
            "UPDATE emplist SET allowed_ips = ?, ip_restriction_enabled = ? WHERE LOWER(username) = LOWER(?)",
            [allowed_ips, ip_restriction_enabled, username.trim()]
        );

        // Also update rep_list just in case username exists there (though they should be unique)
        const [repResult] = await conn.execute(
            "UPDATE rep_list SET allowed_ips = ?, ip_restriction_enabled = ? WHERE LOWER(username) = LOWER(?)",
            [allowed_ips, ip_restriction_enabled, username.trim()]
        );

        if (empResult.affectedRows === 0 && repResult.affectedRows === 0) {
            return NextResponse.json({ error: "User not found or no changes made" }, { status: 404 });
        }

        return NextResponse.json({ message: `Updated settings for ${username} successfully` });
    } catch (error) {
        console.error("Error in IP Restrictions POST:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
