import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";

export async function GET() {
    try {
        const payload = await getSessionPayload();
        if (!payload) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return NextResponse.json({ user: payload });
    } catch (error) {
        console.error("❌ Current User API Error:", error);
        return NextResponse.json({ error: "Failed to fetch user session" }, { status: 500 });
    }
}
