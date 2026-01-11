import FollowupsClient from "./FollowupsTable";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET;

async function getLeadSource() {
  const token = cookies().get("token")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );
    return payload.username;
  } catch {
    return null;
  }
}

export default async function Page() {
  const leadSource = await getLeadSource();
  return <FollowupsClient leadSource={leadSource} />;
}
