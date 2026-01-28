// app/api/blogs/[slug]/route.js
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

// GET single blog by slug
export async function GET(request, { params }) {
  try {
    const { slug } = params;
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
    const { slug } = params;

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

    let finalImagePath = image_path;
    if (imageFile) {
      // const filePath = await saveImage(imageFile);
      // finalImagePath = filePath;
      console.log("New image file received but not processed yet.");
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
    const { slug } = params;
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
