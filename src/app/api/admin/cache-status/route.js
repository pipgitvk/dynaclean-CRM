import { NextResponse } from "next/server";
import { getCacheStats } from "@/lib/cache";
import { getDbConnection } from "@/lib/db";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

/**
 * GET /api/admin/cache-status
 * Returns current cache statistics and database pool status
 * Admin only
 */
export async function GET(request) {
  try {
    // Verify admin access
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );

    if (payload.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Get cache stats
    const cacheStats = getCacheStats();

    // Get DB pool info
    const pool = await getDbConnection();
    const poolInfo = {
      connectionLimit: 10,
      queueLimit: 0,
      idleTimeout: 30000,
      status: "Active",
    };

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      cache: {
        ...cacheStats,
        hitRate: cacheStats.hits + cacheStats.misses > 0 
          ? Math.round((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100)
          : 0,
      },
      database: poolInfo,
      message: `Cache has ${cacheStats.size} entries | Hit rate: ${cacheStats.hits + cacheStats.misses > 0 ? Math.round((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100) : 0}%`,
    });
  } catch (error) {
    console.error("Cache status error:", error);
    return NextResponse.json(
      { error: "Failed to get cache status" },
      { status: 500 }
    );
  }
}
