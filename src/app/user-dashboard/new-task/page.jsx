import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import TaskForm from "@/components/task/TaskForm";

const JWT_SECRET = process.env.JWT_SECRET;
export const dynamic = "force-dynamic";

export default async function AddTaskPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return <p className="text-red-500">❌ Unauthorized</p>;

  const { payload } = await jwtVerify(
    token,
    new TextEncoder().encode(JWT_SECRET)
  );

  return (
    <div className="mx-auto bg-white p-8 shadow-lg rounded-lg mt-6">
      <h1 className="text-2xl font-semibold mb-6 text-gray-600">
        Add New Task
      </h1>
      <TaskForm username={payload.username} />
    </div>
  );
}
