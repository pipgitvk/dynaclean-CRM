import { access, rename as fsRename } from "fs/promises";
import path from "path";
import { getDbConnection } from "@/lib/db";

/**
 * Updates `rep_list.username` and propagates the value everywhere we know about,
 * plus FK children discovered from information_schema. Use inside a controlled
 * admin flow only.
 *
 * @param {string} oldUsername - Current login name (from URL / form)
 * @param {string} newUsername - Desired new login name (trimmed)
 * @returns {{ actualOld: string, actualNew: string }}
 */
export async function renameRepListUsername(oldUsername, newUsername) {
  const actualNew = String(newUsername || "").trim();
  if (!actualNew) {
    throw new Error("New username is required.");
  }
  if (actualNew.length > 191) {
    throw new Error("Username is too long.");
  }

  const pool = await getDbConnection();
  const conn = await pool.getConnection();

  const [userRows] = await conn.query(
    `SELECT username FROM rep_list WHERE username = ? OR LOWER(username) = LOWER(?) LIMIT 1`,
    [oldUsername, oldUsername]
  );
  if (!userRows.length) {
    conn.release();
    throw new Error("Employee not found.");
  }
  const actualOld = userRows[0].username;

  if (actualOld === actualNew) {
    conn.release();
    return { actualOld, actualNew };
  }

  const [taken] = await conn.query(
    `SELECT username FROM rep_list WHERE username = ? AND NOT (username <=> ?)`,
    [actualNew, actualOld]
  );
  if (taken.length > 0) {
    conn.release();
    throw new Error("That username is already taken.");
  }

  const [refs] = await conn.query(
    `SELECT DISTINCT TABLE_NAME, COLUMN_NAME
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND REFERENCED_TABLE_NAME = 'rep_list'
       AND REFERENCED_COLUMN_NAME = 'username'
       AND TABLE_NAME != 'rep_list'`
  );

  const extra = [
    ["employee_salary_structure", "username"],
    ["employee_attendance_schedule", "username"],
    ["employee_profiles", "username"],
    ["employee_leaves", "username"],
    ["employee_profile_submissions", "username"],
  ];

  const updates = new Map();
  for (const r of refs) {
    updates.set(`${r.TABLE_NAME}.${r.COLUMN_NAME}`, r);
  }
  for (const [t, c] of extra) {
    if (!updates.has(`${t}.${c}`)) {
      updates.set(`${t}.${c}`, { TABLE_NAME: t, COLUMN_NAME: c });
    }
  }

  const newDir = path.join(process.cwd(), "public", "employees", actualNew);
  let newDirExists = false;
  try {
    await access(newDir);
    newDirExists = true;
  } catch (e) {
    if (e.code !== "ENOENT") {
      conn.release();
      throw e;
    }
  }
  if (newDirExists) {
    conn.release();
    throw new Error(
      `A profile folder for "${actualNew}" already exists. Remove or rename it first.`
    );
  }

  const [picRows] = await conn.query(
    `SELECT profile_pic FROM rep_list WHERE username = ? LIMIT 1`,
    [actualOld]
  );
  let nextProfilePic = picRows[0]?.profile_pic ?? null;
  if (
    nextProfilePic &&
    typeof nextProfilePic === "string" &&
    nextProfilePic.includes(`/employees/${actualOld}/`)
  ) {
    nextProfilePic = nextProfilePic.replace(
      `/employees/${actualOld}/`,
      `/employees/${actualNew}/`
    );
  }

  try {
    await conn.beginTransaction();
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");

    for (const { TABLE_NAME, COLUMN_NAME } of updates.values()) {
      try {
        await conn.query(
          `UPDATE \`${TABLE_NAME}\` SET \`${COLUMN_NAME}\` = ? WHERE \`${COLUMN_NAME}\` = ?`,
          [actualNew, actualOld]
        );
      } catch (err) {
        if (err.code === "ER_NO_SUCH_TABLE" || err.code === "42S02") {
          continue;
        }
        throw err;
      }
    }

    await conn.query(
      `UPDATE rep_list SET reporting_manager = ? WHERE reporting_manager = ?`,
      [actualNew, actualOld]
    );

    await conn.query(
      `UPDATE rep_list SET username = ?, profile_pic = ? WHERE username = ?`,
      [actualNew, nextProfilePic, actualOld]
    );

    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    await conn.commit();
  } catch (err) {
    try {
      await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    } catch (_) {
      /* ignore */
    }
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const oldDir = path.join(process.cwd(), "public", "employees", actualOld);
  try {
    await access(oldDir);
    await fsRename(oldDir, newDir);
  } catch (e) {
    if (e.code !== "ENOENT") {
      console.error("renameRepListUsername: profile folder rename failed:", e);
    }
  }

  return { actualOld, actualNew };
}
