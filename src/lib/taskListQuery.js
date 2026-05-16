/** Shared SELECT columns for task manager lists (includes automatic-task flag). */
export const TASK_LIST_SELECT_SQL = `
  t.task_id,
  t.taskname,
  t.createdby,
  t.taskassignto,
  (
    SELECT tf.reassign
    FROM task_followup tf
    WHERE tf.task_id = t.task_id
    ORDER BY tf.id DESC
    LIMIT 1
  ) AS reassign,
  (
    SELECT tf.taskassignto
    FROM task_followup tf
    WHERE tf.task_id = t.task_id
    ORDER BY tf.id ASC
    LIMIT 1
  ) AS first_assignto,
  t.followed_date,
  t.next_followup_date,
  t.status,
  t.task_completion_date,
  COALESCE(t.is_auto_generated, 0) AS is_automatic
`;
