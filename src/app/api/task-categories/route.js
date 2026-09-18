import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { DEFAULT_TASK_CATEGORIES } from "@/lib/taskCategories";
import { ensureTaskCustomCategoriesTable } from "@/lib/ensureTaskCustomCategoriesTable";

function normalizeCategoryName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export async function GET() {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conn = await getDbConnection();
    await ensureTaskCustomCategoriesTable(conn);

    const [rows] = await conn.execute(
      `SELECT id, category_name, created_at
       FROM task_custom_categories
       WHERE username = ?
       ORDER BY category_name ASC`,
      [payload.username],
    );

    return NextResponse.json({
      success: true,
      defaults: DEFAULT_TASK_CATEGORIES,
      custom: rows || [],
    });
  } catch (error) {
    console.error("task-categories GET:", error);
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const categoryName = normalizeCategoryName(body?.category_name);

    if (!categoryName) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 },
      );
    }

    if (categoryName.length > 100) {
      return NextResponse.json(
        { error: "Category name must be 100 characters or less" },
        { status: 400 },
      );
    }

    const conn = await getDbConnection();
    await ensureTaskCustomCategoriesTable(conn);

    const lowerName = categoryName.toLowerCase();
    const defaultExists = DEFAULT_TASK_CATEGORIES.some(
      (item) => item.toLowerCase() === lowerName,
    );
    if (defaultExists) {
      return NextResponse.json(
        { error: "This category already exists in the default list" },
        { status: 409 },
      );
    }

    const [existing] = await conn.execute(
      `SELECT id, category_name
       FROM task_custom_categories
       WHERE username = ? AND LOWER(category_name) = ?
       LIMIT 1`,
      [payload.username, lowerName],
    );

    if (existing?.length) {
      return NextResponse.json({
        success: true,
        category: existing[0],
        message: "Category already exists",
      });
    }

    const [result] = await conn.execute(
      `INSERT INTO task_custom_categories (username, category_name)
       VALUES (?, ?)`,
      [payload.username, categoryName],
    );

    return NextResponse.json({
      success: true,
      category: {
        id: result.insertId,
        category_name: categoryName,
      },
    });
  } catch (error) {
    console.error("task-categories POST:", error);
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 },
    );
  }
}
