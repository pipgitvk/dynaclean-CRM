/**
 * `task` / `task_followup` use manual `id` PRIMARY KEY (no AUTO_INCREMENT).
 * All inserts must allocate the next id explicitly.
 */

export async function repairTaskZeroPrimaryKeys(conn) {
  const [zeroTasks] = await conn.execute(
    "SELECT id FROM task WHERE id = 0 LIMIT 1"
  );
  if (zeroTasks.length > 0) {
    const [[{ max_id }]] = await conn.execute(
      "SELECT COALESCE(MAX(id), 0) AS max_id FROM task"
    );
    const newId = Number(max_id) + 1;
    await conn.execute("UPDATE task SET id = ? WHERE id = 0", [newId]);
  }

  const [zeroFollowups] = await conn.execute(
    "SELECT id FROM task_followup WHERE id = 0 LIMIT 1"
  );
  if (zeroFollowups.length > 0) {
    const [[{ max_id }]] = await conn.execute(
      "SELECT COALESCE(MAX(id), 0) AS max_id FROM task_followup"
    );
    const newId = Number(max_id) + 1;
    await conn.execute("UPDATE task_followup SET id = ? WHERE id = 0", [newId]);
  }
}

/** @returns {{ id: number, task_id: number }} */
export async function allocateNextTaskRowIds(conn) {
  await repairTaskZeroPrimaryKeys(conn);
  const [[row]] = await conn.execute(
    `SELECT COALESCE(MAX(id), 0) AS max_id, COALESCE(MAX(task_id), 999) AS max_task_id
     FROM task FOR UPDATE`
  );
  const maxId = Number(row?.max_id) || 0;
  const maxTaskId = Number(row?.max_task_id) || 999;
  return {
    id: maxId + 1,
    task_id: maxTaskId + 1,
  };
}

export async function allocateNextTaskFollowupId(conn) {
  await repairTaskZeroPrimaryKeys(conn);
  const [[row]] = await conn.execute(
    "SELECT COALESCE(MAX(id), 0) AS max_id FROM task_followup FOR UPDATE"
  );
  return Number(row?.max_id || 0) + 1;
}
