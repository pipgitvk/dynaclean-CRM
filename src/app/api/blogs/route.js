// app/api/blogs/route.js
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import fs from "fs/promises";
import path from "path";

// GET all blogs
export async function GET() {
  try {
    const db = await getDbConnection();
    const [rows] = await db.query(
      `SELECT id, title, slug, image_path, created_at, updated_at, status, category FROM blogs`
    );
    // db.end();
    return NextResponse.json({ blogs: rows });
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
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      const fileName = `${Date.now()}-${imageFile.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const filePath = path.join(process.cwd(), "public", "blogs", fileName);

      await fs.writeFile(filePath, buffer);
      image_path = `/blogs/${fileName}`;
    }

    const db = await getDbConnection();

    // Check if slug already exists
    const [existing] = await db.query("SELECT id FROM blogs WHERE slug = ?", [slug]);
    if (existing.length > 0) {
      // Clean up uploaded image if slug exists
      if (image_path) {
        await fs.unlink(path.join(process.cwd(), "public", image_path));
      }
      // db.end();
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