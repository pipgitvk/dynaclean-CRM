import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getDbConnection } from "@/lib/db";
import ClientTaskTable from "@/components/task//ClientTaskTableAdmin";
import DirectorTaskManager from "@/components/task/DirectorTaskManager";

const JWT_SECRET = process.env.JWT_SECRET;
export const dynamic = "force-dynamic";

async function getUsernameFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET),
    );
    return payload.username;
  } catch (e) {
    console.error("JWT Error:", e);
    return null;
  }
}

export default async function DirectorTaskPage() {
  const username = await getUsernameFromToken();
  if (!username) {
    return <p className="text-red-600 p-4">❌ Unauthorized</p>;
  }

  return <DirectorTaskManager currentUser={username} />;
}
