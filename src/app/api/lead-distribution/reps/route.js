import { getDbConnection } from "@/lib/db";

export async function GET() {
  const conn = await getDbConnection();

  const [rows] = await conn.execute(
    "SELECT username FROM rep_list where status = 1;"
  );



  // await conn.end();
  return Response.json(rows);
}


//WHERE ((userRole='BACK OFFICE' AND (status != 0 OR status IS NULL)) OR username IN ('kamal', 'amitkumar')) AND username != 'jayshankar';