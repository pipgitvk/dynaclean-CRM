// // app/admin-dashboard/page.jsx
// import { cookies } from "next/headers";
// import { jwtVerify } from "jose";
// import { getDbConnection } from "@/lib/db";
// import UpcomingTasks from "@/components/task/UpcomingTasksAdmin";
// // import UpcomingLeads from "@/components/Leads/UpcommingLeads";

// const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

// export default async function UserDashboardPage() {
//   const cookieStore = await cookies();
//   const token = cookieStore.get("token")?.value;

//   if (!token) {
//     return <p className="text-red-600">Unauthorized</p>;
//   }

//   try {
//     const { payload } = await jwtVerify(
//       token,
//       new TextEncoder().encode(JWT_SECRET)
//     );

//     const username = payload.username;

//     const connection = await getDbConnection();

//     const [rows] = await connection.execute(
//       `
//       SELECT username, email, empId, userRole FROM emplist WHERE username = ?
//       UNION
//       SELECT username, email, empId, userRole FROM rep_list WHERE username = ?
//       `,
//       [username, username]
//     );
//     const user = rows[0];

//     const [pendingOrders] = await connection.execute(
//       `
//       SELECT * FROM neworder WHERE approval_status = 'pending'
//       `
//     );

//     // await connection.end();
//     const pendingOrdersCount = pendingOrders.length;

//     if (!user) {
//       return <p className="text-red-600">User not found</p>;
//     }

//     return (
//       <div className="space-y-3 sm:space-y-4 md:space-y-6 max-w-full">
//         {/* Welcome Section - Enhanced Responsive Grid */}
//         <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-5 md:gap-7">
//           {/* Welcome Card - Takes 2 columns on large screens */}
//           <div className="lg:col-span-2 bg-white rounded-lg sm:rounded-xl shadow-md p-3 sm:p-4 md:p-6 lg:p-8">
//             <div className="flex items-center gap-2 sm:gap-3">
//               <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg sm:text-xl md:text-2xl shadow-lg flex-shrink-0">
//                 {user.username.charAt(0).toUpperCase()}
//               </div>
//               <div className="space-y-0.5 sm:space-y-1 flex-1 min-w-0">
//                 <h1 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-semibold text-gray-900 tracking-tight break-words">
//                   Welcome,{" "}
//                   <span className="text-blue-600 break-all">
//                     {user.username}
//                   </span>
//                 </h1>
//                 <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">
//                   Role:{" "}
//                   <span className="text-gray-700 font-semibold">
//                     {user.userRole}
//                   </span>
//                 </p>
//               </div>
//             </div>
//           </div>

//           {/* Admin Stats Card - 1 column on large screens */}
//           <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-4 md:p-6 text-white">
//             <div className="flex flex-col h-full justify-between min-h-[100px]">
//               <div>
//                 <p className="text-xs sm:text-sm opacity-90 mb-1 sm:mb-2">
//                   Control Panel
//                 </p>
//                 <p className="text-2xl sm:text-3xl md:text-4xl font-bold">
//                   Admin
//                 </p>
//               </div>
//               <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/20">
//                 <p className="text-xs opacity-75">Full System Access</p>
//               </div>
//             </div>
//           </div>

//           {/* Admin Stats Card - 2 column on large screens */}
//           <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-4 md:p-6 text-white">
//             <div className="flex flex-col h-full justify-between min-h-[100px]">
//               <div>
//                 <p className="text-xs sm:text-sm opacity-90 mb-1 sm:mb-2">
//                   Pending Orders
//                 </p>
//                 <p className="text-2xl sm:text-3xl md:text-4xl font-bold">
//                   {pendingOrdersCount}
//                 </p>
//               </div>
//               <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/20">
//                 <a
//                   href="/admin-dashboard/order"
//                   className="px-4 py-2 bg-white text-purple-600 rounded-lg font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg hover:scale-105 transform duration-200"
//                 >
//                   View Orders →
//                 </a>
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* System Performance Dashboard - Featured Card */}
//         <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 rounded-xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
//           <div className="flex flex-col md:flex-row items-center justify-between gap-4">
//             <div className="text-white">
//               <h2 className="text-2xl md:text-3xl font-bold mb-2">
//                 📊 System Performance Dashboard
//               </h2>
//               <p className="text-white/90 text-sm md:text-base">
//                 Monitor sales, delivery, payments, services & installations in
//                 real-time
//               </p>
//               <div className="mt-4 flex flex-wrap gap-2">
//                 <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium">
//                   Sales Analytics
//                 </span>
//                 <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium">
//                   Delivery Tracking
//                 </span>
//                 <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium">
//                   Payment Status
//                 </span>
//                 <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium">
//                   Service Metrics
//                 </span>
//               </div>
//             </div>
//             <a
//               href="/admin-dashboard/stats"
//               className="px-8 py-4 bg-white text-purple-600 rounded-lg font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg hover:scale-105 transform duration-200"
//             >
//               View Dashboard →
//             </a>
//           </div>
//         </div>

//         {/* Stats Overview - Responsive Grid */}
//         {/* <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
//           <div className="bg-white rounded-xl shadow-md p-4 md:p-5 hover:shadow-lg transition-shadow">
//             <p className="text-xs md:text-sm text-gray-500 mb-1">Total Users</p>
//             <p className="text-2xl md:text-3xl font-bold text-gray-900">-</p>
//           </div>
//           <div className="bg-white rounded-xl shadow-md p-4 md:p-5 hover:shadow-lg transition-shadow">
//             <p className="text-xs md:text-sm text-gray-500 mb-1">Active Tasks</p>
//             <p className="text-2xl md:text-3xl font-bold text-blue-600">-</p>
//           </div>
//           <div className="bg-white rounded-xl shadow-md p-4 md:p-5 hover:shadow-lg transition-shadow">
//             <p className="text-xs md:text-sm text-gray-500 mb-1">Pending</p>
//             <p className="text-2xl md:text-3xl font-bold text-orange-600">-</p>
//           </div>
//           <div className="bg-white rounded-xl shadow-md p-4 md:p-5 hover:shadow-lg transition-shadow">
//             <p className="text-xs md:text-sm text-gray-500 mb-1">Completed</p>
//             <p className="text-2xl md:text-3xl font-bold text-green-600">-</p>
//           </div>
//         </div> */}

//         {/* Tasks Section - Full width responsive with better padding */}
//         <div className="bg-white rounded-lg sm:rounded-xl shadow-md overflow-hidden">
//           <div className="p-3 sm:p-4 md:p-6 border-b border-gray-200">
//             <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900">
//               Upcoming Tasks
//             </h2>
//           </div>
//           <div className="overflow-x-auto">
//             <UpcomingTasks leadSource={username} />
//           </div>
//         </div>
//       </div>
//     );
//   } catch (error) {
//     console.error("Dashboard error:", error.message);
//     return <p className="text-red-600">Failed to load dashboard</p>;
//   }
// }

// app/admin-dashboard/page.jsx
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { TextEncoder as NodeTextEncoder } from "util";
import { getDbConnection } from "@/lib/db";
import UpcomingTasks from "@/components/task/UpcomingTasksAdmin";
// import UpcomingLeads from "@/components/Leads/UpcommingLeads";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

const TextEncoderImpl =
  typeof TextEncoder !== "undefined" ? TextEncoder : NodeTextEncoder;

export default async function UserDashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return <p className="text-red-600">Unauthorized</p>;
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoderImpl().encode(JWT_SECRET)
    );

    const username = payload.username;

    const connection = await getDbConnection();

    const [rows] = await connection.execute(
      `
      SELECT username, email, empId, userRole FROM emplist WHERE username = ?
      UNION
      SELECT username, email, empId, userRole FROM rep_list WHERE username = ?
      `,
      [username, username]
    );
    const user = rows[0];

    const [pendingOrders] = await connection.execute(
      `
      SELECT * FROM neworder WHERE approval_status = 'pending'
      `
    );

    // await connection.end();
    const pendingOrdersCount = pendingOrders.length;

    if (!user) {
      return <p className="text-red-600">User not found</p>;
    }

    return (
      <div className="space-y-3 sm:space-y-4 md:space-y-6 max-w-full">
        {/* Welcome Section - Enhanced Responsive Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-5 md:gap-7">
          {/* Welcome Card - Takes 2 columns on large screens */}
          {/* <div className="lg:col-span-2 bg-white rounded-lg sm:rounded-xl shadow-md p-3 sm:p-4 md:p-6 lg:p-8">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg sm:text-xl md:text-2xl shadow-lg flex-shrink-0">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="space-y-0.5 sm:space-y-1 flex-1 min-w-0">
                <h1 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-semibold text-gray-900 tracking-tight break-words">
                  Welcome,{" "}
                  <span className="text-blue-600 break-all">
                    {user.username}
                  </span>
                </h1>
                <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">
                  Role:{" "}
                  <span className="text-gray-700 font-semibold">
                    {user.userRole}
                  </span>
                </p>
              </div>
            </div>
          </div> */}

          {/* Admin Stats Card - 1 column on large screens */}
          {/* <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-4 md:p-6 text-white">
            <div className="flex flex-col h-full justify-between min-h-[100px]">
              <div>
                <p className="text-xs sm:text-sm opacity-90 mb-1 sm:mb-2">
                  Control Panel
                </p>
                <p className="text-2xl sm:text-3xl md:text-4xl font-bold">
                  Admin
                </p>
              </div>
              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/20">
                <p className="text-xs opacity-75">Full System Access</p>
              </div>
            </div>
          </div> */}

          {/* Admin Stats Card - 2 column on large screens */}
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-4 md:p-6 text-white">
            <div className="flex flex-col h-full justify-between min-h-[100px]">
              <div>
                <p className="text-xs sm:text-sm opacity-90 mb-1 sm:mb-2">
                  Pending Orders
                </p>
                <p className="text-2xl sm:text-3xl md:text-4xl font-bold">
                  {pendingOrdersCount}
                </p>
              </div>
              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/20">
                <a
                  href="/admin-dashboard/order"
                  className="px-4 py-2 bg-white text-purple-600 rounded-lg font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg hover:scale-105 transform duration-200"
                >
                  View Orders →
                </a>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-4 md:p-6 text-white">
            <div className="flex flex-col h-full justify-between min-h-[100px]">
              <div className="text-white">
                <h2 className="text-xl md:text-xl font-bold mb-2">
                  📊 System Performance Dashboard
                </h2>
              </div>
              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/20">
                <a
                  href="/admin-dashboard/stats"
                  className="px-4 py-2 bg-white text-purple-600 rounded-lg font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg hover:scale-105 transform duration-200"
                >
                  View Dashboard →
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* System Performance Dashboard - Featured Card */}
        {/* <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 rounded-xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-white">
              <h2 className="text-2xl md:text-3xl font-bold mb-2">
                📊 System Performance Dashboard
              </h2>
              <p className="text-white/90 text-sm md:text-base">
                Monitor sales, delivery, payments, services & installations in
                real-time
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium">
                  Sales Analytics
                </span>
                <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium">
                  Delivery Tracking
                </span>
                <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium">
                  Payment Status
                </span>
                <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium">
                  Service Metrics
                </span>
              </div>
            </div>
            <a
              href="/admin-dashboard/stats"
              className="px-8 py-4 bg-white text-purple-600 rounded-lg font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg hover:scale-105 transform duration-200"
            >
              View Dashboard →
            </a>
          </div>
        </div> */}

        {/* Stats Overview - Responsive Grid */}
        {/* <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div className="bg-white rounded-xl shadow-md p-4 md:p-5 hover:shadow-lg transition-shadow">
            <p className="text-xs md:text-sm text-gray-500 mb-1">Total Users</p>
            <p className="text-2xl md:text-3xl font-bold text-gray-900">-</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4 md:p-5 hover:shadow-lg transition-shadow">
            <p className="text-xs md:text-sm text-gray-500 mb-1">Active Tasks</p>
            <p className="text-2xl md:text-3xl font-bold text-blue-600">-</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4 md:p-5 hover:shadow-lg transition-shadow">
            <p className="text-xs md:text-sm text-gray-500 mb-1">Pending</p>
            <p className="text-2xl md:text-3xl font-bold text-orange-600">-</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4 md:p-5 hover:shadow-lg transition-shadow">
            <p className="text-xs md:text-sm text-gray-500 mb-1">Completed</p>
            <p className="text-2xl md:text-3xl font-bold text-green-600">-</p>
          </div>
        </div> */}

        {/* Tasks Section - Full width responsive with better padding */}
        {/* <div className="bg-white rounded-lg sm:rounded-xl shadow-md overflow-hidden">
          <div className="p-3 sm:p-4 md:p-6 border-b border-gray-200">
            <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900">
              Upcoming Tasks
            </h2>
          </div>
          <div className="overflow-x-auto">
            <UpcomingTasks leadSource={username} />
          </div>
        </div> */}
      </div>
    );
  } catch (error) {
    console.error("Dashboard error:", error.message);
    return <p className="text-red-600">Failed to load dashboard</p>;
  }
}
