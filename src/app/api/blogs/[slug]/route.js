// app/api/blogs/[slug]/route.js
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadBlogImageToCloudinary(file) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { folder: "blogs" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result?.secure_url || "");
        }
      )
      .end(buffer);
  });
}

// GET single blog by slug
export async function GET(request, { params }) {
  try {
    const { slug } = await params;
    const db = await getDbConnection();
    const [rows] = await db.query(`SELECT * FROM blogs WHERE slug = ?`, [slug]);
    // db.end();

    if (rows.length === 0) {
      return NextResponse.json({ message: "Blog not found." }, { status: 404 });
    }
    return NextResponse.json({ blog: rows[0] });
  } catch (error) {
    console.error("Error fetching blog data:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 },
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const { slug } = await params;

    // Correctly handle FormData from the request
    const formData = await request.formData();
    const title = formData.get("title");
    const content = formData.get("content");
    const image_path = formData.get("image_path");
    const meta_tags = formData.get("meta_tags");
    const og_tags = formData.get("og_tags");
    const category = formData.get("category");
    const status = formData.get("status");
    const imageFile = formData.get("image"); // This is the file object

    const db = await getDbConnection();

    let finalImagePath = image_path || "";
    if (imageFile && imageFile instanceof File) {
      try {
        finalImagePath = await uploadBlogImageToCloudinary(imageFile);
      } catch (err) {
        console.error("Cloudinary upload error:", err);
        return NextResponse.json(
          { message: "Failed to upload image. Check Cloudinary config." },
          { status: 500 }
        );
      }
    }

    const [result] = await db.query(
      `UPDATE blogs SET title = ?, content = ?, image_path = ?, meta_tags = ?, og_tags = ?, category = ?, status = ?, updated_at = NOW() WHERE slug = ?`,
      [
        title,
        content,
        finalImagePath,
        meta_tags,
        og_tags,
        category,
        status,
        slug,
      ],
    );
    // db.end();

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { message: "Blog not found or no changes made." },
        { status: 404 },
      );
    }
    return NextResponse.json({ message: "Blog updated successfully." });
  } catch (error) {
    console.error("Error updating blog:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 },
    );
  }
}

// DELETE a blog by slug
export async function DELETE(request, { params }) {
  try {
    const { slug } = await params;
    const db = await getDbConnection();

    const [result] = await db.query(`DELETE FROM blogs WHERE slug = ?`, [slug]);
    // db.end();

    if (result.affectedRows === 0) {
      return NextResponse.json({ message: "Blog not found." }, { status: 404 });
    }
    return NextResponse.json({ message: "Blog deleted successfully." });
  } catch (error) {
    console.error("Error deleting blog:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 },
    );
  }
}
