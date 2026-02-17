import { getDbConnection } from "@/lib/db";
import RepUpdateForm from "@/components/rep-update-form";

export const dynamic = "force-dynamic";

export default async function RepPage({ params }) {
  let { username } = await params;
   username = decodeURIComponent(username);
  console.log("Hello",username);
  

  if (!username) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <h1 className="text-3xl font-bold text-red-600">
          Username is missing.
        </h1>
      </div>
    );
  }

  try {
    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      `SELECT password FROM rep_list WHERE username = ?`,
      [username],
    );
    // await conn.end();

    if (rows.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
          <h1 className="text-3xl font-bold text-red-600">
            Representative not found.
          </h1>
        </div>
      );
    }

    const { password } = rows[0];
    console.log(password);
    

    return (
      <div className="flex flex-col items-center justify-center  bg-gray-100 p-4">
        <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
          <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">
            Edit Password for **{username}**
          </h1>
          <RepUpdateForm initialPassword={password} username={username} />
        </div>
      </div>
    );
  } catch (error) {
    console.error("Database fetch error:", error);
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <h1 className="text-3xl font-bold text-red-600">
          An error occurred. Please try again.
        </h1>
      </div>
    );
  }
}
