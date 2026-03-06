// app/api/blogs/route.js
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

function toAbsoluteImageUrl(imagePath) {
  if (!imagePath) return "";
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) return imagePath;
  const base = process.env.NEXT_PUBLIC_BASE_URL || "";
  return base ? `${base.replace(/\/$/, "")}${imagePath}` : imagePath;
}

// GET all blogs
export async function GET() {
  try {
    const db = await getDbConnection();
    const [rows] = await db.query(
      `SELECT id, title, slug, image_path, created_at, updated_at, status, category FROM blogs`
    );
    const blogs = rows.map((b) => {
      const displayUrl = toAbsoluteImageUrl(b.image_path);
      return {
        ...b,
        image_path: b.image_path,
        image_url: displayUrl,
      };
    });
    return NextResponse.json({ blogs });
  } catch (error) {
    console.error("Error fetching blogs:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 }
    );
  }
}

// POST a new blog (handles image upload and data saving)
export async function POST(request) {
  try {
    const formData = await request.formData();
    const title = formData.get("title");
    const slug = formData.get("slug");
    const content = formData.get("content");
    const meta_tags = formData.get("meta_tags");
    const og_tags = formData.get("og_tags");
    const category = formData.get("category");
    const status = formData.get("status");
    const created_by = formData.get("created_by");
    const imageFile = formData.get("image");

    let image_path = "";
    if (imageFile && imageFile instanceof File) {
      try {
        image_path = await uploadBlogImageToCloudinary(imageFile);
      } catch (err) {
        console.error("Cloudinary upload error:", err);
        return NextResponse.json(
          { message: "Failed to upload image. Check Cloudinary config." },
          { status: 500 }
        );
      }
    }

    const db = await getDbConnection();

    // Check if slug already exists
    const [existing] = await db.query("SELECT id FROM blogs WHERE slug = ?", [slug]);
    if (existing.length > 0) {
      return NextResponse.json(
        { message: "Slug already exists. Please use a unique slug." },
        { status: 409 }
      );
    }

    const [result] = await db.query(
      `INSERT INTO blogs (title, slug, content, image_path, meta_tags, og_tags, created_by, category, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, slug, content, image_path, meta_tags, og_tags, created_by, category, status]
    );
    // db.end();
    
    return NextResponse.json({ message: "Blog created successfully.", blogId: result.insertId });
  } catch (error) {
    console.error("Error creating blog:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 }
    );
  }
}