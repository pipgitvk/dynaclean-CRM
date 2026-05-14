ALTER TABLE task ADD COLUMN parent_recurring_task_id INT NULL;
ALTER TABLE task ADD INDEX idx_task_parent_recurring_task_id (parent_recurring_task_id);
