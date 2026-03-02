// import { NextResponse } from "next/server";
// import { v2 as cloudinary } from "cloudinary";
// import { getDbConnection } from "@/lib/db";
// import { jwtVerify } from "jose";

// // Cloudinary config
// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
// });

// export async function POST(req) {
//   try {
//     const token = req.cookies.get("token")?.value;
//     if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

//     const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
//     const username = payload.username;

//     const data = await req.formData();

//     // Extract fields
//     const fields = Object.fromEntries(data.entries());
//     const attachments = data.getAll("attachments");

//     const uploadedFiles = [];

//     for (const file of attachments) {
//       if (typeof file === "object") {
//         const buffer = Buffer.from(await file.arrayBuffer());
//         const upload = await new Promise((resolve, reject) => {
//           cloudinary.uploader.upload_stream(
//             { folder: "expense_attachments" },
//             (error, result) => {
//               if (error) reject(error);
//               else resolve(result.secure_url);
//             }
//           ).end(buffer);
//         });

//         uploadedFiles.push(upload);
//       }
//     }

//     const attachmentsStr = uploadedFiles.join(", ");

//     const conn = await getDbConnection();

//     await conn.execute(
//       `INSERT INTO expenses (
//         username, TravelDate, FromLocation, Tolocation, distance,
//         description, person_name, person_contact, ConveyanceMode,
//         TicketCost, HotelCost, MealsCost, OtherExpenses,
//         attachments, approval_status
//       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//       [
//         username,
//         fields.TravelDate,
//         fields.FromLocation,
//         fields.Tolocation,
//         fields.distance,
//         fields.description,
//         fields.person_name,
//         fields.person_contact,
//         fields.ConveyanceMode,
//         fields.TicketCost,
//         fields.HotelCost,
//         fields.MealsCost,
//         fields.OtherExpenses,
//         attachmentsStr,
//         "Pending",
//       ]
//     );

//         // await conn.end();

//     return NextResponse.json({ success: true });
//   } catch (err) {
//     console.error("❌ Upload error:", err);
//     return NextResponse.json({ error: "Server error" }, { status: 500 });
//   }
// }






import { NextResponse } from "next/server";
// Removed Cloudinary import
// import { v2 as cloudinary } from "cloudinary";
import { getDbConnection } from "@/lib/db";
import { jwtVerify } from "jose";
import fs from "fs/promises"; // For asynchronous file operations
import path from "path"; // For path manipulation

const UPLOAD_DIR = path.join(process.cwd(), "public", "expense_attachments");

export async function POST(req) {
  try {
    console.log("[expense-api] POST /api/expenses - new expense submission");
    const token = req.cookies.get("token")?.value;
    if (!token) {
      console.error("[expense-api] ERROR: Unauthorized - no token");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
    const username = payload.username;
    console.log(`[expense-api] user=${username}`);

    const data = await req.formData();
    const fields = Object.fromEntries(data.entries());
    const attachments = data.getAll("attachments");

    const savedFilePaths = [];
    console.log(`[expense-api] UPLOAD_DIR=${UPLOAD_DIR} attachmentsCount=${attachments?.length || 0}`);

    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    for (const file of attachments) {
      if (file instanceof File) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = `${Date.now()}-${file.name}`;
        const filePath = path.join(UPLOAD_DIR, fileName);

        await fs.writeFile(filePath, buffer);
        const publicPath = `/expense_attachments/${fileName}`;
        savedFilePaths.push(publicPath);
        console.log(`[expense-api] SAVED file="${file.name}" -> ${filePath} (public: ${publicPath})`);
      } else {
        console.warn("[expense-api] SKIPPED non-File attachment:", typeof file, file);
      }
    }

    const attachmentsStr = savedFilePaths.join(", ");
    console.log(`[expense-api] DB will store attachments="${attachmentsStr}"`);

    const conn = await getDbConnection();

    await conn.execute(
      `INSERT INTO expenses (
        username, TravelDate, FromLocation, Tolocation, distance,
        description, person_name, person_contact, ConveyanceMode,
        TicketCost, HotelCost, MealsCost, OtherExpenses,
        attachments, approval_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        username,
        fields.TravelDate,
        fields.FromLocation,
        fields.Tolocation,
        fields.distance,
        fields.description,
        fields.person_name,
        fields.person_contact,
        fields.ConveyanceMode,
        fields.TicketCost,
        fields.HotelCost,
        fields.MealsCost,
        fields.OtherExpenses,
        attachmentsStr, // This now contains comma-separated local paths
        "Pending",
      ]
    );

        // await conn.end();

    console.log("[expense-api] SUCCESS expense created");
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[expense-api] ERROR:", err?.message || err);
    console.error("[expense-api] ERROR stack:", err?.stack);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}