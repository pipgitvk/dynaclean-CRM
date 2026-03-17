import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

function parseIps(str) {
    if (!str || typeof str !== "string") return [];
    return str.split(",").map((s) => s.trim()).filter(Boolean);
}

function joinIps(arr) {
    return arr.filter(Boolean).join(", ");
}

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

        // Global: return all unique IPs from all users
        const [empRows] = await conn.execute("SELECT username, allowed_ips FROM emplist WHERE allowed_ips IS NOT NULL AND allowed_ips != ''");
        const [repRows] = await conn.execute("SELECT username, allowed_ips FROM rep_list WHERE allowed_ips IS NOT NULL AND allowed_ips != ''");

        const ipSet = new Set();
        const ipToUsers = {};

        for (const row of [...empRows, ...repRows]) {
            const ips = parseIps(row.allowed_ips);
            for (const ip of ips) {
                ipSet.add(ip);
                if (!ipToUsers[ip]) ipToUsers[ip] = [];
                ipToUsers[ip].push(row.username);
            }
        }

        const [empCount] = await conn.execute("SELECT COUNT(*) as count FROM emplist WHERE ip_restriction_enabled = 1");
        const [repCount] = await conn.execute("SELECT COUNT(*) as count FROM rep_list WHERE ip_restriction_enabled = 1");
        const [empTotal] = await conn.execute("SELECT COUNT(*) as count FROM emplist");
        const [repTotal] = await conn.execute("SELECT COUNT(*) as count FROM rep_list");
        const total = empTotal[0].count + repTotal[0].count;
        const restricted = empCount[0].count + repCount[0].count;
        const globalRestrictionEnabled = total > 0 && restricted === total ? 1 : restricted === 0 ? 0 : 0;

        return NextResponse.json({
            allIps: Array.from(ipSet).sort(),
            ipToUsers,
            restrictedUserCount: restricted,
            globalRestrictionEnabled
        });
    } catch (error) {
        console.error("Error in IP Restrictions GET:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { username, allowed_ips, ip_restriction_enabled, bulk, addIp } = body;
        const conn = await getDbConnection();

        if (addIp && typeof addIp === "string") {
            const ip = addIp.trim();
            if (!ip) return NextResponse.json({ error: "IP is required" }, { status: 400 });

            const [empRows] = await conn.execute("SELECT username, allowed_ips FROM emplist");
            const [repRows] = await conn.execute("SELECT username, allowed_ips FROM rep_list");

            for (const row of empRows) {
                const ips = parseIps(row.allowed_ips);
                if (!ips.includes(ip)) {
                    ips.push(ip);
                    await conn.execute("UPDATE emplist SET allowed_ips = ? WHERE username = ?", [joinIps(ips), row.username]);
                }
            }
            for (const row of repRows) {
                const ips = parseIps(row.allowed_ips);
                if (!ips.includes(ip)) {
                    ips.push(ip);
                    await conn.execute("UPDATE rep_list SET allowed_ips = ? WHERE username = ?", [joinIps(ips), row.username]);
                }
            }
            return NextResponse.json({ message: `IP ${ip} added to all users` });
        }

        if (bulk) {
            if (body.bulkToggleOnly) {
                await conn.execute("UPDATE emplist SET ip_restriction_enabled = ?", [ip_restriction_enabled]);
                await conn.execute("UPDATE rep_list SET ip_restriction_enabled = ?", [ip_restriction_enabled]);
            } else {
                await conn.execute("UPDATE emplist SET allowed_ips = ?, ip_restriction_enabled = ?", [allowed_ips, ip_restriction_enabled]);
                await conn.execute("UPDATE rep_list SET allowed_ips = ?, ip_restriction_enabled = ?", [allowed_ips, ip_restriction_enabled]);
            }
            return NextResponse.json({ message: "Updated all users successfully" });
        }

        if (!username) {
            return NextResponse.json({ error: "Username is required" }, { status: 400 });
        }

        const [empResult] = await conn.execute(
            "UPDATE emplist SET allowed_ips = ?, ip_restriction_enabled = ? WHERE LOWER(username) = LOWER(?)",
            [allowed_ips, ip_restriction_enabled, username.trim()]
        );
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

export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const ip = searchParams.get("ip")?.trim();
        if (!ip) return NextResponse.json({ error: "IP parameter is required" }, { status: 400 });

        const conn = await getDbConnection();
        const [empRows] = await conn.execute("SELECT username, allowed_ips FROM emplist WHERE allowed_ips IS NOT NULL AND allowed_ips != ''");
        const [repRows] = await conn.execute("SELECT username, allowed_ips FROM rep_list WHERE allowed_ips IS NOT NULL AND allowed_ips != ''");

        for (const row of empRows) {
            const ips = parseIps(row.allowed_ips).filter((x) => x !== ip);
            await conn.execute("UPDATE emplist SET allowed_ips = ? WHERE username = ?", [joinIps(ips), row.username]);
        }
        for (const row of repRows) {
            const ips = parseIps(row.allowed_ips).filter((x) => x !== ip);
            await conn.execute("UPDATE rep_list SET allowed_ips = ? WHERE username = ?", [joinIps(ips), row.username]);
        }
        return NextResponse.json({ message: `IP ${ip} removed from all users` });
    } catch (error) {
        console.error("Error in IP Restrictions DELETE:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
