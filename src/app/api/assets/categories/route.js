import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

// GET /api/assets/categories - Fetch all asset categories
export async function GET(req) {
  const payload = await getSessionPayload();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const conn = await getDbConnection();

    // Fetch categories from database
    const [categories] = await conn.execute(`
      SELECT id, category_name, category_type, created_at
      FROM asset_categories
      ORDER BY category_type ASC, category_name ASC
    `);

    return NextResponse.json({ success: true, categories: categories || [] });
  } catch (err) {
    console.error("[assets/categories GET]", err?.message);
    return NextResponse.json({ error: "DB error", detail: err?.message }, { status: 500 });
  }
}

// POST /api/assets/categories - Add new asset category
export async function POST(req) {
  const payload = await getSessionPayload();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { categoryName, categoryType } = body;

    if (!categoryName || !categoryType) {
      return NextResponse.json(
        { error: "categoryName and categoryType are required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    // Check if category already exists
    const [[existing]] = await conn.execute(
      `SELECT id FROM asset_categories WHERE LOWER(category_name) = LOWER(?) AND category_type = ?`,
      [categoryName, categoryType]
    );

    if (existing) {
      return NextResponse.json(
        { error: "Category already exists" },
        { status: 409 }
      );
    }

    // Insert new category
    const [result] = await conn.execute(
      `INSERT INTO asset_categories (category_name, category_type, created_at) VALUES (?, ?, NOW())`,
      [categoryName, categoryType]
    );

    return NextResponse.json(
      {
        success: true,
        message: "Category added successfully",
        category: {
          id: result.insertId,
          category_name: categoryName,
          category_type: categoryType,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[assets/categories POST]", err?.message);
    return NextResponse.json({ error: "DB error", detail: err?.message }, { status: 500 });
  }
}
